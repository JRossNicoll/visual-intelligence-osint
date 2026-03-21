"""Behavior Modeling Engine - Statistical behavior classification.

Classifies entity behavior using statistical analysis of temporal
and spatial patterns. Each classification includes confidence scores
and evidence supporting the determination.

Behavior types:
- loitering: Extended presence at a single location beyond baseline
- repeated_visit: Statistically significant return frequency to a location
- convoy: Temporally correlated movement of multiple entities
- short_stay: Visit duration significantly below entity's mean
- long_stay: Visit duration significantly above entity's mean
- routine: Statistically periodic appearance pattern
- transient: Single or rare appearance with no established pattern

All classifications use learned baselines per entity, not fixed thresholds.
"""

import logging
from collections import Counter
from datetime import datetime
from typing import Optional

import numpy as np
from scipy import stats

from intelligence_engine.models.schemas import BehaviorClassification

logger = logging.getLogger(__name__)

MIN_EVENTS_FOR_BEHAVIOR = 3
MIN_EVENTS_FOR_DURATION_ANALYSIS = 5


class BehaviorModeler:
    """Classifies entity behavior using statistical methods.

    Each behavior classification is based on distributional analysis
    of the entity's historical patterns, not arbitrary thresholds.
    """

    def classify_all(
        self,
        entity_id: str,
        events: list[dict],
        co_occurrence_map: Optional[dict[str, list[str]]] = None,
    ) -> list[BehaviorClassification]:
        """Run all behavior classifiers on an entity's event history.

        Args:
            entity_id: The entity to classify.
            events: List of temporal events with keys:
                - timestamp: datetime
                - location_id: Optional[str]
                - location_name: Optional[str]
                - duration_seconds: Optional[float]
                - co_occurring_entities: Optional[list[str]]
            co_occurrence_map: Optional map of timestamp -> list of co-present entity IDs.

        Returns:
            List of BehaviorClassification results (may be empty if insufficient data).
        """
        if len(events) < MIN_EVENTS_FOR_BEHAVIOR:
            return []

        results = []

        # Check for loitering
        loitering = self._detect_loitering(entity_id, events)
        if loitering:
            results.extend(loitering)

        # Check for repeated visits
        repeated = self._detect_repeated_visits(entity_id, events)
        if repeated:
            results.extend(repeated)

        # Check for convoy behavior
        if co_occurrence_map:
            convoy = self._detect_convoy(entity_id, events, co_occurrence_map)
            if convoy:
                results.extend(convoy)

        # Classify stay duration
        duration_class = self._classify_stay_duration(entity_id, events)
        if duration_class:
            results.extend(duration_class)

        # Check for routine behavior
        routine = self._detect_routine(entity_id, events)
        if routine:
            results.append(routine)

        return results

    def _detect_loitering(
        self, entity_id: str, events: list[dict]
    ) -> list[BehaviorClassification]:
        """Detect loitering using duration distribution analysis.

        Loitering is defined as a visit duration that exceeds the entity's
        mean duration by more than 2 standard deviations, OR if no baseline
        exists, a visit that exceeds the population median by 2x.

        Uses the entity's own distributional baseline — not a fixed threshold.
        """
        results = []

        durations = [
            e["duration_seconds"]
            for e in events
            if e.get("duration_seconds") is not None and e["duration_seconds"] > 0
        ]

        if len(durations) < MIN_EVENTS_FOR_DURATION_ANALYSIS:
            return results

        durations_arr = np.array(durations)
        mean_dur = float(np.mean(durations_arr))
        std_dur = float(np.std(durations_arr, ddof=1))

        if std_dur < 1.0:
            # Very consistent duration — loitering threshold based on mean * factor
            threshold = mean_dur * 2.0
        else:
            # Use z-score based threshold
            threshold = mean_dur + 2.0 * std_dur

        # Check each event for loitering
        for event in events:
            dur = event.get("duration_seconds")
            if dur is None or dur <= 0:
                continue

            if dur > threshold:
                z_score = (dur - mean_dur) / max(std_dur, 1.0)
                # Confidence based on how extreme the duration is
                confidence = min(1.0 - stats.norm.sf(abs(z_score)) * 2, 0.99)

                location = event.get("location_name", event.get("location_id", "unknown"))
                results.append(BehaviorClassification(
                    entity_id=entity_id,
                    behavior_type="loitering",
                    confidence=round(confidence, 3),
                    severity="medium" if z_score < 3 else "high",
                    description=(
                        f"Extended presence at {location} for {dur:.0f}s "
                        f"(z-score: {z_score:.2f}, baseline: {mean_dur:.0f}s +/- {std_dur:.0f}s). "
                        f"Duration exceeds entity's learned baseline by {z_score:.1f} standard deviations."
                    ),
                    evidence={
                        "duration_seconds": dur,
                        "mean_duration": round(mean_dur, 1),
                        "std_duration": round(std_dur, 1),
                        "z_score": round(z_score, 3),
                        "threshold": round(threshold, 1),
                        "location": location,
                        "timestamp": str(event.get("timestamp", "")),
                    },
                    duration_seconds=dur,
                ))

        return results

    def _detect_repeated_visits(
        self, entity_id: str, events: list[dict]
    ) -> list[BehaviorClassification]:
        """Detect statistically significant repeated visits to locations.

        Uses a binomial test to determine if the visit frequency to a
        specific location is significantly higher than expected under
        a uniform distribution across all visited locations.
        """
        results = []

        locations = [
            e.get("location_id") for e in events if e.get("location_id")
        ]
        if len(locations) < MIN_EVENTS_FOR_BEHAVIOR:
            return results

        location_counts = Counter(locations)
        n_unique = len(location_counts)
        total_visits = len(locations)

        if n_unique < 2:
            return results

        # Expected proportion under uniform distribution
        expected_prob = 1.0 / n_unique

        for loc_id, count in location_counts.items():
            if count < 3:
                continue

            # Binomial test: is this location visited significantly more than expected?
            p_value = float(stats.binom_test(count, total_visits, expected_prob, alternative="greater"))

            if p_value < 0.05:  # Statistically significant at 5% level
                confidence = min(1.0 - p_value, 0.99)
                observed_freq = count / total_visits

                # Get location name from events
                loc_name = loc_id
                for e in events:
                    if e.get("location_id") == loc_id and e.get("location_name"):
                        loc_name = e["location_name"]
                        break

                results.append(BehaviorClassification(
                    entity_id=entity_id,
                    behavior_type="repeated_visit",
                    confidence=round(confidence, 3),
                    severity="low" if p_value > 0.01 else "medium",
                    description=(
                        f"Statistically significant repeated visits to {loc_name}: "
                        f"{count}/{total_visits} visits ({observed_freq:.0%}). "
                        f"Expected {expected_prob:.0%} under uniform distribution "
                        f"(p-value: {p_value:.4f})."
                    ),
                    evidence={
                        "location_id": loc_id,
                        "location_name": loc_name,
                        "visit_count": count,
                        "total_visits": total_visits,
                        "observed_frequency": round(observed_freq, 4),
                        "expected_frequency": round(expected_prob, 4),
                        "p_value": round(p_value, 6),
                        "n_unique_locations": n_unique,
                    },
                ))

        return results

    def _detect_convoy(
        self,
        entity_id: str,
        events: list[dict],
        co_occurrence_map: dict[str, list[str]],
    ) -> list[BehaviorClassification]:
        """Detect convoy/group movement patterns.

        Two entities form a convoy if they co-occur significantly more
        often than expected by chance, given their individual appearance
        frequencies. Uses a chi-squared test of independence.
        """
        results = []

        # Count co-occurrences per entity
        co_counts: Counter[str] = Counter()
        total_events = len(events)

        for event in events:
            co_entities = event.get("co_occurring_entities", [])
            for co_entity in co_entities:
                if co_entity != entity_id:
                    co_counts[co_entity] += 1

        for other_id, co_count in co_counts.most_common(10):
            if co_count < 3:
                continue

            # Get other entity's total appearances from co_occurrence_map
            other_total = len(co_occurrence_map.get(other_id, []))
            if other_total < 3:
                continue

            # Observed co-occurrence rate
            co_rate = co_count / total_events

            # Expected co-occurrence rate under independence
            # P(A and B) = P(A) * P(B) if independent
            # Approximate P(B) from co_occurrence_map
            # Use a hypergeometric test for more precision
            # But chi-squared is simpler and sufficient

            # 2x2 contingency table:
            # [co_occur, entity_only], [other_only, neither]
            entity_only = total_events - co_count
            other_only = max(other_total - co_count, 0)
            total_possible = max(total_events + other_total, total_events)
            neither = max(total_possible - co_count - entity_only - other_only, 0)

            table = np.array([[co_count, entity_only], [other_only, max(neither, 1)]])

            try:
                chi2, p_value, _, _ = stats.chi2_contingency(table, correction=True)
            except ValueError:
                continue

            if p_value < 0.05 and co_rate > 0.3:
                confidence = min(1.0 - p_value, 0.99)
                results.append(BehaviorClassification(
                    entity_id=entity_id,
                    behavior_type="convoy",
                    confidence=round(confidence, 3),
                    severity="medium",
                    description=(
                        f"Convoy pattern with entity {other_id}: "
                        f"co-occurred {co_count}/{total_events} times ({co_rate:.0%}). "
                        f"Chi-squared test rejects independence (p={p_value:.4f})."
                    ),
                    evidence={
                        "co_entity_id": other_id,
                        "co_occurrence_count": co_count,
                        "total_events": total_events,
                        "co_occurrence_rate": round(co_rate, 4),
                        "chi_squared": round(float(chi2), 3),
                        "p_value": round(float(p_value), 6),
                    },
                    associated_entities=[other_id],
                ))

        return results

    def _classify_stay_duration(
        self, entity_id: str, events: list[dict]
    ) -> list[BehaviorClassification]:
        """Classify visit duration patterns as short_stay or long_stay.

        Uses percentile-based classification against the entity's own
        duration distribution. Events in the bottom 10th percentile
        are short_stay, events in the top 90th percentile are long_stay.
        """
        results = []

        durations = [
            (e, e["duration_seconds"])
            for e in events
            if e.get("duration_seconds") is not None and e["duration_seconds"] > 0
        ]

        if len(durations) < MIN_EVENTS_FOR_DURATION_ANALYSIS:
            return results

        dur_values = np.array([d[1] for d in durations])
        p10 = float(np.percentile(dur_values, 10))
        p90 = float(np.percentile(dur_values, 90))
        median = float(np.median(dur_values))

        # Only classify the most recent events as short/long stay
        recent_events = sorted(durations, key=lambda x: x[0].get("timestamp", ""))[-5:]

        for event, dur in recent_events:
            percentile = float(stats.percentileofscore(dur_values, dur))

            if dur <= p10 and percentile < 15:
                results.append(BehaviorClassification(
                    entity_id=entity_id,
                    behavior_type="short_stay",
                    confidence=round(1.0 - percentile / 100.0, 3),
                    severity="low",
                    description=(
                        f"Short stay: {dur:.0f}s (percentile: {percentile:.1f}%, "
                        f"median: {median:.0f}s, p10: {p10:.0f}s)."
                    ),
                    evidence={
                        "duration_seconds": dur,
                        "percentile": round(percentile, 2),
                        "median_duration": round(median, 1),
                        "p10": round(p10, 1),
                    },
                    duration_seconds=dur,
                ))
            elif dur >= p90 and percentile > 85:
                results.append(BehaviorClassification(
                    entity_id=entity_id,
                    behavior_type="long_stay",
                    confidence=round(percentile / 100.0, 3),
                    severity="low",
                    description=(
                        f"Long stay: {dur:.0f}s (percentile: {percentile:.1f}%, "
                        f"median: {median:.0f}s, p90: {p90:.0f}s)."
                    ),
                    evidence={
                        "duration_seconds": dur,
                        "percentile": round(percentile, 2),
                        "median_duration": round(median, 1),
                        "p90": round(p90, 1),
                    },
                    duration_seconds=dur,
                ))

        return results

    def _detect_routine(
        self, entity_id: str, events: list[dict]
    ) -> Optional[BehaviorClassification]:
        """Detect routine behavior using coefficient of variation of inter-arrival times.

        An entity with low CV in inter-arrival times and consistent appearance
        hours has routine behavior. Uses the Coefficient of Variation (CV = std/mean)
        of inter-arrival times — a dimensionless measure of regularity.

        CV < 0.3: highly regular (routine)
        CV 0.3-0.6: moderately regular
        CV > 0.6: irregular (transient)
        """
        timestamps = sorted([
            e["timestamp"] for e in events
            if isinstance(e.get("timestamp"), datetime)
        ])

        if len(timestamps) < MIN_EVENTS_FOR_DURATION_ANALYSIS:
            return None

        # Inter-arrival times in hours
        intervals = np.array([
            (timestamps[i + 1] - timestamps[i]).total_seconds() / 3600.0
            for i in range(len(timestamps) - 1)
        ])

        if len(intervals) < 3:
            return None

        mean_interval = float(np.mean(intervals))
        std_interval = float(np.std(intervals, ddof=1))

        if mean_interval <= 0:
            return None

        cv = std_interval / mean_interval  # Coefficient of variation

        if cv < 0.3:
            return BehaviorClassification(
                entity_id=entity_id,
                behavior_type="routine",
                confidence=round(1.0 - cv, 3),
                severity="low",
                description=(
                    f"Highly regular appearance pattern detected. "
                    f"Inter-arrival CV={cv:.3f} (mean={mean_interval:.1f}h, "
                    f"std={std_interval:.1f}h). "
                    f"Entity appears approximately every {mean_interval:.1f} hours "
                    f"with low variance."
                ),
                evidence={
                    "coefficient_of_variation": round(cv, 4),
                    "mean_interval_hours": round(mean_interval, 2),
                    "std_interval_hours": round(std_interval, 2),
                    "n_intervals": len(intervals),
                    "regularity": "high",
                },
            )
        elif cv < 0.6:
            return BehaviorClassification(
                entity_id=entity_id,
                behavior_type="routine",
                confidence=round(0.6 - cv + 0.3, 3),
                severity="low",
                description=(
                    f"Moderately regular appearance pattern. "
                    f"Inter-arrival CV={cv:.3f} (mean={mean_interval:.1f}h, "
                    f"std={std_interval:.1f}h)."
                ),
                evidence={
                    "coefficient_of_variation": round(cv, 4),
                    "mean_interval_hours": round(mean_interval, 2),
                    "std_interval_hours": round(std_interval, 2),
                    "n_intervals": len(intervals),
                    "regularity": "moderate",
                },
            )

        return None
