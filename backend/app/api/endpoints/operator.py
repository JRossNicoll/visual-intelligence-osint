"""Operator API endpoints - real-time monitoring, investigation, and intelligence."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.operator import (
    AlertActionResponse,
    DashboardSummary,
    EntityFullProfile,
    EntitySearchResult,
    FeedEvent,
    IntelligenceSummary,
    InvestigationTimeline,
    OperatorAlert,
    WatchlistActionResponse,
    WatchlistAddRequest,
    WatchlistEntry,
)
from app.services.operator_service import OperatorService

router = APIRouter(prefix="/operator", tags=["operator"])


# ------------------------------------------------------------------ #
# Dashboard
# ------------------------------------------------------------------ #


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    """Get aggregated operator dashboard data."""
    data = await OperatorService.get_dashboard_summary(db)
    return DashboardSummary(**data)


# ------------------------------------------------------------------ #
# Alerts (prioritized, deduplicated, grouped)
# ------------------------------------------------------------------ #


@router.get("/alerts", response_model=list[OperatorAlert])
async def get_alerts(
    severity: Optional[str] = Query(None),
    alert_type: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[OperatorAlert]:
    """Get prioritized, deduplicated, grouped alerts for operator view."""
    alerts = await OperatorService.get_prioritized_alerts(
        db,
        severity=severity,
        alert_type=alert_type,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )
    return [OperatorAlert(**a) for a in alerts]


@router.post("/alerts/{alert_id}/review", response_model=AlertActionResponse)
async def review_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> AlertActionResponse:
    """Mark an alert as reviewed."""
    result = await OperatorService.review_alert(db, alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertActionResponse(**result)


@router.post("/alerts/{alert_id}/escalate", response_model=AlertActionResponse)
async def escalate_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> AlertActionResponse:
    """Escalate an alert - bumps severity and publishes event."""
    result = await OperatorService.escalate_alert(db, alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertActionResponse(**result)


@router.post("/alerts/{alert_id}/dismiss", response_model=AlertActionResponse)
async def dismiss_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> AlertActionResponse:
    """Dismiss an alert."""
    result = await OperatorService.dismiss_alert(db, alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertActionResponse(**result)


# ------------------------------------------------------------------ #
# Live Feed
# ------------------------------------------------------------------ #


@router.get("/feed", response_model=list[FeedEvent])
async def get_feed(
    limit: int = Query(50, ge=1, le=200),
    entity_id: Optional[str] = Query(None),
    since: Optional[str] = Query(None, description="ISO datetime string"),
    db: AsyncSession = Depends(get_db),
) -> list[FeedEvent]:
    """Get live event feed for operator monitoring."""
    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid datetime format for 'since'")
    events = await OperatorService.get_live_feed(
        db, limit=limit, entity_id=entity_id, since=since_dt,
    )
    return [FeedEvent(**e) for e in events]


# ------------------------------------------------------------------ #
# Watchlist
# ------------------------------------------------------------------ #


@router.get("/watchlist", response_model=list[WatchlistEntry])
async def get_watchlist(
    db: AsyncSession = Depends(get_db),
) -> list[WatchlistEntry]:
    """Get the operator watchlist with enriched entity data."""
    entries = await OperatorService.get_watchlist(db)
    return [WatchlistEntry(**e) for e in entries]


@router.post("/watchlist/{entity_id}", response_model=WatchlistActionResponse)
async def add_to_watchlist(
    entity_id: str,
    body: WatchlistAddRequest = WatchlistAddRequest(),
    db: AsyncSession = Depends(get_db),
) -> WatchlistActionResponse:
    """Add an entity to the operator watchlist."""
    result = await OperatorService.add_to_watchlist(
        entity_id, reason=body.reason, priority=body.priority,
    )
    return WatchlistActionResponse(**result)


@router.delete("/watchlist/{entity_id}", response_model=WatchlistActionResponse)
async def remove_from_watchlist(
    entity_id: str,
) -> WatchlistActionResponse:
    """Remove an entity from the operator watchlist."""
    result = await OperatorService.remove_from_watchlist(entity_id)
    return WatchlistActionResponse(**result)


# ------------------------------------------------------------------ #
# Investigation Mode
# ------------------------------------------------------------------ #


@router.get("/entities/{entity_id}/profile", response_model=EntityFullProfile)
async def get_entity_profile(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
) -> EntityFullProfile:
    """Get unified entity profile for investigation mode."""
    profile = await OperatorService.get_entity_full_profile(db, entity_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Entity not found")
    return EntityFullProfile(**profile)


@router.get("/timeline", response_model=InvestigationTimeline)
async def get_timeline(
    entity_id: Optional[str] = Query(None),
    from_time: Optional[str] = Query(None, description="ISO datetime string"),
    to_time: Optional[str] = Query(None, description="ISO datetime string"),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> InvestigationTimeline:
    """Get investigation timeline combining events and alerts."""
    from_dt = None
    to_dt = None
    if from_time:
        try:
            from_dt = datetime.fromisoformat(from_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_time format")
    if to_time:
        try:
            to_dt = datetime.fromisoformat(to_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_time format")

    data = await OperatorService.get_investigation_timeline(
        db, entity_id=entity_id, from_time=from_dt, to_time=to_dt, limit=limit,
    )
    return InvestigationTimeline(**data)


@router.get("/search", response_model=list[EntitySearchResult])
async def search_entities(
    query: str = Query(""),
    risk_level: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    min_risk_score: Optional[float] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[EntitySearchResult]:
    """Search entities for investigation mode."""
    results = await OperatorService.search_entities(
        db,
        query=query,
        risk_level=risk_level,
        entity_type=entity_type,
        min_risk_score=min_risk_score,
        limit=limit,
    )
    return [EntitySearchResult(**r) for r in results]


# ------------------------------------------------------------------ #
# Intelligence Mode
# ------------------------------------------------------------------ #


@router.get("/intelligence", response_model=IntelligenceSummary)
async def get_intelligence_summary(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> IntelligenceSummary:
    """Get long-term intelligence summary for strategic view."""
    data = await OperatorService.get_intelligence_summary(db, days=days)
    return IntelligenceSummary(**data)
