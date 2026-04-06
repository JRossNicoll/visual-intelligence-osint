"""Workflow orchestration API endpoints — definitions, executions, approvals, SLA monitoring."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflows", tags=["workflows"])


# ------------------------------------------------------------------ #
# Request schemas
# ------------------------------------------------------------------ #


class WorkflowDefinitionCreate(BaseModel):
    name: str
    display_name: str
    description: str = ""
    category: str = "custom"
    trigger_config: dict
    steps: list
    sla_seconds: Optional[int] = None
    escalation_policy: Optional[dict] = None


class WorkflowDefinitionUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    trigger_config: Optional[dict] = None
    steps: Optional[list] = None
    sla_seconds: Optional[int] = None
    escalation_policy: Optional[dict] = None
    is_active: Optional[bool] = None


class StartExecutionRequest(BaseModel):
    workflow_definition_id: str
    trigger_type: str = "manual"
    trigger_data: Optional[dict] = None
    context: Optional[dict] = None
    entity_id: Optional[str] = None
    case_id: Optional[str] = None
    alert_id: Optional[str] = None


class AdvanceExecutionRequest(BaseModel):
    step_result: Optional[dict] = None


class CancelExecutionRequest(BaseModel):
    reason: str = ""


class ApprovalDecisionRequest(BaseModel):
    decision: str  # approved or rejected
    comment: str = ""


# ------------------------------------------------------------------ #
# Workflow Definition endpoints
# ------------------------------------------------------------------ #


@router.get("/definitions")
async def list_definitions(
    category: Optional[str] = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await WorkflowService.list_definitions(
        db, category=category, active_only=active_only, limit=limit
    )


@router.get("/definitions/{def_id}")
async def get_definition(
    def_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await WorkflowService.get_definition(db, def_id)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow definition not found")
    return result


@router.post("/definitions", status_code=201)
async def create_definition(
    body: WorkflowDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await WorkflowService.create_definition(db, **body.model_dump())
    await db.commit()
    return result


@router.patch("/definitions/{def_id}")
async def update_definition(
    def_id: str,
    body: WorkflowDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await WorkflowService.update_definition(
        db, def_id, **body.model_dump(exclude_unset=True)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Workflow definition not found")
    await db.commit()
    return result


@router.delete("/definitions/{def_id}")
async def delete_definition(
    def_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    deleted = await WorkflowService.delete_definition(db, def_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow definition not found")
    await db.commit()
    return {"status": "deleted"}


# ------------------------------------------------------------------ #
# Execution endpoints
# ------------------------------------------------------------------ #


@router.get("/executions")
async def list_executions(
    workflow_definition_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    case_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await WorkflowService.list_executions(
        db,
        workflow_definition_id=workflow_definition_id,
        status=status,
        entity_id=entity_id,
        case_id=case_id,
        limit=limit,
    )


@router.get("/executions/stats")
async def get_execution_stats(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await WorkflowService.get_execution_stats(db)


@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await WorkflowService.get_execution(db, execution_id)
    if not result:
        raise HTTPException(status_code=404, detail="Workflow execution not found")
    return result


@router.get("/executions/{execution_id}/steps")
async def get_execution_steps(
    execution_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await WorkflowService.get_execution_steps(db, execution_id)


@router.post("/executions", status_code=201)
async def start_execution(
    body: StartExecutionRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    try:
        result = await WorkflowService.start_execution(
            db,
            workflow_definition_id=body.workflow_definition_id,
            trigger_type=body.trigger_type,
            trigger_data=body.trigger_data,
            context=body.context,
            initiated_by=user.get("username", "system"),
            entity_id=body.entity_id,
            case_id=body.case_id,
            alert_id=body.alert_id,
        )
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/executions/{execution_id}/advance")
async def advance_execution(
    execution_id: str,
    body: AdvanceExecutionRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    try:
        result = await WorkflowService.advance_execution(
            db, execution_id, step_result=body.step_result
        )
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/executions/{execution_id}/cancel")
async def cancel_execution(
    execution_id: str,
    body: CancelExecutionRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await WorkflowService.cancel_execution(
        db, execution_id, reason=body.reason
    )
    if not result:
        raise HTTPException(status_code=404, detail="Execution not found")
    await db.commit()
    return result


# ------------------------------------------------------------------ #
# Approval endpoints
# ------------------------------------------------------------------ #


@router.get("/approvals")
async def list_pending_approvals(
    role: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await WorkflowService.list_pending_approvals(db, role=role, limit=limit)


@router.post("/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: str,
    body: ApprovalDecisionRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await WorkflowService.decide_approval(
        db,
        approval_id,
        decision=body.decision,
        decided_by=user.get("username", "unknown"),
        comment=body.comment,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Approval request not found")
    await db.commit()
    return result


# ------------------------------------------------------------------ #
# SLA Monitoring
# ------------------------------------------------------------------ #


@router.get("/sla/breaches")
async def check_sla_breaches(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    breaches = await WorkflowService.check_sla_breaches(db)
    await db.commit()
    return {"breaches": breaches, "count": len(breaches)}


# ------------------------------------------------------------------ #
# Seed
# ------------------------------------------------------------------ #


@router.post("/seed")
async def seed_workflows(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    stats = await WorkflowService.seed_builtins(db)
    await db.commit()
    return {"status": "ok", "seeded": stats}
