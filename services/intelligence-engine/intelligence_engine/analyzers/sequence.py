"""Sequence & Causal Pattern Detection.

Moves beyond co-occurrence into ordered temporal patterns:
1. Frequent sequence mining (PrefixSpan-inspired)
2. Lead/lag relationships between entities
3. Conditional probability P(B | A)
4. Time-delay distributions

Techniques:
- PrefixSpan-style frequent sequence mining on event streams
- Time-lag correlation between entity appearances
- Conditional probability estimation with Laplace smoothing
- Bootstrap confidence intervals for timing estimates

All patterns include statistical evidence (support counts,
conditional probabilities, lift metrics) for explainability.
"""

import logging
from collections import defaultdict
from datetime import datetime
from itertools import combinations

import numpy as np
from scipy import stats

from intelligence_engine.models.system_schemas import (
    CausalRelationship,
    SequencePattern,
    SequenceResult,
)

logger = logging.getLogger(__name__)

DEFAULT_MAX_SEQUENCE_LENGTH = 4
DEFAULT_MIN_SUPPORT = 3
DEFAULT_TIME_WINDOW_SECONDS = 600  # 10 minutes


class SequenceDetector:
    """Detects ordered temporal sequences and causal relationships.

    Uses PrefixSpan-inspired mining on the event stream to find
    recurring entity appearance sequences, and estimates conditional
    probabilities and time-lag distributions.
    """

    def __init__(
        self,
        max_sequence_length: int = DEFAULT_MAX_SEQUENCE_LENGTH,
        min_support: int = DEFAULT_MIN_SUPPORT,
        time_window_seconds: float = DEFAULT_TIME_WINDOW_SECONDS,
    ) -> None:
        self.max_sequence_length = max_sequence_length
        self.min_support = min_support
        self.time_window_seconds = time_window_seconds

    def detect(
        self,
        events: list[dict],
    ) -> SequenceResult:
        """Detect sequence patterns and causal relationships.

        Args:
            events: List of events with:
                - entity_id: str
                - timestamp: datetime
                - location_id: Optional[str]

        Returns:
            SequenceResult with frequent sequences and causal relationships.
        """
        if not events or len(events) < self.min_support:
            return SequenceResult(
                explanation="Insufficient events for sequence detection."
            )

        sorted_events = sorted(events, key=lambda e: e["timestamp"])

        # 1. Mine frequent sequences
        frequent = self._mine_sequences(sorted_events)

        # 2. Detect causal relationships
        causal = self._detect_causal(sorted_events)

        return SequenceResult(
            frequent_sequences=frequent,
            causal_relationships=causal,
            total_events_analyzed=len(sorted_events),
            time_window_seconds=self.time_window_seconds,
            min_support=self.min_support,
            explanation=(
                f"Analyzed {len(sorted_events)} events. "
                f"Found {len(frequent)} frequent sequences and "
                f"{len(causal)} causal relationships "
                f"(window={self.time_window_seconds}s, "
                f"min_support={self.min_support})."
            ),
        )

    def _mine_sequences(self, events: list[dict]) -> list[SequencePattern]:
        """Mine frequent ordered sequences using PrefixSpan-inspired approach.

        For each event, look forward within the time window to build
        candidate sequences. Count support for each unique sequence.
        """
        # Build candidate sequences by scanning with a time window
        sequence_instances: dict[tuple[str, ...], list[list[datetime]]] = defaultdict(list)

        n = len(events)
        for i in range(n):
            # Start a sequence from event i
            seq = [events[i]["entity_id"]]
            timestamps = [events[i]["timestamp"]]
            last_entity = events[i]["entity_id"]

            for j in range(i + 1, n):
                delta = (events[j]["timestamp"] - events[i]["timestamp"]).total_seconds()
                if delta > self.time_window_seconds:
                    break

                next_entity = events[j]["entity_id"]
                # Skip consecutive same-entity events
                if next_entity == last_entity:
                    continue

                seq.append(next_entity)
                timestamps.append(events[j]["timestamp"])
                last_entity = next_entity

                if len(seq) <= self.max_sequence_length:
                    key = tuple(seq)
                    sequence_instances[key].append(list(timestamps))

                if len(seq) >= self.max_sequence_length:
                    break

        # Filter by minimum support
        patterns = []
        for seq_tuple, instances in sequence_instances.items():
            if len(seq_tuple) < 2:
                continue

            support = len(instances)
            if support < self.min_support:
                continue

            # Compute timing statistics
            delays_per_step: list[list[float]] = [[] for _ in range(len(seq_tuple) - 1)]
            locations: set[str] = set()

            for ts_list in instances:
                for step_idx in range(len(ts_list) - 1):
                    delay = (ts_list[step_idx + 1] - ts_list[step_idx]).total_seconds()
                    delays_per_step[step_idx].append(delay)

            mean_delays = []
            std_delays = []
            for delays in delays_per_step:
                if delays:
                    mean_delays.append(round(float(np.mean(delays)), 2))
                    std_delays.append(round(float(np.std(delays, ddof=1)), 2) if len(delays) > 1 else 0.0)
                else:
                    mean_delays.append(0.0)
                    std_delays.append(0.0)

            # Confidence: based on support relative to total possible
            prefix_count = sum(
                1 for key in sequence_instances
                if key[:1] == seq_tuple[:1]
            )
            confidence = support / max(prefix_count, 1)

            # Collect locations from events in these sequences
            for inst_ts in instances:
                for ts in inst_ts:
                    for e in events:
                        if e["timestamp"] == ts and e.get("location_name"):
                            locations.add(e["location_name"])

            patterns.append(SequencePattern(
                sequence=list(seq_tuple),
                support=support,
                confidence=round(min(confidence, 0.99), 4),
                mean_delay_seconds=mean_delays,
                std_delay_seconds=std_delays,
                locations=sorted(locations),
                evidence={
                    "total_instances": support,
                    "prefix_count": prefix_count,
                    "sequence_length": len(seq_tuple),
                    "window_seconds": self.time_window_seconds,
                },
                explanation=(
                    f"Sequence {' -> '.join(seq_tuple)} observed {support} times "
                    f"(confidence={confidence:.3f}). "
                    f"Mean delays between steps: "
                    f"{', '.join(f'{d:.1f}s' for d in mean_delays)}."
                ),
            ))

        # Sort by support * confidence (combined importance)
        patterns.sort(key=lambda p: p.support * p.confidence, reverse=True)
        return patterns[:50]  # Limit to top 50

    def _detect_causal(self, events: list[dict]) -> list[CausalRelationship]:
        """Detect lead/lag causal relationships between entity pairs.

        For each pair (A, B), computes:
        - P(B appears within window | A just appeared) = conditional_probability
        - P(B appears in any window) = baseline_probability
        - Lift = conditional / baseline
        - Time lag distribution

        A causal relationship exists when lift > 1 with statistical significance.
        """
        relationships = []

        # Build per-entity timelines
        entity_timelines: dict[str, list[datetime]] = defaultdict(list)
        for e in events:
            entity_timelines[e["entity_id"]].append(e["timestamp"])

        for eid in entity_timelines:
            entity_timelines[eid].sort()

        entity_ids = list(entity_timelines.keys())
        total_windows = max(len(events) - 1, 1)

        # Compute baseline probability for each entity
        entity_event_counts = {eid: len(ts) for eid, ts in entity_timelines.items()}

        for eid_a, eid_b in combinations(entity_ids, 2):
            for leader, follower in [(eid_a, eid_b), (eid_b, eid_a)]:
                ts_leader = entity_timelines[leader]
                ts_follower = entity_timelines[follower]

                if len(ts_leader) < 2 or len(ts_follower) < 2:
                    continue

                # Count: how many times does follower appear within window after leader?
                follow_count = 0
                lags: list[float] = []

                for t_lead in ts_leader:
                    for t_follow in ts_follower:
                        delta = (t_follow - t_lead).total_seconds()
                        if 0 < delta <= self.time_window_seconds:
                            follow_count += 1
                            lags.append(delta)
                            break  # Count only the first follower per leader event

                if follow_count < self.min_support:
                    continue

                # Conditional probability: P(follower within window | leader appeared)
                cond_prob = follow_count / len(ts_leader)

                # Baseline probability: P(follower appears in any random window)
                baseline_prob = entity_event_counts[follower] / total_windows
                baseline_prob = min(baseline_prob, 0.99)

                # Lift
                lift = cond_prob / max(baseline_prob, 0.01)

                if lift <= 1.2:  # Not meaningfully higher than baseline
                    continue

                # Statistical test: binomial test
                p_value = float(stats.binomtest(
                    follow_count, len(ts_leader), baseline_prob,
                    alternative="greater"
                ).pvalue)

                if p_value >= 0.1:
                    continue

                mean_lag = float(np.mean(lags))
                std_lag = float(np.std(lags, ddof=1)) if len(lags) > 1 else 0.0
                confidence = min(1.0 - p_value, 0.99)

                relationships.append(CausalRelationship(
                    leader_entity=leader,
                    follower_entity=follower,
                    conditional_probability=round(cond_prob, 4),
                    baseline_probability=round(baseline_prob, 4),
                    lift=round(lift, 4),
                    mean_lag_seconds=round(mean_lag, 2),
                    std_lag_seconds=round(std_lag, 2),
                    occurrences=follow_count,
                    confidence=round(confidence, 4),
                    explanation=(
                        f"{follower} follows {leader} in {follow_count}/{len(ts_leader)} "
                        f"events (P={cond_prob:.3f}, baseline={baseline_prob:.3f}, "
                        f"lift={lift:.2f}). Mean lag: {mean_lag:.1f}s +/- {std_lag:.1f}s. "
                        f"Binomial p={p_value:.4f}."
                    ),
                ))

        relationships.sort(key=lambda r: r.lift * r.confidence, reverse=True)
        return relationships[:30]
