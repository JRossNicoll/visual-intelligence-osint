"""Operator service - alert generation, deduplication, ranking, and explainability.

This is a thin layer on top of the intelligence engine that transforms
raw intelligence outputs into operator-friendly alerts and views.
"""

import hashlib
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.redis import redis_manager
from app.models.alert import Alert
from app.models.intelligence import (
    BehaviorRecord,
    EntityProfile,
    IntelligenceInsight,
    TemporalEvent,
)

logger = logging.getLogger(__name__)

SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1}
DEDUP_WINDOW_SECONDS = 300


class ExplainabilityEngine:
    """Converts technical intelligence outputs to operator-friendly language."""

    @staticmethod
    def simplify_anomaly(anomaly_data: dict) -> str:
        score = anomaly_data.get("anomaly_score", 0)
        explanation = anomaly_data.get("explanation", "")
        if "time" in explanation.lower() or "hour" in explanation.lower():
            if score > 0.7:
                return "Appeared at a highly unusual time, far outside normal patterns"
            elif score > 0.4:
                return "Appeared at an unusual time compared to typical activity"
            else:
                return "Slight deviation from normal time patterns"
        if "location" in explanation.lower():
            if score > 0.7:
                return "Appeared at an unexpected location with no prior history"
            elif score > 0.4:
                return "Appeared at a location rarely visited before"
            else:
                return "Minor location deviation from normal patterns"
        if score > 0.7:
            return "Highly anomalous behavior detected - significant deviation from baseline"
        elif score > 0.4:
            return "Unusual behavior detected - moderate deviation from normal patterns"
        elif score > 0.2:
            return "Slightly unusual activity detected"
        return "Within normal behavioral range"

    @staticmethod
    def simplify_coordination(pattern: dict) -> str:
        pattern_type = pattern.get("type", "co_occurrence")
        entities = pattern.get("entities", [])
        confidence = pattern.get("confidence", 0)
        count = len(entities)
        if pattern_type == "staggered_pair":
            if count >= 2:
                return (
                    f"{count} entities showing coordinated staggered movement - "
                    "one appears shortly after another consistently"
                )
            return "Two entities showing a follow pattern"
        if pattern_type == "convoy":
            return f"{count} entities moving together as a group across locations"
        if pattern_type == "co_occurrence":
            if confidence > 0.8:
                return f"{count} entities repeatedly appearing together - strong coordination signal"
            return f"{count} entities co-occurring - possible coordination"
        return f"Coordinated activity detected involving {count} entities"

    @staticmethod
    def simplify_group_anomaly(anomaly: dict) -> str:
        anomaly_type = anomaly.get("anomaly_type", "")
        z_score = anomaly.get("z_score", 0)
        if anomaly_type == "unusual_gathering":
            if z_score > 10:
                return "Extremely unusual gathering - far more entities than normal in this area"
            elif z_score > 5:
                return "Unusual gathering detected - significantly more entities than expected"
            return "Notable grouping of entities in this area"
        if anomaly_type == "interaction_surge":
            if z_score > 10:
                return "Massive spike in entity interactions - highly unusual activity level"
            elif z_score > 5:
                return "Significant increase in entity interactions above baseline"
            return "Elevated interaction levels detected"
        if anomaly_type == "new_cluster":
            return "New group formation detected - entities not previously seen together"
        return "Unusual group-level activity detected"

    @staticmethod
    def simplify_risk(risk_data: dict) -> str:
        risk_level = risk_data.get("risk_level", "low")
        factors = risk_data.get("risk_factors", [])
        level_map = {"critical": "Critical risk level", "high": "High risk level",
                     "medium": "Elevated risk", "low": "Low risk"}
        summary = level_map.get(risk_level, "Low risk")
        if factors:
            top_factors = sorted(factors, key=lambda f: f.get("weight", 0), reverse=True)[:2]
            descs = [f.get("description", f.get("factor", "")) for f in top_factors]
            descs = [d for d in descs if d]
            if descs:
                summary += " - " + "; ".join(descs)
        return summary

    @staticmethod
    def simplify_behavior(behavior: dict) -> str:
        behavior_type = behavior.get("behavior_type", "")
        confidence = behavior.get("confidence", 0)
        type_descriptions = {
            "loitering": "Entity remaining in one area for an extended period",
            "repeated_visit": "Entity returning to the same location multiple times",
            "convoy": "Entity traveling in coordination with others",
            "short_stay": "Brief appearance at this location",
            "long_stay": "Extended presence at this location",
            "routine": "Following a regular, predictable schedule",
            "anomaly": "Behavior deviating from established patterns",
        }
        base = type_descriptions.get(behavior_type, f"Detected behavior: {behavior_type}")
        if confidence > 0.8:
            return base + " (high confidence)"
        elif confidence > 0.5:
            return base
        return base + " (preliminary assessment)"

    @staticmethod
    def generate_recommended_actions(alert_type: str, severity: str, context: dict) -> list[str]:
        actions = []
        if severity in ("critical", "high"):
            actions.append("Immediate review recommended")
        if alert_type == "coordination":
            actions.append("Review all involved entities for common connections")
            actions.append("Check historical co-occurrence patterns")
            if severity == "critical":
                actions.append("Consider adding all involved entities to active watchlist")
        elif alert_type == "anomaly":
            actions.append("Compare with entity normal behavior baseline")
            actions.append("Review recent location history for this entity")
        elif alert_type == "group_anomaly":
            actions.append("Monitor area for continued unusual activity")
            actions.append("Review entity composition of the group")
        elif alert_type == "risk_elevation":
            actions.append("Review risk factor breakdown")
            actions.append("Check associated entities for related risk changes")
        elif alert_type == "behavior":
            actions.append("Review entity timeline for context")
        return actions


