"""Case management models for structured intelligence cases."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Case(Base, UUIDMixin, TimestampMixin):
    """A structured intelligence case that groups evidence, entities, and alerts."""

    __tablename__ = "cases"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="open", nullable=False, index=True
    )  # open, active, closed

    # Priority and severity
    priority: Mapped[str] = mapped_column(
        String(20), default="medium", nullable=False
    )  # low, medium, high, critical
    severity: Mapped[str] = mapped_column(
        String(20), default="medium", nullable=False
    )  # low, medium, high, critical

    # Linked entities and alerts (summary counts)
    entity_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    alert_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Linked IDs stored as JSON arrays
    linked_entity_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    linked_alert_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Case metadata
    created_by: Mapped[str] = mapped_column(
        String(50), default="operator", nullable=False
    )  # operator, investigator, analyst, system
    assigned_to: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Source of case creation
    source_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # alert, entity, manual
    source_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Intelligence summary (auto-generated)
    summary_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps for lifecycle
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class CaseEvidence(Base, UUIDMixin, TimestampMixin):
    """Evidence attached to a case - events, patterns, relationships, risk scores."""

    __tablename__ = "case_evidence"

    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )

    evidence_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # event, alert, pattern, relationship, risk_score, behavior, insight

    # Reference to the source record
    source_table: Mapped[str] = mapped_column(String(100), nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), nullable=False)

    # Snapshot of the evidence at time of attachment
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Confidence and relevance
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    relevance_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Who added this evidence
    added_by: Mapped[str] = mapped_column(
        String(50), default="system", nullable=False
    )

    # For reproducibility: store parameters used to generate the insight
    computation_params: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class CaseNote(Base, UUIDMixin, TimestampMixin):
    """Analyst notes attached to a case."""

    __tablename__ = "case_notes"

    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    note_type: Mapped[str] = mapped_column(
        String(50), default="general", nullable=False
    )  # general, finding, action, decision


class AuditLog(Base, UUIDMixin, TimestampMixin):
    """Audit trail for all user actions and system-generated insights."""

    __tablename__ = "audit_logs"

    # Who performed the action
    actor: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    role: Mapped[str] = mapped_column(
        String(50), default="operator", nullable=False
    )  # operator, investigator, analyst, system

    # What was done
    action: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # case_created, evidence_added, alert_reviewed, query_executed, etc.
    resource_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # case, alert, entity, evidence, query
    resource_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Details
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamp of the action
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
