"""Pydantic schemas for system-level intelligence data exchange.

These schemas support multi-entity reasoning, coordinated behavior detection,
graph-based risk propagation, sequence mining, adaptive weights, confidence
calibration, and evaluation metrics.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

# ============================================================
# 1. Coordinated Behavior Detection
# ============================================================

class CoordinationPattern(BaseModel):
    """A detected coordination pattern between multiple entities."""

    pattern_id: str = ""
    coordination_type: str = ""  # co_occurrence, sequential, convoy, staggered
    involved_entities: list[str] = Field(default_factory=list)
    frequency: int = 0  # How many times this pattern was observed
    consistency: float = 0.0  # CV-based consistency score [0,1]
    confidence: float = 0.0
    mean_time_gap_seconds: Optional[float] = None
    std_time_gap_seconds: Optional[float] = None
    locations: list[str] = Field(default_factory=list)
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    evidence: dict = Field(default_factory=dict)
    explanation: str = ""


class CoordinationResult(BaseModel):
    """Result of system-level coordination analysis."""

    total_entities_analyzed: int = 0
    total_events_analyzed: int = 0
    patterns_detected: list[CoordinationPattern] = Field(default_factory=list)
    graph_motifs: list[dict] = Field(default_factory=list)
    analysis_window_hours: float = 0.0
    explanation: str = ""


# ============================================================
# 2. Graph-Based Risk Propagation
# ============================================================

class RiskContribution(BaseModel):
    """Risk contribution from a single neighbor in propagation."""

    source_entity_id: str
    source_risk: float = 0.0
    relationship_weight: float = 0.0
    hop_distance: int = 1
    damping_applied: float = 0.0
    contribution: float = 0.0


class PropagatedRiskScore(BaseModel):
    """Risk score after graph-based propagation."""

    entity_id: str
    original_risk: float = 0.0
    propagated_risk: float = 0.0
    final_risk: float = 0.0  # blend of original + propagated
    risk_level: str = "low"
    neighbor_contributions: list[RiskContribution] = Field(default_factory=list)
    propagation_depth: int = 0
    damping_factor: float = 0.5
    blend_alpha: float = 0.7  # weight on original vs propagated
    explanation: str = ""


# ============================================================
# 3. Sequence & Causal Pattern Detection
# ============================================================

class SequencePattern(BaseModel):
    """A detected ordered sequence of entity appearances."""

    sequence: list[str] = Field(default_factory=list)  # [A, B, C]
    support: int = 0  # Number of times this sequence was observed
    confidence: float = 0.0  # P(sequence) given prefix
    mean_delay_seconds: list[float] = Field(default_factory=list)  # delays between steps
    std_delay_seconds: list[float] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)
    evidence: dict = Field(default_factory=dict)
    explanation: str = ""


class CausalRelationship(BaseModel):
    """A detected lead/lag causal relationship between two entities."""

    leader_entity: str
    follower_entity: str
    conditional_probability: float = 0.0  # P(B | A)
    baseline_probability: float = 0.0  # P(B) unconditionally
    lift: float = 0.0  # P(B|A) / P(B)
    mean_lag_seconds: float = 0.0
    std_lag_seconds: float = 0.0
    occurrences: int = 0
    confidence: float = 0.0
    explanation: str = ""


class SequenceResult(BaseModel):
    """Result of sequence and causal pattern detection."""

    frequent_sequences: list[SequencePattern] = Field(default_factory=list)
    causal_relationships: list[CausalRelationship] = Field(default_factory=list)
    total_events_analyzed: int = 0
    time_window_seconds: float = 0.0
    min_support: int = 0
    explanation: str = ""


# ============================================================
# 4. Adaptive Risk Model
# ============================================================

class WeightSnapshot(BaseModel):
    """A point-in-time snapshot of adaptive risk weights."""

    timestamp: datetime
    w1_anomaly: float
    w2_association: float
    w3_behavior: float
    trigger: str = ""  # what caused the update
    evidence: dict = Field(default_factory=dict)


class AdaptiveWeightState(BaseModel):
    """Current state of the adaptive risk weight model."""

    current_w1: float = 0.4
    current_w2: float = 0.3
    current_w3: float = 0.3
    update_count: int = 0
    weight_history: list[WeightSnapshot] = Field(default_factory=list)
    prior_alpha: list[float] = Field(default_factory=lambda: [4.0, 3.0, 3.0])
    posterior_alpha: list[float] = Field(default_factory=lambda: [4.0, 3.0, 3.0])
    learning_rate: float = 0.1
    regularization_strength: float = 0.01
    explanation: str = ""


# ============================================================
# 5. Confidence Calibration
# ============================================================

class CalibrationBin(BaseModel):
    """A single bin in a calibration/reliability diagram."""

    bin_lower: float = 0.0
    bin_upper: float = 0.0
    mean_predicted: float = 0.0
    mean_actual: float = 0.0
    count: int = 0
    gap: float = 0.0  # |mean_predicted - mean_actual|


class CalibrationResult(BaseModel):
    """Result of confidence calibration analysis."""

    module_name: str = ""
    method: str = ""  # platt_scaling, isotonic_regression, raw
    bins: list[CalibrationBin] = Field(default_factory=list)
    ece: float = 0.0  # Expected Calibration Error
    mce: float = 0.0  # Maximum Calibration Error
    brier_score: float = 0.0
    n_samples: int = 0
    platt_a: Optional[float] = None  # Platt scaling parameter
    platt_b: Optional[float] = None
    explanation: str = ""


# ============================================================
# 6. Multi-Entity Anomaly Detection
# ============================================================

class GroupAnomaly(BaseModel):
    """A detected group-level anomaly."""

    anomaly_type: str = ""  # unusual_gathering, new_cluster, interaction_surge, community_shift
    involved_entities: list[str] = Field(default_factory=list)
    anomaly_score: float = 0.0
    confidence: float = 0.0
    location: Optional[str] = None
    timestamp: Optional[datetime] = None
    baseline_metric: float = 0.0
    observed_metric: float = 0.0
    z_score: float = 0.0
    evidence: dict = Field(default_factory=dict)
    explanation: str = ""


class GroupAnomalyResult(BaseModel):
    """Result of multi-entity anomaly detection."""

    anomalies: list[GroupAnomaly] = Field(default_factory=list)
    clusters_detected: int = 0
    cluster_details: list[dict] = Field(default_factory=list)
    density_change: float = 0.0
    total_entities: int = 0
    total_events: int = 0
    explanation: str = ""


# ============================================================
# 7. System-Level Explanation
# ============================================================

class SystemExplanation(BaseModel):
    """A comprehensive system-level explanation for an alert or insight."""

    alert_id: str = ""
    alert_type: str = ""  # coordination, risk_propagation, sequence, group_anomaly
    summary: str = ""
    pattern_description: str = ""
    contributing_entities: list[dict] = Field(default_factory=list)
    risk_propagation_chain: list[dict] = Field(default_factory=list)
    statistical_significance: dict = Field(default_factory=dict)
    confidence: float = 0.0
    recommended_actions: list[str] = Field(default_factory=list)
    explanation: str = ""


# ============================================================
# 8. Evaluation Framework
# ============================================================

class EvaluationMetrics(BaseModel):
    """Evaluation metrics for a specific capability."""

    module_name: str = ""
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    accuracy: float = 0.0
    calibration_error: float = 0.0
    brier_score: float = 0.0
    n_true_positives: int = 0
    n_false_positives: int = 0
    n_true_negatives: int = 0
    n_false_negatives: int = 0
    details: dict = Field(default_factory=dict)
    explanation: str = ""


class StabilityMetrics(BaseModel):
    """Metrics for risk propagation stability."""

    converged: bool = False
    iterations_to_converge: int = 0
    max_risk_change: float = 0.0
    mean_risk_change: float = 0.0
    oscillation_detected: bool = False
    explanation: str = ""
