"""Target definition and matching service."""

import logging
from typing import Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.redis import redis_manager
from app.models.target import Target
from app.schemas.target import TargetCreate, TargetUpdate

logger = logging.getLogger(__name__)


class TargetService:
    """Handles target CRUD and matching operations."""

    @staticmethod
    async def create_target(db: AsyncSession, data: TargetCreate) -> Target:
        """Create a new intelligence target."""
        target = Target(
            name=data.name,
            description=data.description,
            target_type=data.target_type,
            text_query=data.text_query,
            similarity_threshold=data.similarity_threshold,
            attribute_filters=data.attribute_filters,
            alert_enabled=data.alert_enabled,
            webhook_url=data.webhook_url,
            priority=data.priority,
        )
        db.add(target)
        await db.flush()
        await db.refresh(target)

        # Cache active target in Redis for fast matching
        if target.is_active:
            await TargetService._cache_target(target)

        logger.info("Created target: %s (%s)", target.name, target.id)
        return target

    @staticmethod
    async def get_target(db: AsyncSession, target_id: str) -> Optional[Target]:
        """Get a target by ID."""
        result = await db.execute(select(Target).where(Target.id == target_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_targets(
        db: AsyncSession,
        is_active: Optional[bool] = None,
        target_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Target]:
        """List targets with optional filtering."""
        query = select(Target)
        if is_active is not None:
            query = query.where(Target.is_active == is_active)
        if target_type:
            query = query.where(Target.target_type == target_type)
        query = query.order_by(Target.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def update_target(
        db: AsyncSession, target_id: str, data: TargetUpdate
    ) -> Optional[Target]:
        """Update a target."""
        target = await TargetService.get_target(db, target_id)
        if not target:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(target, key, value)

        await db.flush()
        await db.refresh(target)

        # Update Redis cache
        if target.is_active:
            await TargetService._cache_target(target)
        else:
            await redis_manager.delete(f"target:{target.id}")

        return target

    @staticmethod
    async def delete_target(db: AsyncSession, target_id: str) -> bool:
        """Delete a target."""
        target = await TargetService.get_target(db, target_id)
        if not target:
            return False
        await db.delete(target)
        await redis_manager.delete(f"target:{target.id}")
        return True

    @staticmethod
    async def check_target_match(
        entity_embedding: Optional[list[float]],
        entity_attributes: Optional[dict],
        entity_type: str,
        active_targets: list[Target],
    ) -> list[tuple[Target, float]]:
        """Check if an entity matches any active targets.

        Returns list of (target, similarity_score) tuples.
        """
        matches: list[tuple[Target, float]] = []

        for target in active_targets:
            if target.target_type != entity_type:
                continue

            score = 0.0
            match_count = 0

            # Embedding-based matching (CLIP text vs detection embedding)
            if entity_embedding and target.text_embedding:
                entity_vec = np.array(entity_embedding, dtype=np.float32)
                target_vec = np.array(target.text_embedding, dtype=np.float32)
                similarity = float(
                    np.dot(entity_vec, target_vec)
                    / (np.linalg.norm(entity_vec) * np.linalg.norm(target_vec) + 1e-8)
                )
                score += similarity
                match_count += 1

            # Image embedding matching
            if entity_embedding and target.image_embedding:
                entity_vec = np.array(entity_embedding, dtype=np.float32)
                target_vec = np.array(target.image_embedding, dtype=np.float32)
                similarity = float(
                    np.dot(entity_vec, target_vec)
                    / (np.linalg.norm(entity_vec) * np.linalg.norm(target_vec) + 1e-8)
                )
                score += similarity
                match_count += 1

            # Attribute-based matching
            if entity_attributes and target.attribute_filters:
                attr_score = TargetService._match_attributes(
                    entity_attributes, target.attribute_filters
                )
                score += attr_score
                match_count += 1

            if match_count > 0:
                avg_score = score / match_count
                if avg_score >= target.similarity_threshold:
                    matches.append((target, avg_score))

        return matches

    @staticmethod
    def _match_attributes(entity_attrs: dict, filter_attrs: dict) -> float:
        """Calculate attribute matching score between 0 and 1."""
        if not filter_attrs:
            return 0.0

        total = len(filter_attrs)
        matched = 0

        for key, expected_value in filter_attrs.items():
            actual_value = entity_attrs.get(key)
            if actual_value is not None:
                if isinstance(expected_value, str) and isinstance(actual_value, str):
                    if expected_value.lower() in actual_value.lower():
                        matched += 1
                elif actual_value == expected_value:
                    matched += 1

        return matched / total if total > 0 else 0.0

    @staticmethod
    async def _cache_target(target: Target) -> None:
        """Cache a target in Redis for fast real-time matching."""
        cache_data = {
            "id": target.id,
            "name": target.name,
            "target_type": target.target_type,
            "text_embedding": target.text_embedding,
            "image_embedding": target.image_embedding,
            "similarity_threshold": target.similarity_threshold,
            "attribute_filters": target.attribute_filters,
            "alert_enabled": target.alert_enabled,
            "webhook_url": target.webhook_url,
        }
        await redis_manager.set_json(f"target:{target.id}", cache_data, ttl=3600)

    @staticmethod
    async def get_active_targets(db: AsyncSession) -> list[Target]:
        """Get all active targets for matching."""
        result = await db.execute(
            select(Target).where(Target.is_active == True)  # noqa: E712
        )
        return list(result.scalars().all())
