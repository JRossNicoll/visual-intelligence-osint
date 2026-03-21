"""Alert models for intelligence notifications."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Alert(Base, UUIDMixin, TimestampMixin):
    """An alert triggered by the intelligence system."""

    __tablename__ = "alerts"

    alert_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # target_match, reappearance, anomaly
    severity: Mapped[str] = mapped_column(
        String(20), default="medium", nullable=False
    )  # low, medium, high, critical
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Related entities
    entity_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )
    target_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )
    stream_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )

    # Detection details
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    similarity_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    frame_number: Mapped[Optional[int]] = mapped_column(nullable=True)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Alert state
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_acknowledged: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Webhook delivery
    webhook_delivered: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    webhook_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Additional context
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
