"""Risk Scoring Engine - Formalized multi-component risk model.

Computes entity risk using a weighted linear combination:

    Risk(entity) = w1 * anomaly_score + w2 * association_risk + w3 * behavior_score

Component definitions:
- anomaly_score (0-1): Aggregate anomaly score from the AnomalyDetector.
  Computed as the exponentially weighted moving average of recent anomaly
  scores, giving more weight to recent anomalies.

- association_risk (0-1): Risk propagated from associated entities, weighted
  by relationship strength. Uses a damped propagation model:
  association_risk = Σ(relationship_weight_i * risk_score_i * damping) / n
  where damping = 0.5 prevents risk inflation through long chains.

- behavior_score (0-1): Risk derived from behavior classifications.
  Each behavior type has an inherent risk weight:
  - loitering: 0.6
  - convoy: 0.5
  - anomaly: 0.8
  - long_stay: 0.3
  - repeated_visit: 0.2
  - routine: 0.1
  The score is the confidence-weighted max of active behaviors.

Default weights: w1=0.4, w2=0.3, w3=0.3
Justification:
- Anomalies (w1=0.4): Direct observed deviations are the strongest signal.
  An entity behaving unlike its own baseline is the most reliable indicator.
- Association (w2=0.3): Known associations with high-risk entities provide
  strong indirect evidence, but should not dominate without direct evidence.
- Behavior (w3=0.3): Behavioral patterns provide context but are less
  definitive than anomalies — routine behavior may appear suspicious but
  be benign. Weighted equally with association to balance.

Risk levels:
- low: 0.0 - 0.25
- medium: 0.25 - 0.50
- high: 0.50 - 0.75
- critical: 0.75 - 1.0
"""

import logging

import numpy as np

from intelligence_engine.models.schemas import RiskScore

logger = logging.getLogger(__name__)

# Default component weights
DEFAULT_W1_ANOMALY = 0.4
DEFAULT_W2_ASSOCIATION = 0.3
DEFAULT_W3_BEHAVIOR = 0.3

# Risk propagation damping factor
ASSOCIATION_DAMPING = 0.5

# Behavior type risk weights (inherent risk of each behavior)
BEHAVIOR_RISK_WEIGHTS = {
    "loitering": 0.6,
    "convoy": 0.5,
    "anomaly": 0.8,
    "long_stay": 0.3,
    "repeated_visit": 0.2,
    "routine": 0.1,
    "short_stay": 0.15,
    "transient": 0.05,
}

# EWMA decay factor for anomaly score aggregation
ANOMALY_EWMA_ALPHA = 0.3  # Recent anomalies weigh more

# Risk level thresholds
RISK_LEVEL_THRESHOLDS = [
    (0.75, "critical"),
    (0.50, "high"),
    (0.25, "medium"),
    (0.0, "low"),
]


