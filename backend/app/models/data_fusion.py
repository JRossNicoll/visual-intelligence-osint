"""Enterprise Data Fusion models — source registry, ingestion records, correlation.

Enables the platform to ingest and fuse intelligence from many external systems
(ALPR, access control, financial, SIGINT, HUMINT, social media, etc.) and
correlate them with video-derived entities.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin

# ------------------------------------------------------------------ #
# Data Source Registry
# ------------------------------------------------------------------ #


class DataSource(Base, UUIDMixin, TimestampMixin):
    """An external system that feeds data into the platform.

    Examples: ALPR camera network, building access control, financial
    transaction feeds, social media monitors, radio intercepts.
    """

    __tablename__ = "data_sources"

    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Source classification
    source_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
    )  # alpr, access_control, financial, social_media, sigint, humint, cyber, geoint, video, manual

    adapter_type: Mapped[str] = mapped_column(
        String(50), default="generic_api", nullable=False,
    )  # generic_api, csv_upload, webhook_receiver, database_poll, mqtt, syslog, manual

    # Connection configuration (encrypted at rest in production)
    connection_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # E.g. {"url": "...", "auth_type": "bearer", "poll_interval_seconds": 60}

    # Data mapping — how this source's fields map to the ontology
    field_mapping: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # E.g. {"plate_number": "entity.attributes.license_plate", "camera_id": "location"}

    # Source reliability (Admiralty/NATO system: A-F for reliability, 1-6 for credibility)
    reliability_rating: Mapped[str] = mapped_column(
        String(1), default="C", nullable=False,
    )  # A=completely reliable, B=usually reliable, C=fairly reliable, D=not usually reliable, E=unreliable, F=unknown
    credibility_rating: Mapped[str] = mapped_column(
        String(1), default="3", nullable=False,
    )  # 1=confirmed, 2=probably true, 3=possibly true, 4=doubtfully true, 5=improbable, 6=unknown

    # Computed confidence weight (0.0 - 1.0) derived from reliability + credibility
    confidence_weight: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, index=True,
    )  # active, paused, error, disabled

    # Health tracking
    last_heartbeat_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    last_ingestion_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    total_records_ingested: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ------------------------------------------------------------------ #
# Ingested Records
# ------------------------------------------------------------------ #


class IngestedRecord(Base, UUIDMixin, TimestampMixin):
    """A single record ingested from an external data source.

    Raw data is stored alongside normalized (ontology-mapped) data.
    """

    __tablename__ = "ingested_records"

    data_source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Raw data as received
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    raw_timestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # External ID from the source system (for dedup)
    external_id: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, index=True,
    )

    # Normalized data (mapped to ontology schema)
    normalized_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Extracted entity hints — fields that might match existing entities
    entity_hints: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # E.g. {"license_plate": "ABC123", "face_embedding": [...], "name": "John Doe"}

    # Processing state
    processing_status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True,
    )  # pending, processing, correlated, unmatched, failed

    # Confidence inherited from source
    source_confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)

    # Location context
    location_name: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


# ------------------------------------------------------------------ #
# Correlation Records
# ------------------------------------------------------------------ #


class CorrelationRecord(Base, UUIDMixin, TimestampMixin):
    """Links an ingested record to an existing entity with a correlation score.

    Represents the fusion decision: "this external data point likely refers
    to this tracked entity."
    """

    __tablename__ = "correlation_records"

    ingested_record_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ingested_records.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    entity_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    data_source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_sources.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Correlation details
    correlation_method: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )  # embedding_similarity, attribute_match, temporal_proximity, manual, composite

    correlation_score: Mapped[float] = mapped_column(Float, nullable=False)
    # Weighted by source confidence
    weighted_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Which fields matched
    matching_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # E.g. {"license_plate": {"match": true, "score": 1.0}, "location": {"match": true, "proximity_m": 50}}

    # Review state (for uncertain correlations)
    status: Mapped[str] = mapped_column(
        String(20), default="auto_accepted", nullable=False, index=True,
    )  # auto_accepted, pending_review, accepted, rejected

    reviewed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Enrichment applied to the entity from this record
    enrichment_applied: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


# ------------------------------------------------------------------ #
# Fusion Summary (per entity — aggregated view of all sources)
# ------------------------------------------------------------------ #


class FusionSummary(Base, UUIDMixin, TimestampMixin):
    """Aggregated data fusion summary for an entity across all sources.

    Provides a single view: "here is everything we know about this entity
    from all systems combined, with confidence-weighted attributes."
    """

    __tablename__ = "fusion_summaries"

    entity_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )

    # Number of sources that contributed data
    source_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correlation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Confidence-weighted merged attributes
    # Each attribute: {"value": ..., "confidence": 0.92, "sources": ["alpr", "access_ctrl"]}
    fused_attributes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Source breakdown
    source_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # E.g. {"alpr": {"count": 12, "last_seen": "..."}, "access_control": {"count": 3, ...}}

    # Overall confidence (weighted average across all sources)
    overall_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Last time this summary was recomputed
    last_computed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