class AlertPrioritizer:
    """Ranks, deduplicates, groups, and suppresses alerts."""

    @staticmethod
    def compute_priority_score(
        severity: str, confidence: float,
        risk_score: float = 0.0, entity_count: int = 1,
    ) -> float:
        severity_weight = SEVERITY_ORDER.get(severity, 1) / 4.0
        entity_factor = min(entity_count / 10.0, 1.0)
        priority = (
            0.40 * severity_weight
            + 0.25 * min(confidence, 1.0)
            + 0.20 * min(risk_score, 1.0)
            + 0.15 * entity_factor
        )
        return round(min(priority, 1.0), 4)

    @staticmethod
    def compute_dedup_hash(
        alert_type: str, entity_ids: list[str], location: str = "",
    ) -> str:
        sorted_entities = sorted(entity_ids) if entity_ids else []
        key = alert_type + ":" + ",".join(sorted_entities) + ":" + location
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    @staticmethod
    def should_suppress(severity: str, confidence: float) -> bool:
        if severity == "low" and confidence < 0.3:
            return True
        return False

    @staticmethod
    def group_related_alerts(alerts: list[dict]) -> list[dict]:
        entity_to_alerts: dict[str, list[int]] = defaultdict(list)
        for i, alert in enumerate(alerts):
            for eid in alert.get("entity_ids", []):
                entity_to_alerts[eid].append(i)
        parent = list(range(len(alerts)))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: int, b: int) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for indices in entity_to_alerts.values():
            for j in range(1, len(indices)):
                union(indices[0], indices[j])
        group_map: dict[int, str] = {}
        for i in range(len(alerts)):
            root = find(i)
            if root not in group_map:
                group_map[root] = f"group_{root}"
            alerts[i]["group_id"] = group_map[root]
        return alerts


