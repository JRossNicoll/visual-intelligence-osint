"""Intelligence API endpoints - temporal analysis, anomaly detection, risk scoring, predictions."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.intelligence import (
    AnalysisResultResponse,
    AnalyzeBatchRequest,
    AnalyzeEntityRequest,
    BehaviorRecordResponse,
    EntityProfileResponse,
    IntelligenceInsightResponse,
    NLQueryRequest,
    NLQueryResponse,
    PredictionResponse,
    RiskScoreResponse,
    TemporalEventCreate,
    TemporalEventResponse,
)
from app.services.intelligence_service import IntelligenceService

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


# --- Temporal Events ---


@router.post("/events", response_model=TemporalEventResponse)
async def create_temporal_event(
    event: TemporalEventCreate,
    db: AsyncSession = Depends(get_db),
) -> TemporalEventResponse:
    """Record a temporal event for intelligence analysis."""
    result = await IntelligenceService.create_temporal_event(
        db,
        entity_id=event.entity_id,
        stream_id=event.stream_id,
        event_type=event.event_type,
        timestamp=event.timestamp,
        confidence=event.confidence,
        location_id=event.location_id,
        location_name=event.location_name,
        duration_seconds=event.duration_seconds,
        attributes=event.attributes,
        co_occurring_entities=event.co_occurring_entities,
        hour_of_day=event.hour_of_day,
        day_of_week=event.day_of_week,
        is_weekend=event.is_weekend,
    )
    return TemporalEventResponse.model_validate(result)


@router.get("/events", response_model=list[TemporalEventResponse])
async def list_temporal_events(
    entity_id: Optional[str] = Query(None),
    stream_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[TemporalEventResponse]:
    """List temporal events with filtering."""
    events = await IntelligenceService.get_temporal_events(
        db, entity_id=entity_id, stream_id=stream_id,
        event_type=event_type, limit=limit,
    )
    return [TemporalEventResponse.model_validate(e) for e in events]


# --- Entity Profiles ---


@router.get("/profiles", response_model=list[EntityProfileResponse])
async def list_entity_profiles(
    risk_level: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    min_risk_score: Optional[float] = Query(None, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[EntityProfileResponse]:
    """List entity intelligence profiles."""
    profiles = await IntelligenceService.list_entity_profiles(
        db, risk_level=risk_level, entity_type=entity_type,
        min_risk_score=min_risk_score, limit=limit, offset=offset,
    )
    return [EntityProfileResponse.model_validate(p) for p in profiles]


@router.get("/profiles/{entity_id}", response_model=EntityProfileResponse)
async def get_entity_profile(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
) -> EntityProfileResponse:
    """Get the intelligence profile for an entity."""
    profile = await IntelligenceService.get_entity_profile(db, entity_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return EntityProfileResponse.model_validate(profile)


# --- Behavior Records ---


@router.get("/behaviors", response_model=list[BehaviorRecordResponse])
async def list_behavior_records(
    entity_id: Optional[str] = Query(None),
    behavior_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[BehaviorRecordResponse]:
    """List behavior records."""
    records = await IntelligenceService.get_behavior_records(
        db, entity_id=entity_id, behavior_type=behavior_type,
        is_active=is_active, limit=limit,
    )
    return [BehaviorRecordResponse.model_validate(r) for r in records]


# --- Intelligence Insights ---


@router.get("/insights", response_model=list[IntelligenceInsightResponse])
async def list_insights(
    insight_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    is_reviewed: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[IntelligenceInsightResponse]:
    """List intelligence insights."""
    insights = await IntelligenceService.get_insights(
        db, insight_type=insight_type, severity=severity,
        is_reviewed=is_reviewed, limit=limit,
    )
    return [IntelligenceInsightResponse.model_validate(i) for i in insights]


@router.post("/insights/{insight_id}/review")
async def review_insight(
    insight_id: str,
    db: AsyncSession = Depends(get_db),
) -> IntelligenceInsightResponse:
    """Mark an insight as reviewed."""
    insight = await IntelligenceService.review_insight(db, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    return IntelligenceInsightResponse.model_validate(insight)


@router.post("/insights/{insight_id}/dismiss")
async def dismiss_insight(
    insight_id: str,
    db: AsyncSession = Depends(get_db),
) -> IntelligenceInsightResponse:
    """Dismiss an intelligence insight."""
    insight = await IntelligenceService.dismiss_insight(db, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    return IntelligenceInsightResponse.model_validate(insight)


# --- Analysis ---


@router.post("/analyze", response_model=AnalysisResultResponse)
async def analyze_entity(
    request: AnalyzeEntityRequest,
    db: AsyncSession = Depends(get_db),
) -> AnalysisResultResponse:
    """Run full intelligence analysis on an entity.

    Performs temporal pattern analysis (FFT + autocorrelation),
    anomaly detection (z-score + isolation forest), behavior
    classification, risk scoring, and prediction generation.

    Every result includes explainability — statistical evidence
    and reasoning that produced the insight.
    """
    result = await IntelligenceService.analyze_entity(db, request.entity_id)
    return AnalysisResultResponse(**result)


@router.post("/analyze-batch")
async def analyze_batch(
    request: AnalyzeBatchRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Run batch analysis on all entities with sufficient data."""
    return await IntelligenceService.analyze_batch(db, request.min_events)


