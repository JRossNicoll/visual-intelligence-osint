"""Case management service — CRUD, evidence linking, timeline, summaries, audit."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.case import AuditLog, Case, CaseEvidence, CaseNote
from app.models.intelligence import (
    EntityProfile,
    TemporalEvent,
)

logger = logging.getLogger(__name__)


class AuditService:
    """Records all user actions and system events for traceability."""

    @staticmethod
    async def log(
        db: AsyncSession,
        *,
        actor: str,
        role: str,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        detail: Optional[str] = None,
        metadata_json: Optional[dict] = None,
    ) -> None:
        entry = AuditLog(
            actor=actor,
            role=role,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            detail=detail,
            metadata_json=metadata_json,
            performed_at=datetime.now(timezone.utc),
        )
        db.add(entry)
        # Flush so the log is written even if later code errors
        await db.flush()

    @staticmethod
    async def get_logs(
        db: AsyncSession,
        *,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        actor: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        conditions = []
        if resource_type:
            conditions.append(AuditLog.resource_type == resource_type)
        if resource_id:
            conditions.append(AuditLog.resource_id == resource_id)
        if actor:
            conditions.append(AuditLog.actor == actor)
        if action:
            conditions.append(AuditLog.action == action)

        query = select(AuditLog)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(AuditLog.performed_at.desc()).limit(limit).offset(offset)

        result = await db.execute(query)
        logs = list(result.scalars().all())
        return [
            {
                "id": log.id,
                "actor": log.actor,
                "role": log.role,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "detail": log.detail,
                "metadata_json": log.metadata_json,
                "performed_at": log.performed_at.isoformat(),
            }
            for log in logs
        ]


class CaseService:
    """Manages intelligence cases, evidence, notes, and summaries."""

    # ------------------------------------------------------------------ #
    # Case CRUD
    # ------------------------------------------------------------------ #

    @staticmethod
    async def create_case(
        db: AsyncSession,
        *,
        title: str,
        description: str = "",
        priority: str = "medium",
        severity: str = "medium",
        assigned_to: Optional[str] = None,
        tags: Optional[list[str]] = None,
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        linked_entity_ids: Optional[list[str]] = None,
        linked_alert_ids: Optional[list[str]] = None,
        created_by: str = "operator",
    ) -> dict:
        now = datetime.now(timezone.utc)
        entity_ids = linked_entity_ids or []
        alert_ids = linked_alert_ids or []

        case = Case(
            title=title,
            description=description,
            status="open",
            priority=priority,
            severity=severity,
            entity_count=len(entity_ids),
            alert_count=len(alert_ids),
            evidence_count=0,
            linked_entity_ids=entity_ids,
            linked_alert_ids=alert_ids,
            created_by=created_by,
            assigned_to=assigned_to,
            tags=tags or [],
            source_type=source_type,
            source_id=source_id,
            opened_at=now,
        )
        db.add(case)
        await db.flush()

        # Auto-attach alert evidence if created from an alert
        if source_type == "alert" and source_id:
            alert_result = await db.execute(
                select(Alert).where(Alert.id == source_id)
            )
            alert = alert_result.scalar_one_or_none()
            if alert:
                evidence = CaseEvidence(
                    case_id=case.id,
                    evidence_type="alert",
                    source_table="alerts",
                    source_id=alert.id,
                    title=alert.title,
                    description=alert.description or "",
                    data_snapshot={
                        "alert_type": alert.alert_type,
                        "severity": alert.severity,
                        "confidence": alert.confidence,
                        "metadata": alert.metadata_json,
                    },
                    confidence=alert.confidence,
                    added_by="system",
                )
                db.add(evidence)
                case.evidence_count = 1
                # Also link the alert's entity
                if alert.entity_id and alert.entity_id not in entity_ids:
                    entity_ids.append(alert.entity_id)
                    case.linked_entity_ids = entity_ids
                    case.entity_count = len(entity_ids)
                if alert.id not in alert_ids:
                    alert_ids.append(alert.id)
                    case.linked_alert_ids = alert_ids
                    case.alert_count = len(alert_ids)

        await db.flush()

        await AuditService.log(
            db,
            actor=created_by,
            role=created_by,
            action="case_created",
            resource_type="case",
            resource_id=case.id,
            detail=f"Case created: {title}",
            metadata_json={"source_type": source_type, "source_id": source_id},
        )

        return _case_to_dict(case)

    @staticmethod
    async def get_case(db: AsyncSession, case_id: str) -> Optional[dict]:
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            return None
        return _case_to_dict(case)

    @staticmethod
    async def list_cases(
        db: AsyncSession,
        *,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assigned_to: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        conditions = []
        if status:
            conditions.append(Case.status == status)
        if priority:
            conditions.append(Case.priority == priority)
        if assigned_to:
            conditions.append(Case.assigned_to == assigned_to)

        query = select(Case)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(Case.updated_at.desc()).limit(limit).offset(offset)

        result = await db.execute(query)
        cases = list(result.scalars().all())
        return [_case_to_summary(c) for c in cases]

    @staticmethod
    async def update_case(
        db: AsyncSession,
        case_id: str,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        severity: Optional[str] = None,
        assigned_to: Optional[str] = None,
        tags: Optional[list[str]] = None,
        actor: str = "operator",
    ) -> Optional[dict]:
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            return None

        changes: list[str] = []
        if title is not None:
            case.title = title
            changes.append("title")
        if description is not None:
            case.description = description
            changes.append("description")
        if status is not None:
            old_status = case.status
            case.status = status
            changes.append(f"status: {old_status} -> {status}")
            if status == "closed":
                case.closed_at = datetime.now(timezone.utc)
        if priority is not None:
            case.priority = priority
            changes.append("priority")
        if severity is not None:
            case.severity = severity
            changes.append("severity")
        if assigned_to is not None:
            case.assigned_to = assigned_to
            changes.append("assigned_to")
        if tags is not None:
            case.tags = tags
            changes.append("tags")

        case.updated_at = datetime.now(timezone.utc)
        await db.flush()

        await AuditService.log(
            db,
            actor=actor,
            role=actor,
            action="case_updated",
            resource_type="case",
            resource_id=case.id,
            detail=f"Updated: {', '.join(changes)}",
        )

        return _case_to_dict(case)

    # ------------------------------------------------------------------ #
    # Entity & Alert Linking
    # ------------------------------------------------------------------ #

    @staticmethod
    async def link_entities(
        db: AsyncSession,
        case_id: str,
        entity_ids: list[str],
        actor: str = "operator",
    ) -> Optional[dict]:
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            return None

        current = case.linked_entity_ids or []
        added = [eid for eid in entity_ids if eid not in current]
        case.linked_entity_ids = current + added
        case.entity_count = len(case.linked_entity_ids)
        case.updated_at = datetime.now(timezone.utc)
        await db.flush()

        if added:
            await AuditService.log(
                db,
                actor=actor,
                role=actor,
                action="entities_linked",
                resource_type="case",
                resource_id=case.id,
                detail=f"Linked {len(added)} entities",
                metadata_json={"entity_ids": added},
            )

        return {"id": case.id, "status": "updated", "message": f"{len(added)} entities linked"}

    @staticmethod
    async def link_alerts(
        db: AsyncSession,
        case_id: str,
        alert_ids: list[str],
        actor: str = "operator",
    ) -> Optional[dict]:
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            return None

        current = case.linked_alert_ids or []
        added = [aid for aid in alert_ids if aid not in current]
        case.linked_alert_ids = current + added
        case.alert_count = len(case.linked_alert_ids)
        case.updated_at = datetime.now(timezone.utc)
        await db.flush()

        # Auto-link entities from alerts
        for aid in added:
            alert_result = await db.execute(select(Alert).where(Alert.id == aid))
            alert = alert_result.scalar_one_or_none()
            if alert and alert.entity_id:
                current_entities = case.linked_entity_ids or []
                if alert.entity_id not in current_entities:
                    current_entities.append(alert.entity_id)
                    case.linked_entity_ids = current_entities
                    case.entity_count = len(current_entities)

        await db.flush()

        if added:
            await AuditService.log(
                db,
                actor=actor,
                role=actor,
                action="alerts_linked",
                resource_type="case",
                resource_id=case.id,
                detail=f"Linked {len(added)} alerts",
                metadata_json={"alert_ids": added},
            )

        return {"id": case.id, "status": "updated", "message": f"{len(added)} alerts linked"}

    # ------------------------------------------------------------------ #
    # Evidence
    # ------------------------------------------------------------------ #

    @staticmethod
    async def add_evidence(
        db: AsyncSession,
        case_id: str,
        *,
        evidence_type: str,
        source_table: str,
        source_id: str,
        title: str,
        description: str = "",
        data_snapshot: Optional[dict] = None,
        confidence: Optional[float] = None,
        relevance_note: str = "",
        computation_params: Optional[dict] = None,
        added_by: str = "operator",
    ) -> Optional[dict]:
        case_result = await db.execute(select(Case).where(Case.id == case_id))
        case = case_result.scalar_one_or_none()
        if not case:
            return None

        evidence = CaseEvidence(
            case_id=case_id,
            evidence_type=evidence_type,
            source_table=source_table,
            source_id=source_id,
            title=title,
            description=description,
            data_snapshot=data_snapshot,
            confidence=confidence,
            relevance_note=relevance_note,
            added_by=added_by,
            computation_params=computation_params,
        )
        db.add(evidence)
        case.evidence_count = (case.evidence_count or 0) + 1
        case.updated_at = datetime.now(timezone.utc)
        await db.flush()

        await AuditService.log(
            db,
            actor=added_by,
            role=added_by,
            action="evidence_added",
            resource_type="case",
            resource_id=case.id,
            detail=f"Added {evidence_type} evidence: {title}",
            metadata_json={"evidence_id": evidence.id, "source_table": source_table, "source_id": source_id},
        )

        return {
            "id": evidence.id,
            "case_id": evidence.case_id,
            "evidence_type": evidence.evidence_type,
            "source_table": evidence.source_table,
            "source_id": evidence.source_id,
            "title": evidence.title,
            "description": evidence.description or "",
            "data_snapshot": evidence.data_snapshot,
            "confidence": evidence.confidence,
            "relevance_note": evidence.relevance_note or "",
            "added_by": evidence.added_by,
            "computation_params": evidence.computation_params,
            "created_at": evidence.created_at.isoformat(),
        }

    @staticmethod
    async def get_evidence(
        db: AsyncSession,
        case_id: str,
        *,
        evidence_type: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict]:
        conditions = [CaseEvidence.case_id == case_id]
        if evidence_type:
            conditions.append(CaseEvidence.evidence_type == evidence_type)

        query = (
            select(CaseEvidence)
            .where(and_(*conditions))
            .order_by(CaseEvidence.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        items = list(result.scalars().all())
        return [
            {
                "id": ev.id,
                "case_id": ev.case_id,
                "evidence_type": ev.evidence_type,
                "source_table": ev.source_table,
                "source_id": ev.source_id,
                "title": ev.title,
                "description": ev.description or "",
                "data_snapshot": ev.data_snapshot,
                "confidence": ev.confidence,
                "relevance_note": ev.relevance_note or "",
                "added_by": ev.added_by,
                "computation_params": ev.computation_params,
                "created_at": ev.created_at.isoformat(),
            }
            for ev in items
        ]

    # ------------------------------------------------------------------ #
    # Notes
    # ------------------------------------------------------------------ #

    @staticmethod
    async def add_note(
        db: AsyncSession,
        case_id: str,
        *,
        content: str,
        author: str = "operator",
        note_type: str = "general",
    ) -> Optional[dict]:
        case_result = await db.execute(select(Case).where(Case.id == case_id))
        case = case_result.scalar_one_or_none()
        if not case:
            return None

        note = CaseNote(
            case_id=case_id,
            author=author,
            content=content,
            note_type=note_type,
        )
        db.add(note)
        case.updated_at = datetime.now(timezone.utc)
        await db.flush()

        await AuditService.log(
            db,
            actor=author,
            role=author,
            action="note_added",
            resource_type="case",
            resource_id=case.id,
            detail=f"Added {note_type} note",
        )

        return {
            "id": note.id,
            "case_id": note.case_id,
            "author": note.author,
            "content": note.content,
            "note_type": note.note_type,
            "created_at": note.created_at.isoformat(),
        }

    @staticmethod
    async def get_notes(db: AsyncSession, case_id: str, limit: int = 100) -> list[dict]:
        query = (
            select(CaseNote)
            .where(CaseNote.case_id == case_id)
            .order_by(CaseNote.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        notes = list(result.scalars().all())
        return [
            {
                "id": n.id,
                "case_id": n.case_id,
                "author": n.author,
                "content": n.content,
                "note_type": n.note_type,
                "created_at": n.created_at.isoformat(),
            }
            for n in notes
        ]

    # ------------------------------------------------------------------ #
    # Case Timeline
    # ------------------------------------------------------------------ #

    @staticmethod
    async def get_case_timeline(
        db: AsyncSession,
        case_id: str,
        *,
        limit: int = 200,
    ) -> dict:
        case_result = await db.execute(select(Case).where(Case.id == case_id))
        case = case_result.scalar_one_or_none()
        if not case:
            return {"case_id": case_id, "total_items": 0, "items": []}

        items: list[dict] = []

        # Gather events from linked entities
        entity_ids = case.linked_entity_ids or []
        if entity_ids:
            event_query = (
                select(TemporalEvent)
                .where(TemporalEvent.entity_id.in_(entity_ids))
                .order_by(TemporalEvent.timestamp.desc())
                .limit(limit)
            )
            event_result = await db.execute(event_query)
            for ev in event_result.scalars().all():
                items.append({
                    "type": "event",
                    "id": ev.id,
                    "timestamp": ev.timestamp.isoformat(),
                    "title": f"{ev.event_type} - {ev.entity_id[:8]}",
                    "description": f"At {ev.location_name or 'unknown location'}",
                    "severity": None,
                    "confidence": ev.confidence,
                    "entity_id": ev.entity_id,
                    "evidence_type": None,
                })

        # Gather alerts from linked alerts
        alert_ids = case.linked_alert_ids or []
        if alert_ids:
            alert_query = (
                select(Alert)
                .where(Alert.id.in_(alert_ids))
                .order_by(Alert.created_at.desc())
            )
            alert_result = await db.execute(alert_query)
            for a in alert_result.scalars().all():
                items.append({
                    "type": "alert",
                    "id": a.id,
                    "timestamp": a.created_at.isoformat(),
                    "title": a.title,
                    "description": a.description or "",
                    "severity": a.severity,
                    "confidence": a.confidence,
                    "entity_id": a.entity_id,
                    "evidence_type": None,
                })

        # Gather evidence
        evidence_query = (
            select(CaseEvidence)
            .where(CaseEvidence.case_id == case_id)
            .order_by(CaseEvidence.created_at.desc())
        )
        evidence_result = await db.execute(evidence_query)
        for ev in evidence_result.scalars().all():
            items.append({
                "type": "evidence",
                "id": ev.id,
                "timestamp": ev.created_at.isoformat(),
                "title": ev.title,
                "description": ev.description or "",
                "severity": None,
                "confidence": ev.confidence,
                "entity_id": None,
                "evidence_type": ev.evidence_type,
            })

        # Gather notes
        note_query = (
            select(CaseNote)
            .where(CaseNote.case_id == case_id)
            .order_by(CaseNote.created_at.desc())
        )
        note_result = await db.execute(note_query)
        for n in note_result.scalars().all():
            items.append({
                "type": "note",
                "id": n.id,
                "timestamp": n.created_at.isoformat(),
                "title": f"Note by {n.author}",
                "description": n.content,
                "severity": None,
                "confidence": None,
                "entity_id": None,
                "evidence_type": None,
            })

        # Sort all items by timestamp (newest first)
        items.sort(key=lambda x: x["timestamp"], reverse=True)
        items = items[:limit]

        return {
            "case_id": case_id,
            "total_items": len(items),
            "items": items,
        }

    # ------------------------------------------------------------------ #
    # Intelligence Summary
    # ------------------------------------------------------------------ #

    @staticmethod
    async def generate_case_summary(db: AsyncSession, case_id: str) -> Optional[dict]:
        case_result = await db.execute(select(Case).where(Case.id == case_id))
        case = case_result.scalar_one_or_none()
        if not case:
            return None

        now = datetime.now(timezone.utc)
        entity_ids = case.linked_entity_ids or []
        alert_ids = case.linked_alert_ids or []

        # Gather entity profiles
        key_entities: list[dict] = []
        risk_levels: dict[str, int] = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        if entity_ids:
            profile_query = select(EntityProfile).where(
                EntityProfile.entity_id.in_(entity_ids)
            )
            profile_result = await db.execute(profile_query)
            for p in profile_result.scalars().all():
                key_entities.append({
                    "entity_id": p.entity_id,
                    "entity_type": p.entity_type,
                    "risk_score": p.risk_score,
                    "risk_level": p.risk_level,
                    "visit_count": p.visit_count,
                    "behavior_tags": p.behavior_tags or [],
                })
                risk_levels[p.risk_level] = risk_levels.get(p.risk_level, 0) + 1

        # Gather detected patterns from evidence
        detected_patterns: list[dict] = []
        evidence_query = select(CaseEvidence).where(
            and_(
                CaseEvidence.case_id == case_id,
                CaseEvidence.evidence_type.in_(["pattern", "behavior", "insight"]),
            )
        )
        evidence_result = await db.execute(evidence_query)
        for ev in evidence_result.scalars().all():
            detected_patterns.append({
                "type": ev.evidence_type,
                "title": ev.title,
                "description": ev.description or "",
                "confidence": ev.confidence,
            })

        # Confidence levels across all evidence
        all_evidence_query = select(CaseEvidence).where(
            CaseEvidence.case_id == case_id
        )
        all_evidence_result = await db.execute(all_evidence_query)
        confidences = [
            ev.confidence
            for ev in all_evidence_result.scalars().all()
            if ev.confidence is not None
        ]
        confidence_levels = {}
        if confidences:
            confidence_levels = {
                "mean": round(sum(confidences) / len(confidences), 3),
                "min": round(min(confidences), 3),
                "max": round(max(confidences), 3),
                "count": len(confidences),
            }

        # Generate findings from alerts
        findings: list[str] = []
        if alert_ids:
            alert_query = select(Alert).where(Alert.id.in_(alert_ids))
            alert_result = await db.execute(alert_query)
            for a in alert_result.scalars().all():
                findings.append(f"[{a.severity.upper()}] {a.title}")

        # Limitations
        limitations: list[str] = []
        if len(entity_ids) == 0:
            limitations.append("No entities linked to this case")
        if len(alert_ids) == 0:
            limitations.append("No alerts linked to this case")
        if not confidences:
            limitations.append("No confidence scores available for evidence items")
        if len(entity_ids) == 1:
            limitations.append("Single-entity case - limited relationship analysis possible")

        summary = {
            "case_id": case_id,
            "title": case.title,
            "key_entities": key_entities,
            "detected_patterns": detected_patterns,
            "risk_levels": risk_levels,
            "confidence_levels": confidence_levels,
            "limitations": limitations,
            "findings": findings,
            "generated_at": now.isoformat(),
        }

        # Persist the summary
        case.summary_json = summary
        case.updated_at = now
        await db.flush()

        await AuditService.log(
            db,
            actor="system",
            role="system",
            action="summary_generated",
            resource_type="case",
            resource_id=case.id,
            detail="Intelligence summary regenerated",
        )

        return summary

    # ------------------------------------------------------------------ #
    # Create from Alert (1-click flow)
    # ------------------------------------------------------------------ #

    @staticmethod
    async def create_from_alert(
        db: AsyncSession,
        alert_id: str,
        *,
        created_by: str = "operator",
    ) -> Optional[dict]:
        alert_result = await db.execute(select(Alert).where(Alert.id == alert_id))
        alert = alert_result.scalar_one_or_none()
        if not alert:
            return None

        entity_ids: list[str] = []
        if alert.entity_id:
            entity_ids.append(alert.entity_id)
        if alert.metadata_json and alert.metadata_json.get("entity_ids"):
            for eid in alert.metadata_json["entity_ids"]:
                if eid not in entity_ids:
                    entity_ids.append(eid)

        return await CaseService.create_case(
            db,
            title=f"Case: {alert.title}",
            description=alert.description or f"Auto-created from {alert.alert_type} alert",
            priority="high" if alert.severity in ("critical", "high") else "medium",
            severity=alert.severity,
            source_type="alert",
            source_id=alert.id,
            linked_entity_ids=entity_ids,
            linked_alert_ids=[alert.id],
            created_by=created_by,
        )

    # ------------------------------------------------------------------ #
    # Create from Entity
    # ------------------------------------------------------------------ #

    @staticmethod
    async def create_from_entity(
        db: AsyncSession,
        entity_id: str,
        *,
        created_by: str = "investigator",
    ) -> Optional[dict]:
        profile_result = await db.execute(
            select(EntityProfile).where(EntityProfile.entity_id == entity_id)
        )
        profile = profile_result.scalar_one_or_none()

        title = f"Investigation: Entity {entity_id[:8]}"
        description = "Auto-created from entity investigation"
        priority = "medium"
        severity = "medium"

        if profile:
            title = f"Investigation: {profile.entity_type.title()} {entity_id[:8]}"
            description = f"Entity with risk level {profile.risk_level}, {profile.visit_count} visits"
            if profile.risk_level in ("critical", "high"):
                priority = "high"
                severity = profile.risk_level

        return await CaseService.create_case(
            db,
            title=title,
            description=description,
            priority=priority,
            severity=severity,
            source_type="entity",
            source_id=entity_id,
            linked_entity_ids=[entity_id],
            created_by=created_by,
        )


# ------------------------------------------------------------------ #
# Private helpers
# ------------------------------------------------------------------ #

def _case_to_dict(case: Case) -> dict:
    return {
        "id": case.id,
        "title": case.title,
        "description": case.description or "",
        "status": case.status,
        "priority": case.priority,
        "severity": case.severity,
        "entity_count": case.entity_count,
        "alert_count": case.alert_count,
        "evidence_count": case.evidence_count,
        "linked_entity_ids": case.linked_entity_ids or [],
        "linked_alert_ids": case.linked_alert_ids or [],
        "created_by": case.created_by,
        "assigned_to": case.assigned_to,
        "tags": case.tags or [],
        "source_type": case.source_type,
        "source_id": case.source_id,
        "summary_json": case.summary_json,
        "opened_at": case.opened_at.isoformat(),
        "closed_at": case.closed_at.isoformat() if case.closed_at else None,
        "created_at": case.created_at.isoformat(),
        "updated_at": case.updated_at.isoformat(),
    }


def _case_to_summary(case: Case) -> dict:
    return {
        "id": case.id,
        "title": case.title,
        "status": case.status,
        "priority": case.priority,
        "severity": case.severity,
        "entity_count": case.entity_count,
        "alert_count": case.alert_count,
        "evidence_count": case.evidence_count,
        "created_by": case.created_by,
        "assigned_to": case.assigned_to,
        "tags": case.tags or [],
        "opened_at": case.opened_at.isoformat(),
        "closed_at": case.closed_at.isoformat() if case.closed_at else None,
        "created_at": case.created_at.isoformat(),
        "updated_at": case.updated_at.isoformat(),
    }
