"""Workflow orchestration service — definition management, execution engine, approvals, SLAs.

Goes beyond simple case pipelines: supports multi-step workflows with branching,
conditions, approvals, escalations, and SLA tracking.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import (
    ApprovalRequest,
    StepExecution,
    WorkflowDefinition,
    WorkflowExecution,
)

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
# Built-in workflow templates
# ------------------------------------------------------------------ #

BUILTIN_WORKFLOWS = [
    {
        "name": "high_risk_entity_investigation",
        "display_name": "High Risk Entity Investigation",
        "description": "Automated workflow triggered when an entity's risk score exceeds threshold. Enriches data, creates case, assigns analyst.",
        "category": "investigation",
        "trigger_config": {
            "type": "event",
            "event_types": ["entity_risk_high"],
            "conditions": [
                {"field": "risk_score", "op": ">=", "value": 0.8},
            ],
        },
        "steps": [
            {
                "id": "step_1",
                "name": "Enrich Entity Data",
                "type": "action",
                "config": {
                    "action": "enrich_entity",
                    "params": {"sources": ["all"]},
                },
                "on_success": "step_2",
                "on_failure": "step_error",
                "timeout_seconds": 120,
            },
            {
                "id": "step_2",
                "name": "Create Intelligence Case",
                "type": "action",
                "config": {
                    "action": "create_case",
                    "params": {
                        "title": "High Risk Entity Investigation - {{entity.label}}",
                        "priority": "high",
                    },
                },
                "on_success": "step_3",
                "on_failure": "step_error",
                "timeout_seconds": 30,
            },
            {
                "id": "step_3",
                "name": "Alert Operations Team",
                "type": "action",
                "config": {
                    "action": "send_notification",
                    "params": {
                        "recipients": ["admin"],
                        "message": "High risk entity detected: {{entity.label}} (score: {{entity.risk_score}})",
                        "channel": "ui",
                    },
                },
                "on_success": "step_4",
                "on_failure": "step_error",
                "timeout_seconds": 30,
            },
            {
                "id": "step_4",
                "name": "Analyst Review",
                "type": "approval",
                "config": {
                    "required_role": "analyst",
                    "description": "Review high-risk entity and determine next steps",
                    "options": ["escalate", "monitor", "dismiss"],
                },
                "on_success": "step_5",
                "on_failure": "step_error",
                "timeout_seconds": 7200,
                "sla_seconds": 3600,
            },
            {
                "id": "step_5",
                "name": "Apply Decision",
                "type": "condition",
                "config": {
                    "field": "approval_decision",
                    "branches": {
                        "escalate": "step_escalate",
                        "monitor": "step_monitor",
                        "dismiss": "step_dismiss",
                    },
                },
            },
            {
                "id": "step_escalate",
                "name": "Escalate to Admin",
                "type": "action",
                "config": {
                    "action": "escalate_case",
                    "params": {"new_priority": "critical", "reason": "Analyst escalation"},
                },
                "on_success": "step_done",
            },
            {
                "id": "step_monitor",
                "name": "Add to Watchlist",
                "type": "action",
                "config": {
                    "action": "add_to_watchlist",
                    "params": {"reason": "Under monitoring", "expiry_hours": 72},
                },
                "on_success": "step_done",
            },
            {
                "id": "step_dismiss",
                "name": "Close Case",
                "type": "action",
                "config": {"action": "update_case_status", "params": {"status": "closed"}},
                "on_success": "step_done",
            },
            {"id": "step_done", "name": "Workflow Complete", "type": "action", "config": {}},
            {
                "id": "step_error",
                "name": "Error Handler",
                "type": "action",
                "config": {
                    "action": "send_notification",
                    "params": {
                        "recipients": ["admin"],
                        "message": "Workflow error in high-risk investigation",
                        "channel": "ui",
                    },
                },
            },
        ],
        "sla_seconds": 14400,
        "escalation_policy": {
            "levels": [
                {"after_seconds": 3600, "notify": ["analyst"], "action": "reminder"},
                {"after_seconds": 7200, "notify": ["admin"], "action": "reassign"},
                {"after_seconds": 14400, "notify": ["admin"], "action": "escalate"},
            ],
        },
    },
    {
        "name": "coordinated_activity_response",
        "display_name": "Coordinated Activity Response",
        "description": "Triggered when coordinated behavior is detected among multiple entities.",
        "category": "investigation",
        "trigger_config": {
            "type": "event",
            "event_types": ["coordination_detected"],
            "conditions": [
                {"field": "entity_count", "op": ">=", "value": 3},
            ],
        },
        "steps": [
            {
                "id": "step_1",
                "name": "Create Coordination Case",
                "type": "action",
                "config": {
                    "action": "create_case",
                    "params": {
                        "title": "Coordinated Activity Alert - {{entity_count}} entities",
                        "priority": "critical",
                    },
                },
                "on_success": "step_2",
                "on_failure": "step_error",
            },
            {
                "id": "step_2",
                "name": "Enrich All Entities",
                "type": "parallel",
                "config": {
                    "action": "enrich_entity",
                    "iterate_over": "entity_ids",
                },
                "on_success": "step_3",
                "on_failure": "step_error",
            },
            {
                "id": "step_3",
                "name": "Admin Review Required",
                "type": "approval",
                "config": {
                    "required_role": "admin",
                    "description": "Review coordinated activity involving {{entity_count}} entities",
                    "priority": "critical",
                },
                "on_success": "step_done",
                "on_failure": "step_error",
                "sla_seconds": 1800,
            },
            {"id": "step_done", "name": "Complete", "type": "action", "config": {}},
            {
                "id": "step_error",
                "name": "Error Handler",
                "type": "action",
                "config": {
                    "action": "send_notification",
                    "params": {
                        "recipients": ["admin"],
                        "message": "Coordinated activity workflow error",
                        "channel": "ui",
                    },
                },
            },
        ],
        "sla_seconds": 3600,
    },
    {
        "name": "new_entity_onboarding",
        "display_name": "New Entity Onboarding",
        "description": "Enrich and classify newly detected entities across all data sources.",
        "category": "enrichment",
        "trigger_config": {
            "type": "event",
            "event_types": ["entity_created"],
        },
        "steps": [
            {
                "id": "step_1",
                "name": "Classify Entity Type",
                "type": "action",
                "config": {"action": "classify_entity"},
                "on_success": "step_2",
                "on_failure": "step_done",
            },
            {
                "id": "step_2",
                "name": "Fusion Enrichment",
                "type": "action",
                "config": {
                    "action": "enrich_entity",
                    "params": {"sources": ["all"]},
                },
                "on_success": "step_3",
                "on_failure": "step_done",
                "timeout_seconds": 300,
            },
            {
                "id": "step_3",
                "name": "Risk Assessment",
                "type": "action",
                "config": {"action": "compute_risk_score"},
                "on_success": "step_4",
                "on_failure": "step_done",
            },
            {
                "id": "step_4",
                "name": "Check Risk Threshold",
                "type": "condition",
                "config": {
                    "field": "risk_score",
                    "branches": {
                        "high": "step_alert",
                        "default": "step_done",
                    },
                    "threshold": 0.7,
                },
            },
            {
                "id": "step_alert",
                "name": "Alert on High Risk",
                "type": "action",
                "config": {
                    "action": "create_alert",
                    "params": {"severity": "high", "title": "New high-risk entity detected"},
                },
                "on_success": "step_done",
            },
            {"id": "step_done", "name": "Complete", "type": "action", "config": {}},
        ],
        "sla_seconds": 600,
    },
    {
        "name": "alert_triage",
        "display_name": "Alert Triage Workflow",
        "description": "Standard triage process for incoming alerts: auto-classify, assign, track SLA.",
        "category": "alerting",
        "trigger_config": {
            "type": "event",
            "event_types": ["alert_created"],
        },
        "steps": [
            {
                "id": "step_1",
                "name": "Auto-Classify Severity",
                "type": "action",
                "config": {"action": "classify_alert"},
                "on_success": "step_2",
                "on_failure": "step_2",
            },
            {
                "id": "step_2",
                "name": "Route to Analyst",
                "type": "condition",
                "config": {
                    "field": "severity",
                    "branches": {
                        "critical": "step_critical",
                        "high": "step_high",
                        "default": "step_standard",
                    },
                },
            },
            {
                "id": "step_critical",
                "name": "Critical Alert — Admin Approval",
                "type": "approval",
                "config": {
                    "required_role": "admin",
                    "description": "Critical alert requires immediate admin review",
                    "priority": "critical",
                },
                "on_success": "step_done",
                "sla_seconds": 900,
            },
            {
                "id": "step_high",
                "name": "High Alert — Analyst Review",
                "type": "approval",
                "config": {
                    "required_role": "analyst",
                    "description": "High-severity alert requires analyst review",
                    "priority": "high",
                },
                "on_success": "step_done",
                "sla_seconds": 3600,
            },
            {
                "id": "step_standard",
                "name": "Standard Processing",
                "type": "action",
                "config": {"action": "auto_acknowledge"},
                "on_success": "step_done",
            },
            {"id": "step_done", "name": "Triage Complete", "type": "action", "config": {}},
        ],
        "sla_seconds": 7200,
    },
    {
        "name": "data_source_health_check",
        "display_name": "Data Source Health Check",
        "description": "Periodic workflow to verify all data sources are responsive and ingesting.",
        "category": "compliance",
        "trigger_config": {
            "type": "scheduled",
            "cron": "0 */6 * * *",
        },
        "steps": [
            {
                "id": "step_1",
                "name": "Check All Sources",
                "type": "action",
                "config": {"action": "check_source_health"},
                "on_success": "step_2",
                "on_failure": "step_error",
            },
            {
                "id": "step_2",
                "name": "Evaluate Results",
                "type": "condition",
                "config": {
                    "field": "unhealthy_count",
                    "branches": {
                        "alert": "step_alert",
                        "default": "step_done",
                    },
                    "threshold": 1,
                },
            },
            {
                "id": "step_alert",
                "name": "Alert on Unhealthy Sources",
                "type": "action",
                "config": {
                    "action": "create_alert",
                    "params": {
                        "severity": "medium",
                        "title": "Data source health check failed",
                    },
                },
                "on_success": "step_done",
            },
            {"id": "step_done", "name": "Complete", "type": "action", "config": {}},
            {
                "id": "step_error",
                "name": "Error",
                "type": "action",
                "config": {
                    "action": "send_notification",
                    "params": {
                        "recipients": ["admin"],
                        "message": "Health check workflow failed",
                        "channel": "ui",
                    },
                },
            },
        ],
        "sla_seconds": 1800,
    },
]


class WorkflowService:
    """Manages workflow definitions, execution, approvals, and SLA tracking."""

    # ------------------------------------------------------------------ #
    # Seed built-ins
    # ------------------------------------------------------------------ #

    @staticmethod
    async def seed_builtins(db: AsyncSession) -> dict:
        """Seed built-in workflow definitions."""
        stats = {"workflows": 0}
        for spec in BUILTIN_WORKFLOWS:
            existing = await db.execute(
                select(WorkflowDefinition).where(WorkflowDefinition.name == spec["name"])
            )
            if existing.scalar_one_or_none():
                continue
            wf = WorkflowDefinition(
                name=spec["name"],
                display_name=spec["display_name"],
                description=spec.get("description"),
                category=spec.get("category", "general"),
                trigger_config=spec["trigger_config"],
                steps=spec["steps"],
                sla_seconds=spec.get("sla_seconds"),
                escalation_policy=spec.get("escalation_policy"),
                is_template=True,
            )
            db.add(wf)
            stats["workflows"] += 1
        await db.flush()
        logger.info("Workflow seed complete: %s", stats)
        return stats

    # ------------------------------------------------------------------ #
    # Workflow Definition CRUD
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_definitions(
        db: AsyncSession,
        *,
        category: Optional[str] = None,
        active_only: bool = True,
        limit: int = 50,
    ) -> list[dict]:
        conditions = []
        if category:
            conditions.append(WorkflowDefinition.category == category)
        if active_only:
            conditions.append(WorkflowDefinition.is_active == True)  # noqa: E712
        query = select(WorkflowDefinition)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(WorkflowDefinition.name).limit(limit)
        result = await db.execute(query)
        return [_definition_to_dict(wf) for wf in result.scalars().all()]

    @staticmethod
    async def get_definition(db: AsyncSession, def_id: str) -> Optional[dict]:
        result = await db.execute(
            select(WorkflowDefinition).where(WorkflowDefinition.id == def_id)
        )
        wf = result.scalar_one_or_none()
        return _definition_to_dict(wf) if wf else None

    @staticmethod
    async def create_definition(
        db: AsyncSession,
        *,
        name: str,
        display_name: str,
        description: str = "",
        category: str = "custom",
        trigger_config: dict,
        steps: list,
        sla_seconds: Optional[int] = None,
        escalation_policy: Optional[dict] = None,
    ) -> dict:
        wf = WorkflowDefinition(
            name=name,
            display_name=display_name,
            description=description,
            category=category,
            trigger_config=trigger_config,
            steps=steps,
            sla_seconds=sla_seconds,
            escalation_policy=escalation_policy,
            is_template=False,
        )
        db.add(wf)
        await db.flush()
        return _definition_to_dict(wf)

    @staticmethod
    async def update_definition(
        db: AsyncSession, def_id: str, **kwargs: object
    ) -> Optional[dict]:
        result = await db.execute(
            select(WorkflowDefinition).where(WorkflowDefinition.id == def_id)
        )
        wf = result.scalar_one_or_none()
        if not wf:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(wf, key):
                setattr(wf, key, value)
        wf.version += 1
        wf.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return _definition_to_dict(wf)

    @staticmethod
    async def delete_definition(db: AsyncSession, def_id: str) -> bool:
        result = await db.execute(
            select(WorkflowDefinition).where(WorkflowDefinition.id == def_id)
        )
        wf = result.scalar_one_or_none()
        if not wf:
            return False
        await db.delete(wf)
        await db.flush()
        return True

    # ------------------------------------------------------------------ #
    # Workflow Execution
    # ------------------------------------------------------------------ #

    @staticmethod
    async def start_execution(
        db: AsyncSession,
        *,
        workflow_definition_id: str,
        trigger_type: str = "manual",
        trigger_data: Optional[dict] = None,
        context: Optional[dict] = None,
        initiated_by: str = "system",
        entity_id: Optional[str] = None,
        case_id: Optional[str] = None,
        alert_id: Optional[str] = None,
    ) -> dict:
        """Start a new workflow execution."""
        # Get the definition
        def_result = await db.execute(
            select(WorkflowDefinition).where(
                WorkflowDefinition.id == workflow_definition_id
            )
        )
        wf_def = def_result.scalar_one_or_none()
        if not wf_def:
            raise ValueError(f"Workflow definition {workflow_definition_id} not found")

        now = datetime.now(timezone.utc)
        sla_deadline = None
        if wf_def.sla_seconds:
            sla_deadline = now + timedelta(seconds=wf_def.sla_seconds)

        # Find the first step
        steps = wf_def.steps or []
        first_step = steps[0] if steps else None

        execution = WorkflowExecution(
            workflow_definition_id=workflow_definition_id,
            trigger_type=trigger_type,
            trigger_data=trigger_data,
            context=context or {},
            status="running",
            current_step_id=first_step["id"] if first_step else None,
            current_step_name=first_step["name"] if first_step else None,
            started_at=now,
            sla_deadline=sla_deadline,
            initiated_by=initiated_by,
            step_history=[],
            entity_id=entity_id,
            case_id=case_id,
            alert_id=alert_id,
        )
        db.add(execution)
        await db.flush()

        # Create first step execution
        if first_step:
            step_exec = StepExecution(
                workflow_execution_id=execution.id,
                step_id=first_step["id"],
                step_name=first_step["name"],
                step_type=first_step.get("type", "action"),
                status="running",
                started_at=now,
                sla_deadline=(
                    now + timedelta(seconds=first_step["sla_seconds"])
                    if first_step.get("sla_seconds")
                    else None
                ),
            )
            db.add(step_exec)
            await db.flush()

        # Update definition stats
        wf_def.total_executions += 1

        await db.flush()
        logger.info(
            "Started workflow execution: %s (def=%s, trigger=%s)",
            execution.id, wf_def.name, trigger_type,
        )
        return _execution_to_dict(execution)

    @staticmethod
    async def advance_execution(
        db: AsyncSession,
        execution_id: str,
        *,
        step_result: Optional[dict] = None,
    ) -> dict:
        """Advance a workflow execution to the next step."""
        exec_result = await db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
        )
        execution = exec_result.scalar_one_or_none()
        if not execution:
            raise ValueError(f"Execution {execution_id} not found")

        now = datetime.now(timezone.utc)

        # Get current step execution
        current_step_exec = None
        if execution.current_step_id:
            step_result_q = await db.execute(
                select(StepExecution).where(
                    and_(
                        StepExecution.workflow_execution_id == execution_id,
                        StepExecution.step_id == execution.current_step_id,
                        StepExecution.status == "running",
                    )
                )
            )
            current_step_exec = step_result_q.scalar_one_or_none()

        # Complete current step
        if current_step_exec:
            current_step_exec.status = "completed"
            current_step_exec.completed_at = now
            current_step_exec.output_data = step_result

        # Record in step history
        history = execution.step_history or []
        history.append({
            "step_id": execution.current_step_id,
            "step_name": execution.current_step_name,
            "status": "completed",
            "completed_at": now.isoformat(),
            "result": step_result,
        })
        execution.step_history = history

        # Get workflow definition to find next step
        def_result = await db.execute(
            select(WorkflowDefinition).where(
                WorkflowDefinition.id == execution.workflow_definition_id
            )
        )
        wf_def = def_result.scalar_one_or_none()
        if not wf_def:
            execution.status = "failed"
            execution.error_message = "Workflow definition not found"
            await db.flush()
            return _execution_to_dict(execution)

        # Find next step
        current_step_spec = None
        for step in wf_def.steps:
            if step["id"] == execution.current_step_id:
                current_step_spec = step
                break

        next_step_id = None
        if current_step_spec:
            # Handle condition branching
            if current_step_spec.get("type") == "condition":
                branches = current_step_spec.get("config", {}).get("branches", {})
                decision = (step_result or {}).get("decision", "default")
                next_step_id = branches.get(decision, branches.get("default"))
            else:
                next_step_id = current_step_spec.get("on_success")

        if not next_step_id:
            # Workflow complete
            execution.status = "completed"
            execution.completed_at = now
            execution.duration_seconds = (now - execution.started_at).total_seconds() if execution.started_at else None
            execution.result = step_result

            # Update definition stats
            wf_def.successful_executions += 1
            if execution.duration_seconds:
                if wf_def.avg_duration_seconds:
                    wf_def.avg_duration_seconds = (
                        wf_def.avg_duration_seconds * 0.9 + execution.duration_seconds * 0.1
                    )
                else:
                    wf_def.avg_duration_seconds = execution.duration_seconds
        else:
            # Find next step spec
            next_step_spec = None
            for step in wf_def.steps:
                if step["id"] == next_step_id:
                    next_step_spec = step
                    break

            if next_step_spec:
                execution.current_step_id = next_step_id
                execution.current_step_name = next_step_spec.get("name", "")

                # Handle approval steps
                if next_step_spec.get("type") == "approval":
                    execution.status = "waiting_approval"
                    # Create approval request
                    config = next_step_spec.get("config", {})
                    step_exec = StepExecution(
                        workflow_execution_id=execution.id,
                        step_id=next_step_id,
                        step_name=next_step_spec["name"],
                        step_type="approval",
                        status="waiting_approval",
                        started_at=now,
                        approval_requested_from=config.get("required_role", "admin"),
                        sla_deadline=(
                            now + timedelta(seconds=next_step_spec["sla_seconds"])
                            if next_step_spec.get("sla_seconds")
                            else None
                        ),
                    )
                    db.add(step_exec)
                    await db.flush()

                    approval = ApprovalRequest(
                        workflow_execution_id=execution.id,
                        step_execution_id=step_exec.id,
                        title=config.get("description", next_step_spec["name"]),
                        description=config.get("description"),
                        context_data=execution.context,
                        required_role=config.get("required_role", "admin"),
                        priority=config.get("priority", "medium"),
                        expires_at=(
                            now + timedelta(seconds=next_step_spec["sla_seconds"])
                            if next_step_spec.get("sla_seconds")
                            else None
                        ),
                    )
                    db.add(approval)
                else:
                    # Create next step execution
                    step_exec = StepExecution(
                        workflow_execution_id=execution.id,
                        step_id=next_step_id,
                        step_name=next_step_spec["name"],
                        step_type=next_step_spec.get("type", "action"),
                        status="running",
                        started_at=now,
                        sla_deadline=(
                            now + timedelta(seconds=next_step_spec["sla_seconds"])
                            if next_step_spec.get("sla_seconds")
                            else None
                        ),
                    )
                    db.add(step_exec)
            else:
                # Step not found — complete workflow
                execution.status = "completed"
                execution.completed_at = now

        await db.flush()
        return _execution_to_dict(execution)

    @staticmethod
    async def cancel_execution(
        db: AsyncSession, execution_id: str, *, reason: str = ""
    ) -> Optional[dict]:
        result = await db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
        )
        execution = result.scalar_one_or_none()
        if not execution:
            return None

        now = datetime.now(timezone.utc)
        execution.status = "cancelled"
        execution.completed_at = now
        execution.error_message = reason or "Cancelled by user"

        # Cancel any pending step executions
        pending_steps = await db.execute(
            select(StepExecution).where(
                and_(
                    StepExecution.workflow_execution_id == execution_id,
                    StepExecution.status.in_(["pending", "running", "waiting_approval"]),
                )
            )
        )
        for step in pending_steps.scalars().all():
            step.status = "skipped"
            step.completed_at = now

        # Cancel pending approvals
        pending_approvals = await db.execute(
            select(ApprovalRequest).where(
                and_(
                    ApprovalRequest.workflow_execution_id == execution_id,
                    ApprovalRequest.status == "pending",
                )
            )
        )
        for approval in pending_approvals.scalars().all():
            approval.status = "expired"

        # Update definition stats
        def_result = await db.execute(
            select(WorkflowDefinition).where(
                WorkflowDefinition.id == execution.workflow_definition_id
            )
        )
        wf_def = def_result.scalar_one_or_none()
        if wf_def:
            wf_def.failed_executions += 1

        await db.flush()
        return _execution_to_dict(execution)

    @staticmethod
    async def list_executions(
        db: AsyncSession,
        *,
        workflow_definition_id: Optional[str] = None,
        status: Optional[str] = None,
        entity_id: Optional[str] = None,
        case_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        conditions = []
        if workflow_definition_id:
            conditions.append(
                WorkflowExecution.workflow_definition_id == workflow_definition_id
            )
        if status:
            conditions.append(WorkflowExecution.status == status)
        if entity_id:
            conditions.append(WorkflowExecution.entity_id == entity_id)
        if case_id:
            conditions.append(WorkflowExecution.case_id == case_id)
        query = select(WorkflowExecution)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(WorkflowExecution.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return [_execution_to_dict(e) for e in result.scalars().all()]

    @staticmethod
    async def get_execution(db: AsyncSession, execution_id: str) -> Optional[dict]:
        result = await db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
        )
        execution = result.scalar_one_or_none()
        if not execution:
            return None
        return _execution_to_dict(execution)

    @staticmethod
    async def get_execution_steps(
        db: AsyncSession, execution_id: str
    ) -> list[dict]:
        result = await db.execute(
            select(StepExecution)
            .where(StepExecution.workflow_execution_id == execution_id)
            .order_by(StepExecution.created_at)
        )
        return [_step_exec_to_dict(s) for s in result.scalars().all()]

    @staticmethod
    async def get_execution_stats(db: AsyncSession) -> dict:
        """Get aggregate workflow execution statistics."""
        total = await db.execute(select(func.count(WorkflowExecution.id)))
        running = await db.execute(
            select(func.count(WorkflowExecution.id)).where(
                WorkflowExecution.status == "running"
            )
        )
        waiting = await db.execute(
            select(func.count(WorkflowExecution.id)).where(
                WorkflowExecution.status == "waiting_approval"
            )
        )
        completed = await db.execute(
            select(func.count(WorkflowExecution.id)).where(
                WorkflowExecution.status == "completed"
            )
        )
        failed = await db.execute(
            select(func.count(WorkflowExecution.id)).where(
                WorkflowExecution.status == "failed"
            )
        )
        sla_breached = await db.execute(
            select(func.count(WorkflowExecution.id)).where(
                WorkflowExecution.sla_breached == True  # noqa: E712
            )
        )

        return {
            "total": total.scalar() or 0,
            "running": running.scalar() or 0,
            "waiting_approval": waiting.scalar() or 0,
            "completed": completed.scalar() or 0,
            "failed": failed.scalar() or 0,
            "sla_breached": sla_breached.scalar() or 0,
        }

    # ------------------------------------------------------------------ #
    # Approvals
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_pending_approvals(
        db: AsyncSession,
        *,
        role: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        query = select(ApprovalRequest).where(ApprovalRequest.status == "pending")
        if role:
            query = query.where(ApprovalRequest.required_role == role)
        query = query.order_by(ApprovalRequest.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return [_approval_to_dict(a) for a in result.scalars().all()]

    @staticmethod
    async def decide_approval(
        db: AsyncSession,
        approval_id: str,
        *,
        decision: str,
        decided_by: str,
        comment: str = "",
    ) -> Optional[dict]:
        """Approve or reject a pending approval request.

        On approval, advances the workflow execution to the next step.
        """
        result = await db.execute(
            select(ApprovalRequest).where(ApprovalRequest.id == approval_id)
        )
        approval = result.scalar_one_or_none()
        if not approval:
            return None

        now = datetime.now(timezone.utc)
        approval.status = decision  # approved or rejected
        approval.decided_by = decided_by
        approval.decided_at = now
        approval.decision_comment = comment

        # Update the step execution
        step_result = await db.execute(
            select(StepExecution).where(StepExecution.id == approval.step_execution_id)
        )
        step_exec = step_result.scalar_one_or_none()
        if step_exec:
            step_exec.status = "completed"
            step_exec.completed_at = now
            step_exec.approval_decision = decision
            step_exec.approval_comment = comment
            step_exec.approved_by = decided_by

        # Advance the workflow
        if decision == "approved":
            await WorkflowService.advance_execution(
                db,
                approval.workflow_execution_id,
                step_result={"decision": decision, "comment": comment},
            )
        elif decision == "rejected":
            # Cancel the workflow on rejection
            await WorkflowService.cancel_execution(
                db,
                approval.workflow_execution_id,
                reason=f"Approval rejected by {decided_by}: {comment}",
            )

        await db.flush()
        return _approval_to_dict(approval)

    # ------------------------------------------------------------------ #
    # SLA Monitoring
    # ------------------------------------------------------------------ #

    @staticmethod
    async def check_sla_breaches(db: AsyncSession) -> list[dict]:
        """Check for SLA breaches across all running executions."""
        now = datetime.now(timezone.utc)
        breaches: list[dict] = []

        # Check workflow-level SLAs
        result = await db.execute(
            select(WorkflowExecution).where(
                and_(
                    WorkflowExecution.status.in_(["running", "waiting_approval"]),
                    WorkflowExecution.sla_deadline.isnot(None),
                    WorkflowExecution.sla_deadline < now,
                    WorkflowExecution.sla_breached == False,  # noqa: E712
                )
            )
        )
        for execution in result.scalars().all():
            execution.sla_breached = True
            breaches.append({
                "type": "workflow",
                "execution_id": execution.id,
                "workflow_name": execution.current_step_name,
                "deadline": execution.sla_deadline.isoformat() if execution.sla_deadline else None,
                "breached_by_seconds": (now - execution.sla_deadline).total_seconds() if execution.sla_deadline else 0,
            })

        # Check step-level SLAs
        step_result = await db.execute(
            select(StepExecution).where(
                and_(
                    StepExecution.status.in_(["running", "waiting_approval"]),
                    StepExecution.sla_deadline.isnot(None),
                    StepExecution.sla_deadline < now,
                    StepExecution.sla_breached == False,  # noqa: E712
                )
            )
        )
        for step in step_result.scalars().all():
            step.sla_breached = True
            breaches.append({
                "type": "step",
                "step_execution_id": step.id,
                "step_name": step.step_name,
                "deadline": step.sla_deadline.isoformat() if step.sla_deadline else None,
                "breached_by_seconds": (now - step.sla_deadline).total_seconds() if step.sla_deadline else 0,
            })

        # Expire overdue approvals
        approval_result = await db.execute(
            select(ApprovalRequest).where(
                and_(
                    ApprovalRequest.status == "pending",
                    ApprovalRequest.expires_at.isnot(None),
                    ApprovalRequest.expires_at < now,
                )
            )
        )
        for approval in approval_result.scalars().all():
            approval.status = "expired"
            breaches.append({
                "type": "approval_expired",
                "approval_id": approval.id,
                "title": approval.title,
                "expired_at": approval.expires_at.isoformat() if approval.expires_at else None,
            })

        if breaches:
            await db.flush()
            logger.warning("SLA breaches detected: %d", len(breaches))

        return breaches


# ------------------------------------------------------------------ #
# Serializers
# ------------------------------------------------------------------ #


def _definition_to_dict(wf: WorkflowDefinition) -> dict:
    return {
        "id": wf.id,
        "name": wf.name,
        "display_name": wf.display_name,
        "description": wf.description,
        "version": wf.version,
        "category": wf.category,
        "trigger_config": wf.trigger_config,
        "steps": wf.steps,
        "sla_seconds": wf.sla_seconds,
        "escalation_policy": wf.escalation_policy,
        "is_active": wf.is_active,
        "is_template": wf.is_template,
        "total_executions": wf.total_executions,
        "successful_executions": wf.successful_executions,
        "failed_executions": wf.failed_executions,
        "avg_duration_seconds": wf.avg_duration_seconds,
        "created_at": wf.created_at.isoformat(),
    }


def _execution_to_dict(e: WorkflowExecution) -> dict:
    return {
        "id": e.id,
        "workflow_definition_id": e.workflow_definition_id,
        "trigger_type": e.trigger_type,
        "trigger_data": e.trigger_data,
        "context": e.context,
        "status": e.status,
        "current_step_id": e.current_step_id,
        "current_step_name": e.current_step_name,
        "started_at": e.started_at.isoformat() if e.started_at else None,
        "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        "duration_seconds": e.duration_seconds,
        "sla_deadline": e.sla_deadline.isoformat() if e.sla_deadline else None,
        "sla_breached": e.sla_breached,
        "escalation_level": e.escalation_level,
        "assigned_to": e.assigned_to,
        "initiated_by": e.initiated_by,
        "step_history": e.step_history,
        "result": e.result,
        "error_message": e.error_message,
        "entity_id": e.entity_id,
        "case_id": e.case_id,
        "alert_id": e.alert_id,
        "created_at": e.created_at.isoformat(),
    }


def _step_exec_to_dict(s: StepExecution) -> dict:
    return {
        "id": s.id,
        "workflow_execution_id": s.workflow_execution_id,
        "step_id": s.step_id,
        "step_name": s.step_name,
        "step_type": s.step_type,
        "status": s.status,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        "input_data": s.input_data,
        "output_data": s.output_data,
        "error_message": s.error_message,
        "approval_requested_from": s.approval_requested_from,
        "approval_decision": s.approval_decision,
        "approval_comment": s.approval_comment,
        "approved_by": s.approved_by,
        "sla_deadline": s.sla_deadline.isoformat() if s.sla_deadline else None,
        "sla_breached": s.sla_breached,
        "attempt_number": s.attempt_number,
        "created_at": s.created_at.isoformat(),
    }


def _approval_to_dict(a: ApprovalRequest) -> dict:
    return {
        "id": a.id,
        "workflow_execution_id": a.workflow_execution_id,
        "step_execution_id": a.step_execution_id,
        "title": a.title,
        "description": a.description,
        "context_data": a.context_data,
        "required_role": a.required_role,
        "requested_from": a.requested_from,
        "status": a.status,
        "decided_by": a.decided_by,
        "decided_at": a.decided_at.isoformat() if a.decided_at else None,
        "decision_comment": a.decision_comment,
        "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        "priority": a.priority,
        "created_at": a.created_at.isoformat(),
    }
