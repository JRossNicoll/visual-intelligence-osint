"""Pipeline integration API endpoints.

Receives processed results from the CV pipeline service and stores them.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.neo4j import neo4j_manager
from app.db.session import get_db
from app.services.alert_service import AlertService
from app.services.entity_service import EntityService
from app.services.stream_service import StreamService
from app.services.target_service import TargetService
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


class PipelineDetection(BaseModel):
    label: str
    confidence: float
    bbox: tuple[float, float, float, float]  # x, y, w, h
    track_id: Optional[int] = None
    attributes: Optional[dict] = None
    embedding: Optional[list[float]] = None


class PipelineFrameResult(BaseModel):
    stream_id: str
    frame_number: int
    timestamp: Optional[str] = None
    detections: list[PipelineDetection]
    processing_fps: float = 0.0


class PipelineStatsUpdate(BaseModel):
    stream_id: str
    frames_processed: int
    detections_count: int
    active_tracks: int
    current_fps: float


@router.post("/frame-result")
async def receive_frame_result(
    result: PipelineFrameResult,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive processed frame results from the CV pipeline.

    This endpoint is called by the CV pipeline service after processing each frame.
    It handles:
    1. Storing detections in PostgreSQL
    2. Entity creation/matching
    3. Target matching and alert generation
    4. Broadcasting results via WebSocket
    """
    timestamp = (
        datetime.fromisoformat(result.timestamp)
        if result.timestamp
        else datetime.now(timezone.utc)
    )

    # Get active targets for matching
    active_targets = await TargetService.get_active_targets(db)

    ws_detections = []
    entities_in_frame: list[str] = []

    for det in result.detections:
        # Determine entity type from label
        entity_type = _classify_entity_type(det.label)

        # Create or match entity
        entity = await EntityService.create_or_match_entity(
            db=db,
            entity_type=entity_type,
            label=det.label,
            confidence=det.confidence,
            attributes=det.attributes,
            embedding=det.embedding,
            stream_id=result.stream_id,
            timestamp=timestamp,
        )

        # Store detection
        await EntityService.create_detection(
            db=db,
            stream_id=result.stream_id,
            frame_number=result.frame_number,
            timestamp=timestamp,
            label=det.label,
            confidence=det.confidence,
            bbox=det.bbox,
            track_id=det.track_id,
            entity_id=entity.id,
            attributes=det.attributes,
        )

        entities_in_frame.append(entity.id)

        # Check target matches
        matches = await TargetService.check_target_match(
            entity_embedding=det.embedding,
            entity_attributes=det.attributes,
            entity_type=entity_type,
            active_targets=active_targets,
        )

        # Create alerts for matches
        for target, score in matches:
            if target.alert_enabled:
                await AlertService.create_alert(
                    db=db,
                    alert_type="target_match",
                    severity=target.priority,
                    title=f"Target Match: {target.name}",
                    description=f"Entity '{entity.label}' matches target '{target.name}' with score {score:.2f}",
                    entity_id=entity.id,
                    target_id=target.id,
                    stream_id=result.stream_id,
                    confidence=det.confidence,
                    similarity_score=score,
                    frame_number=result.frame_number,
                    webhook_url=target.webhook_url,
                )

        ws_detections.append(
            {
                "entity_id": entity.id,
                "label": det.label,
                "confidence": det.confidence,
                "bbox": list(det.bbox),
                "track_id": det.track_id,
                "entity_type": entity_type,
                "attributes": det.attributes,
            }
        )

    # Create co-occurrence relationships in the graph
    for i, eid1 in enumerate(entities_in_frame):
        for eid2 in entities_in_frame[i + 1 :]:
            await neo4j_manager.create_co_occurred_relationship(
                eid1, eid2, timestamp.isoformat(), result.stream_id
            )

    # Broadcast to WebSocket clients
    await ws_manager.broadcast_to_stream(
        result.stream_id,
        {
            "type": "frame_detections",
            "stream_id": result.stream_id,
            "frame_number": result.frame_number,
            "timestamp": timestamp.isoformat(),
            "detections": ws_detections,
            "active_tracks": len(set(d.track_id for d in result.detections if d.track_id)),
            "fps": result.processing_fps,
        },
    )

    return {
        "status": "processed",
        "frame_number": result.frame_number,
        "detections_stored": len(result.detections),
        "entities_matched": len(entities_in_frame),
    }


@router.post("/stats")
async def update_pipeline_stats(data: PipelineStatsUpdate) -> dict:
    """Update real-time pipeline statistics."""
    await StreamService.update_stream_stats(
        stream_id=data.stream_id,
        frames_processed=data.frames_processed,
        detections_count=data.detections_count,
        active_tracks=data.active_tracks,
        current_fps=data.current_fps,
    )

    await ws_manager.broadcast_to_stream(
        data.stream_id,
        {
            "type": "stream_stats",
            "stream_id": data.stream_id,
            "frames_processed": data.frames_processed,
            "detections_count": data.detections_count,
            "active_tracks": data.active_tracks,
            "current_fps": data.current_fps,
        },
    )

    return {"status": "updated"}


def _classify_entity_type(label: str) -> str:
    """Classify a detection label into an entity type."""
    vehicle_labels = {
        "car", "truck", "bus", "motorcycle", "bicycle", "boat",
        "train", "airplane", "vehicle", "suv", "van", "sedan",
    }
    person_labels = {"person", "pedestrian", "human", "man", "woman", "child"}

    lower_label = label.lower()
    if lower_label in person_labels:
        return "person"
    if lower_label in vehicle_labels:
        return "vehicle"
    return "object"
