"""Pydantic schemas for intelligence API endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Entity Profile Schemas ---
class EntityProfileResponse(BaseModel):
    id: str
    entity_id: str
    entity_type: str
    first_seen: datetime
    last_seen: datetime
    visit_count: int
    total_duration_seconds: float
    common_locations: Optional[list] = None
    last_location_id: Optional[str] = None
    last_location_name: Optional[str] = None
    behavior_summary: Optional[dict] = None
    behavior_tags: Optional[list] = None
    temporal_pattern: Optional[dict] = None
    associated_entities: Optional[list] = None
    association_count: int = 0
    risk_score: float = 0.0
    risk_factors: Optional[list] = None
    risk_level: str = "low"
    predicted_next_location: Optional[dict] = None
    predicted_next_time: Optional[dict] = None
    profile_completeness: float = 0.0
    last_analyzed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Temporal Event Schemas ---
class TemporalEventCreate(BaseModel):
    entity_id: str
    stream_id: str
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    event_type: str = "appearance"
    timestamp: datetime
    duration_seconds: Optional[float] = None
    confidence: float = 1.0
    attributes: Optional[dict] = None
    co_occurring_entities: Optional[list[str]] = None
    hour_of_day: Optional[int] = None
    day_of_week: Optional[int] = None
    is_weekend: Optional[bool] = None


class TemporalEventResponse(BaseModel):
    id: str
    entity_id: str
    stream_id: str
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    event_type: str
    timestamp: datetime
    duration_seconds: Optional[float] = None
    confidence: float
    attributes: Optional[dict] = None
    co_occurring_entities: Optional[list] = None
    hour_of_day: int
    day_of_week: int
    is_weekend: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Behavior Record Schemas ---
class BehaviorRecordResponse(BaseModel):
    id: str
    entity_id: str
    behavior_type: str
    description: str
    confidence: float
    severity: str
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    stream_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    associated_entity_ids: Optional[list] = None
    pattern_data: Optional[dict] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Intelligence Insight Schemas ---
class IntelligenceInsightResponse(BaseModel):
    id: str
    insight_type: str
    title: str
    description: str
    severity: str
    entity_ids: Optional[list] = None
    location_ids: Optional[list] = None
    stream_ids: Optional[list] = None
    confidence: float
    evidence: Optional[dict] = None
    recommendation: Optional[str] = None
    is_reviewed: bool
    is_dismissed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Analysis Request/Response Schemas ---
class AnalyzeEntityRequest(BaseModel):
    entity_id: str


class AnalyzeBatchRequest(BaseModel):
    min_events: int = 3


class AnalysisResultResponse(BaseModel):
    entity_id: str
    status: str
    temporal_pattern: Optional[dict] = None
    anomaly: Optional[dict] = None
    behaviors: list[dict] = Field(default_factory=list)
    relationships: list[dict] = Field(default_factory=list)
    risk: Optional[dict] = None
    prediction: Optional[dict] = None
    analysis_timestamp: Optional[str] = None


# --- NL Query Schemas ---
class NLQueryRequest(BaseModel):
    query: str
    max_results: int = 20


class NLQueryResponse(BaseModel):
    original_query: str
    interpreted_query: str = ""
    generated_sql: Optional[str] = None
    generated_cypher: Optional[str] = None
    query_explanation: str = ""
    results: list[dict] = Field(default_factory=list)
    result_count: int = 0
    confidence: float = 0.0


# --- Risk Score Schemas ---
class RiskScoreResponse(BaseModel):
    entity_id: str
    risk_score: float = 0.0
    risk_level: str = "low"
    anomaly_component: float = 0.0
    association_component: float = 0.0
    behavior_component: float = 0.0
    w1: float = 0.4
    w2: float = 0.3
    w3: float = 0.3
    risk_factors: list[dict] = Field(default_factory=list)
    explanation: str = ""


# --- Prediction Schemas ---
class PredictionResponse(BaseModel):
    entity_id: str
    predicted_time_window_start: Optional[datetime] = None
    predicted_time_window_end: Optional[datetime] = None
    time_confidence: float = 0.0
    predicted_location_id: Optional[str] = None
    predicted_location_name: Optional[str] = None
    location_confidence: float = 0.0
    method: str = ""
    evidence: Optional[dict] = None
    explanation: str = ""


# ============================================================
# System-Level Intelligence Schemas
# ============================================================


class SystemAnalysisRequest(BaseModel):
    """Request for system-level multi-entity analysis."""
    entity_ids: Optional[list[str]] = None
    from_time: Optional[datetime] = None
    to_time: Optional[datetime] = None
    include_risk_propagation: bool = True
    include_coordination: bool = True
    include_sequences: bool = True
    include_group_anomalies: bool = True


class SystemAnalysisResponse(BaseModel):
    """Response from system-level intelligence analysis."""
    status: str
    coordination: Optional[dict] = None
    sequences: Optional[dict] = None
    risk_propagation: Optional[list[dict]] = None
    risk_stability: Optional[dict] = None
    group_anomalies: Optional[dict] = None
    system_explanation: Optional[dict] = None
    adaptive_weights: Optional[dict] = None
    analysis_timestamp: Optional[str] = None


class CoordinationResponse(BaseModel):
    """Response for coordination detection."""
    total_entities_analyzed: int = 0
    total_events_analyzed: int = 0
    patterns_detected: list[dict] = Field(default_factory=list)
    graph_motifs: list[dict] = Field(default_factory=list)
    analysis_window_hours: float = 0.0
    explanation: str = ""


class RiskPropagationRequest(BaseModel):
    """Request for risk propagation analysis."""
    entity_ids: Optional[list[str]] = None
    max_depth: int = 2
    damping_factor: float = 0.5


class RiskPropagationResponse(BaseModel):
    """Response from risk propagation."""
    propagated_scores: list[dict] = Field(default_factory=list)
    stability: Optional[dict] = None
    explanation: str = ""


class SequenceResponse(BaseModel):
    """Response for sequence/causal pattern detection."""
    frequent_sequences: list[dict] = Field(default_factory=list)
    causal_relationships: list[dict] = Field(default_factory=list)
    total_events_analyzed: int = 0
    explanation: str = ""


class AdaptiveWeightFeedbackRequest(BaseModel):
    """Request to provide feedback for adaptive weight updating."""
    feedback_type: str  # true_positive, false_positive, false_negative
    component_scores: dict = Field(default_factory=dict)
    outcome: bool = True


class AdaptiveWeightResponse(BaseModel):
    """Response showing current adaptive weight state."""
    current_w1: float = 0.4
    current_w2: float = 0.3
    current_w3: float = 0.3
    update_count: int = 0
    weight_history: list[dict] = Field(default_factory=list)
    explanation: str = ""


class GroupAnomalyResponse(BaseModel):
    """Response for group-level anomaly detection."""
    anomalies: list[dict] = Field(default_factory=list)
    clusters_detected: int = 0
    density_change: float = 0.0
    total_entities: int = 0
    total_events: int = 0
    explanation: str = ""


class EvaluationResponse(BaseModel):
    """Response from evaluation framework."""
    coordination_metrics: Optional[dict] = None
    sequence_metrics: Optional[dict] = None
    risk_stability: Optional[dict] = None
    group_anomaly_metrics: Optional[dict] = None
    calibration_metrics: Optional[dict] = None
    explanation: str = ""
