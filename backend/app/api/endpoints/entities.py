"""Entity intelligence API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.session import get_db
from app.schemas.entity import (
    DetectionResponse,
    EntityGraphResponse,
    EntityResponse,
    EntitySearchRequest,
)
from app.services.entity_service import EntityService

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("", response_model=list[EntityResponse])
async def search_entities(
    entity_type: Optional[str] = Query(None),
    label: Optional[str] = Query(None),
    text_query: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0),
    stream_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[EntityResponse]:
    """Search and filter tracked entities."""
    params = EntitySearchRequest(
        entity_type=entity_type,
        label=label,
        text_query=text_query,
        min_confidence=min_confidence,
        stream_id=stream_id,
        limit=limit,
        offset=offset,
    )
    entities = await EntityService.search_entities(db, params)
    return [EntityResponse.model_validate(e) for e in entities]


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> EntityResponse:
    """Get a specific entity by ID."""
    entity = await EntityService.get_entity(db, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return EntityResponse.model_validate(entity)


@router.get("/{entity_id}/detections", response_model=list[DetectionResponse])
async def get_entity_detections(
    entity_id: str,
    stream_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[DetectionResponse]:
    """Get all detections for an entity."""
    detections = await EntityService.get_detections(
        db, stream_id=stream_id, entity_id=entity_id, limit=limit
    )
    return [DetectionResponse.model_validate(d) for d in detections]


@router.get("/{entity_id}/graph", response_model=EntityGraphResponse)
async def get_entity_graph(
    entity_id: str,
    depth: int = Query(2, ge=1, le=5),
    current_user: TokenData = Depends(get_current_user),
) -> EntityGraphResponse:
    """Get the relationship graph for an entity."""
    graph = await EntityService.get_entity_graph(entity_id, depth)
    return EntityGraphResponse(**graph)


@router.get("/{entity_id}/timeline")
async def get_entity_timeline(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[dict]:
    """Get the sighting timeline for an entity."""
    entity = await EntityService.get_entity(db, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return await EntityService.get_entity_timeline(db, entity_id)


@router.get("/stream/{stream_id}/detections", response_model=list[DetectionResponse])
async def get_stream_detections(
    stream_id: str,
    from_frame: Optional[int] = Query(None),
    to_frame: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[DetectionResponse]:
    """Get all detections for a stream."""
    detections = await EntityService.get_detections(
        db, stream_id=stream_id, from_frame=from_frame, to_frame=to_frame, limit=limit
    )
    return [DetectionResponse.model_validate(d) for d in detections]
