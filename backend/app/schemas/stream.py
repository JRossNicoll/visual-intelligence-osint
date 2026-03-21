"""Pydantic schemas for stream endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StreamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    source_type: str = Field(..., pattern="^(rtsp|file|webrtc)$")
    source_url: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_live: bool = False


class StreamUpdate(BaseModel):
    name: Optional[str] = None
    source_url: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_live: Optional[bool] = None


class StreamResponse(BaseModel):
    id: str
    name: str
    source_type: str
    source_url: Optional[str] = None
    file_path: Optional[str] = None
    status: str
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_live: bool
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    total_frames_processed: int = 0
    total_detections: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StreamStartRequest(BaseModel):
    processing_fps: Optional[int] = Field(default=10, ge=1, le=30)
    detection_confidence: Optional[float] = Field(default=0.5, ge=0.1, le=1.0)
    enable_tracking: bool = True
    enable_embedding: bool = True


class StreamStatusResponse(BaseModel):
    stream_id: str
    status: str
    current_fps: Optional[float] = None
    frames_processed: int = 0
    detections_count: int = 0
    active_tracks: int = 0
    uptime_seconds: Optional[float] = None
