"""Video file model — belongs to a case, processed by the batch pipeline."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class VideoFile(Base, UUIDMixin, TimestampMixin):
    """A video file uploaded to a case for batch processing."""

    __tablename__ = "video_files"

    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Processing status
    status: Mapped[str] = mapped_column(
        String(20), default="queued", nullable=False, index=True
    )  # queued, processing, complete, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Video metadata (populated after processing)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    frame_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    processed_frames: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    entity_count_discovered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Processing timestamps
    processing_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    processing_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
