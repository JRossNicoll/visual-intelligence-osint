"""Confidence Calibration Module.

Normalizes confidence scores across all intelligence modules so that
a confidence of 0.8 means "80% of the time this is correct."

Implements:
1. Platt Scaling: Logistic sigmoid fit to map raw scores to calibrated probabilities
2. Isotonic Regression: Non-parametric monotonic calibration
3. Reliability Diagrams: Binned calibration analysis
4. Expected Calibration Error (ECE) and Maximum Calibration Error (MCE)
5. Brier Score for overall calibration quality

Why calibration matters:
- Raw confidence scores from different modules are not on the same scale
- A 0.8 anomaly confidence and 0.8 prediction confidence may have
  very different true accuracy rates
- Calibrated scores enable meaningful comparison and decision-making
"""

import logging
from typing import Optional

import numpy as np
from scipy.optimize import minimize

from intelligence_engine.models.system_schemas import (
    CalibrationBin,
    CalibrationResult,
)

logger = logging.getLogger(__name__)

DEFAULT_N_BINS = 10


class ConfidenceCalibrator:
    """Calibrates confidence scores using Platt scaling or isotonic regression.

    Fits a calibration model from (predicted_confidence, actual_outcome) pairs,
    then applies the learned mapping to new confidence scores.
    """

    def __init__(self, n_bins: int = DEFAULT_N_BINS) -> None:
        self.n_bins = n_bins
        self._platt_a: Optional[float] = None
        self._platt_b: Optional[float] = None
        self._isotonic_x: Optional[np.ndarray] = None
        self._isotonic_y: Optional[np.ndarray] = None

    def fit_platt(
        self,
        predicted: list[float],
        actual: list[int],
    ) -> CalibrationResult:
        """Fit Platt scaling: calibrated_p = 1 / (1 + exp(a*f + b)).

        Args:
            predicted: Raw confidence/probability scores from the module.
            actual: Binary outcomes (1 = event occurred/correct, 0 = not).

        Returns:
            CalibrationResult with fitted parameters and metrics.
        """
        if len(predicted) != len(actual):
            raise ValueError("predicted and actual must have same length")
        if len(predicted) < 5:
            return CalibrationResult(
                method="platt_scaling",
                explanation="Insufficient data for Platt scaling (need >= 5).",
            )

        pred = np.array(predicted, dtype=float)
        act = np.array(actual, dtype=float)

        # Fit logistic: P(y=1) = 1 / (1 + exp(a*f + b))
        # Minimize negative log-likelihood
        def neg_log_likelihood(params: np.ndarray) -> float:
            a, b = params
            p = 1.0 / (1.0 + np.exp(a * pred + b))
            p = np.clip(p, 1e-10, 1 - 1e-10)
            return -float(np.sum(act * np.log(p) + (1 - act) * np.log(1 - p)))

        result = minimize(neg_log_likelihood, x0=np.array([0.0, 0.0]), method="Nelder-Mead")
        self._platt_a = float(result.x[0])
        self._platt_b = float(result.x[1])

        # Apply calibration
        calibrated = self.calibrate_platt(predicted)

        # Compute metrics
        return self._compute_metrics(
            predicted, calibrated, actual, "platt_scaling",
            platt_a=self._platt_a, platt_b=self._platt_b,
        )

    def calibrate_platt(self, scores: list[float]) -> list[float]:
        """Apply fitted Platt scaling to new scores."""
        if self._platt_a is None:
            return scores

        arr = np.array(scores, dtype=float)
        calibrated = 1.0 / (1.0 + np.exp(self._platt_a * arr + self._platt_b))
        return [round(float(c), 4) for c in calibrated]

    def fit_isotonic(
        self,
        predicted: list[float],
        actual: list[int],
    ) -> CalibrationResult:
        """Fit isotonic (monotonic) regression calibration.

        Pool-adjacent-violators algorithm (PAVA) to find the monotonic
        mapping that minimizes squared error.

        Args:
            predicted: Raw confidence scores.
            actual: Binary outcomes.

        Returns:
            CalibrationResult with metrics.
        """
        if len(predicted) != len(actual):
            raise ValueError("predicted and actual must have same length")
        if len(predicted) < 5:
            return CalibrationResult(
                method="isotonic_regression",
                explanation="Insufficient data for isotonic regression (need >= 5).",
            )

        pred = np.array(predicted, dtype=float)
        act = np.array(actual, dtype=float)

        # Sort by predicted
        order = np.argsort(pred)
        pred_sorted = pred[order]
        act_sorted = act[order]

        # Pool-adjacent-violators algorithm
        isotonic_y = self._pava(act_sorted)
        self._isotonic_x = pred_sorted
        self._isotonic_y = isotonic_y

        # Apply calibration
        calibrated = self.calibrate_isotonic(predicted)

        return self._compute_metrics(
            predicted, calibrated, actual, "isotonic_regression"
        )

    def _pava(self, y: np.ndarray) -> np.ndarray:
        """Pool-adjacent-violators algorithm for isotonic regression."""
        n = len(y)
        result = y.copy().astype(float)
        weights = np.ones(n)

        i = 0
        while i < n - 1:
            if result[i] > result[i + 1]:
                # Pool
                total_weight = weights[i] + weights[i + 1]
                pooled = (result[i] * weights[i] + result[i + 1] * weights[i + 1]) / total_weight
                result[i] = pooled
                result[i + 1] = pooled
                weights[i] = total_weight
                weights[i + 1] = total_weight

                # Check backward
                j = i
                while j > 0 and result[j - 1] > result[j]:
                    total = weights[j - 1] + weights[j]
                    pooled = (result[j - 1] * weights[j - 1] + result[j] * weights[j]) / total
                    result[j - 1] = pooled
                    result[j] = pooled
                    weights[j - 1] = total
                    weights[j] = total
                    j -= 1
            i += 1

        return result

    def calibrate_isotonic(self, scores: list[float]) -> list[float]:
        """Apply fitted isotonic regression to new scores."""
        if self._isotonic_x is None or self._isotonic_y is None:
            return scores

        calibrated = np.interp(
            scores, self._isotonic_x, self._isotonic_y,
            left=float(self._isotonic_y[0]),
            right=float(self._isotonic_y[-1]),
        )
        return [round(float(c), 4) for c in calibrated]

    def compute_reliability_diagram(
        self,
        predicted: list[float],
        actual: list[int],
    ) -> CalibrationResult:
        """Compute reliability diagram (binned calibration) without fitting.

        Args:
            predicted: Confidence scores.
            actual: Binary outcomes.

        Returns:
            CalibrationResult with bins and error metrics.
        """
        return self._compute_metrics(predicted, predicted, actual, "raw")

    def _compute_metrics(
        self,
        raw_predicted: list[float],
        calibrated: list[float],
        actual: list[int],
        method: str,
        platt_a: Optional[float] = None,
        platt_b: Optional[float] = None,
    ) -> CalibrationResult:
        """Compute calibration metrics."""
        pred = np.array(calibrated, dtype=float)
        act = np.array(actual, dtype=float)
        n = len(pred)

        # Binned calibration
        bins = []
        bin_edges = np.linspace(0, 1, self.n_bins + 1)

        for i in range(self.n_bins):
            lower = bin_edges[i]
            upper = bin_edges[i + 1]
            mask = (pred >= lower) & (pred < upper) if i < self.n_bins - 1 else (pred >= lower) & (pred <= upper)
            count = int(mask.sum())

            if count > 0:
                mean_pred = float(pred[mask].mean())
                mean_actual = float(act[mask].mean())
                gap = abs(mean_pred - mean_actual)
            else:
                mean_pred = (lower + upper) / 2
                mean_actual = 0.0
                gap = 0.0

            bins.append(CalibrationBin(
                bin_lower=round(lower, 2),
                bin_upper=round(upper, 2),
                mean_predicted=round(mean_pred, 4),
                mean_actual=round(mean_actual, 4),
                count=count,
                gap=round(gap, 4),
            ))

        # ECE (Expected Calibration Error)
        ece = sum(b.gap * b.count for b in bins) / max(n, 1)

        # MCE (Maximum Calibration Error)
        mce = max(b.gap for b in bins) if bins else 0.0

        # Brier Score
        brier = float(np.mean((pred - act) ** 2))

        explanation_parts = [
            f"Calibration method: {method}.",
            f"ECE={ece:.4f}, MCE={mce:.4f}, Brier={brier:.4f}.",
            f"Samples: {n}.",
        ]
        if platt_a is not None:
            explanation_parts.append(
                f"Platt parameters: a={platt_a:.4f}, b={platt_b:.4f}."
            )

        return CalibrationResult(
            module_name="",
            method=method,
            bins=bins,
            ece=round(ece, 4),
            mce=round(mce, 4),
            brier_score=round(brier, 4),
            n_samples=n,
            platt_a=round(platt_a, 4) if platt_a is not None else None,
            platt_b=round(platt_b, 4) if platt_b is not None else None,
            explanation=" ".join(explanation_parts),
        )
