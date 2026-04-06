"""Pydantic schemas for entity endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EntityResponse(BaseModel):
    id: str
    entity_type: str
    label: str
    confidence: float
    attributes: Optional[dict] = None
    thumbnail_path: Optional[str] = None
    first_seen: datetime
    last_seen: datetime
    total_sightings: int
    first_stream_id: Optional[str] = None
    last_stream_id: Optional[str] = None
    match_cluster_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EntitySearchRequest(BaseModel):
    entity_type: Optional[str] = None
    label: Optional[str] = None
    text_query: Optional[str] = None
    min_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    attributes: Optional[dict] = None
    stream_id: Optional[str] = None
    from_time: Optional[datetime] = None
    to_time: Optional[datetime] = None
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class DetectionResponse(BaseModel):
    id: str
    stream_id: str
    entity_id: Optional[str] = None
    frame_number: int
    timestamp: datetime
    label: str
    confidence: float
    bbox_x: float
    bbox_y: float
    bbox_w: float
    bbox_h: float
    track_id: Optional[int] = None
    attributes: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SightingResponse(BaseModel):
    id: str
    entity_id: str
    stream_id: str
    first_frame: int
    last_frame: int
    first_timestamp: datetime
    last_timestamp: datetime
    detection_count: int
    avg_confidence: float
    thumbnail_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EntityGraphResponse(BaseModel):
    nodes: list[dict]
    edges: list[dict]


class EntityTimelineEntry(BaseModel):
    timestamp: datetime
    stream_id: str
    stream_name: Optional[str] = None
    location_name: Optional[str] = None
    confidence: float
    thumbnail_path: Optional[str] = None
