"""Pydantic schemas for target definition endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TargetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    target_type: str = Field(..., pattern="^(person|vehicle|object)$")
    text_query: Optional[str] = None
    similarity_threshold: float = Field(default=0.75, ge=0.1, le=1.0)
    attribute_filters: Optional[dict] = None
    alert_enabled: bool = True
    webhook_url: Optional[str] = None
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")


class TargetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    text_query: Optional[str] = None
    is_active: Optional[bool] = None
    similarity_threshold: Optional[float] = Field(default=None, ge=0.1, le=1.0)
    attribute_filters: Optional[dict] = None
    alert_enabled: Optional[bool] = None
    webhook_url: Optional[str] = None
    priority: Optional[str] = Field(
        default=None, pattern="^(low|medium|high|critical)$"
    )


class TargetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    target_type: str
    is_active: bool
    text_query: Optional[str] = None
    reference_image_path: Optional[str] = None
    similarity_threshold: float
    attribute_filters: Optional[dict] = None
    alert_enabled: bool
    webhook_url: Optional[str] = None
    total_matches: int
    priority: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TargetMatchEvent(BaseModel):
    target_id: str
    target_name: str
    entity_id: str
    stream_id: str
    similarity_score: float
    confidence: float
    timestamp: datetime
    thumbnail_path: Optional[str] = None
    attributes: Optional[dict] = None