class RiskScorer:
    """Computes formalized risk scores for entities.

    All component scores are mathematically defined and the overall
    risk score is a tunable weighted combination. Every score includes
    an explanation of contributing factors.
    """

    def __init__(
        self,
        w1: float = DEFAULT_W1_ANOMALY,
        w2: float = DEFAULT_W2_ASSOCIATION,
        w3: float = DEFAULT_W3_BEHAVIOR,
    ) -> None:
        """Initialize the risk scorer.

        Args:
            w1: Weight for anomaly component.
            w2: Weight for association component.
            w3: Weight for behavior component.

        Raises:
            ValueError: If weights don't sum to ~1.0.
        """
        total = w1 + w2 + w3
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Weights must sum to 1.0, got {total}")
        self.w1 = w1
        self.w2 = w2
        self.w3 = w3

    def compute(
        self,
        entity_id: str,
        anomaly_scores: list[float],
        associated_entities: list[dict],
        behavior_classifications: list[dict],
    ) -> RiskScore:
        """Compute the risk score for an entity.

        Args:
            entity_id: Entity to score.
            anomaly_scores: List of recent anomaly scores (0-1), most recent last.
            associated_entities: List of dicts with:
                - entity_id: str
                - relationship_weight: float (0-1)
                - risk_score: float (0-1)
            behavior_classifications: List of dicts with:
                - behavior_type: str
                - confidence: float (0-1)
                - severity: str

        Returns:
            RiskScore with all components and explanation.
        """
        risk_factors = []

        # --- Component 1: Anomaly Score (EWMA) ---
        anomaly_component = self._compute_anomaly_component(anomaly_scores)
        if anomaly_component > 0.1:
            risk_factors.append({
                "factor": "anomaly",
                "score": round(anomaly_component, 4),
                "weight": self.w1,
                "detail": (
                    f"Anomaly EWMA={anomaly_component:.3f} from "
                    f"{len(anomaly_scores)} recent scores."
                ),
            })

        # --- Component 2: Association Risk (Damped Propagation) ---
        association_component = self._compute_association_component(associated_entities)
        if association_component > 0.05:
            top_risky = sorted(
                associated_entities, key=lambda x: x.get("risk_score", 0), reverse=True
            )[:3]
            risk_factors.append({
                "factor": "association",
                "score": round(association_component, 4),
                "weight": self.w2,
                "detail": (
                    f"Association risk={association_component:.3f} propagated from "
                    f"{len(associated_entities)} associated entities "
                    f"(damping={ASSOCIATION_DAMPING}). "
                    f"Top risk sources: {[e.get('entity_id', '?') for e in top_risky]}."
                ),
            })

        # --- Component 3: Behavior Score ---
        behavior_component = self._compute_behavior_component(behavior_classifications)
        if behavior_component > 0.05:
            behavior_types = [b.get("behavior_type", "unknown") for b in behavior_classifications]
            risk_factors.append({
                "factor": "behavior",
                "score": round(behavior_component, 4),
                "weight": self.w3,
                "detail": (
                    f"Behavior risk={behavior_component:.3f} from "
                    f"classifications: {behavior_types}."
                ),
            })

        # --- Composite Risk Score ---
        risk_score = (
            self.w1 * anomaly_component
            + self.w2 * association_component
            + self.w3 * behavior_component
        )
        risk_score = min(max(risk_score, 0.0), 1.0)

        # Determine risk level
        risk_level = "low"
        for threshold, level in RISK_LEVEL_THRESHOLDS:
            if risk_score >= threshold:
                risk_level = level
                break

        explanation = self._build_explanation(
            risk_score, risk_level,
            anomaly_component, association_component, behavior_component,
            risk_factors,
        )

        return RiskScore(
            entity_id=entity_id,
            risk_score=round(risk_score, 4),
            risk_level=risk_level,
            anomaly_component=round(anomaly_component, 4),
            association_component=round(association_component, 4),
            behavior_component=round(behavior_component, 4),
            w1=self.w1,
            w2=self.w2,
            w3=self.w3,
            risk_factors=risk_factors,
            explanation=explanation,
        )

    def _compute_anomaly_component(self, scores: list[float]) -> float:
        """Compute anomaly component using Exponentially Weighted Moving Average.

        EWMA gives more weight to recent anomaly scores:
            S_t = α * x_t + (1 - α) * S_{t-1}

        This ensures recent anomalous behavior dominates the score while
        historical anomalies decay naturally.
        """
        if not scores:
            return 0.0

        ewma = scores[0]
        for score in scores[1:]:
            ewma = ANOMALY_EWMA_ALPHA * score + (1 - ANOMALY_EWMA_ALPHA) * ewma

        return min(max(float(ewma), 0.0), 1.0)

    def _compute_association_component(self, associations: list[dict]) -> float:
        """Compute association risk using damped propagation.

        association_risk = Σ(w_i * r_i * d) / max(n, 1)

        where:
        - w_i = relationship weight with entity i
        - r_i = risk score of entity i
        - d = damping factor (0.5)
        - n = number of associations

        Damping prevents risk inflation through long chains.
        """
        if not associations:
            return 0.0

        weighted_risks = []
        for assoc in associations:
            rel_weight = assoc.get("relationship_weight", 0.0)
            entity_risk = assoc.get("risk_score", 0.0)
            propagated = rel_weight * entity_risk * ASSOCIATION_DAMPING
            weighted_risks.append(propagated)

        if not weighted_risks:
            return 0.0

        # Use max rather than mean to capture the strongest risk source
        # but also consider overall density
        max_risk = max(weighted_risks)
        mean_risk = float(np.mean(weighted_risks))

        # Blend: 60% max + 40% mean to capture both intensity and breadth
        component = 0.6 * max_risk + 0.4 * mean_risk
        return min(max(component, 0.0), 1.0)

    def _compute_behavior_component(self, classifications: list[dict]) -> float:
        """Compute behavior risk from classifications.

        Each behavior type has an inherent risk weight. The component
        score is the confidence-weighted maximum of all active behaviors.
        """
        if not classifications:
            return 0.0

        behavior_scores = []
        for cls in classifications:
            behavior_type = cls.get("behavior_type", "unknown")
            confidence = cls.get("confidence", 0.5)
            inherent_risk = BEHAVIOR_RISK_WEIGHTS.get(behavior_type, 0.1)

            # Score = inherent_risk * confidence
            behavior_scores.append(inherent_risk * confidence)

        if not behavior_scores:
            return 0.0

        # Use weighted max (emphasize the most risky behavior)
        max_score = max(behavior_scores)
        mean_score = float(np.mean(behavior_scores))

        # 70% max + 30% mean
        component = 0.7 * max_score + 0.3 * mean_score
        return min(max(component, 0.0), 1.0)

    def _build_explanation(
        self,
        score: float,
        level: str,
        anomaly: float,
        association: float,
        behavior: float,
        factors: list[dict],
    ) -> str:
        """Build explanation of risk computation."""
        parts = [
            f"Risk score: {score:.3f} ({level}).",
            f"Formula: R = {self.w1}*anomaly + {self.w2}*association + {self.w3}*behavior",
            f"= {self.w1}*{anomaly:.3f} + {self.w2}*{association:.3f} + {self.w3}*{behavior:.3f}",
            f"= {score:.3f}.",
        ]

        if factors:
            parts.append("Contributing factors:")
            for f in factors:
                parts.append(f"  - {f['factor']}: {f['detail']}")

        if not factors:
            parts.append("No significant risk factors detected.")

        return " ".join(parts)
