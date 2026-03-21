"""Entity models for tracked objects (people, vehicles, objects)."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Entity(Base, UUIDMixin, TimestampMixin):
    """A persistent entity tracked across frames and sessions.

    Represents a unique real-world object (person, vehicle, etc.)
    that has been identified and tracked by the CV pipeline.
    """

    __tablename__ = "entities"

    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # person, vehicle, object
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    # Attributes extracted by CV pipeline
    attributes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # e.g., {"color": "white", "make": "Toyota", "model": "Hilux", "clothing": "red hoodie"}

    # Embedding vector stored as JSON array (for cross-session matching)
    embedding: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Thumbnail / reference image path
    thumbnail_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Tracking statistics
    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    total_sightings: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Source stream info
    first_stream_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    last_stream_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Cross-session match info
    match_cluster_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )


class Detection(Base, UUIDMixin, TimestampMixin):
    """A single detection event in a specific frame."""

    __tablename__ = "detections"

    stream_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    entity_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )
    frame_number: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Detection info
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_x: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_y: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_w: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_h: Mapped[float] = mapped_column(Float, nullable=False)

    # Tracking ID within the session
    track_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Attributes
    attributes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class Sighting(Base, UUIDMixin, TimestampMixin):
    """A sighting aggregates detections of an entity within a time window."""

    __tablename__ = "sightings"

    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    stream_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    first_frame: Mapped[int] = mapped_column(Integer, nullable=False)
    last_frame: Mapped[int] = mapped_column(Integer, nullable=False)
    first_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    detection_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    avg_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
