"""Case intelligence — cached analysis results generated after all videos are processed."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class CaseIntelligence(Base, UUIDMixin, TimestampMixin):
    """Cached intelligence analysis results for a case.

    Generated automatically when all videos in a case are processed
    and identity matching is complete. Re-generated when new videos
    are added.
    """

    __tablename__ = "case_intelligence"

    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )

    # Analysis outputs (all stored as JSON)
    coordination_patterns: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    temporal_anomalies: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    risk_scores: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    sequence_patterns: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    group_anomalies: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    cross_video_timeline: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Summary for operator display
    summary_text: Mapped[Optional[str]] = mapped_column(nullable=True)
    entity_count: Mapped[int] = mapped_column(default=0, nullable=False)
    pattern_count: Mapped[int] = mapped_column(default=0, nullable=False)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
