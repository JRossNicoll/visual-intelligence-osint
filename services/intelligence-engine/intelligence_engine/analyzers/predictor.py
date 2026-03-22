"""Predictive Analytics Engine - Frequency-based probability distributions.

Implements next-appearance prediction using:
1. Frequency-based probability distributions over time windows
2. Periodicity extrapolation (when periodic behavior is detected)
3. Location prediction using empirical visit distributions

NO random guessing. All predictions include:
- Predicted time window with confidence interval
- Predicted location with probability
- Method used and evidence supporting the prediction

Prediction methods:
- If periodicity detected: extrapolate next occurrence from dominant period
- If no periodicity: use empirical distribution of inter-arrival times
  to construct a probability density over future time windows
- Location prediction: weighted by visit frequency with temporal decay
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
from scipy import stats

from intelligence_engine.models.schemas import PredictionResult, TemporalPatternResult

logger = logging.getLogger(__name__)

MIN_EVENTS_FOR_PREDICTION = 4


class Predictor:
    """Predicts next entity appearance using statistical methods.

    All predictions are grounded in observed data distributions.
    Confidence scores reflect the statistical uncertainty of the prediction.
    """

    def predict_next_appearance(
        self,
        entity_id: str,
        timestamps: list[datetime],
        temporal_pattern: Optional[TemporalPatternResult] = None,
        location_history: Optional[list[dict]] = None,
        reference_time: Optional[datetime] = None,
    ) -> PredictionResult:
        """Predict when and where an entity will next appear.

        Args:
            entity_id: Entity to predict.
            timestamps: Historical appearance timestamps (sorted).
            temporal_pattern: Pre-computed temporal pattern (optional).
            location_history: List of dicts with location_id, location_name,
                              timestamp, duration_seconds.
            reference_time: Current time (default: now).

        Returns:
            PredictionResult with time window, location, and confidence.
        """
        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        if len(timestamps) < MIN_EVENTS_FOR_PREDICTION:
            return PredictionResult(
                entity_id=entity_id,
                method="insufficient_data",
                explanation=(
                    f"Cannot predict: only {len(timestamps)} observations "
                    f"(need >= {MIN_EVENTS_FOR_PREDICTION})."
                ),
            )

        sorted_ts = sorted(timestamps)

        # Choose prediction method based on available pattern info
        if (
            temporal_pattern
            and temporal_pattern.periodicity
            and temporal_pattern.periodicity.is_periodic
            and temporal_pattern.periodicity.period_confidence > 0.3
        ):
            time_pred = self._predict_periodic(
                sorted_ts, temporal_pattern, reference_time
            )
        else:
            time_pred = self._predict_empirical(sorted_ts, reference_time)

        # Location prediction
        loc_pred = self._predict_location(location_history, reference_time)

        # Merge results
        return PredictionResult(
            entity_id=entity_id,
            predicted_time_window_start=time_pred.get("window_start"),
            predicted_time_window_end=time_pred.get("window_end"),
            time_confidence=time_pred.get("confidence", 0.0),
            predicted_location_id=loc_pred.get("location_id"),
            predicted_location_name=loc_pred.get("location_name"),
            location_confidence=loc_pred.get("confidence", 0.0),
            method=time_pred.get("method", "unknown"),
            evidence={
                "time_evidence": time_pred.get("evidence", {}),
                "location_evidence": loc_pred.get("evidence", {}),
            },
            explanation=self._build_explanation(time_pred, loc_pred),
        )

    def _predict_periodic(
        self,
        timestamps: list[datetime],
        pattern: TemporalPatternResult,
        reference_time: datetime,
    ) -> dict:
        """Predict next appearance using detected periodicity.

        Extrapolates from the last known appearance using the dominant
        period. The prediction window width is proportional to the
        standard deviation of historical inter-arrival times.
        """
        period_hours = pattern.periodicity.dominant_period_hours
        period_confidence = pattern.periodicity.period_confidence

        last_seen = timestamps[-1]
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)

        # How many periods since last seen?
        hours_since_last = (reference_time - last_seen).total_seconds() / 3600.0
        periods_elapsed = hours_since_last / period_hours
        next_period_number = int(np.ceil(periods_elapsed))
        if next_period_number < 1:
            next_period_number = 1

        # Predicted center of next appearance
        predicted_center = last_seen + timedelta(hours=next_period_number * period_hours)

        # Window width based on inter-arrival time variance
        intervals = np.array([
            (timestamps[i + 1] - timestamps[i]).total_seconds() / 3600.0
            for i in range(len(timestamps) - 1)
        ])
        std_interval = float(np.std(intervals, ddof=1)) if len(intervals) > 1 else period_hours * 0.2

        # Use 1 standard deviation as the window half-width
        window_half = timedelta(hours=max(std_interval, 0.5))
        window_start = predicted_center - window_half
        window_end = predicted_center + window_half

        # Confidence: combine period confidence with prediction horizon penalty
        # Predictions further in the future are less confident
        horizon_penalty = float(np.exp(-0.1 * next_period_number))
        confidence = period_confidence * horizon_penalty

        return {
            "window_start": window_start,
            "window_end": window_end,
            "confidence": round(min(confidence, 0.95), 3),
            "method": "periodicity_extrapolation",
            "evidence": {
                "dominant_period_hours": round(period_hours, 2),
                "periods_elapsed": round(periods_elapsed, 2),
                "next_period_number": next_period_number,
                "std_interval_hours": round(std_interval, 2),
                "last_seen": str(last_seen),
                "period_confidence": round(period_confidence, 3),
                "horizon_penalty": round(horizon_penalty, 3),
            },
        }

    def _predict_empirical(
        self, timestamps: list[datetime], reference_time: datetime
    ) -> dict:
        """Predict next appearance using empirical inter-arrival distribution.

        Fits a log-normal distribution to the inter-arrival times (which
        are typically right-skewed) and predicts the next appearance
        as the median of the fitted distribution projected from the
        last observation.

        Log-normal is chosen because:
        - Inter-arrival times are strictly positive
        - The distribution of human activity intervals is typically right-skewed
        - It provides a natural model for "mostly regular with occasional gaps"
        """
        if len(timestamps) < 2:
            return {"confidence": 0.0, "method": "insufficient_data"}

        last_seen = timestamps[-1]
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)

        # Inter-arrival times in hours
        intervals = np.array([
            (timestamps[i + 1] - timestamps[i]).total_seconds() / 3600.0
            for i in range(len(timestamps) - 1)
        ])

        # Filter out zero or near-zero intervals
        intervals = intervals[intervals > 0.01]
        if len(intervals) < 2:
            return {"confidence": 0.0, "method": "insufficient_data"}

        # Fit log-normal distribution to inter-arrival times
        log_intervals = np.log(intervals)
        mu = float(np.mean(log_intervals))
        sigma = float(np.std(log_intervals, ddof=1))

        if sigma < 0.01:
            sigma = 0.01  # Prevent degenerate distribution

        # Predicted next interval: median of log-normal = exp(mu)
        predicted_interval_hours = float(np.exp(mu))

        # Confidence interval (50% interval of log-normal)
        q25 = float(np.exp(mu + sigma * stats.norm.ppf(0.25)))
        q75 = float(np.exp(mu + sigma * stats.norm.ppf(0.75)))

        window_start = last_seen + timedelta(hours=q25)
        window_end = last_seen + timedelta(hours=q75)

        # Confidence based on:
        # 1. How tight the distribution is (low sigma = high confidence)
        # 2. Sample size
        # 3. How far in the future the prediction is
        tightness = float(np.exp(-sigma))
        sample_factor = min(len(intervals) / 20.0, 1.0)
        hours_ahead = (window_start - reference_time).total_seconds() / 3600.0
        horizon_factor = float(np.exp(-0.02 * max(hours_ahead, 0)))

        confidence = tightness * sample_factor * horizon_factor

        return {
            "window_start": window_start,
            "window_end": window_end,
            "confidence": round(min(max(confidence, 0.01), 0.90), 3),
            "method": "frequency_distribution",
            "evidence": {
                "distribution": "log-normal",
                "mu": round(mu, 4),
                "sigma": round(sigma, 4),
                "predicted_interval_hours": round(predicted_interval_hours, 2),
                "q25_hours": round(q25, 2),
                "q75_hours": round(q75, 2),
                "n_intervals": len(intervals),
                "last_seen": str(last_seen),
                "tightness_factor": round(tightness, 3),
                "sample_factor": round(sample_factor, 3),
                "horizon_factor": round(horizon_factor, 3),
            },
        }

    def _predict_location(
        self,
        location_history: Optional[list[dict]],
        reference_time: datetime,
    ) -> dict:
        """Predict most likely next location using decay-weighted frequencies.

        Applies temporal decay to historical visit frequencies, then
        normalizes to get a probability distribution over locations.
        The most probable location is returned with its probability.
        """
        if not location_history:
            return {"confidence": 0.0, "evidence": {}}

        # Decay-weighted frequency per location
        location_weights: dict[str, float] = {}
        location_names: dict[str, str] = {}
        decay_rate = 0.005  # Half-life ≈ 139 hours ≈ 5.8 days

        for visit in location_history:
            loc_id = visit.get("location_id")
            if not loc_id:
                continue

            visit_time = visit.get("timestamp")
            if isinstance(visit_time, str):
                try:
                    visit_time = datetime.fromisoformat(visit_time)
                except ValueError:
                    continue

            if visit_time and visit_time.tzinfo is None:
                visit_time = visit_time.replace(tzinfo=timezone.utc)

            hours_ago = (reference_time - visit_time).total_seconds() / 3600.0 if visit_time else 0
            weight = float(np.exp(-decay_rate * max(hours_ago, 0)))

            location_weights[loc_id] = location_weights.get(loc_id, 0.0) + weight

            if visit.get("location_name"):
                location_names[loc_id] = visit["location_name"]

        if not location_weights:
            return {"confidence": 0.0, "evidence": {}}

        # Normalize to probabilities
        total_weight = sum(location_weights.values())
        if total_weight == 0:
            return {"confidence": 0.0, "evidence": {}}

        probabilities = {
            loc: w / total_weight for loc, w in location_weights.items()
        }

        # Most likely location
        best_loc = max(probabilities, key=probabilities.get)
        best_prob = probabilities[best_loc]

        return {
            "location_id": best_loc,
            "location_name": location_names.get(best_loc, best_loc),
            "confidence": round(best_prob, 3),
            "evidence": {
                "location_probabilities": {
                    loc: round(p, 4) for loc, p in
                    sorted(probabilities.items(), key=lambda x: x[1], reverse=True)[:5]
                },
                "decay_rate": decay_rate,
                "total_locations": len(location_weights),
            },
        }

    def _build_explanation(self, time_pred: dict, loc_pred: dict) -> str:
        """Build human-readable prediction explanation."""
        parts = []

        method = time_pred.get("method", "unknown")
        if method == "periodicity_extrapolation":
            evidence = time_pred.get("evidence", {})
            parts.append(
                f"Time prediction via periodicity extrapolation: "
                f"dominant period ~{evidence.get('dominant_period_hours', '?')}h, "
                f"{evidence.get('next_period_number', '?')} periods ahead from last seen."
            )
        elif method == "frequency_distribution":
            evidence = time_pred.get("evidence", {})
            parts.append(
                f"Time prediction via log-normal distribution fit "
                f"(μ={evidence.get('mu', '?')}, σ={evidence.get('sigma', '?')}). "
                f"Predicted interval: ~{evidence.get('predicted_interval_hours', '?')}h."
            )
        else:
            parts.append(f"Time prediction method: {method}.")

        parts.append(f"Time confidence: {time_pred.get('confidence', 0):.1%}.")

        if loc_pred.get("location_name"):
            parts.append(
                f"Location prediction: {loc_pred['location_name']} "
                f"(probability: {loc_pred.get('confidence', 0):.1%})."
            )

        return " ".join(parts)
