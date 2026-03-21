"""Case management API endpoints — CRUD, evidence, notes, timeline, summary, audit."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.case import (
    AuditLogEntry,
    CaseActionResponse,
    CaseCreate,
    CaseDetail,
    CaseIntelSummary,
    CaseSummary,
    CaseTimeline,
    CaseTimelineItem,
    CaseUpdate,
    EvidenceAdd,
    EvidenceItem,
    LinkAlertsRequest,
    LinkEntitiesRequest,
    NoteAdd,
    NoteItem,
)
from app.services.case_service import AuditService, CaseService

router = APIRouter(prefix="/cases", tags=["cases"])


# ------------------------------------------------------------------ #
# Case CRUD
# ------------------------------------------------------------------ #


@router.post("", response_model=CaseDetail)
async def create_case(
    body: CaseCreate,
    db: AsyncSession = Depends(get_db),
) -> CaseDetail:
    """Create a new intelligence case."""
    data = await CaseService.create_case(
        db,
        title=body.title,
        description=body.description,
        priority=body.priority,
        severity=body.severity,
        assigned_to=body.assigned_to,
        tags=body.tags,
        source_type=body.source_type,
        source_id=body.source_id,
        linked_entity_ids=body.linked_entity_ids,
        linked_alert_ids=body.linked_alert_ids,
    )
    return CaseDetail(**data)


@router.get("", response_model=list[CaseSummary])
async def list_cases(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[CaseSummary]:
    """List cases with optional filtering."""
    cases = await CaseService.list_cases(
        db, status=status, priority=priority, assigned_to=assigned_to,
        limit=limit, offset=offset,
    )
    return [CaseSummary(**c) for c in cases]


@router.get("/audit/all", response_model=list[AuditLogEntry])
async def get_all_audit_logs(
    resource_type: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogEntry]:
    """Get all audit log entries with optional filtering."""
    logs = await AuditService.get_logs(
        db, resource_type=resource_type, actor=actor, action=action,
        limit=limit, offset=offset,
    )
    return [AuditLogEntry(**log) for log in logs]


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
) -> CaseDetail:
    """Get full case details."""
    data = await CaseService.get_case(db, case_id)
    if not data:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseDetail(**data)


@router.patch("/{case_id}", response_model=CaseDetail)
async def update_case(
    case_id: str,
    body: CaseUpdate,
    db: AsyncSession = Depends(get_db),
) -> CaseDetail:
    """Update case fields (title, status, priority, etc.)."""
    data = await CaseService.update_case(
        db, case_id,
        title=body.title,
        description=body.description,
        status=body.status,
        priority=body.priority,
        severity=body.severity,
        assigned_to=body.assigned_to,
        tags=body.tags,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseDetail(**data)


# ------------------------------------------------------------------ #
# Quick-create flows
# ------------------------------------------------------------------ #


@router.post("/from-alert/{alert_id}", response_model=CaseDetail)
async def create_from_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> CaseDetail:
    """Create a case from an alert in one click — auto-populates entities, timeline, related alerts."""
    data = await CaseService.create_from_alert(db, alert_id)
    if not data:
        raise HTTPException(status_code=404, detail="Alert not found")
    return CaseDetail(**data)


@router.post("/from-entity/{entity_id}", response_model=CaseDetail)
async def create_from_entity(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
) -> CaseDetail:
    """Create a case from an entity in one click — auto-populates profile data."""
    data = await CaseService.create_from_entity(db, entity_id)
    if not data:
        raise HTTPException(status_code=404, detail="Entity not found")
    return CaseDetail(**data)


# ------------------------------------------------------------------ #
# Entity & Alert Linking
# ------------------------------------------------------------------ #


@router.post("/{case_id}/entities", response_model=CaseActionResponse)
async def link_entities(
    case_id: str,
    body: LinkEntitiesRequest,
    db: AsyncSession = Depends(get_db),
) -> CaseActionResponse:
    """Link entities to a case."""
    result = await CaseService.link_entities(db, case_id, body.entity_ids)
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseActionResponse(**result)


@router.post("/{case_id}/alerts", response_model=CaseActionResponse)
async def link_alerts(
    case_id: str,
    body: LinkAlertsRequest,
    db: AsyncSession = Depends(get_db),
) -> CaseActionResponse:
    """Link alerts to a case."""
    result = await CaseService.link_alerts(db, case_id, body.alert_ids)
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseActionResponse(**result)


# ------------------------------------------------------------------ #
# Evidence
# ------------------------------------------------------------------ #


@router.post("/{case_id}/evidence", response_model=EvidenceItem)
async def add_evidence(
    case_id: str,
    body: EvidenceAdd,
    db: AsyncSession = Depends(get_db),
) -> EvidenceItem:
    """Attach evidence to a case."""
    data = await CaseService.add_evidence(
        db, case_id,
        evidence_type=body.evidence_type,
        source_table=body.source_table,
        source_id=body.source_id,
        title=body.title,
        description=body.description,
        data_snapshot=body.data_snapshot,
        confidence=body.confidence,
        relevance_note=body.relevance_note,
        computation_params=body.computation_params,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Case not found")
    return EvidenceItem(**data)


@router.get("/{case_id}/evidence", response_model=list[EvidenceItem])
async def get_evidence(
    case_id: str,
    evidence_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[EvidenceItem]:
    """Get all evidence for a case."""
    items = await CaseService.get_evidence(db, case_id, evidence_type=evidence_type, limit=limit)
    return [EvidenceItem(**i) for i in items]


# ------------------------------------------------------------------ #
# Notes
# ------------------------------------------------------------------ #


@router.post("/{case_id}/notes", response_model=NoteItem)
async def add_note(
    case_id: str,
    body: NoteAdd,
    db: AsyncSession = Depends(get_db),
) -> NoteItem:
    """Add a note to a case."""
    data = await CaseService.add_note(
        db, case_id, content=body.content, author=body.author, note_type=body.note_type,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Case not found")
    return NoteItem(**data)


@router.get("/{case_id}/notes", response_model=list[NoteItem])
async def get_notes(
    case_id: str,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[NoteItem]:
    """Get all notes for a case."""
    items = await CaseService.get_notes(db, case_id, limit=limit)
    return [NoteItem(**i) for i in items]


# ------------------------------------------------------------------ #
# Timeline
# ------------------------------------------------------------------ #


@router.get("/{case_id}/timeline", response_model=CaseTimeline)
async def get_case_timeline(
    case_id: str,
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> CaseTimeline:
    """Get unified timeline for a case (events, alerts, evidence, notes)."""
    data = await CaseService.get_case_timeline(db, case_id, limit=limit)
    return CaseTimeline(
        case_id=data["case_id"],
        total_items=data["total_items"],
        items=[CaseTimelineItem(**item) for item in data["items"]],
    )


# ------------------------------------------------------------------ #
# Intelligence Summary
# ------------------------------------------------------------------ #


@router.post("/{case_id}/summary", response_model=CaseIntelSummary)
async def generate_summary(
    case_id: str,
    db: AsyncSession = Depends(get_db),
) -> CaseIntelSummary:
    """Generate (or regenerate) the intelligence summary for a case."""
    data = await CaseService.generate_case_summary(db, case_id)
    if not data:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseIntelSummary(**data)


# ------------------------------------------------------------------ #
# Audit Log
# ------------------------------------------------------------------ #


@router.get("/{case_id}/audit", response_model=list[AuditLogEntry])
async def get_case_audit(
    case_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogEntry]:
    """Get audit log entries for a specific case."""
    logs = await AuditService.get_logs(
        db, resource_type="case", resource_id=case_id, limit=limit, offset=offset,
    )
    return [AuditLogEntry(**log) for log in logs]
