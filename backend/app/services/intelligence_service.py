"""Intelligence service - orchestrates analysis and manages intelligence data."""

import logging
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.neo4j import neo4j_manager
from app.models.intelligence import (
    BehaviorRecord,
    EntityProfile,
    IntelligenceInsight,
    TemporalEvent,
)

logger = logging.getLogger(__name__)

# Add intelligence engine to path for imports
_ie_path = str(Path(__file__).resolve().parents[3] / "services" / "intelligence-engine")
if _ie_path not in sys.path:
    sys.path.insert(0, _ie_path)

from intelligence_engine.engine import IntelligenceEngine  # noqa: E402

# Thread-safe singleton engine instance
_engine: Optional[IntelligenceEngine] = None
_engine_lock = threading.Lock()


def get_engine() -> IntelligenceEngine:
    """Get or create the intelligence engine singleton (thread-safe)."""
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = IntelligenceEngine()
    return _engine


class IntelligenceService:
    """Manages intelligence data and orchestrates analysis."""

    # --- Temporal Events ---

    @staticmethod
    async def create_temporal_event(
        db: AsyncSession,
        entity_id: str,
        stream_id: str,
        event_type: str,
        timestamp: datetime,
        confidence: float = 1.0,
        location_id: Optional[str] = None,
        location_name: Optional[str] = None,
        duration_seconds: Optional[float] = None,
        attributes: Optional[dict] = None,
        co_occurring_entities: Optional[list] = None,
        hour_of_day: Optional[int] = None,
        day_of_week: Optional[int] = None,
        is_weekend: Optional[bool] = None,
    ) -> TemporalEvent:
        """Create a temporal event record."""
        if hour_of_day is None:
            hour_of_day = timestamp.hour
        if day_of_week is None:
            day_of_week = timestamp.weekday()
        if is_weekend is None:
            is_weekend = timestamp.weekday() >= 5

        event = TemporalEvent(
            entity_id=entity_id,
            stream_id=stream_id,
            location_id=location_id,
            location_name=location_name,
            event_type=event_type,
            timestamp=timestamp,
            duration_seconds=duration_seconds,
            confidence=confidence,
            attributes=attributes,
            co_occurring_entities=co_occurring_entities,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            is_weekend=is_weekend,
        )
        db.add(event)
        await db.flush()
        await db.refresh(event)
        return event

    @staticmethod
    async def get_temporal_events(
        db: AsyncSession,
        entity_id: Optional[str] = None,
        stream_id: Optional[str] = None,
        event_type: Optional[str] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> list[TemporalEvent]:
        """Get temporal events with filtering."""
        query = select(TemporalEvent)
        if entity_id:
            query = query.where(TemporalEvent.entity_id == entity_id)
        if stream_id:
            query = query.where(TemporalEvent.stream_id == stream_id)
        if event_type:
            query = query.where(TemporalEvent.event_type == event_type)
        if from_time:
            query = query.where(TemporalEvent.timestamp >= from_time)
        if to_time:
            query = query.where(TemporalEvent.timestamp <= to_time)
        query = query.order_by(TemporalEvent.timestamp.desc()).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    # --- Entity Profiles ---

    @staticmethod
    async def get_entity_profile(
        db: AsyncSession, entity_id: str
    ) -> Optional[EntityProfile]:
        """Get the intelligence profile for an entity."""
        result = await db.execute(
            select(EntityProfile).where(EntityProfile.entity_id == entity_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_entity_profiles(
        db: AsyncSession,
        risk_level: Optional[str] = None,
        entity_type: Optional[str] = None,
        min_risk_score: Optional[float] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[EntityProfile]:
        """List entity profiles with filtering."""
        query = select(EntityProfile)
        if risk_level:
            query = query.where(EntityProfile.risk_level == risk_level)
        if entity_type:
            query = query.where(EntityProfile.entity_type == entity_type)
        if min_risk_score is not None:
            query = query.where(EntityProfile.risk_score >= min_risk_score)
        query = (
            query.order_by(EntityProfile.risk_score.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def upsert_entity_profile(
        db: AsyncSession, entity_id: str, data: dict
    ) -> EntityProfile:
        """Create or update an entity profile."""
        result = await db.execute(
            select(EntityProfile).where(EntityProfile.entity_id == entity_id)
        )
        profile = result.scalar_one_or_none()

        if profile:
            for key, value in data.items():
                if hasattr(profile, key):
                    setattr(profile, key, value)
        else:
            profile = EntityProfile(entity_id=entity_id, **data)
            db.add(profile)

        await db.flush()
        await db.refresh(profile)
        return profile

    # --- Behavior Records ---

    @staticmethod
    async def get_behavior_records(
        db: AsyncSession,
        entity_id: Optional[str] = None,
        behavior_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 50,
    ) -> list[BehaviorRecord]:
        """Get behavior records with filtering."""
        query = select(BehaviorRecord)
        if entity_id:
            query = query.where(BehaviorRecord.entity_id == entity_id)
        if behavior_type:
            query = query.where(BehaviorRecord.behavior_type == behavior_type)
        if is_active is not None:
            query = query.where(BehaviorRecord.is_active == is_active)
        query = query.order_by(BehaviorRecord.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create_behavior_record(
        db: AsyncSession, data: dict
    ) -> BehaviorRecord:
        """Create a behavior record."""
        record = BehaviorRecord(**data)
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record

    # --- Intelligence Insights ---

    @staticmethod
    async def get_insights(
        db: AsyncSession,
        insight_type: Optional[str] = None,
        severity: Optional[str] = None,
        entity_id: Optional[str] = None,
        is_reviewed: Optional[bool] = None,
        limit: int = 50,
    ) -> list[IntelligenceInsight]:
        """Get intelligence insights with filtering."""
        query = select(IntelligenceInsight).where(
            IntelligenceInsight.is_dismissed == False  # noqa: E712
        )
        if insight_type:
            query = query.where(IntelligenceInsight.insight_type == insight_type)
        if severity:
            query = query.where(IntelligenceInsight.severity == severity)
        if is_reviewed is not None:
            query = query.where(IntelligenceInsight.is_reviewed == is_reviewed)
        query = query.order_by(IntelligenceInsight.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create_insight(
        db: AsyncSession, data: dict
    ) -> IntelligenceInsight:
        """Create an intelligence insight."""
        insight = IntelligenceInsight(**data)
        db.add(insight)
        await db.flush()
        await db.refresh(insight)
        return insight

    @staticmethod
    async def dismiss_insight(
        db: AsyncSession, insight_id: str
    ) -> Optional[IntelligenceInsight]:
        """Dismiss an intelligence insight."""
        result = await db.execute(
            select(IntelligenceInsight).where(IntelligenceInsight.id == insight_id)
        )
        insight = result.scalar_one_or_none()
        if insight:
            insight.is_dismissed = True
            await db.flush()
            await db.refresh(insight)
        return insight

    @staticmethod
    async def review_insight(
        db: AsyncSession, insight_id: str
    ) -> Optional[IntelligenceInsight]:
        """Mark an intelligence insight as reviewed."""
        result = await db.execute(
            select(IntelligenceInsight).where(IntelligenceInsight.id == insight_id)
        )
        insight = result.scalar_one_or_none()
        if insight:
            insight.is_reviewed = True
            await db.flush()
            await db.refresh(insight)
        return insight

    # --- Full Analysis ---

    @staticmethod
    async def analyze_entity(
        db: AsyncSession, entity_id: str
    ) -> dict:
        """Run full intelligence analysis on an entity.

        Orchestrates temporal analysis, anomaly detection, behavior
        classification, risk scoring, and prediction generation.
        """
        engine = get_engine()

        # Get all temporal events for this entity
        events_result = await db.execute(
            select(TemporalEvent)
            .where(TemporalEvent.entity_id == entity_id)
            .order_by(TemporalEvent.timestamp.asc())
        )
        events = list(events_result.scalars().all())

        if not events:
            return {"entity_id": entity_id, "status": "no_data"}

        # Convert to dicts for the engine
        event_dicts = [
            {
                "entity_id": e.entity_id,
                "stream_id": e.stream_id,
                "location_id": e.location_id,
                "location_name": e.location_name,
                "event_type": e.event_type,
                "timestamp": e.timestamp,
                "duration_seconds": e.duration_seconds,
                "confidence": e.confidence,
                "hour_of_day": e.hour_of_day,
                "day_of_week": e.day_of_week,
                "co_occurring_entities": e.co_occurring_entities or [],
            }
            for e in events
        ]

        # Get co-occurrence data from Neo4j
        co_occurrence_data = await IntelligenceService._get_co_occurrence_data(
            entity_id
        )

        # Get associated entity risks
        associated_risks = await IntelligenceService._get_associated_risks(
            db, entity_id
        )

        # Run full analysis
        analysis = engine.full_entity_analysis(
            entity_id=entity_id,
            events=event_dicts,
            co_occurrence_data=co_occurrence_data,
            associated_entity_risks=associated_risks,
        )

        # Update entity profile with results
        now = datetime.now(timezone.utc)
        profile_data = {
            "entity_type": event_dicts[0].get("entity_id", "unknown"),
            "first_seen": events[0].timestamp,
            "last_seen": events[-1].timestamp,
            "visit_count": len(events),
            "risk_score": analysis.get("risk", {}).get("risk_score", 0.0),
            "risk_level": analysis.get("risk", {}).get("risk_level", "low"),
            "risk_factors": analysis.get("risk", {}).get("risk_factors", []),
            "temporal_pattern": analysis.get("temporal_pattern"),
            "behavior_summary": {
                "behaviors": [b.get("behavior_type") for b in analysis.get("behaviors", [])],
                "behavior_count": len(analysis.get("behaviors", [])),
            },
            "behavior_tags": [b.get("behavior_type") for b in analysis.get("behaviors", [])],
            "last_analyzed_at": now,
        }

        # Extract location data
        locations = {}
        for e in event_dicts:
            loc_id = e.get("location_id")
            if loc_id:
                if loc_id not in locations:
                    locations[loc_id] = {
                        "location_id": loc_id,
                        "name": e.get("location_name", loc_id),
                        "visit_count": 0,
                    }
                locations[loc_id]["visit_count"] += 1
        profile_data["common_locations"] = sorted(
            locations.values(), key=lambda x: x["visit_count"], reverse=True
        )[:10]

        if events:
            profile_data["last_location_id"] = events[-1].location_id
            profile_data["last_location_name"] = events[-1].location_name

        # Prediction data
        prediction = analysis.get("prediction", {})
        if prediction.get("predicted_time_window_start"):
            profile_data["predicted_next_time"] = {
                "window_start": str(prediction["predicted_time_window_start"]),
                "window_end": str(prediction.get("predicted_time_window_end")),
                "confidence": prediction.get("time_confidence", 0),
            }
        if prediction.get("predicted_location_id"):
            profile_data["predicted_next_location"] = {
                "location_id": prediction["predicted_location_id"],
                "name": prediction.get("predicted_location_name"),
                "probability": prediction.get("location_confidence", 0),
            }

        # Calculate profile completeness
        completeness_fields = [
            "common_locations", "behavior_tags", "temporal_pattern",
            "risk_factors", "predicted_next_time",
        ]
        filled = sum(1 for f in completeness_fields if profile_data.get(f))
        profile_data["profile_completeness"] = filled / len(completeness_fields)

        # Try to get entity_type from the entities table
        from app.models.entity import Entity
        entity_result = await db.execute(
            select(Entity.entity_type).where(Entity.id == entity_id)
        )
        entity_type_row = entity_result.scalar_one_or_none()
        if entity_type_row:
            profile_data["entity_type"] = entity_type_row

        await IntelligenceService.upsert_entity_profile(db, entity_id, profile_data)

        # Store behavior records
        for behavior in analysis.get("behaviors", []):
            await IntelligenceService.create_behavior_record(db, {
                "entity_id": entity_id,
                "behavior_type": behavior["behavior_type"],
                "description": behavior.get("description", ""),
                "confidence": behavior.get("confidence", 0.0),
                "severity": behavior.get("severity", "low"),
                "location_name": behavior.get("evidence", {}).get("location"),
                "started_at": now,
                "is_active": True,
            })

        # Store insights for anomalies
        anomaly = analysis.get("anomaly")
        if anomaly and anomaly.get("is_anomalous"):
            await IntelligenceService.create_insight(db, {
                "insight_type": "anomaly",
                "title": f"Anomaly detected for entity {entity_id}",
                "description": anomaly.get("explanation", "Anomalous behavior detected."),
                "severity": "high" if anomaly.get("anomaly_score", 0) > 0.7 else "medium",
                "entity_ids": [entity_id],
                "confidence": anomaly.get("anomaly_score", 0.0),
                "evidence": anomaly,
            })

        return analysis

    @staticmethod
    async def analyze_batch(
        db: AsyncSession, min_events: int = 3
    ) -> dict:
        """Run analysis on all entities with sufficient data."""
        # Get entities with enough events
        result = await db.execute(
            select(TemporalEvent.entity_id, func.count(TemporalEvent.id).label("cnt"))
            .group_by(TemporalEvent.entity_id)
            .having(func.count(TemporalEvent.id) >= min_events)
        )
        entity_counts = result.all()

        analyzed = 0
        errors = 0
        for entity_id, count in entity_counts:
            try:
                await IntelligenceService.analyze_entity(db, entity_id)
                analyzed += 1
            except Exception as e:
                logger.error("Failed to analyze entity %s: %s", entity_id, e)
                errors += 1

        return {
            "entities_analyzed": analyzed,
            "errors": errors,
            "total_eligible": len(entity_counts),
        }

    @staticmethod
    async def _get_co_occurrence_data(entity_id: str) -> dict:
        """Get co-occurrence timestamps from Neo4j."""
        try:
            query = """
            MATCH (e:Entity {entity_id: $entity_id})-[r:CO_OCCURRED_WITH]-(other:Entity)
            RETURN other.entity_id as other_id, r.count as count, r.last_seen as last_seen
            """
            results = await neo4j_manager.execute_query(query, {"entity_id": entity_id})
            co_data = {}
            for r in results:
                other_id = r.get("other_id")
                if other_id:
                    co_data[other_id] = []  # Timestamps would be stored here
            return co_data
        except Exception as e:
            logger.debug("Neo4j co-occurrence query failed: %s", e)
            return {}

    @staticmethod
    async def _get_associated_risks(
        db: AsyncSession, entity_id: str
    ) -> list[dict]:
        """Get risk scores for associated entities."""
        profile = await IntelligenceService.get_entity_profile(db, entity_id)
        if not profile or not profile.associated_entities:
            return []

        risks = []
        for assoc in profile.associated_entities:
            assoc_id = assoc.get("entity_id")
            if assoc_id:
                assoc_profile = await IntelligenceService.get_entity_profile(db, assoc_id)
                if assoc_profile:
                    risks.append({
                        "entity_id": assoc_id,
                        "relationship_weight": assoc.get("strength", 0.5),
                        "risk_score": assoc_profile.risk_score,
                    })

        return risks

    # --- NL Query ---

    @staticmethod
    async def execute_nl_query(
        db: AsyncSession, query: str
    ) -> dict:
        """Execute a natural language query."""
        engine = get_engine()
        result = engine.translate_nl_query(query)

        # Execute the generated SQL if available — read-only with strict validation
        query_results = []
        if result.generated_sql:
            try:
                from sqlalchemy import text
                safe_sql = result.generated_sql.strip().rstrip(";")
                # Strict read-only gate: only SELECT, no mutation keywords
                upper_sql = safe_sql.upper()
                forbidden = {"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE"}
                if not upper_sql.startswith("SELECT"):
                    query_results = [{"error": "Only SELECT queries are allowed."}]
                elif any(kw in upper_sql for kw in forbidden):
                    query_results = [{"error": "Query contains forbidden mutation keywords."}]
                else:
                    # Execute via read-only connection with statement timeout
                    sql_result = await db.execute(
                        text("SET LOCAL statement_timeout = '5s'")
                    )
                    sql_result = await db.execute(text(safe_sql))
                    rows = sql_result.fetchall()
                    query_results = [dict(row._mapping) for row in rows[:500]]
            except Exception as e:
                logger.warning("SQL execution failed: %s", e)
                query_results = [{"error": str(e), "note": "Query generated but execution failed."}]

        return {
            "original_query": result.original_query,
            "interpreted_query": result.interpreted_query,
            "generated_sql": result.generated_sql,
            "generated_cypher": result.generated_cypher,
            "query_explanation": result.query_explanation,
            "results": query_results,
            "result_count": len(query_results),
            "confidence": result.confidence,
        }

    # --- Neo4j Relationship Updates ---

    @staticmethod
    async def update_neo4j_relationship_weight(
        entity_id_1: str,
        entity_id_2: str,
        weight: float,
        strength_label: str,
    ) -> None:
        """Update the relationship weight in Neo4j."""
        query = """
        MATCH (e1:Entity {entity_id: $entity_id_1})-[r:CO_OCCURRED_WITH]-(e2:Entity {entity_id: $entity_id_2})
        SET r.weight = $weight,
            r.strength = $strength_label,
            r.updated_at = datetime()
        """
        await neo4j_manager.execute_query(query, {
            "entity_id_1": entity_id_1,
            "entity_id_2": entity_id_2,
            "weight": weight,
            "strength_label": strength_label,
        })

    # =================================================================
    # System-Level Intelligence Methods
    # =================================================================

    @staticmethod
    async def run_system_analysis(
        db: AsyncSession,
        entity_ids: Optional[list[str]] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
    ) -> dict:
        """Run full system-level intelligence analysis.

        Detects coordination patterns, sequences, group anomalies,
        and propagates risk through the entity graph.
        """
        engine = get_engine()

        # Build query for all events
        query = select(TemporalEvent).order_by(TemporalEvent.timestamp.asc())
        if entity_ids:
            query = query.where(TemporalEvent.entity_id.in_(entity_ids))
        if from_time:
            query = query.where(TemporalEvent.timestamp >= from_time)
        if to_time:
            query = query.where(TemporalEvent.timestamp <= to_time)
        query = query.limit(5000)

        result = await db.execute(query)
        events = list(result.scalars().all())

        if not events:
            return {"status": "no_data", "explanation": "No events found."}

        event_dicts = [
            {
                "entity_id": e.entity_id,
                "stream_id": e.stream_id,
                "location_id": e.location_id,
                "location_name": e.location_name,
                "event_type": e.event_type,
                "timestamp": e.timestamp,
                "duration_seconds": e.duration_seconds,
                "confidence": e.confidence,
                "hour_of_day": e.hour_of_day,
                "day_of_week": e.day_of_week,
                "co_occurring_entities": e.co_occurring_entities or [],
            }
            for e in events
        ]

        # Build entity risk map and adjacency from profiles
        entity_risks = {}
        adjacency: dict[str, list[dict]] = {}
        unique_ids = {e.entity_id for e in events}
        for eid in unique_ids:
            profile = await IntelligenceService.get_entity_profile(db, eid)
            if profile:
                entity_risks[eid] = profile.risk_score
                if profile.associated_entities:
                    adjacency[eid] = [
                        {
                            "entity_id": a.get("entity_id", ""),
                            "weight": a.get("strength", 0.5),
                        }
                        for a in profile.associated_entities
                    ]

        return engine.full_system_analysis(
            all_events=event_dicts,
            entity_risks=entity_risks if entity_risks else None,
            adjacency=adjacency if adjacency else None,
            historical_events=event_dicts,
        )

    @staticmethod
    async def detect_coordination(
        db: AsyncSession,
        entity_ids: Optional[list[str]] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
    ) -> dict:
        """Detect multi-entity coordination patterns."""
        engine = get_engine()
        query = select(TemporalEvent).order_by(TemporalEvent.timestamp.asc())
        if entity_ids:
            query = query.where(TemporalEvent.entity_id.in_(entity_ids))
        if from_time:
            query = query.where(TemporalEvent.timestamp >= from_time)
        if to_time:
            query = query.where(TemporalEvent.timestamp <= to_time)
        query = query.limit(5000)

        result = await db.execute(query)
        events = list(result.scalars().all())
        event_dicts = [
            {
                "entity_id": e.entity_id,
                "location_id": e.location_id,
                "location_name": e.location_name,
                "timestamp": e.timestamp,
                "co_occurring_entities": e.co_occurring_entities or [],
            }
            for e in events
        ]
        coord = engine.detect_coordination(event_dicts)
        return coord.model_dump()

    @staticmethod
    async def detect_sequences(
        db: AsyncSession,
        entity_ids: Optional[list[str]] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
    ) -> dict:
        """Detect temporal sequences and causal relationships."""
        engine = get_engine()
        query = select(TemporalEvent).order_by(TemporalEvent.timestamp.asc())
        if entity_ids:
            query = query.where(TemporalEvent.entity_id.in_(entity_ids))
        if from_time:
            query = query.where(TemporalEvent.timestamp >= from_time)
        if to_time:
            query = query.where(TemporalEvent.timestamp <= to_time)
        query = query.limit(5000)

        result = await db.execute(query)
        events = list(result.scalars().all())
        event_dicts = [
            {
                "entity_id": e.entity_id,
                "location_id": e.location_id,
                "timestamp": e.timestamp,
            }
            for e in events
        ]
        seq = engine.detect_sequences(event_dicts)
        return seq.model_dump()

    @staticmethod
    async def detect_group_anomalies(
        db: AsyncSession,
        entity_ids: Optional[list[str]] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
    ) -> dict:
        """Detect group-level anomalies."""
        engine = get_engine()
        query = select(TemporalEvent).order_by(TemporalEvent.timestamp.asc())
        if entity_ids:
            query = query.where(TemporalEvent.entity_id.in_(entity_ids))
        if from_time:
            query = query.where(TemporalEvent.timestamp >= from_time)
        if to_time:
            query = query.where(TemporalEvent.timestamp <= to_time)
        query = query.limit(5000)

        result = await db.execute(query)
        events = list(result.scalars().all())
        event_dicts = [
            {
                "entity_id": e.entity_id,
                "location_id": e.location_id,
                "location_name": e.location_name,
                "timestamp": e.timestamp,
                "co_occurring_entities": e.co_occurring_entities or [],
            }
            for e in events
        ]
        anomalies = engine.detect_group_anomalies(event_dicts, event_dicts)
        return anomalies.model_dump()

    @staticmethod
    async def update_adaptive_weights(
        feedback_type: str,
        component_scores: dict,
        outcome: bool,
    ) -> dict:
        """Provide feedback to the adaptive risk model."""
        engine = get_engine()
        state = engine.update_adaptive_weights(
            feedback_type, component_scores, outcome
        )
        return state.model_dump()

    @staticmethod
    async def get_adaptive_weights() -> dict:
        """Get current adaptive risk weight state."""
        engine = get_engine()
        state = engine.get_adaptive_weights()
        return state.model_dump()

    @staticmethod
    async def run_evaluation() -> dict:
        """Run full evaluation framework."""
        engine = get_engine()
        return engine.run_evaluation()
