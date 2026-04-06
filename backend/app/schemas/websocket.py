"""WebSocket message schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class WSMessage(BaseModel):
    """Base WebSocket message."""

    type: str
    timestamp: datetime
    data: Any


class WSDetectionFrame(BaseModel):
    """Real-time detection data for a single frame."""

    stream_id: str
    frame_number: int
    timestamp: datetime
    detections: list[dict]
    active_tracks: int
    fps: float


class WSAlertNotification(BaseModel):
    """Real-time alert notification."""

    alert_id: str
    alert_type: str
    severity: str
    title: str
    entity_id: Optional[str] = None
    target_id: Optional[str] = None
    stream_id: Optional[str] = None
    similarity_score: Optional[float] = None
    timestamp: datetime


class WSStreamStatus(BaseModel):
    """Stream status update."""

    stream_id: str
    status: str
    fps: Optional[float] = None
    frames_processed: int = 0
    active_tracks: int = 0


class WSEntityUpdate(BaseModel):
    """Entity update notification."""

    entity_id: str
    entity_type: str
    label: str
    action: str  # new, updated, matched
    stream_id: Optional[str] = None
    timestamp: datetime
