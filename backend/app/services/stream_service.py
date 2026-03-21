"""Stream management service."""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.redis import redis_manager
from app.models.stream import Stream
from app.schemas.stream import StreamCreate, StreamUpdate

logger = logging.getLogger(__name__)


class StreamService:
    """Handles stream CRUD operations and lifecycle management."""

    @staticmethod
    async def create_stream(db: AsyncSession, data: StreamCreate) -> Stream:
        """Create a new video stream source."""
        stream = Stream(
            name=data.name,
            source_type=data.source_type,
            source_url=data.source_url,
            location_name=data.location_name,
            latitude=data.latitude,
            longitude=data.longitude,
            is_live=data.is_live,
            status="inactive",
        )
        db.add(stream)
        await db.flush()
        await db.refresh(stream)
        logger.info("Created stream: %s (%s)", stream.name, stream.id)
        return stream

    @staticmethod
    async def get_stream(db: AsyncSession, stream_id: str) -> Optional[Stream]:
        """Get a stream by ID."""
        result = await db.execute(select(Stream).where(Stream.id == stream_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_streams(
        db: AsyncSession,
        status: Optional[str] = None,
        source_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Stream]:
        """List streams with optional filtering."""
        query = select(Stream)
        if status:
            query = query.where(Stream.status == status)
        if source_type:
            query = query.where(Stream.source_type == source_type)
        query = query.order_by(Stream.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def update_stream(
        db: AsyncSession, stream_id: str, data: StreamUpdate
    ) -> Optional[Stream]:
        """Update a stream."""
        stream = await StreamService.get_stream(db, stream_id)
        if not stream:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(stream, key, value)

        await db.flush()
        await db.refresh(stream)
        return stream

    @staticmethod
    async def delete_stream(db: AsyncSession, stream_id: str) -> bool:
        """Delete a stream."""
        stream = await StreamService.get_stream(db, stream_id)
        if not stream:
            return False
        await db.delete(stream)
        return True

    @staticmethod
    async def start_stream(db: AsyncSession, stream_id: str) -> Optional[Stream]:
        """Mark a stream as active and begin processing."""
        stream = await StreamService.get_stream(db, stream_id)
        if not stream:
            return None

        stream.status = "active"
        stream.started_at = datetime.now(timezone.utc)
        stream.stopped_at = None
        await db.flush()
        await db.refresh(stream)

        # Cache active stream state in Redis
        await redis_manager.set_json(
            f"stream:{stream_id}:status",
            {
                "status": "active",
                "started_at": stream.started_at.isoformat(),
                "frames_processed": 0,
                "detections_count": 0,
                "active_tracks": 0,
            },
            ttl=3600,
        )

        logger.info("Started stream: %s", stream_id)
        return stream

    @staticmethod
    async def stop_stream(db: AsyncSession, stream_id: str) -> Optional[Stream]:
        """Stop a stream."""
        stream = await StreamService.get_stream(db, stream_id)
        if not stream:
            return None

        stream.status = "inactive"
        stream.stopped_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(stream)

        # Clear Redis state
        await redis_manager.delete(f"stream:{stream_id}:status")

        logger.info("Stopped stream: %s", stream_id)
        return stream

    @staticmethod
    async def update_stream_stats(
        stream_id: str,
        frames_processed: int,
        detections_count: int,
        active_tracks: int,
        current_fps: float,
    ) -> None:
        """Update real-time stream statistics in Redis."""
        await redis_manager.set_json(
            f"stream:{stream_id}:status",
            {
                "status": "active",
                "frames_processed": frames_processed,
                "detections_count": detections_count,
                "active_tracks": active_tracks,
                "current_fps": current_fps,
            },
            ttl=60,
        )

    @staticmethod
    async def get_stream_status(stream_id: str) -> Optional[dict]:
        """Get real-time stream status from Redis."""
        return await redis_manager.get_json(f"stream:{stream_id}:status")
