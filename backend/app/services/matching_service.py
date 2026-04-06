"""Cross-video identity matching service.

Compares entity embeddings within a case using cosine similarity:
- > 0.85: auto-merge (keep highest-confidence embedding)
- 0.70-0.85: create pending_match for human review
- < 0.70: distinct entities
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity
from app.models.matching import NegativeMatchPair, PendingMatch

logger = logging.getLogger(__name__)

AUTO_MERGE_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.70


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    va = np.array(a, dtype=np.float64)
    vb = np.array(b, dtype=np.float64)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


class MatchingService:
    """Cross-video entity identity matching."""

    @staticmethod
    async def run_matching_for_case(
        db: AsyncSession,
        case_id: str,
    ) -> dict:
        """Run identity matching across all entities in a case.

        Compares every pair of entities with embeddings.
        Returns summary of auto-merges and pending matches created.
        """
        # Get all entities in this case that have embeddings
        result = await db.execute(
            select(Entity)
            .where(Entity.case_id == case_id)
            .where(Entity.embedding.isnot(None))
        )
        entities = list(result.scalars().all())

        if len(entities) < 2:
            return {
                "case_id": case_id,
                "entities_compared": len(entities),
                "auto_merged": 0,
                "pending_matches_created": 0,
                "distinct_pairs": 0,
            }

        # Load existing negative pairs to avoid re-suggesting
        neg_result = await db.execute(
            select(NegativeMatchPair).where(NegativeMatchPair.case_id == case_id)
        )
        negative_pairs = set()
        for neg in neg_result.scalars().all():
            negative_pairs.add((neg.entity_a_id, neg.entity_b_id))
            negative_pairs.add((neg.entity_b_id, neg.entity_a_id))

        # Load existing pending matches to avoid duplicates
        pending_result = await db.execute(
            select(PendingMatch)
            .where(PendingMatch.case_id == case_id)
            .where(PendingMatch.status == "pending")
        )
        existing_pending = set()
        for pm in pending_result.scalars().all():
            existing_pending.add((pm.entity_a_id, pm.entity_b_id))
            existing_pending.add((pm.entity_b_id, pm.entity_a_id))

        auto_merged = 0
        pending_created = 0
        distinct_count = 0

        # Compare all pairs
        for i in range(len(entities)):
            for j in range(i + 1, len(entities)):
                e_a = entities[i]
                e_b = entities[j]

                # Skip negative pairs
                if (e_a.id, e_b.id) in negative_pairs:
                    continue

                # Skip already-pending pairs
                if (e_a.id, e_b.id) in existing_pending:
                    continue

                sim = cosine_similarity(e_a.embedding, e_b.embedding)

                if sim >= AUTO_MERGE_THRESHOLD:
                    # Auto-merge: keep higher-confidence entity as canonical
                    await MatchingService._merge_entities(db, e_a, e_b, sim)
                    auto_merged += 1
                elif sim >= REVIEW_THRESHOLD:
                    # Create pending match for human review
                    pm = PendingMatch(
                        case_id=case_id,
                        entity_a_id=e_a.id,
                        entity_b_id=e_b.id,
                        similarity_score=sim,
                        status="pending",
                    )
                    db.add(pm)
                    pending_created += 1
                else:
                    distinct_count += 1

        await db.flush()

        return {
            "case_id": case_id,
            "entities_compared": len(entities),
            "auto_merged": auto_merged,
            "pending_matches_created": pending_created,
            "distinct_pairs": distinct_count,
        }

    @staticmethod
    async def _merge_entities(
        db: AsyncSession,
        entity_a: Entity,
        entity_b: Entity,
        similarity: float,
    ) -> None:
        """Merge two entities — keep the higher-confidence one as canonical."""
        # Determine canonical entity (higher confidence)
        if entity_a.confidence >= entity_b.confidence:
            canonical, duplicate = entity_a, entity_b
        else:
            canonical, duplicate = entity_b, entity_a

        # Update canonical with merged data
        canonical.total_sightings += duplicate.total_sightings
        if duplicate.first_seen < canonical.first_seen:
            canonical.first_seen = duplicate.first_seen
        if duplicate.last_seen > canonical.last_seen:
            canonical.last_seen = duplicate.last_seen

        # Set match cluster
        cluster_id = canonical.match_cluster_id or canonical.id
        canonical.match_cluster_id = cluster_id
        duplicate.match_cluster_id = cluster_id

        logger.info(
            "Auto-merged entity %s into %s (sim=%.3f)",
            duplicate.id, canonical.id, similarity,
        )

    @staticmethod
    async def get_pending_matches(
        db: AsyncSession,
        case_id: str,
    ) -> list[dict]:
        """Get all pending matches for a case."""
        result = await db.execute(
            select(PendingMatch)
            .where(PendingMatch.case_id == case_id)
            .where(PendingMatch.status == "pending")
            .order_by(PendingMatch.similarity_score.desc())
        )
        matches = list(result.scalars().all())
        return [_match_to_dict(m) for m in matches]

    @staticmethod
    async def review_match(
        db: AsyncSession,
        match_id: str,
        decision: str,
        reviewed_by: str,
    ) -> Optional[dict]:
        """Accept or reject a pending match.

        Args:
            decision: "accepted" or "rejected"
            reviewed_by: username of reviewer
        """
        result = await db.execute(
            select(PendingMatch).where(PendingMatch.id == match_id)
        )
        match = result.scalar_one_or_none()
        if not match:
            return None

        match.status = decision
        match.reviewed_by = reviewed_by
        match.reviewed_at = datetime.now(timezone.utc)

        if decision == "accepted":
            # Merge the entities
            ea_result = await db.execute(select(Entity).where(Entity.id == match.entity_a_id))
            eb_result = await db.execute(select(Entity).where(Entity.id == match.entity_b_id))
            entity_a = ea_result.scalar_one_or_none()
            entity_b = eb_result.scalar_one_or_none()
            if entity_a and entity_b:
                await MatchingService._merge_entities(
                    db, entity_a, entity_b, match.similarity_score
                )
        elif decision == "rejected":
            # Add to negative pairs to prevent re-suggestion
            neg_pair = NegativeMatchPair(
                case_id=match.case_id,
                entity_a_id=match.entity_a_id,
                entity_b_id=match.entity_b_id,
            )
            db.add(neg_pair)

        await db.flush()
        await db.refresh(match)
        return _match_to_dict(match)

    @staticmethod
    async def get_match_stats(
        db: AsyncSession,
        case_id: str,
    ) -> dict:
        """Get matching statistics for a case."""
        from sqlalchemy import func
        result = await db.execute(
            select(
                PendingMatch.status,
                func.count(PendingMatch.id),
            )
            .where(PendingMatch.case_id == case_id)
            .group_by(PendingMatch.status)
        )
        stats = {row[0]: row[1] for row in result.all()}
        return {
            "case_id": case_id,
            "pending": stats.get("pending", 0),
            "accepted": stats.get("accepted", 0),
            "rejected": stats.get("rejected", 0),
            "total": sum(stats.values()),
        }


def _match_to_dict(m: PendingMatch) -> dict:
    return {
        "id": m.id,
        "case_id": m.case_id,
        "entity_a_id": m.entity_a_id,
        "entity_b_id": m.entity_b_id,
        "similarity_score": m.similarity_score,
        "status": m.status,
        "reviewed_by": m.reviewed_by,
        "reviewed_at": str(m.reviewed_at) if m.reviewed_at else None,
        "created_at": str(m.created_at),
    }
