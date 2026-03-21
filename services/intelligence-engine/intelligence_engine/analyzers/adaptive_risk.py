"""Adaptive Risk Model - Bayesian weight updating.

Replaces static weights in R = w1*anomaly + w2*association + w3*behavior
with adaptive Bayesian weight updating that learns from feedback.

Approach: Dirichlet-Multinomial model
- Prior: Dirichlet(alpha_1, alpha_2, alpha_3) representing initial weight beliefs
- Update: When an alert is confirmed/rejected, the component that contributed
  most (or least) gets its alpha updated
- Posterior mean gives new weights: w_i = alpha_i / sum(alpha)

Features:
- Online Bayesian updating (no batch retraining needed)
- Regularization toward prior (prevents extreme weights)
- Weight evolution logging
- Stability guarantees (minimum weight floor)

Why Bayesian over gradient-based:
- Works with sparse feedback (few confirmed alerts)
- Natural uncertainty quantification
- Principled regularization via prior
- No learning rate tuning needed (prior strength controls it)
"""

import logging
from datetime import datetime, timezone

import numpy as np

from intelligence_engine.models.system_schemas import (
    AdaptiveWeightState,
    WeightSnapshot,
)

logger = logging.getLogger(__name__)

# Minimum weight floor to prevent any component from being zeroed out
MIN_WEIGHT = 0.05
# Default prior: Dirichlet(4, 3, 3) encodes initial belief w1=0.4, w2=0.3, w3=0.3
DEFAULT_PRIOR_ALPHA = [4.0, 3.0, 3.0]
# Maximum alpha to prevent prior from dominating forever
MAX_ALPHA_SUM = 100.0


