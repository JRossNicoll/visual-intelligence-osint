"""Anomaly Detection Engine - Z-score and Isolation Forest based anomaly scoring.

Implements dual-method anomaly detection:
1. Z-score analysis: Measures how many standard deviations an observation
   deviates from the entity's learned baseline (time, location, behavior).
2. Isolation Forest: Ensemble method that isolates anomalies by random
   partitioning — anomalous points require fewer splits to isolate.

Every anomaly includes a numeric score and a natural language explanation
of WHY it was flagged, with the specific deviation factors.
"""

import logging
from typing import Optional

import numpy as np
from sklearn.ensemble import IsolationForest

from intelligence_engine.models.schemas import AnomalyResult

logger = logging.getLogger(__name__)

# Minimum historical events needed to establish a baseline
MIN_BASELINE_EVENTS = 5

# Z-score threshold for flagging anomalies (>2σ is unusual, >3σ is highly anomalous)
Z_SCORE_ANOMALY_THRESHOLD = 2.0
Z_SCORE_HIGH_THRESHOLD = 3.0


class AnomalyDetector:
    """Detects anomalies in entity behavior using statistical methods.

    For each entity, the detector maintains a learned baseline from
    historical observations. New events are scored against this baseline
    using both parametric (z-score) and non-parametric (isolation forest)
    methods.

    The final anomaly score is a weighted combination:
        anomaly_score = 0.5 * z_score_normalized + 0.5 * isolation_score

    Both components are scaled to [0, 1] where 1 = maximally anomalous.
    """

    def __init__(self, contamination: float = 0.05) -> None:
        """Initialize the anomaly detector.

        Args:
            contamination: Expected proportion of anomalies in training data.
                           Used by Isolation Forest. Default 0.05 (5%).
        """
        self.contamination = contamination

    def detect(
        self,
        current_event: dict,
        historical_events: list[dict],
    ) -> AnomalyResult:
        """Detect if a current event is anomalous given historical baseline.

        Args:
            current_event: Dict with keys:
                - timestamp: datetime
                - hour_of_day: int (0-23)
                - day_of_week: int (0=Mon, 6=Sun)
                - location_id: Optional[str]
                - duration_seconds: Optional[float]
            historical_events: List of past events with the same keys.

        Returns:
            AnomalyResult with scores and explanation.
        """
        if len(historical_events) < MIN_BASELINE_EVENTS:
            return AnomalyResult(
                is_anomalous=False,
                anomaly_score=0.0,
                explanation=f"Insufficient baseline data ({len(historical_events)} events, "
                f"need >= {MIN_BASELINE_EVENTS}). Cannot determine anomaly status.",
            )

        deviation_factors = []

        # --- Z-score Analysis ---
        z_time = self._z_score_time(current_event, historical_events)
        z_location = self._z_score_location(current_event, historical_events)

        if z_time is not None and abs(z_time) > Z_SCORE_ANOMALY_THRESHOLD:
            severity = "high" if abs(z_time) > Z_SCORE_HIGH_THRESHOLD else "medium"
            deviation_factors.append({
                "factor": "unusual_time",
                "z_score": round(z_time, 3),
                "severity": severity,
                "detail": self._explain_time_deviation(current_event, historical_events, z_time),
            })

        if z_location is not None and z_location > Z_SCORE_ANOMALY_THRESHOLD:
            deviation_factors.append({
                "factor": "unusual_location",
                "z_score": round(z_location, 3),
                "severity": "medium",
                "detail": self._explain_location_deviation(current_event, historical_events),
            })

        # --- Isolation Forest Analysis ---
        isolation_score = self._isolation_forest_score(current_event, historical_events)

        # --- Composite Score ---
        # Normalize z-scores to [0, 1] using sigmoid-like mapping
        z_normalized = 0.0
        z_count = 0
        if z_time is not None:
            z_normalized += self._z_to_probability(abs(z_time))
            z_count += 1
        if z_location is not None:
            z_normalized += self._z_to_probability(z_location)
            z_count += 1
        if z_count > 0:
            z_normalized /= z_count

        # Weighted combination
        if isolation_score is not None:
            anomaly_score = 0.5 * z_normalized + 0.5 * isolation_score
        else:
            anomaly_score = z_normalized

        anomaly_score = min(max(anomaly_score, 0.0), 1.0)

        # Determine if anomalous
        is_anomalous = anomaly_score > 0.5 or len(deviation_factors) > 0

        # Build explanation
        explanation = self._build_explanation(
            anomaly_score, z_time, z_location, isolation_score, deviation_factors
        )

        return AnomalyResult(
            is_anomalous=is_anomalous,
            anomaly_score=round(anomaly_score, 4),
            z_score_time=round(z_time, 4) if z_time is not None else None,
            z_score_location=round(z_location, 4) if z_location is not None else None,
            isolation_score=round(isolation_score, 4) if isolation_score is not None else None,
            deviation_factors=deviation_factors,
            explanation=explanation,
        )

    def _z_score_time(
        self, current: dict, historical: list[dict]
    ) -> Optional[float]:
        """Compute z-score for the time-of-day of the current event.

        Models the entity's typical appearance time using historical hours,
        accounting for circular nature of time (23:00 is close to 01:00)
        by using circular statistics (mean direction on unit circle).
        """
        hist_hours = np.array([e["hour_of_day"] for e in historical], dtype=float)
        current_hour = float(current["hour_of_day"])

        if len(hist_hours) < MIN_BASELINE_EVENTS:
            return None

        # Circular statistics for hours (period = 24)
        angles = hist_hours * (2 * np.pi / 24.0)
        mean_sin = np.mean(np.sin(angles))
        mean_cos = np.mean(np.cos(angles))
        circular_mean_angle = np.arctan2(mean_sin, mean_cos)
        circular_mean_hour = (circular_mean_angle * 24.0 / (2 * np.pi)) % 24.0

        # Circular standard deviation
        resultant_length = np.sqrt(mean_sin**2 + mean_cos**2)
        if resultant_length > 0.99999:
            resultant_length = 0.99999  # Avoid log(0)
        circular_std = np.sqrt(-2.0 * np.log(resultant_length)) * (24.0 / (2 * np.pi))

        if circular_std < 0.5:
            circular_std = 0.5  # Minimum std to avoid division issues

        # Circular distance
        diff = current_hour - circular_mean_hour
        # Wrap to [-12, 12]
        if diff > 12:
            diff -= 24
        elif diff < -12:
            diff += 24

        z_score = diff / circular_std
        return float(z_score)

    def _z_score_location(
        self, current: dict, historical: list[dict]
    ) -> Optional[float]:
        """Compute anomaly score for location based on visit frequency.

        For discrete locations, we measure how rare the current location is
        in the entity's history. A never-seen location gets a high score.
        Score is based on the empirical probability of visiting this location.
        """
        current_loc = current.get("location_id")
        if not current_loc:
            return None

        hist_locations = [e.get("location_id") for e in historical if e.get("location_id")]
        if len(hist_locations) < MIN_BASELINE_EVENTS:
            return None

        total = len(hist_locations)
        loc_count = sum(1 for loc in hist_locations if loc == current_loc)
        frequency = loc_count / total

        if frequency == 0:
            # Never seen at this location — highly anomalous
            # Use Laplace smoothing to get a probability-based z-score
            smoothed_freq = 1.0 / (total + len(set(hist_locations)) + 1)
            # Convert to z-score equivalent: -log(probability)
            return float(-np.log(smoothed_freq))
        else:
            # Low frequency locations are more anomalous
            # Expected frequency under uniform = 1/n_unique_locations
            n_unique = len(set(hist_locations))
            expected_freq = 1.0 / n_unique
            if frequency < expected_freq:
                # Below expected — compute how far below
                return float((expected_freq - frequency) / max(expected_freq, 0.01))
            return 0.0

    def _isolation_forest_score(
        self, current: dict, historical: list[dict]
    ) -> Optional[float]:
        """Score anomalousness using Isolation Forest.

        Features used:
        - hour_of_day (sin/cos encoded for circularity)
        - day_of_week (sin/cos encoded)
        - duration_seconds (if available)

        Returns score in [0, 1] where 1 = most anomalous.
        """
        if len(historical) < max(MIN_BASELINE_EVENTS, 10):
            return None

        # Build feature matrix
        features = self._extract_features(historical)
        current_features = self._extract_features([current])

        if features.shape[1] == 0:
            return None

        try:
            # Fit isolation forest on historical data
            n_estimators = min(100, max(10, len(historical)))
            clf = IsolationForest(
                n_estimators=n_estimators,
                contamination=self.contamination,
                random_state=42,
            )
            clf.fit(features)

            # Score the current event
            # decision_function returns negative for anomalies, positive for normal
            raw_score = clf.decision_function(current_features)[0]

            # Convert to [0, 1] where 1 = most anomalous
            # Typical range of decision_function is [-0.5, 0.5]
            normalized = 0.5 - float(raw_score)
            normalized = min(max(normalized, 0.0), 1.0)
            return normalized

        except Exception as e:
            logger.warning("Isolation forest failed: %s", e)
            return None

    def _extract_features(self, events: list[dict]) -> np.ndarray:
        """Extract numerical features from events for ML models.

        Encodes cyclical features (hour, day) using sin/cos to preserve
        the circular nature (23:00 is close to 01:00).
        """
        rows = []
        for e in events:
            hour = float(e.get("hour_of_day", 12))
            day = float(e.get("day_of_week", 0))

            features = [
                np.sin(2 * np.pi * hour / 24.0),
                np.cos(2 * np.pi * hour / 24.0),
                np.sin(2 * np.pi * day / 7.0),
                np.cos(2 * np.pi * day / 7.0),
            ]

            duration = e.get("duration_seconds")
            if duration is not None:
                features.append(float(duration))
            else:
                features.append(0.0)

            rows.append(features)

        return np.array(rows)

    def _z_to_probability(self, z: float) -> float:
        """Convert absolute z-score to anomaly probability [0, 1].

        Uses a sigmoid-like mapping where:
        - z=0 → 0.0 (completely normal)
        - z=2 → ~0.5 (moderately anomalous)
        - z=3 → ~0.75 (highly anomalous)
        - z=5 → ~0.95 (extremely anomalous)
        """
        return float(1.0 - np.exp(-0.5 * (z / 2.0) ** 2))

    def _explain_time_deviation(
        self, current: dict, historical: list[dict], z_score: float
    ) -> str:
        """Generate human-readable explanation of time deviation."""
        hist_hours = [e["hour_of_day"] for e in historical]
        current_hour = current["hour_of_day"]
        mean_hour = np.mean(hist_hours)
        std_hour = np.std(hist_hours)

        return (
            f"Appeared at {current_hour:02d}:00, which is {abs(z_score):.1f} standard "
            f"deviations from typical time (~{mean_hour:.0f}:00 +/- {std_hour:.1f}h). "
            f"Historical range: {min(hist_hours):02d}:00 - {max(hist_hours):02d}:00."
        )

    def _explain_location_deviation(
        self, current: dict, historical: list[dict]
    ) -> str:
        """Generate human-readable explanation of location deviation."""
        current_loc = current.get("location_id", "unknown")
        hist_locations = [e.get("location_id") for e in historical if e.get("location_id")]
        unique_locs = set(hist_locations)
        loc_count = sum(1 for loc in hist_locations if loc == current_loc)

        if loc_count == 0:
            return (
                f"First appearance at location '{current_loc}'. "
                f"Entity has only been seen at {len(unique_locs)} other location(s) previously."
            )
        return (
            f"Rarely seen at location '{current_loc}' "
            f"({loc_count}/{len(hist_locations)} historical visits)."
        )

    def _build_explanation(
        self,
        score: float,
        z_time: Optional[float],
        z_location: Optional[float],
        isolation_score: Optional[float],
        factors: list[dict],
    ) -> str:
        """Build comprehensive anomaly explanation."""
        parts = [f"Anomaly score: {score:.3f}."]

        method_parts = []
        if z_time is not None:
            method_parts.append(f"time z-score={z_time:.2f}")
        if z_location is not None:
            method_parts.append(f"location z-score={z_location:.2f}")
        if isolation_score is not None:
            method_parts.append(f"isolation forest={isolation_score:.2f}")
        if method_parts:
            parts.append(f"Components: {', '.join(method_parts)}.")

        if factors:
            factor_descs = [f["detail"] for f in factors]
            parts.append("Deviations: " + " ".join(factor_descs))
        else:
            parts.append("No significant deviations from baseline detected.")

        return " ".join(parts)
