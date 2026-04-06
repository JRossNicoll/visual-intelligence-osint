"""Workflow orchestration models — definitions, triggers, steps, executions, SLAs.

Provides a real workflow engine beyond simple case pipelines: multi-step
processes with branching, conditions, approvals, escalations, and SLA tracking.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin

# ------------------------------------------------------------------ #
# Workflow Definitions
# ------------------------------------------------------------------ #


class WorkflowDefinition(Base, UUIDMixin, TimestampMixin):
    """A reusable workflow template defining a multi-step process.

    Workflows are directed acyclic graphs of steps. Each step can have
    conditions, actions, timeouts, and branching logic.
    """

    __tablename__ = "workflow_definitions"

    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    category: Mapped[str] = mapped_column(
        String(50), default="general", nullable=False,
    )  # investigation, alerting, enrichment, escalation, compliance, custom

    # Trigger configuration — what events start this workflow
    trigger_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    # E.g. {"type": "event", "event_types": ["alert_created", "entity_risk_high"],
    #        "conditions": [{"field": "severity", "op": "in", "value": ["critical","high"]}]}

    # Steps — ordered list of workflow steps (the DAG)
    steps: Mapped[list] = mapped_column(JSON, nullable=False)
    # Each step: {
    #   "id": "step_1",
    #   "name": "Initial Assessment",
    #   "type": "action|condition|approval|wait|parallel|subprocess",
    #   "config": {...},
    #   "on_success": "step_2",
    #   "on_failure": "step_error",
    #   "timeout_seconds": 3600,
    #   "sla_seconds": 7200,
    # }

    # Global SLA for entire workflow (seconds)
    sla_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    escalation_policy: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # E.g. {"levels": [
    #   {"after_seconds": 3600, "notify": ["analyst"], "action": "reassign"},
    #   {"after_seconds": 7200, "notify": ["admin"], "action": "escalate"},
    # ]}

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Execution stats
    total_executions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    successful_executions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_executions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


# ------------------------------------------------------------------ #
# Workflow Executions (instances)
# ------------------------------------------------------------------ #


class WorkflowExecution(Base, UUIDMixin, TimestampMixin):
    """A running or completed instance of a workflow."""

    __tablename__ = "workflow_executions"

    workflow_definition_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # What triggered this execution
    trigger_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )  # event, manual, scheduled, api, subprocess
    trigger_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Context — entities, cases, alerts involved
    context: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # E.g. {"entity_id": "...", "case_id": "...", "alert_id": "...", "data": {...}}

    # Execution state
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True,
    )  # pending, running, paused, waiting_approval, completed, failed, cancelled, timed_out

    current_step_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_step_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Timing
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # SLA tracking
    sla_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Assigned operator
    assigned_to: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    initiated_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)

    # Step execution log
    step_history: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # [{step_id, step_name, status, started_at, completed_at, result, ...}]

    # Output / result
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Linked resources
    entity_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("entities.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    case_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("cases.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    alert_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("alerts.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )


# ------------------------------------------------------------------ #
# Step Executions (individual step within a workflow run)
# ------------------------------------------------------------------ #


class StepExecution(Base, UUIDMixin, TimestampMixin):
    """Execution record for a single step within a workflow run."""

    __tablename__ = "step_executions"

    workflow_execution_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_executions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    step_id: Mapped[str] = mapped_column(String(100), nullable=False)
    step_name: Mapped[str] = mapped_column(String(200), nullable=False)
    step_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )  # action, condition, approval, wait, parallel, subprocess

    # Execution state
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True,
    )  # pending, running, completed, failed, skipped, waiting_approval, timed_out

    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Input / output
    input_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # For approval steps
    approval_requested_from: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    approval_decision: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    approval_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # SLA for this step
    sla_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Retry tracking
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


# ------------------------------------------------------------------ #
# Approval Requests
# ------------------------------------------------------------------ #


class ApprovalRequest(Base, UUIDMixin, TimestampMixin):
    """A pending approval request from a workflow step."""

    __tablename__ = "approval_requests"

    workflow_execution_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_executions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    step_execution_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("step_executions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # What needs approval
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Who can approve
    required_role: Mapped[str] = mapped_column(
        String(50), default="admin", nullable=False,
    )  # admin, analyst
    requested_from: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Decision
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True,
    )  # pending, approved, rejected, expired
    decided_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    decision_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Expiry
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Urgency
    priority: Mapped[str] = mapped_column(
        String(20), default="medium", nullable=False,
    )  # low, medium, high, critical
