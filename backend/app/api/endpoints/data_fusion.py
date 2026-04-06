"""Data Fusion API endpoints — source management, ingestion, correlation, fusion summaries."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.services.data_fusion_service import DataFusionService

router = APIRouter(prefix="/fusion", tags=["data-fusion"])


# ------------------------------------------------------------------ #
# Request schemas
# ------------------------------------------------------------------ #


class DataSourceCreate(BaseModel):
    name: str
    display_name: str
    description: str = ""
    source_type: str
    adapter_type: str = "generic_api"
    connection_config: Optional[dict] = None
    field_mapping: Optional[dict] = None
    reliability_rating: str = "C"
    credibility_rating: str = "3"


class DataSourceUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    connection_config: Optional[dict] = None
    field_mapping: Optional[dict] = None
    reliability_rating: Optional[str] = None
    credibility_rating: Optional[str] = None
    status: Optional[str] = None


class IngestRecordRequest(BaseModel):
    data_source_id: str
    raw_data: dict
    external_id: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class IngestBatchRequest(BaseModel):
    data_source_id: str
    records: list[dict]


class ReviewCorrelationRequest(BaseModel):
    decision: str  # accepted or rejected
    enrichment: Optional[dict] = None


# ------------------------------------------------------------------ #
# Data Source endpoints
# ------------------------------------------------------------------ #


@router.get("/sources")
async def list_sources(
    source_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await DataFusionService.list_sources(
        db, source_type=source_type, status=status, limit=limit
    )


@router.get("/sources/stats")
async def get_source_stats(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await DataFusionService.get_source_stats(db)


@router.get("/sources/{source_id}")
async def get_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await DataFusionService.get_source(db, source_id)
    if not result:
        raise HTTPException(status_code=404, detail="Data source not found")
    return result


@router.post("/sources", status_code=201)
async def create_source(
    body: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await DataFusionService.create_source(db, **body.model_dump())
    await db.commit()
    return result


@router.patch("/sources/{source_id}")
async def update_source(
    source_id: str,
    body: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await DataFusionService.update_source(
        db, source_id, **body.model_dump(exclude_unset=True)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Data source not found")
    await db.commit()
    return result


@router.delete("/sources/{source_id}")
async def delete_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    deleted = await DataFusionService.delete_source(db, source_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Data source not found")
    await db.commit()
    return {"status": "deleted"}


# ------------------------------------------------------------------ #
# Ingestion endpoints
# ------------------------------------------------------------------ #


@router.post("/ingest")
async def ingest_record(
    body: IngestRecordRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    try:
        result = await DataFusionService.ingest_record(db, **body.model_dump())
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ingest/batch")
async def ingest_batch(
    body: IngestBatchRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await DataFusionService.ingest_batch(
        db, data_source_id=body.data_source_id, records=body.records
    )
    await db.commit()
    return result


@router.get("/records")
async def list_ingested_records(
    data_source_id: Optional[str] = Query(None),
    processing_status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await DataFusionService.list_ingested_records(
        db,
        data_source_id=data_source_id,
        processing_status=processing_status,
        limit=limit,
        offset=offset,
    )


# ------------------------------------------------------------------ #
# Correlation endpoints
# ------------------------------------------------------------------ #


@router.post("/correlate/{record_id}")
async def correlate_record(
    record_id: str,
    auto_accept_threshold: float = Query(0.85),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await DataFusionService.correlate_record(
        db, record_id, auto_accept_threshold=auto_accept_threshold
    )
    await db.commit()
    return {"correlations": result, "count": len(result)}


@router.post("/correlate/pending")
async def correlate_pending(
    batch_size: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    stats = await DataFusionService.correlate_pending(db, batch_size=batch_size)
    await db.commit()
    return stats


@router.get("/correlations")
async def list_correlations(
    entity_id: Optional[str] = Query(None),
    data_source_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await DataFusionService.list_correlations(
        db,
        entity_id=entity_id,
        data_source_id=data_source_id,
        status=status,
        limit=limit,
    )


@router.post("/correlations/{correlation_id}/review")
async def review_correlation(
    correlation_id: str,
    body: ReviewCorrelationRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await DataFusionService.review_correlation(
        db,
        correlation_id,
        decision=body.decision,
        reviewed_by=user.get("username", "unknown"),
        enrichment=body.enrichment,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Correlation not found")
    await db.commit()
    return result


# ------------------------------------------------------------------ #
# Fusion Summary endpoints
# ------------------------------------------------------------------ #


@router.get("/summaries")
async def list_fusion_summaries(
    min_sources: int = Query(0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await DataFusionService.list_fusion_summaries(
        db, min_sources=min_sources, limit=limit
    )


@router.get("/summaries/{entity_id}")
async def get_fusion_summary(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await DataFusionService.get_fusion_summary(db, entity_id)
    if not result:
        raise HTTPException(status_code=404, detail="No fusion summary for this entity")
    return result


@router.post("/summaries/{entity_id}/compute")
async def compute_fusion_summary(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await DataFusionService.compute_fusion_summary(db, entity_id)
    await db.commit()
    return result
