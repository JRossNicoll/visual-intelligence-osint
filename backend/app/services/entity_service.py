"""Entity management and intelligence service."""

import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.neo4j import neo4j_manager
from app.models.entity import Detection, Entity, Sighting
from app.schemas.entity import EntitySearchRequest

logger = logging.getLogger(__name__)


class EntityService:
    """Handles entity CRUD, matching, and intelligence operations."""

    @staticmethod
    async def create_or_match_entity(
        db: AsyncSession,
        entity_type: str,
        label: str,
        confidence: float,
        attributes: Optional[dict],
        embedding: Optional[list[float]],
        stream_id: str,
        timestamp: Optional[datetime] = None,
    ) -> Entity:
        """Create a new entity or match to an existing one using embeddings."""
        now = timestamp or datetime.now(timezone.utc)

        # Try to match existing entity by embedding similarity
        if embedding:
            match = await EntityService._find_matching_entity(db, embedding, entity_type)
            if match:
                # Update existing entity
                match.last_seen = now
                match.total_sightings += 1
                match.last_stream_id = stream_id
                match.confidence = max(match.confidence, confidence)
                if attributes:
                    existing_attrs = match.attributes or {}
                    existing_attrs.update(attributes)
                    match.attributes = existing_attrs
                await db.flush()
                await db.refresh(match)

                # Update graph
                await neo4j_manager.create_entity_node(
                    {
                        "entity_id": match.id,
                        "entity_type": match.entity_type,
                        "label": match.label,
                        "timestamp": now.isoformat(),
                        "confidence": match.confidence,
                        "attributes": str(match.attributes or {}),
                    }
                )

                return match

        # Create new entity
        entity = Entity(
            entity_type=entity_type,
            label=label,
            confidence=confidence,
            attributes=attributes,
            embedding=embedding,
            first_seen=now,
            last_seen=now,
            total_sightings=1,
            first_stream_id=stream_id,
            last_stream_id=stream_id,
        )
        db.add(entity)
        await db.flush()
        await db.refresh(entity)

        # Add to graph database
        await neo4j_manager.create_entity_node(
            {
                "entity_id": entity.id,
                "entity_type": entity.entity_type,
                "label": entity.label,
                "timestamp": now.isoformat(),
                "confidence": entity.confidence,
                "attributes": str(entity.attributes or {}),
            }
        )

        logger.info("Created new entity: %s (%s)", entity.label, entity.id)
        return entity

    @staticmethod
    async def _find_matching_entity(
        db: AsyncSession,
        embedding: list[float],
        entity_type: str,
        threshold: float = 0.75,
    ) -> Optional[Entity]:
        """Find an existing entity that matches the given embedding."""
        # Query entities of the same type that have embeddings
        result = await db.execute(
            select(Entity).where(
                and_(
                    Entity.entity_type == entity_type,
                    Entity.embedding.isnot(None),
                )
            )
        )
        entities = result.scalars().all()

        if not entities:
            return None

        query_vec = np.array(embedding, dtype=np.float32)
        best_match: Optional[Entity] = None
        best_similarity = threshold

        for entity in entities:
            if entity.embedding:
                entity_vec = np.array(entity.embedding, dtype=np.float32)
                # Cosine similarity
                similarity = float(
                    np.dot(query_vec, entity_vec)
                    / (np.linalg.norm(query_vec) * np.linalg.norm(entity_vec) + 1e-8)
                )
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = entity

        if best_match:
            logger.info(
                "Matched entity %s with similarity %.3f",
                best_match.id,
                best_similarity,
            )

        return best_match

    @staticmethod
    async def get_entity(db: AsyncSession, entity_id: str) -> Optional[Entity]:
        """Get an entity by ID."""
        result = await db.execute(select(Entity).where(Entity.id == entity_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def search_entities(
        db: AsyncSession, params: EntitySearchRequest
    ) -> list[Entity]:
        """Search entities with filtering."""
        query = select(Entity)

        if params.entity_type:
            query = query.where(Entity.entity_type == params.entity_type)
        if params.label:
            query = query.where(Entity.label.ilike(f"%{params.label}%"))
        if params.min_confidence is not None:
            query = query.where(Entity.confidence >= params.min_confidence)
        if params.stream_id:
            query = query.where(
                (Entity.first_stream_id == params.stream_id)
                | (Entity.last_stream_id == params.stream_id)
            )
        if params.from_time:
            query = query.where(Entity.last_seen >= params.from_time)
        if params.to_time:
            query = query.where(Entity.first_seen <= params.to_time)

        query = (
            query.order_by(Entity.last_seen.desc())
            .limit(params.limit)
            .offset(params.offset)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create_detection(
        db: AsyncSession,
        stream_id: str,
        frame_number: int,
        timestamp: datetime,
        label: str,
        confidence: float,
        bbox: tuple[float, float, float, float],
        track_id: Optional[int] = None,
        entity_id: Optional[str] = None,
        attributes: Optional[dict] = None,
    ) -> Detection:
        """Record a detection event."""
        detection = Detection(
            stream_id=stream_id,
            entity_id=entity_id,
            frame_number=frame_number,
            timestamp=timestamp,
            label=label,
            confidence=confidence,
            bbox_x=bbox[0],
            bbox_y=bbox[1],
            bbox_w=bbox[2],
            bbox_h=bbox[3],
            track_id=track_id,
            attributes=attributes,
        )
        db.add(detection)
        await db.flush()
        return detection

    @staticmethod
    async def get_detections(
        db: AsyncSession,
        stream_id: Optional[str] = None,
        entity_id: Optional[str] = None,
        from_frame: Optional[int] = None,
        to_frame: Optional[int] = None,
        limit: int = 100,
    ) -> list[Detection]:
        """Get detections with filtering."""
        query = select(Detection)
        if stream_id:
            query = query.where(Detection.stream_id == stream_id)
        if entity_id:
            query = query.where(Detection.entity_id == entity_id)
        if from_frame is not None:
            query = query.where(Detection.frame_number >= from_frame)
        if to_frame is not None:
            query = query.where(Detection.frame_number <= to_frame)
        query = query.order_by(Detection.timestamp.desc()).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_entity_graph(entity_id: str, depth: int = 2) -> dict:
        """Get the relationship graph for an entity."""
        raw = await neo4j_manager.get_entity_graph(entity_id, depth)

        nodes: dict[str, dict] = {}
        edges: list[dict] = []

        for record in raw:
            source_props = record.get("source_props", {})
            target_props = record.get("target_props", {})
            source_labels = record.get("source_labels", [])
            target_labels = record.get("target_labels", [])

            source_id = source_props.get("entity_id") or source_props.get("location_id", "unknown")
            target_id = target_props.get("entity_id") or target_props.get("location_id", "unknown")

            if source_id not in nodes:
                nodes[source_id] = {
                    "id": source_id,
                    "labels": source_labels,
                    "properties": source_props,
                }
            if target_id not in nodes:
                nodes[target_id] = {
                    "id": target_id,
                    "labels": target_labels,
                    "properties": target_props,
                }

            edges.append(
                {
                    "source": source_id,
                    "target": target_id,
                    "type": record.get("rel_type", ""),
                    "properties": record.get("rel_props", {}),
                }
            )

        return {"nodes": list(nodes.values()), "edges": edges}

    @staticmethod
    async def get_entity_timeline(
        db: AsyncSession, entity_id: str
    ) -> list[dict]:
        """Get the timeline of sightings for an entity."""
        result = await db.execute(
            select(Sighting)
            .where(Sighting.entity_id == entity_id)
            .order_by(Sighting.first_timestamp.desc())
        )
        sightings = result.scalars().all()
        return [
            {
                "id": s.id,
                "stream_id": s.stream_id,
                "first_timestamp": s.first_timestamp.isoformat(),
                "last_timestamp": s.last_timestamp.isoformat(),
                "detection_count": s.detection_count,
                "avg_confidence": s.avg_confidence,
                "thumbnail_path": s.thumbnail_path,
            }
            for s in sightings
        ]
