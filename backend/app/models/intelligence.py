"""Intelligence models for behavioral analysis, profiling, and risk scoring."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class EntityProfile(Base, UUIDMixin, TimestampMixin):
    """Dynamic intelligence profile for a tracked entity.

    Aggregates behavioral patterns, location history, associations,
    and risk scoring into a single queryable record.
    """

    __tablename__ = "entity_profiles"

    entity_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Temporal statistics
    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    visit_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    total_duration_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Location intelligence
    common_locations: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # e.g., [{"location_id": "...", "name": "...", "visit_count": 12, "avg_duration": 300}]
    last_location_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    last_location_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Behavioral analysis
    behavior_summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # e.g., {"primary_behavior": "routine_visitor", "loitering_score": 0.2, ...}
    behavior_tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # e.g., ["routine_visitor", "short_stay", "daytime_only"]

    # Temporal patterns
    temporal_pattern: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # e.g., {"peak_hours": [8, 17], "peak_days": ["mon", "tue"], "avg_interval_hours": 24.5}

    # Association intelligence
    associated_entities: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # e.g., [{"entity_id": "...", "strength": 0.85, "co_occurrences": 12}]
    association_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Risk scoring
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, index=True)
    risk_factors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # e.g., [{"factor": "unusual_time", "weight": 0.3, "detail": "Appeared at 02:13"}]
    risk_level: Mapped[str] = mapped_column(
        String(20), default="low", nullable=False
    )  # low, medium, high, critical

    # Prediction data
    predicted_next_location: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # e.g., {"location_id": "...", "name": "...", "probability": 0.78}
    predicted_next_time: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # e.g., {"window_start": "2024-01-15T08:00:00Z", "window_end": "...", "probability": 0.82}

    # Profile completeness
    profile_completeness: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Last analysis timestamp
    last_analyzed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class TemporalEvent(Base, UUIDMixin, TimestampMixin):
    """A timestamped intelligence event for temporal analysis.

    Records entity appearances with full context for pattern mining.
    """

    __tablename__ = "temporal_events"

    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    stream_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    location_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    location_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # appearance, departure, reappearance, anomaly, co_occurrence

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Context
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    attributes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    co_occurring_entities: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Day/time decomposition for pattern analysis
    hour_of_day: Mapped[int] = mapped_column(Integer, nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday
    is_weekend: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class BehaviorRecord(Base, UUIDMixin, TimestampMixin):
    """A detected behavior pattern for an entity."""

    __tablename__ = "behavior_records"

    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    behavior_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # loitering, repeated_visit, convoy, short_stay, long_stay, routine, anomaly

    # Behavior details
    description: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20), default="low", nullable=False
    )  # low, medium, high, critical

    # Context
    location_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    location_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stream_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Temporal context
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Associated entities (for convoy/group detection)
    associated_entity_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Pattern details
    pattern_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # e.g., for routine: {"frequency": "daily", "typical_time": "08:00", "variance_minutes": 15}

    # Is this behavior ongoing?
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class IntelligenceInsight(Base, UUIDMixin, TimestampMixin):
    """A generated intelligence insight from pattern analysis."""

    __tablename__ = "intelligence_insights"

    insight_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # pattern, anomaly, prediction, association, risk_change

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20), default="info", nullable=False
    )  # info, low, medium, high, critical

    # Related entities
    entity_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    location_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    stream_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Confidence and evidence
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    evidence: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # e.g., {"supporting_events": [...], "pattern_strength": 0.9}

    # Actionable recommendation
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Has this been reviewed?
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
