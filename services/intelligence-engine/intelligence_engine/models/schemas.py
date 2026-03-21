"""Pydantic schemas for intelligence engine data exchange."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TemporalEventInput(BaseModel):
    """Input event for temporal analysis."""

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


class PeriodicityResult(BaseModel):
    """Result of periodicity detection via FFT/autocorrelation."""

    is_periodic: bool = False
    dominant_period_hours: Optional[float] = None
    period_confidence: float = 0.0
    autocorrelation_peak_lag: Optional[int] = None
    autocorrelation_peak_value: Optional[float] = None
    fft_dominant_frequency: Optional[float] = None
    fft_power_ratio: Optional[float] = None
    description: str = ""


class TemporalPatternResult(BaseModel):
    """Full temporal pattern analysis result for an entity."""

    entity_id: str
    event_count: int = 0
    time_span_hours: float = 0.0
    mean_interval_hours: Optional[float] = None
    std_interval_hours: Optional[float] = None
    periodicity: Optional[PeriodicityResult] = None
    peak_hours: list[int] = Field(default_factory=list)
    peak_days: list[int] = Field(default_factory=list)
    hourly_distribution: list[float] = Field(default_factory=list)
    daily_distribution: list[float] = Field(default_factory=list)
    explanation: str = ""


class AnomalyResult(BaseModel):
    """Result of anomaly detection for a single event."""

    is_anomalous: bool = False
    anomaly_score: float = 0.0
    z_score_time: Optional[float] = None
    z_score_location: Optional[float] = None
    isolation_score: Optional[float] = None
    deviation_factors: list[dict] = Field(default_factory=list)
    explanation: str = ""


class BehaviorClassification(BaseModel):
    """Behavior classification result for an entity."""

    entity_id: str
    behavior_type: str  # loitering, repeated_visit, convoy, short_stay, long_stay, routine, transient
    confidence: float = 0.0
    severity: str = "low"
    description: str = ""
    evidence: dict = Field(default_factory=dict)
    duration_seconds: Optional[float] = None
    associated_entities: list[str] = Field(default_factory=list)


class RelationshipWeight(BaseModel):
    """Computed relationship weight between two entities."""

    entity_id_1: str
    entity_id_2: str
    raw_co_occurrences: int = 0
    temporal_proximity_score: float = 0.0
    frequency_score: float = 0.0
    consistency_score: float = 0.0
    decay_adjusted_weight: float = 0.0
    final_weight: float = 0.0
    strength_label: str = "weak"  # weak, moderate, strong, very_strong
    explanation: str = ""


class RiskScore(BaseModel):
    """Formalized risk score for an entity.

    Risk(entity) = w1 * anomaly_score + w2 * association_risk + w3 * behavior_score

    Component definitions:
    - anomaly_score: Aggregate anomaly score from statistical deviation analysis (0-1)
    - association_risk: Propagated risk from associated entities weighted by relationship strength (0-1)
    - behavior_score: Behavior-derived risk from classification (loitering, unusual patterns) (0-1)

    Default weights (tunable):
    - w1 = 0.4 (anomalies are the primary risk signal)
    - w2 = 0.3 (guilt by association is significant but secondary)
    - w3 = 0.3 (behavioral patterns contribute to overall risk)
    """

    entity_id: str
    risk_score: float = 0.0
    risk_level: str = "low"  # low, medium, high, critical

    # Components
    anomaly_component: float = 0.0
    association_component: float = 0.0
    behavior_component: float = 0.0

    # Weights used
    w1: float = 0.4
    w2: float = 0.3
    w3: float = 0.3

    # Risk factors with explanations
    risk_factors: list[dict] = Field(default_factory=list)
    explanation: str = ""


class PredictionResult(BaseModel):
    """Prediction for next entity appearance."""

    entity_id: str
    predicted_time_window_start: Optional[datetime] = None
    predicted_time_window_end: Optional[datetime] = None
    time_confidence: float = 0.0
    predicted_location_id: Optional[str] = None
    predicted_location_name: Optional[str] = None
    location_confidence: float = 0.0
    method: str = ""  # frequency_distribution, periodicity_extrapolation
    evidence: dict = Field(default_factory=dict)
    explanation: str = ""


class NLQueryRequest(BaseModel):
    """Natural language query request."""

    query: str
    max_results: int = 20


class NLQueryResult(BaseModel):
    """Natural language query result with explanation."""

    original_query: str
    interpreted_query: str = ""
    generated_sql: Optional[str] = None
    generated_cypher: Optional[str] = None
    query_explanation: str = ""
    results: list[dict] = Field(default_factory=list)
    result_count: int = 0
    confidence: float = 0.0
