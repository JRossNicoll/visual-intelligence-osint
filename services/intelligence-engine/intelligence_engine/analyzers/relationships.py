"""Relationship Intelligence Engine - Decay-weighted edge scoring.

Computes relationship strength between entities using a principled
scoring model that accounts for:

1. Co-occurrence frequency: Raw count of joint appearances
2. Temporal proximity: How close in time the co-occurrences are
3. Consistency: Regularity of co-occurrences over the observation window
4. Temporal decay: Older interactions contribute less via exponential decay

The final weight is:

    W(e1, e2) = α * frequency_score + β * proximity_score + γ * consistency_score

where all scores are decay-adjusted and normalized to [0, 1].

Decay function: weight(t) = exp(-λ * Δt)
    where Δt is hours since the co-occurrence and λ is the decay rate.

Default λ = 0.01 (half-life ≈ 69 hours ≈ 2.9 days)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np

from intelligence_engine.models.schemas import RelationshipWeight

logger = logging.getLogger(__name__)

# Default weights for the composite score
ALPHA_FREQUENCY = 0.4
BETA_PROXIMITY = 0.3
GAMMA_CONSISTENCY = 0.3

# Exponential decay rate (λ)
# Half-life = ln(2) / λ ≈ 69.3 hours at λ=0.01
DEFAULT_DECAY_RATE = 0.01

# Strength labels based on final weight
STRENGTH_THRESHOLDS = [
    (0.7, "very_strong"),
    (0.4, "strong"),
    (0.2, "moderate"),
    (0.0, "weak"),
]


class RelationshipEngine:
    """Computes weighted relationship strength between entities.

    All edge weights are derived from statistical properties of
    co-occurrence patterns, not binary presence/absence.
    """

    def __init__(
        self,
        decay_rate: float = DEFAULT_DECAY_RATE,
        alpha: float = ALPHA_FREQUENCY,
        beta: float = BETA_PROXIMITY,
        gamma: float = GAMMA_CONSISTENCY,
    ) -> None:
        """Initialize the relationship engine.

        Args:
            decay_rate: Exponential decay rate λ. Higher = faster decay.
                        Half-life = ln(2)/λ hours.
            alpha: Weight for frequency component.
            beta: Weight for temporal proximity component.
            gamma: Weight for consistency component.
        """
        self.decay_rate = decay_rate
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.half_life_hours = np.log(2) / decay_rate if decay_rate > 0 else float("inf")

    def compute_weight(
        self,
        entity_id_1: str,
        entity_id_2: str,
        co_occurrence_timestamps: list[datetime],
        reference_time: Optional[datetime] = None,
        total_events_entity_1: int = 0,
        total_events_entity_2: int = 0,
    ) -> RelationshipWeight:
        """Compute the relationship weight between two entities.

        Args:
            entity_id_1: First entity ID.
            entity_id_2: Second entity ID.
            co_occurrence_timestamps: Timestamps of joint appearances (sorted).
            reference_time: Current time for decay calculation (default: now).
            total_events_entity_1: Total appearances of entity 1.
            total_events_entity_2: Total appearances of entity 2.

        Returns:
            RelationshipWeight with all component scores and explanation.
        """
        if not co_occurrence_timestamps:
            return RelationshipWeight(
                entity_id_1=entity_id_1,
                entity_id_2=entity_id_2,
                explanation="No co-occurrences recorded.",
            )

        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        n_co = len(co_occurrence_timestamps)
        sorted_times = sorted(co_occurrence_timestamps)

        # --- Component 1: Decay-adjusted frequency score ---
        frequency_score, decay_weights = self._compute_frequency_score(
            sorted_times, reference_time, total_events_entity_1, total_events_entity_2
        )

        # --- Component 2: Temporal proximity score ---
        proximity_score = self._compute_proximity_score(sorted_times)

        # --- Component 3: Consistency score ---
        consistency_score = self._compute_consistency_score(sorted_times)

        # --- Composite weight ---
        decay_adjusted = float(np.sum(decay_weights))
        final_weight = (
            self.alpha * frequency_score
            + self.beta * proximity_score
            + self.gamma * consistency_score
        )
        final_weight = min(max(final_weight, 0.0), 1.0)

        # Strength label
        strength = "weak"
        for threshold, label in STRENGTH_THRESHOLDS:
            if final_weight >= threshold:
                strength = label
                break

        explanation = self._build_explanation(
            n_co, frequency_score, proximity_score, consistency_score,
            decay_adjusted, final_weight, strength,
            total_events_entity_1, total_events_entity_2,
        )

        return RelationshipWeight(
            entity_id_1=entity_id_1,
            entity_id_2=entity_id_2,
            raw_co_occurrences=n_co,
            temporal_proximity_score=round(proximity_score, 4),
            frequency_score=round(frequency_score, 4),
            consistency_score=round(consistency_score, 4),
            decay_adjusted_weight=round(decay_adjusted, 4),
            final_weight=round(final_weight, 4),
            strength_label=strength,
            explanation=explanation,
        )

    def _compute_frequency_score(
        self,
        timestamps: list[datetime],
        reference_time: datetime,
        total_1: int,
        total_2: int,
    ) -> tuple[float, np.ndarray]:
        """Compute decay-adjusted frequency score.

        Each co-occurrence is weighted by exp(-λ * Δt) where Δt is hours
        since the event. The sum is normalized by the maximum possible
        co-occurrences (min of total appearances of either entity).

        Returns (score, decay_weights).
        """
        deltas_hours = np.array([
            (reference_time - t).total_seconds() / 3600.0
            for t in timestamps
        ])
        # Clamp negative deltas (future events) to 0
        deltas_hours = np.maximum(deltas_hours, 0.0)

        decay_weights = np.exp(-self.decay_rate * deltas_hours)
        decay_sum = float(np.sum(decay_weights))

        # Normalize by the maximum possible co-occurrences
        max_possible = max(min(total_1, total_2), len(timestamps), 1)
        score = min(decay_sum / max_possible, 1.0)

        return score, decay_weights

    def _compute_proximity_score(self, timestamps: list[datetime]) -> float:
        """Compute temporal proximity score.

        Measures how tightly clustered the co-occurrences are in time.
        Uses the coefficient of variation (CV) of inter-arrival times.
        Low CV = consistent, regular co-occurrences = high proximity score.

        Also considers the median inter-arrival time — shorter median
        indicates stronger temporal association.
        """
        if len(timestamps) < 2:
            return 0.5  # Single co-occurrence: neutral score

        intervals = np.array([
            (timestamps[i + 1] - timestamps[i]).total_seconds() / 3600.0
            for i in range(len(timestamps) - 1)
        ])

        if len(intervals) == 0:
            return 0.5

        median_interval = float(np.median(intervals))

        # Score inversely proportional to median interval
        # Short intervals (< 1h) → high score
        # Long intervals (> 168h / 1 week) → low score
        interval_score = float(np.exp(-median_interval / 48.0))  # τ = 48 hours

        return min(interval_score, 1.0)

    def _compute_consistency_score(self, timestamps: list[datetime]) -> float:
        """Compute consistency score using coefficient of variation.

        Measures how regular/predictable the co-occurrences are.
        Low CV = highly consistent = high score.
        """
        if len(timestamps) < 3:
            return 0.3  # Not enough data for consistency analysis

        intervals = np.array([
            (timestamps[i + 1] - timestamps[i]).total_seconds() / 3600.0
            for i in range(len(timestamps) - 1)
        ])

        mean_interval = float(np.mean(intervals))
        if mean_interval <= 0:
            return 0.3

        std_interval = float(np.std(intervals, ddof=1)) if len(intervals) > 1 else 0.0
        cv = std_interval / mean_interval

        # Low CV → high consistency score
        # CV = 0 → score = 1.0
        # CV = 1 → score ≈ 0.37
        # CV = 2 → score ≈ 0.14
        consistency = float(np.exp(-cv))
        return min(consistency, 1.0)

    def _build_explanation(
        self,
        n_co: int,
        freq: float,
        prox: float,
        consist: float,
        decay_adj: float,
        final: float,
        strength: str,
        total_1: int,
        total_2: int,
    ) -> str:
        """Build human-readable relationship explanation."""
        parts = [
            f"Relationship strength: {strength} (weight={final:.3f}).",
            f"{n_co} co-occurrences detected.",
            f"Components: frequency={freq:.3f} (α={self.alpha}), "
            f"proximity={prox:.3f} (β={self.beta}), "
            f"consistency={consist:.3f} (γ={self.gamma}).",
            f"Decay-adjusted weight: {decay_adj:.3f} "
            f"(half-life={self.half_life_hours:.1f}h).",
        ]
        if total_1 > 0 and total_2 > 0:
            co_rate = n_co / min(total_1, total_2)
            parts.append(
                f"Co-occurrence rate: {co_rate:.1%} of min(entity appearances)."
            )
        return " ".join(parts)

    def compute_batch(
        self,
        co_occurrence_data: list[dict],
        reference_time: Optional[datetime] = None,
    ) -> list[RelationshipWeight]:
        """Compute weights for multiple entity pairs.

        Args:
            co_occurrence_data: List of dicts with keys:
                - entity_id_1, entity_id_2
                - timestamps: list[datetime]
                - total_events_1, total_events_2: int
            reference_time: Current time for decay.

        Returns:
            List of RelationshipWeight results.
        """
        results = []
        for pair in co_occurrence_data:
            weight = self.compute_weight(
                entity_id_1=pair["entity_id_1"],
                entity_id_2=pair["entity_id_2"],
                co_occurrence_timestamps=pair["timestamps"],
                reference_time=reference_time,
                total_events_entity_1=pair.get("total_events_1", 0),
                total_events_entity_2=pair.get("total_events_2", 0),
            )
            results.append(weight)
        return results
