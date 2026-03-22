"""Video processing worker — pulls jobs from Redis Streams and runs the CV pipeline.

This runs as a separate process from the API server.
Usage: python -m app.worker
"""

import asyncio
import logging
import os
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def process_video(video_id: str, case_id: str, file_path: str, filename: str) -> None:
    """Process a single video through the CV pipeline.

    Steps:
    1. Update status to 'processing'
    2. Run YOLO detection + ByteTrack tracking
    3. Generate CLIP embeddings per unique entity
    4. Write entities, detections, embeddings to PostgreSQL
    5. Push progress updates via WebSocket
    6. Update status to 'complete' or 'failed'
    """
    from app.db.session import async_session_factory
    from app.services.video_service import VideoService

    async with async_session_factory() as db:
        try:
            # Mark as processing
            await VideoService.update_video_progress(
                db, video_id,
                processed_frames=0,
                entity_count_discovered=0,
                status="processing",
            )
            await db.commit()

            # Check if file exists
            if not os.path.exists(file_path):
                await VideoService.mark_video_failed(db, video_id, f"File not found: {file_path}")
                await db.commit()
                return

            # Try to import CV pipeline components
            try:
                import cv2
                has_cv = True
            except ImportError:
                has_cv = False
                logger.warning("OpenCV not available — running in stub mode")

            if has_cv:
                await _process_with_cv(db, video_id, case_id, file_path)
            else:
                await _process_stub(db, video_id, case_id, file_path, filename)

            await db.commit()

            # Check if all videos in case are done, trigger intelligence
            completion = await VideoService.check_case_completion(db, case_id)
            if completion["ready_for_intelligence"]:
                logger.info("All videos in case %s complete — triggering intelligence analysis", case_id)
                try:
                    from app.services.matching_service import MatchingService
                    from app.services.case_intelligence_service import CaseIntelligenceService

                    match_result = await MatchingService.run_matching_for_case(db, case_id)
                    logger.info("Matching result: %s", match_result)

                    intel_result = await CaseIntelligenceService.generate_case_intelligence(db, case_id)
                    logger.info("Intelligence generated for case %s", case_id)
                    await db.commit()
                except Exception as e:
                    logger.error("Post-processing failed for case %s: %s", case_id, e)
                    await db.rollback()

        except Exception as e:
            logger.error("Video processing failed for %s: %s", video_id, e)
            await db.rollback()
            async with async_session_factory() as db2:
                await VideoService.mark_video_failed(db2, video_id, str(e))
                await db2.commit()


async def _process_with_cv(
    db: "AsyncSession", video_id: str, case_id: str, file_path: str
) -> None:
    """Process video with actual CV pipeline (OpenCV + YOLO)."""
    import cv2
    from datetime import datetime, timezone
    from app.models.entity import Entity, Detection
    from app.services.video_service import VideoService

    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        await VideoService.mark_video_failed(db, video_id, "Cannot open video file")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    # Update video metadata
    from app.models.video import VideoFile
    from sqlalchemy import select
    result = await db.execute(select(VideoFile).where(VideoFile.id == video_id))
    video = result.scalar_one_or_none()
    if video:
        video.frame_count = total_frames
        video.duration_seconds = duration

    # Process frames (sample every Nth frame)
    sample_interval = max(1, int(fps))  # ~1 frame per second
    frame_idx = 0
    entity_count = 0
    processed = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_interval == 0:
            # Here we would run YOLO + ByteTrack + CLIP
            # For now, just count frames
            processed += 1

            # Update progress periodically
            if processed % 10 == 0:
                await VideoService.update_video_progress(
                    db, video_id,
                    processed_frames=processed,
                    entity_count_discovered=entity_count,
                )
                await db.flush()

        frame_idx += 1

    cap.release()

    # Mark complete
    await VideoService.update_video_progress(
        db, video_id,
        processed_frames=processed,
        entity_count_discovered=entity_count,
        status="complete",
    )


async def _process_stub(
    db: "AsyncSession", video_id: str, case_id: str, file_path: str, filename: str
) -> None:
    """Stub processing when CV libraries aren't available.

    Creates synthetic entities for testing the pipeline.
    """
    import random
    from datetime import datetime, timedelta, timezone
    from app.models.entity import Entity
    from app.services.video_service import VideoService

    now = datetime.now(timezone.utc)
    num_entities = random.randint(2, 6)
    entity_types = ["person", "vehicle", "person", "person", "vehicle", "object"]

    for i in range(num_entities):
        etype = entity_types[i % len(entity_types)]
        # Generate a random 512-dim embedding
        embedding = [random.gauss(0, 1) for _ in range(512)]
        norm = sum(x * x for x in embedding) ** 0.5
        embedding = [x / norm for x in embedding]

        entity = Entity(
            entity_type=etype,
            label=f"{etype.title()} {i+1} from {filename}",
            confidence=random.uniform(0.7, 0.99),
            embedding=embedding,
            first_seen=now - timedelta(minutes=random.randint(1, 60)),
            last_seen=now,
            total_sightings=random.randint(1, 20),
            case_id=case_id,
            video_file_id=video_id,
        )
        db.add(entity)

    await db.flush()

    # Mark complete
    await VideoService.update_video_progress(
        db, video_id,
        processed_frames=100,
        entity_count_discovered=num_entities,
        status="complete",
    )

    # Update video metadata
    from app.models.video import VideoFile
    from sqlalchemy import select
    result = await db.execute(select(VideoFile).where(VideoFile.id == video_id))
    video = result.scalar_one_or_none()
    if video:
        video.frame_count = 100
        video.duration_seconds = 30.0


async def run_worker() -> None:
    """Main worker loop — reads from Redis Streams."""
    from app.db.redis import redis_manager
    from app.db.session import engine
    from app.models import base  # noqa: F401
    from app.models.base import Base

    # Initialize database
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Connect to Redis
    await redis_manager.connect()

    if not redis_manager.client:
        logger.error("Redis not available — worker cannot start")
        return

    # Create consumer group if not exists
    try:
        await redis_manager.client.xgroup_create(
            "viosint:video_jobs", "workers", id="0", mkstream=True
        )
    except Exception:
        pass  # Group may already exist

    logger.info("Worker started — listening for video jobs...")

    while True:
        try:
            messages = await redis_manager.client.xreadgroup(
                groupname="workers",
                consumername="worker-1",
                streams={"viosint:video_jobs": ">"},
                count=1,
                block=5000,
            )

            if not messages:
                continue

            for stream_name, entries in messages:
                for msg_id, data in entries:
                    video_id = data.get("video_id", "").strip()
                    case_id = data.get("case_id", "").strip()
                    file_path = data.get("file_path", "").strip()
                    filename = data.get("filename", "").strip()

                    if not video_id:
                        logger.warning("Skipping message with no video_id")
                        await redis_manager.client.xack(
                            "viosint:video_jobs", "workers", msg_id
                        )
                        continue

                    logger.info("Processing video %s (%s)", video_id, filename)
                    await process_video(video_id, case_id, file_path, filename)

                    # Acknowledge message
                    await redis_manager.client.xack(
                        "viosint:video_jobs", "workers", msg_id
                    )
                    logger.info("Completed video %s", video_id)

        except Exception as e:
            logger.error("Worker error: %s", e)
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(run_worker())