# --- NL Query ---


@router.post("/query", response_model=NLQueryResponse)
async def natural_language_query(
    request: NLQueryRequest,
    db: AsyncSession = Depends(get_db),
) -> NLQueryResponse:
    """Execute a natural language intelligence query.

    Translates natural language to verified SQL/Cypher queries.
    All queries are template-based to prevent hallucination.
    Returns results with full query explanation.

    Examples:
    - "show all vehicles seen more than 5 times"
    - "find entities seen in the last 24 hours"
    - "who is associated with Vehicle_123"
    - "find suspicious behavior"
    - "show high risk entities"
    """
    result = await IntelligenceService.execute_nl_query(db, request.query)
    return NLQueryResponse(**result)


# --- Risk Scores ---


@router.get("/risk/{entity_id}", response_model=RiskScoreResponse)
async def get_risk_score(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
) -> RiskScoreResponse:
    """Get the risk score for an entity.

    Risk(entity) = w1 * anomaly_score + w2 * association_risk + w3 * behavior_score

    Components:
    - anomaly_score: EWMA of recent anomaly scores from z-score/isolation forest
    - association_risk: Damped propagation from associated entities
    - behavior_score: Confidence-weighted behavioral risk

    Default weights: w1=0.4, w2=0.3, w3=0.3 (tunable)
    """
    profile = await IntelligenceService.get_entity_profile(db, entity_id)
    if not profile:
        raise HTTPException(status_code=404, detail="No risk data available for this entity")
    return RiskScoreResponse(
        entity_id=entity_id,
        risk_score=profile.risk_score,
        risk_level=profile.risk_level,
        risk_factors=profile.risk_factors or [],
        explanation=f"Risk score {profile.risk_score:.3f} ({profile.risk_level}). "
        f"See risk_factors for component breakdown.",
    )


# --- Predictions ---


@router.get("/predictions/{entity_id}", response_model=PredictionResponse)
async def get_prediction(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
) -> PredictionResponse:
    """Get the next-appearance prediction for an entity.

    Uses either:
    - Periodicity extrapolation (if periodic behavior detected via FFT/autocorrelation)
    - Frequency-based probability distribution (log-normal model of inter-arrival times)

    Returns predicted time window and location with confidence scores.
    """
    profile = await IntelligenceService.get_entity_profile(db, entity_id)
    if not profile:
        raise HTTPException(status_code=404, detail="No prediction data available")

    return PredictionResponse(
        entity_id=entity_id,
        predicted_time_window_start=(
            profile.predicted_next_time.get("window_start") if profile.predicted_next_time else None
        ),
        predicted_time_window_end=(
            profile.predicted_next_time.get("window_end") if profile.predicted_next_time else None
        ),
        time_confidence=(
            profile.predicted_next_time.get("confidence", 0) if profile.predicted_next_time else 0
        ),
        predicted_location_id=(
            profile.predicted_next_location.get("location_id") if profile.predicted_next_location else None
        ),
        predicted_location_name=(
            profile.predicted_next_location.get("name") if profile.predicted_next_location else None
        ),
        location_confidence=(
            profile.predicted_next_location.get("probability", 0) if profile.predicted_next_location else 0
        ),
    )
