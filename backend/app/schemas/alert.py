"""Pydantic schemas for alert endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AlertResponse(BaseModel):
    id: str
    alert_type: str
    severity: str
    title: str
    description: Optional[str] = None
    entity_id: Optional[str] = None
    target_id: Optional[str] = None
    stream_id: Optional[str] = None
    confidence: Optional[float] = None
    similarity_score: Optional[float] = None
    frame_number: Optional[int] = None
    thumbnail_path: Optional[str] = None
    is_read: bool
    is_acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    webhook_delivered: bool
    metadata_json: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AlertAcknowledgeRequest(BaseModel):
    is_acknowledged: bool = True


class AlertQueryParams(BaseModel):
    alert_type: Optional[str] = None
    severity: Optional[str] = None
    is_read: Optional[bool] = None
    is_acknowledged: Optional[bool] = None
    entity_id: Optional[str] = None
    target_id: Optional[str] = None
    stream_id: Optional[str] = None
    from_time: Optional[datetime] = None
    to_time: Optional[datetime] = None
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)
