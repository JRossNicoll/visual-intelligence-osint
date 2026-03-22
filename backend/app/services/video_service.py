"""Video pipeline service — manages video uploads, processing queue, and progress tracking."""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.case import Case
from app.models.entity import Entity
from app.models.video import VideoFile

logger = logging.getLogger(__name__)


class VideoService:
    """Manages the batch video processing pipeline."""

    @staticmethod
    async def upload_video(
        db: AsyncSession,
        case_id: str,
        filename: str,
        file_content: bytes,
    ) -> Optional[dict]:
        """Upload a video file to a case and enqueue for processing."""
        # Verify case exists
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            return None

        # Ensure upload directory exists
        upload_dir = os.path.join(settings.VIDEO_UPLOAD_DIR, case_id)
        os.makedirs(upload_dir, exist_ok=True)

        # Write file to disk
        file_path = os.path.join(upload_dir, filename)
        with open(file_path, "wb") as f:
            f.write(file_content)

        # Create VideoFile record
        video = VideoFile(
            case_id=case_id,
            filename=filename,
            file_path=file_path,
            file_size_bytes=len(file_content),
            status="queued",
        )
        db.add(video)
        await db.flush()
        await db.refresh(video)

        # Enqueue job to Redis Streams
        try:
            from app.db.redis import redis_manager
            if redis_manager.client:
                await redis_manager.client.xadd(
                    "viosint:video_jobs",
                    {
                        "video_id": video.id,
                        "case_id": case_id,
                        "file_path": file_path,
                        "filename": filename,
                    },
                )
                logger.info("Enqueued video %s for processing", video.id)
        except Exception as e:
            logger.warning("Failed to enqueue video job: %s", e)

        return _video_to_dict(video)

    @staticmethod
    async def get_case_videos(
        db: AsyncSession,
        case_id: str,
    ) -> list[dict]:
        """Get all videos for a case."""
        result = await db.execute(
            select(VideoFile)
            .where(VideoFile.case_id == case_id)
            .order_by(VideoFile.created_at.desc())
        )
        videos = list(result.scalars().all())
        return [_video_to_dict(v) for v in videos]

    @staticmethod
    async def get_video(
        db: AsyncSession,
        video_id: str,
    ) -> Optional[dict]:
        """Get a single video by ID."""
        result = await db.execute(select(VideoFile).where(VideoFile.id == video_id))
        video = result.scalar_one_or_none()
        if not video:
            return None
        return _video_to_dict(video)

    @staticmethod
    async def update_video_progress(
        db: AsyncSession,
        video_id: str,
        processed_frames: int,
        entity_count_discovered: int,
        status: Optional[str] = None,
    ) -> Optional[dict]:
        """Update video processing progress (called by worker)."""
        result = await db.execute(select(VideoFile).where(VideoFile.id == video_id))
        video = result.scalar_one_or_none()
        if not video:
            return None

        video.processed_frames = processed_frames
        video.entity_count_discovered = entity_count_discovered
        if status:
            video.status = status
            if status == "processing" and not video.processing_started_at:
                video.processing_started_at = datetime.now(timezone.utc)
            elif status in ("complete", "failed"):
                video.processing_completed_at = datetime.now(timezone.utc)

        await db.flush()
        await db.refresh(video)
        return _video_to_dict(video)

    @staticmethod
    async def mark_video_failed(
        db: AsyncSession,
        video_id: str,
        error_message: str,
    ) -> Optional[dict]:
        """Mark a video as failed with error message."""
        result = await db.execute(select(VideoFile).where(VideoFile.id == video_id))
        video = result.scalar_one_or_none()
        if not video:
            return None

        video.status = "failed"
        video.error_message = error_message
        video.processing_completed_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(video)
        return _video_to_dict(video)

    @staticmethod
    async def check_case_completion(
        db: AsyncSession,
        case_id: str,
    ) -> dict:
        """Check if all videos in a case are processed.

        Returns completion status and counts.
        """
        result = await db.execute(
            select(
                func.count(VideoFile.id).label("total"),
                func.count(VideoFile.id).filter(VideoFile.status == "complete").label("complete"),
                func.count(VideoFile.id).filter(VideoFile.status == "failed").label("failed"),
                func.count(VideoFile.id).filter(VideoFile.status == "processing").label("processing"),
                func.count(VideoFile.id).filter(VideoFile.status == "queued").label("queued"),
            ).where(VideoFile.case_id == case_id)
        )
        row = result.one()
        total = row.total
        complete = row.complete
        failed = row.failed

        all_done = total > 0 and (complete + failed) == total
        return {
            "case_id": case_id,
            "total_videos": total,
            "complete": complete,
            "failed": failed,
            "processing": row.processing,
            "queued": row.queued,
            "all_done": all_done,
            "ready_for_intelligence": all_done and complete > 0,
        }

    @staticmethod
    async def get_case_entity_count(
        db: AsyncSession,
        case_id: str,
    ) -> int:
        """Get total entity count for a case."""
        result = await db.execute(
            select(func.count(Entity.id)).where(Entity.case_id == case_id)
        )
        return result.scalar() or 0


def _video_to_dict(video: VideoFile) -> dict:
    """Convert a VideoFile model to a dict."""
    progress = 0.0
    if video.frame_count and video.frame_count > 0:
        progress = min(100.0, (video.processed_frames / video.frame_count) * 100)
    elif video.status == "complete":
        progress = 100.0

    return {
        "id": video.id,
        "case_id": video.case_id,
        "filename": video.filename,
        "file_size_bytes": video.file_size_bytes,
        "status": video.status,
        "error_message": video.error_message,
        "duration_seconds": video.duration_seconds,
        "frame_count": video.frame_count,
        "processed_frames": video.processed_frames,
        "entity_count_discovered": video.entity_count_discovered,
        "progress_percent": progress,
        "processing_started_at": str(video.processing_started_at) if video.processing_started_at else None,
        "processing_completed_at": str(video.processing_completed_at) if video.processing_completed_at else None,
        "created_at": str(video.created_at),
        "updated_at": str(video.updated_at),
    }