class AdaptiveRiskModel:
    """Bayesian adaptive risk weight model using Dirichlet distribution.

    Maintains a Dirichlet posterior over the three risk weight components.
    Updates weights based on feedback (confirmed alerts, false positives, etc.).
    """

    def __init__(
        self,
        prior_alpha: list[float] | None = None,
        min_weight: float = MIN_WEIGHT,
    ) -> None:
        """Initialize with Dirichlet prior.

        Args:
            prior_alpha: Dirichlet concentration parameters [alpha_1, alpha_2, alpha_3].
                         Higher values = stronger prior belief.
            min_weight: Minimum weight floor for any component.
        """
        if prior_alpha is None:
            prior_alpha = list(DEFAULT_PRIOR_ALPHA)

        if len(prior_alpha) != 3:
            raise ValueError(f"Need exactly 3 alpha values, got {len(prior_alpha)}")
        if any(a <= 0 for a in prior_alpha):
            raise ValueError("All alpha values must be positive")

        self.prior_alpha = list(prior_alpha)
        self.posterior_alpha = list(prior_alpha)
        self.min_weight = min_weight
        self.weight_history: list[WeightSnapshot] = []
        self.update_count = 0

        # Log initial state
        self._log_weights("initialization")

    @property
    def weights(self) -> tuple[float, float, float]:
        """Current weights (posterior mean of Dirichlet)."""
        total = sum(self.posterior_alpha)
        raw = [a / total for a in self.posterior_alpha]
        # Apply minimum weight floor
        return self._apply_floor(raw)

    def _apply_floor(self, weights: list[float]) -> tuple[float, float, float]:
        """Apply minimum weight floor and renormalize."""
        floored = [max(w, self.min_weight) for w in weights]
        total = sum(floored)
        normalized = [w / total for w in floored]
        return (normalized[0], normalized[1], normalized[2])

    def get_state(self) -> AdaptiveWeightState:
        """Get current state of the adaptive model."""
        w1, w2, w3 = self.weights
        return AdaptiveWeightState(
            current_w1=round(w1, 4),
            current_w2=round(w2, 4),
            current_w3=round(w3, 4),
            update_count=self.update_count,
            weight_history=list(self.weight_history[-20:]),  # Last 20 snapshots
            prior_alpha=list(self.prior_alpha),
            posterior_alpha=list(self.posterior_alpha),
            explanation=(
                f"Dirichlet posterior: alpha={[round(a,2) for a in self.posterior_alpha]}. "
                f"Weights: anomaly={w1:.3f}, association={w2:.3f}, behavior={w3:.3f}. "
                f"Updates: {self.update_count}."
            ),
        )

    def update_from_feedback(
        self,
        feedback_type: str,
        component_scores: dict[str, float],
        outcome: bool,
    ) -> AdaptiveWeightState:
        """Update weights based on alert feedback.

        Args:
            feedback_type: Type of feedback:
                - "true_positive": Alert was correct (boost contributing components)
                - "false_positive": Alert was wrong (reduce contributing components)
                - "false_negative": Missed alert (boost underperforming components)
            component_scores: Dict with keys "anomaly", "association", "behavior"
                              containing the scores that produced the alert.
            outcome: True if the alert was correct (for true_positive/false_negative),
                     False if wrong (for false_positive).

        Returns:
            Updated AdaptiveWeightState.
        """
        anomaly = component_scores.get("anomaly", 0.0)
        association = component_scores.get("association", 0.0)
        behavior = component_scores.get("behavior", 0.0)
        scores = np.array([anomaly, association, behavior])

        # Normalize scores to get relative contributions
        score_sum = scores.sum()
        if score_sum > 0:
            contributions = scores / score_sum
        else:
            contributions = np.array([1 / 3, 1 / 3, 1 / 3])

        # Compute update magnitude
        update_strength = 1.0  # Base update

        if feedback_type == "true_positive":
            # Boost components that contributed most to the correct alert
            delta = contributions * update_strength
        elif feedback_type == "false_positive":
            # Reduce components that contributed most to the false alert
            # Boost components that contributed least
            delta = (1.0 - contributions) * update_strength * 0.5
        elif feedback_type == "false_negative":
            # Boost all components (especially weak ones) to increase sensitivity
            delta = (1.0 - contributions) * update_strength * 0.3
        else:
            logger.warning(f"Unknown feedback type: {feedback_type}")
            return self.get_state()

        # Apply update with regularization
        new_alpha = [
            self.posterior_alpha[i] + delta[i]
            for i in range(3)
        ]

        # Regularization: prevent alpha sum from growing unboundedly
        alpha_sum = sum(new_alpha)
        if alpha_sum > MAX_ALPHA_SUM:
            scale = MAX_ALPHA_SUM / alpha_sum
            new_alpha = [a * scale for a in new_alpha]

        # Ensure all alphas stay positive
        new_alpha = [max(a, 0.5) for a in new_alpha]

        self.posterior_alpha = new_alpha
        self.update_count += 1

        self._log_weights(f"{feedback_type}_{self.update_count}")

        return self.get_state()

    def update_from_component_performance(
        self,
        anomaly_accuracy: float,
        association_accuracy: float,
        behavior_accuracy: float,
    ) -> AdaptiveWeightState:
        """Update weights based on measured component accuracy.

        When evaluation metrics are available, directly adjust weights
        proportional to each component's accuracy.

        Args:
            anomaly_accuracy: Accuracy of anomaly component [0,1].
            association_accuracy: Accuracy of association component [0,1].
            behavior_accuracy: Accuracy of behavior component [0,1].

        Returns:
            Updated state.
        """
        accuracies = np.array([anomaly_accuracy, association_accuracy, behavior_accuracy])
        acc_sum = accuracies.sum()

        if acc_sum > 0:
            # Update alpha proportional to accuracy
            target_weights = accuracies / acc_sum
            update_strength = 0.5  # Conservative update

            for i in range(3):
                self.posterior_alpha[i] += target_weights[i] * update_strength

        # Regularize
        alpha_sum = sum(self.posterior_alpha)
        if alpha_sum > MAX_ALPHA_SUM:
            scale = MAX_ALPHA_SUM / alpha_sum
            self.posterior_alpha = [a * scale for a in self.posterior_alpha]

        self.update_count += 1
        self._log_weights("accuracy_update")

        return self.get_state()

    def compute_risk_with_adaptive_weights(
        self,
        anomaly_score: float,
        association_score: float,
        behavior_score: float,
    ) -> tuple[float, dict]:
        """Compute risk using current adaptive weights.

        Args:
            anomaly_score: Anomaly component [0,1].
            association_score: Association component [0,1].
            behavior_score: Behavior component [0,1].

        Returns:
            (risk_score, details_dict)
        """
        w1, w2, w3 = self.weights
        risk = w1 * anomaly_score + w2 * association_score + w3 * behavior_score
        risk = min(max(risk, 0.0), 1.0)

        # Compute weight uncertainty from Dirichlet
        alpha_sum = sum(self.posterior_alpha)
        weight_variance = [
            (a * (alpha_sum - a)) / (alpha_sum ** 2 * (alpha_sum + 1))
            for a in self.posterior_alpha
        ]

        details = {
            "weights": {"w1": round(w1, 4), "w2": round(w2, 4), "w3": round(w3, 4)},
            "components": {
                "anomaly": round(anomaly_score, 4),
                "association": round(association_score, 4),
                "behavior": round(behavior_score, 4),
            },
            "weight_uncertainty": [round(v, 6) for v in weight_variance],
            "alpha_sum": round(alpha_sum, 2),
            "updates_applied": self.update_count,
        }

        return round(risk, 4), details

    def _log_weights(self, trigger: str) -> None:
        """Log current weights to history."""
        w1, w2, w3 = self.weights
        self.weight_history.append(WeightSnapshot(
            timestamp=datetime.now(timezone.utc),
            w1_anomaly=round(w1, 4),
            w2_association=round(w2, 4),
            w3_behavior=round(w3, 4),
            trigger=trigger,
            evidence={
                "posterior_alpha": [round(a, 3) for a in self.posterior_alpha],
                "alpha_sum": round(sum(self.posterior_alpha), 3),
            },
        ))

    def reset_to_prior(self) -> AdaptiveWeightState:
        """Reset posterior back to prior (discard all learned adjustments)."""
        self.posterior_alpha = list(self.prior_alpha)
        self.update_count = 0
        self.weight_history.clear()
        self._log_weights("reset")
        return self.get_state()
