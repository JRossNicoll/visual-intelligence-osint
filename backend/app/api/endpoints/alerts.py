"""Alert management API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.alert import AlertResponse
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    alert_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    is_acknowledged: Optional[bool] = Query(None),
    entity_id: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    stream_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[AlertResponse]:
    """List alerts with filtering."""
    alerts = await AlertService.list_alerts(
        db,
        alert_type=alert_type,
        severity=severity,
        is_read=is_read,
        is_acknowledged=is_acknowledged,
        entity_id=entity_id,
        target_id=target_id,
        stream_id=stream_id,
        limit=limit,
        offset=offset,
    )
    return [AlertResponse.model_validate(a) for a in alerts]


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get count of unread alerts."""
    count = await AlertService.get_unread_count(db)
    return {"unread_count": count}


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    """Get a specific alert by ID."""
    alert = await AlertService.get_alert(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertResponse.model_validate(alert)


@router.post("/{alert_id}/read", response_model=AlertResponse)
async def mark_alert_read(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    """Mark an alert as read."""
    alert = await AlertService.mark_as_read(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertResponse.model_validate(alert)


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    """Acknowledge an alert."""
    alert = await AlertService.acknowledge_alert(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertResponse.model_validate(alert)