class OperatorService:
    """Provides operator-focused views of intelligence data."""

    @staticmethod
    async def get_dashboard_summary(db: AsyncSession) -> dict:
        """Get aggregated dashboard data for the operator view."""
        now = datetime.now(timezone.utc)
        last_hour = now - timedelta(hours=1)
        last_24h = now - timedelta(hours=24)

        unread_result = await db.execute(
            select(func.count(Alert.id)).where(Alert.is_read == False)  # noqa: E712
        )
        unread_count = unread_result.scalar() or 0

        critical_result = await db.execute(
            select(func.count(Alert.id)).where(
                and_(Alert.severity == "critical", Alert.created_at >= last_24h)
            )
        )
        critical_count = critical_result.scalar() or 0

        high_risk_result = await db.execute(
            select(func.count(EntityProfile.id)).where(EntityProfile.risk_score >= 0.6)
        )
        high_risk_count = high_risk_result.scalar() or 0

        watchlist_count = 0
        watchlist_data = await redis_manager.get_json("operator:watchlist")
        if watchlist_data:
            watchlist_count = len(watchlist_data)

        recent_events_result = await db.execute(
            select(func.count(TemporalEvent.id)).where(
                TemporalEvent.timestamp >= last_hour
            )
        )
        recent_events_count = recent_events_result.scalar() or 0

        total_entities_result = await db.execute(
            select(func.count(EntityProfile.id))
        )
        total_entities = total_entities_result.scalar() or 0

        severity_breakdown = {}
        for sev in ["critical", "high", "medium", "low"]:
            sev_result = await db.execute(
                select(func.count(Alert.id)).where(
                    and_(Alert.severity == sev, Alert.created_at >= last_24h)
                )
            )
            severity_breakdown[sev] = sev_result.scalar() or 0

        return {
            "unread_alerts": unread_count,
            "critical_alerts_24h": critical_count,
            "high_risk_entities": high_risk_count,
            "watchlist_count": watchlist_count,
            "recent_events_1h": recent_events_count,
            "total_tracked_entities": total_entities,
            "severity_breakdown_24h": severity_breakdown,
            "timestamp": now.isoformat(),
        }

    @staticmethod
    async def get_prioritized_alerts(
        db: AsyncSession,
        severity: Optional[str] = None,
        alert_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> list[dict]:
        """Get alerts ranked by priority with deduplication and grouping."""
        conditions = []
        if severity:
            conditions.append(Alert.severity == severity)
        if alert_type:
            conditions.append(Alert.alert_type == alert_type)
        if unread_only:
            conditions.append(Alert.is_read == False)  # noqa: E712

        query = select(Alert)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(Alert.created_at.desc()).limit(limit * 2).offset(offset)

        result = await db.execute(query)
        raw_alerts = list(result.scalars().all())

        explainer = ExplainabilityEngine()
        alert_dicts: list[dict] = []
        seen_hashes: set[str] = set()

        for alert in raw_alerts:
            entity_ids: list[str] = []
            if alert.entity_id:
                entity_ids.append(alert.entity_id)
            if alert.metadata_json and alert.metadata_json.get("entity_ids"):
                entity_ids.extend(alert.metadata_json["entity_ids"])

            dedup_hash = AlertPrioritizer.compute_dedup_hash(
                alert.alert_type, entity_ids,
                alert.metadata_json.get("location", "") if alert.metadata_json else "",
            )
            if dedup_hash in seen_hashes:
                continue
            seen_hashes.add(dedup_hash)

            confidence = alert.confidence or 0.5
            if AlertPrioritizer.should_suppress(alert.severity, confidence):
                continue

            risk_score = 0.0
            if alert.metadata_json and "risk_score" in alert.metadata_json:
                risk_score = alert.metadata_json["risk_score"]

            priority = AlertPrioritizer.compute_priority_score(
                alert.severity, confidence, risk_score, len(entity_ids),
            )

            operator_explanation = alert.description or ""
            if alert.metadata_json:
                if alert.alert_type == "anomaly":
                    operator_explanation = explainer.simplify_anomaly(alert.metadata_json)
                elif alert.alert_type == "coordination":
                    operator_explanation = explainer.simplify_coordination(alert.metadata_json)
                elif alert.alert_type == "group_anomaly":
                    operator_explanation = explainer.simplify_group_anomaly(alert.metadata_json)

            actions = explainer.generate_recommended_actions(
                alert.alert_type, alert.severity, alert.metadata_json or {},
            )

            alert_dicts.append({
                "id": alert.id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "description": operator_explanation,
                "entity_ids": entity_ids,
                "confidence": confidence,
                "priority_score": priority,
                "is_read": alert.is_read,
                "is_acknowledged": alert.is_acknowledged,
                "recommended_actions": actions,
                "created_at": alert.created_at.isoformat(),
                "dedup_hash": dedup_hash,
            })

        alert_dicts.sort(key=lambda a: a["priority_score"], reverse=True)
        alert_dicts = AlertPrioritizer.group_related_alerts(alert_dicts)
        return alert_dicts[:limit]

    @staticmethod
    async def get_live_feed(
        db: AsyncSession,
        limit: int = 50,
        entity_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> list[dict]:
        """Get live event feed for operator monitoring."""
        if since is None:
            since = datetime.now(timezone.utc) - timedelta(hours=1)

        conditions = [TemporalEvent.timestamp >= since]
        if entity_id:
            conditions.append(TemporalEvent.entity_id == entity_id)

        query = (
            select(TemporalEvent)
            .where(and_(*conditions))
            .order_by(TemporalEvent.timestamp.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        events = list(result.scalars().all())

        return [
            {
                "id": event.id,
                "entity_id": event.entity_id,
                "event_type": event.event_type,
                "timestamp": event.timestamp.isoformat(),
                "location_id": event.location_id,
                "location_name": event.location_name or "Unknown",
                "confidence": event.confidence,
                "co_occurring_entities": event.co_occurring_entities or [],
                "hour_of_day": event.hour_of_day,
                "is_weekend": event.is_weekend,
            }
            for event in events
        ]

    @staticmethod
    async def get_watchlist(db: AsyncSession) -> list[dict]:
        """Get the operator watchlist with enriched entity data."""
        watchlist_data = await redis_manager.get_json("operator:watchlist") or {}
        enriched = []
        for entity_id, meta in watchlist_data.items():
            profile_result = await db.execute(
                select(EntityProfile).where(
                    EntityProfile.entity_id == entity_id
                )
            )
            profile = profile_result.scalar_one_or_none()
            entry: dict = {
                "entity_id": entity_id,
                "added_at": meta.get("added_at", ""),
                "reason": meta.get("reason", ""),
                "priority": meta.get("priority", "medium"),
            }
            if profile:
                entry.update({
                    "entity_type": profile.entity_type,
                    "risk_score": profile.risk_score,
                    "risk_level": profile.risk_level,
                    "last_seen": (
                        profile.last_seen.isoformat() if profile.last_seen else None
                    ),
                    "last_location": profile.last_location_name,
                    "visit_count": profile.visit_count,
                    "behavior_tags": profile.behavior_tags or [],
                })
            else:
                entry.update({
                    "entity_type": "unknown",
                    "risk_score": 0.0,
                    "risk_level": "low",
                    "last_seen": None,
                    "last_location": None,
                    "visit_count": 0,
                    "behavior_tags": [],
                })
            enriched.append(entry)
        enriched.sort(key=lambda e: e.get("risk_score", 0), reverse=True)
        return enriched

    @staticmethod
    async def add_to_watchlist(
        entity_id: str, reason: str = "", priority: str = "medium",
    ) -> dict:
        """Add an entity to the operator watchlist."""
        watchlist = await redis_manager.get_json("operator:watchlist") or {}
        watchlist[entity_id] = {
            "added_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
            "priority": priority,
        }
        await redis_manager.set_json("operator:watchlist", watchlist)
        return {"entity_id": entity_id, "status": "added"}

    @staticmethod
    async def remove_from_watchlist(entity_id: str) -> dict:
        """Remove an entity from the operator watchlist."""
        watchlist = await redis_manager.get_json("operator:watchlist") or {}
        if entity_id in watchlist:
            del watchlist[entity_id]
            await redis_manager.set_json("operator:watchlist", watchlist)
            return {"entity_id": entity_id, "status": "removed"}
        return {"entity_id": entity_id, "status": "not_found"}

    @staticmethod
    async def review_alert(db: AsyncSession, alert_id: str) -> Optional[dict]:
        """Mark an alert as reviewed."""
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        alert = result.scalar_one_or_none()
        if not alert:
            return None
        alert.is_read = True
        await db.flush()
        await db.refresh(alert)
        return {"id": alert.id, "status": "reviewed"}

    @staticmethod
    async def escalate_alert(db: AsyncSession, alert_id: str) -> Optional[dict]:
        """Escalate an alert - bump severity and mark acknowledged."""
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        alert = result.scalar_one_or_none()
        if not alert:
            return None
        severity_upgrade = {
            "low": "medium",
            "medium": "high",
            "high": "critical",
            "critical": "critical",
        }
        alert.severity = severity_upgrade.get(alert.severity, alert.severity)
        alert.is_read = True
        alert.metadata_json = alert.metadata_json or {}
        alert.metadata_json["escalated"] = True
        alert.metadata_json["escalated_at"] = datetime.now(timezone.utc).isoformat()
        await db.flush()
        await db.refresh(alert)
        await redis_manager.publish("alerts", {
            "alert_id": alert.id,
            "type": "escalation",
            "severity": alert.severity,
            "title": "[ESCALATED] " + alert.title,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return {
            "id": alert.id,
            "status": "escalated",
            "new_severity": alert.severity,
        }

    @staticmethod
    async def dismiss_alert(db: AsyncSession, alert_id: str) -> Optional[dict]:
        """Dismiss an alert."""
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        alert = result.scalar_one_or_none()
        if not alert:
            return None
        alert.is_read = True
        alert.is_acknowledged = True
        alert.acknowledged_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(alert)
        return {"id": alert.id, "status": "dismissed"}

    @staticmethod
    async def get_entity_full_profile(
        db: AsyncSession, entity_id: str,
    ) -> Optional[dict]:
        """Get unified entity view for investigation mode."""
        profile_result = await db.execute(
            select(EntityProfile).where(EntityProfile.entity_id == entity_id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            return None

        explainer = ExplainabilityEngine()

        events_result = await db.execute(
            select(TemporalEvent)
            .where(TemporalEvent.entity_id == entity_id)
            .order_by(TemporalEvent.timestamp.desc())
            .limit(100)
        )
        events = list(events_result.scalars().all())

        behaviors_result = await db.execute(
            select(BehaviorRecord)
            .where(BehaviorRecord.entity_id == entity_id)
            .order_by(BehaviorRecord.created_at.desc())
            .limit(20)
        )
        behaviors = list(behaviors_result.scalars().all())

        alerts_result = await db.execute(
            select(Alert)
            .where(Alert.entity_id == entity_id)
            .order_by(Alert.created_at.desc())
            .limit(20)
        )
        entity_alerts = list(alerts_result.scalars().all())

        insights_result = await db.execute(
            select(IntelligenceInsight)
            .where(IntelligenceInsight.is_dismissed == False)  # noqa: E712
            .order_by(IntelligenceInsight.created_at.desc())
            .limit(20)
        )
        all_insights = list(insights_result.scalars().all())
        entity_insights = [
            i for i in all_insights
            if i.entity_ids and entity_id in i.entity_ids
        ]

        watchlist = await redis_manager.get_json("operator:watchlist") or {}
        is_on_watchlist = entity_id in watchlist

        return {
            "entity_id": entity_id,
            "entity_type": profile.entity_type,
            "risk_score": profile.risk_score,
            "risk_level": profile.risk_level,
            "risk_summary": explainer.simplify_risk({
                "risk_score": profile.risk_score,
                "risk_level": profile.risk_level,
                "risk_factors": profile.risk_factors or [],
            }),
            "first_seen": (
                profile.first_seen.isoformat() if profile.first_seen else None
            ),
            "last_seen": (
                profile.last_seen.isoformat() if profile.last_seen else None
            ),
            "visit_count": profile.visit_count,
            "last_location": profile.last_location_name,
            "common_locations": profile.common_locations or [],
            "associated_entities": profile.associated_entities or [],
            "behavior_tags": profile.behavior_tags or [],
            "behaviors": [
                {
                    "type": b.behavior_type,
                    "description": explainer.simplify_behavior({
                        "behavior_type": b.behavior_type,
                        "confidence": b.confidence,
                    }),
                    "confidence": b.confidence,
                    "severity": b.severity,
                    "started_at": b.started_at.isoformat(),
                    "is_active": b.is_active,
                }
                for b in behaviors
            ],
            "recent_events": [
                {
                    "id": e.id,
                    "event_type": e.event_type,
                    "timestamp": e.timestamp.isoformat(),
                    "location_name": e.location_name or "Unknown",
                    "confidence": e.confidence,
                }
                for e in events[:20]
            ],
            "alerts": [
                {
                    "id": a.id,
                    "severity": a.severity,
                    "title": a.title,
                    "alert_type": a.alert_type,
                    "created_at": a.created_at.isoformat(),
                }
                for a in entity_alerts
            ],
            "insights": [
                {
                    "id": i.id,
                    "type": i.insight_type,
                    "title": i.title,
                    "description": i.description,
                    "severity": i.severity,
                    "confidence": i.confidence,
                }
                for i in entity_insights
            ],
            "temporal_pattern": profile.temporal_pattern,
            "predicted_next_time": profile.predicted_next_time,
            "predicted_next_location": profile.predicted_next_location,
            "is_on_watchlist": is_on_watchlist,
            "profile_completeness": profile.profile_completeness,
            "last_analyzed_at": (
                profile.last_analyzed_at.isoformat()
                if profile.last_analyzed_at
                else None
            ),
        }

    @staticmethod
    async def get_investigation_timeline(
        db: AsyncSession,
        entity_id: Optional[str] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 200,
    ) -> dict:
        """Get investigation timeline combining events and alerts."""
        if from_time is None:
            from_time = datetime.now(timezone.utc) - timedelta(days=7)
        if to_time is None:
            to_time = datetime.now(timezone.utc)

        event_conditions = [
            TemporalEvent.timestamp >= from_time,
            TemporalEvent.timestamp <= to_time,
        ]
        if entity_id:
            event_conditions.append(TemporalEvent.entity_id == entity_id)

        events_result = await db.execute(
            select(TemporalEvent)
            .where(and_(*event_conditions))
            .order_by(TemporalEvent.timestamp.asc())
            .limit(limit)
        )
        events = list(events_result.scalars().all())

        alert_conditions = [
            Alert.created_at >= from_time,
            Alert.created_at <= to_time,
        ]
        if entity_id:
            alert_conditions.append(Alert.entity_id == entity_id)

        alerts_result = await db.execute(
            select(Alert)
            .where(and_(*alert_conditions))
            .order_by(Alert.created_at.asc())
            .limit(limit)
        )
        alerts = list(alerts_result.scalars().all())

        timeline_items: list[dict] = []
        for event in events:
            timeline_items.append({
                "type": "event",
                "id": event.id,
                "timestamp": event.timestamp.isoformat(),
                "entity_id": event.entity_id,
                "event_type": event.event_type,
                "location_name": event.location_name or "Unknown",
                "confidence": event.confidence,
                "co_occurring_entities": event.co_occurring_entities or [],
            })
        for alert in alerts:
            timeline_items.append({
                "type": "alert",
                "id": alert.id,
                "timestamp": alert.created_at.isoformat(),
                "entity_id": alert.entity_id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "description": alert.description,
                "confidence": alert.confidence,
            })

        timeline_items.sort(key=lambda x: x["timestamp"])

        return {
            "entity_id": entity_id,
            "from_time": from_time.isoformat(),
            "to_time": to_time.isoformat(),
            "total_events": len(events),
            "total_alerts": len(alerts),
            "items": timeline_items,
        }

    @staticmethod
    async def get_intelligence_summary(
        db: AsyncSession, days: int = 30,
    ) -> dict:
        """Get long-term intelligence summary for strategic view."""
        now = datetime.now(timezone.utc)
        since = now - timedelta(days=days)

        risk_dist_result = await db.execute(
            select(
                EntityProfile.risk_level,
                func.count(EntityProfile.id),
            ).group_by(EntityProfile.risk_level)
        )
        risk_distribution = {
            row[0]: row[1] for row in risk_dist_result.all()
        }

        top_risk_result = await db.execute(
            select(EntityProfile)
            .order_by(EntityProfile.risk_score.desc())
            .limit(10)
        )
        top_risk_entities = [
            {
                "entity_id": p.entity_id,
                "entity_type": p.entity_type,
                "risk_score": p.risk_score,
                "risk_level": p.risk_level,
                "visit_count": p.visit_count,
                "last_seen": (
                    p.last_seen.isoformat() if p.last_seen else None
                ),
                "behavior_tags": p.behavior_tags or [],
            }
            for p in top_risk_result.scalars().all()
        ]

        behavior_dist_result = await db.execute(
            select(
                BehaviorRecord.behavior_type,
                func.count(BehaviorRecord.id),
            )
            .where(BehaviorRecord.created_at >= since)
            .group_by(BehaviorRecord.behavior_type)
        )
        behavior_distribution = {
            row[0]: row[1] for row in behavior_dist_result.all()
        }

        alert_trend = []
        for day_offset in range(min(days, 30)):
            day_start = now - timedelta(days=day_offset + 1)
            day_end = now - timedelta(days=day_offset)
            day_count_result = await db.execute(
                select(func.count(Alert.id)).where(
                    and_(
                        Alert.created_at >= day_start,
                        Alert.created_at < day_end,
                    )
                )
            )
            alert_trend.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "count": day_count_result.scalar() or 0,
            })
        alert_trend.reverse()

        active_insights_result = await db.execute(
            select(IntelligenceInsight)
            .where(
                and_(
                    IntelligenceInsight.is_dismissed == False,  # noqa: E712
                    IntelligenceInsight.is_reviewed == False,  # noqa: E712
                )
            )
            .order_by(IntelligenceInsight.created_at.desc())
            .limit(10)
        )
        active_insights = [
            {
                "id": i.id,
                "type": i.insight_type,
                "title": i.title,
                "description": i.description,
                "severity": i.severity,
                "confidence": i.confidence,
                "created_at": i.created_at.isoformat(),
            }
            for i in active_insights_result.scalars().all()
        ]

        location_result = await db.execute(
            select(
                TemporalEvent.location_name,
                func.count(TemporalEvent.id).label("count"),
            )
            .where(
                and_(
                    TemporalEvent.timestamp >= since,
                    TemporalEvent.location_name.isnot(None),
                )
            )
            .group_by(TemporalEvent.location_name)
            .order_by(func.count(TemporalEvent.id).desc())
            .limit(10)
        )
        top_locations = [
            {"location": row[0], "event_count": row[1]}
            for row in location_result.all()
        ]

        entity_trend = []
        for day_offset in range(min(days, 30)):
            day_start = now - timedelta(days=day_offset + 1)
            day_end = now - timedelta(days=day_offset)
            entity_count_result = await db.execute(
                select(func.count(EntityProfile.id)).where(
                    and_(
                        EntityProfile.first_seen >= day_start,
                        EntityProfile.first_seen < day_end,
                    )
                )
            )
            entity_trend.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "new_entities": entity_count_result.scalar() or 0,
            })
        entity_trend.reverse()

        return {
            "period_days": days,
            "risk_distribution": risk_distribution,
            "top_risk_entities": top_risk_entities,
            "behavior_distribution": behavior_distribution,
            "alert_trend": alert_trend,
            "entity_trend": entity_trend,
            "active_insights": active_insights,
            "top_locations": top_locations,
            "generated_at": now.isoformat(),
        }

    @staticmethod
    async def search_entities(
        db: AsyncSession,
        query: str = "",
        risk_level: Optional[str] = None,
        entity_type: Optional[str] = None,
        min_risk_score: Optional[float] = None,
        limit: int = 20,
    ) -> list[dict]:
        """Search entities for investigation mode."""
        conditions = []
        if risk_level:
            conditions.append(EntityProfile.risk_level == risk_level)
        if entity_type:
            conditions.append(EntityProfile.entity_type == entity_type)
        if min_risk_score is not None:
            conditions.append(EntityProfile.risk_score >= min_risk_score)

        db_query = select(EntityProfile)
        if conditions:
            db_query = db_query.where(and_(*conditions))
        db_query = db_query.order_by(
            EntityProfile.risk_score.desc()
        ).limit(limit)

        result = await db.execute(db_query)
        profiles = list(result.scalars().all())

        return [
            {
                "entity_id": p.entity_id,
                "entity_type": p.entity_type,
                "risk_score": p.risk_score,
                "risk_level": p.risk_level,
                "visit_count": p.visit_count,
                "first_seen": (
                    p.first_seen.isoformat() if p.first_seen else None
                ),
                "last_seen": (
                    p.last_seen.isoformat() if p.last_seen else None
                ),
                "last_location": p.last_location_name,
                "behavior_tags": p.behavior_tags or [],
            }
            for p in profiles
        ]
