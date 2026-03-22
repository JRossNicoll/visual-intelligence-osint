"""Case intelligence service — runs full intelligence analysis on a case after all videos are processed."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_intelligence import CaseIntelligence
from app.models.entity import Entity
from app.models.intelligence import TemporalEvent
from app.services.intelligence_service import IntelligenceService

logger = logging.getLogger(__name__)


class CaseIntelligenceService:
    """Generates and caches intelligence analysis for a case."""

    @staticmethod
    async def generate_case_intelligence(
        db: AsyncSession,
        case_id: str,
    ) -> dict:
        """Run full intelligence analysis on all entities in a case.

        Called automatically when all videos in a case are processed
        and identity matching is complete.
        """
        # Get all entities linked to this case
        result = await db.execute(
            select(Entity).where(Entity.case_id == case_id)
        )
        entities = list(result.scalars().all())
        entity_ids = [e.id for e in entities]

        if not entity_ids:
            return {"case_id": case_id, "status": "no_entities"}

        # Run per-entity analysis
        for eid in entity_ids:
            try:
                await IntelligenceService.analyze_entity(db, eid)
            except Exception as e:
                logger.warning("Entity analysis failed for %s: %s", eid, e)

        # Run system-level analysis
        try:
            system_analysis = await IntelligenceService.run_system_analysis(
                db, entity_ids=entity_ids
            )
        except Exception as e:
            logger.warning("System analysis failed: %s", e)
            system_analysis = {"status": "error", "error": str(e)}

        # Gather per-entity risk scores
        risk_scores = {}
        for eid in entity_ids:
            profile = await IntelligenceService.get_entity_profile(db, eid)
            if profile:
                risk_scores[eid] = {
                    "risk_score": profile.risk_score,
                    "risk_level": profile.risk_level,
                    "risk_factors": profile.risk_factors or [],
                    "behavior_tags": profile.behavior_tags or [],
                }

        # Build cross-video timeline
        timeline_result = await db.execute(
            select(TemporalEvent)
            .where(TemporalEvent.entity_id.in_(entity_ids))
            .order_by(TemporalEvent.timestamp.asc())
            .limit(2000)
        )
        timeline_events = list(timeline_result.scalars().all())
        cross_video_timeline = {}
        for evt in timeline_events:
            eid = evt.entity_id
            if eid not in cross_video_timeline:
                cross_video_timeline[eid] = []
            cross_video_timeline[eid].append({
                "timestamp": str(evt.timestamp),
                "event_type": evt.event_type,
                "location_name": evt.location_name,
                "stream_id": evt.stream_id,
            })

        now = datetime.now(timezone.utc)

        # Extract analysis components
        coordination = system_analysis.get("coordination", {})
        temporal_anomalies = system_analysis.get("group_anomalies", {})
        sequences = system_analysis.get("sequences", {})
        group_anomalies = system_analysis.get("group_anomalies", {})

        # Count patterns
        pattern_count = 0
        if isinstance(coordination, dict):
            pattern_count += len(coordination.get("patterns", []))
        if isinstance(sequences, dict):
            pattern_count += len(sequences.get("frequent_sequences", []))

        # Generate summary text
        summary_parts = []
        summary_parts.append(
            f"Analysis of {len(entity_ids)} entities across case."
        )
        if pattern_count > 0:
            summary_parts.append(f"{pattern_count} coordination/sequence patterns detected.")
        high_risk = [eid for eid, r in risk_scores.items() if r["risk_level"] in ("high", "critical")]
        if high_risk:
            summary_parts.append(f"{len(high_risk)} high/critical risk entities identified.")
        summary_text = " ".join(summary_parts)

        # Upsert case intelligence record
        existing = await db.execute(
            select(CaseIntelligence).where(CaseIntelligence.case_id == case_id)
        )
        intel = existing.scalar_one_or_none()

        data = {
            "coordination_patterns": coordination if isinstance(coordination, dict) else {},
            "temporal_anomalies": temporal_anomalies if isinstance(temporal_anomalies, dict) else {},
            "risk_scores": risk_scores,
            "sequence_patterns": sequences if isinstance(sequences, dict) else {},
            "group_anomalies": group_anomalies if isinstance(group_anomalies, dict) else {},
            "cross_video_timeline": cross_video_timeline,
            "summary_text": summary_text,
            "entity_count": len(entity_ids),
            "pattern_count": pattern_count,
            "generated_at": now,
        }

        if intel:
            for key, value in data.items():
                if hasattr(intel, key):
                    object.__setattr__(intel, key, value)
        else:
            intel = CaseIntelligence(case_id=case_id, **data)
            db.add(intel)

        await db.flush()
        await db.refresh(intel)

        return _intel_to_dict(intel)

    @staticmethod
    async def get_case_intelligence(
        db: AsyncSession,
        case_id: str,
    ) -> Optional[dict]:
        """Get cached intelligence results for a case."""
        result = await db.execute(
            select(CaseIntelligence).where(CaseIntelligence.case_id == case_id)
        )
        intel = result.scalar_one_or_none()
        if not intel:
            return None
        return _intel_to_dict(intel)


def _intel_to_dict(intel: CaseIntelligence) -> dict:
    return {
        "id": intel.id,
        "case_id": intel.case_id,
        "coordination_patterns": intel.coordination_patterns or {},
        "temporal_anomalies": intel.temporal_anomalies or {},
        "risk_scores": intel.risk_scores or {},
        "sequence_patterns": intel.sequence_patterns or {},
        "group_anomalies": intel.group_anomalies or {},
        "cross_video_timeline": intel.cross_video_timeline or {},
        "summary_text": intel.summary_text or "",
        "entity_count": intel.entity_count,
        "pattern_count": intel.pattern_count,
        "generated_at": str(intel.generated_at),
        "created_at": str(intel.created_at),
    }
