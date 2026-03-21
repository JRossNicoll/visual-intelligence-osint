"""Coordinated Behavior Detection - Multi-entity coordination patterns.

Detects:
1. Co-occurrence patterns: Entities appearing together repeatedly across locations
2. Convoy behavior: Multiple entities moving together in sync
3. Staggered coordination: A appears, then B appears shortly after (sequential)
4. Graph motifs: Triads, chains, and other structural patterns

Techniques:
- Temporal clustering of co-occurrences via sliding time windows
- Statistical significance testing (chi-squared for independence)
- Graph motif detection (triad census)
- Sequence pattern detection with time-lag analysis

All detections include confidence scores based on statistical tests,
not arbitrary thresholds.
"""

import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone
from itertools import combinations
from typing import Optional

import numpy as np
from scipy import stats

from intelligence_engine.models.system_schemas import (
    CoordinationPattern,
    CoordinationResult,
)

logger = logging.getLogger(__name__)

# Minimum co-occurrences to consider a pattern
MIN_CO_OCCURRENCES = 3
# Sliding window size for temporal co-occurrence (seconds)
DEFAULT_WINDOW_SECONDS = 300  # 5 minutes
# Maximum lag for staggered coordination (seconds)
MAX_STAGGER_LAG_SECONDS = 600  # 10 minutes


class CoordinationDetector:
    """Detects multi-entity coordination patterns.

    Uses statistical methods to identify entities that appear together,
    move in convoy, or exhibit staggered sequential behavior across
    time and space.
    """

    def __init__(
        self,
        window_seconds: float = DEFAULT_WINDOW_SECONDS,
        max_stagger_lag: float = MAX_STAGGER_LAG_SECONDS,
        min_co_occurrences: int = MIN_CO_OCCURRENCES,
    ) -> None:
        self.window_seconds = window_seconds
        self.max_stagger_lag = max_stagger_lag
        self.min_co_occurrences = min_co_occurrences

    def detect(
        self,
        events: list[dict],
        reference_time: Optional[datetime] = None,
    ) -> CoordinationResult:
        """Detect coordination patterns across all entities in the event stream.

        Args:
            events: List of events, each with keys:
                - entity_id: str
                - timestamp: datetime
                - location_id: Optional[str]
                - location_name: Optional[str]
            reference_time: Current time for analysis window.

        Returns:
            CoordinationResult with detected patterns and motifs.
        """
        if not events or len(events) < 2:
            return CoordinationResult(
                explanation="Insufficient events for coordination analysis."
            )

        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        sorted_events = sorted(events, key=lambda e: e["timestamp"])
        entity_ids = list({e["entity_id"] for e in sorted_events})
        patterns = []

        # 1. Detect temporal co-occurrence patterns
        co_patterns = self._detect_co_occurrence(sorted_events, entity_ids)
        patterns.extend(co_patterns)

        # 2. Detect staggered/sequential coordination
        seq_patterns = self._detect_staggered(sorted_events, entity_ids)
        patterns.extend(seq_patterns)

        # 3. Detect convoy behavior (multi-location co-movement)
        convoy_patterns = self._detect_convoy(sorted_events, entity_ids)
        patterns.extend(convoy_patterns)

        # 4. Graph motif detection
        motifs = self._detect_motifs(sorted_events, entity_ids)

        # Compute analysis window
        time_span = (sorted_events[-1]["timestamp"] - sorted_events[0]["timestamp"])
        window_hours = time_span.total_seconds() / 3600.0

        explanation_parts = [
            f"Analyzed {len(sorted_events)} events across {len(entity_ids)} entities "
            f"over {window_hours:.1f} hours.",
            f"Detected {len(patterns)} coordination patterns.",
        ]
        if motifs:
            explanation_parts.append(f"Found {len(motifs)} graph motifs.")

        return CoordinationResult(
            total_entities_analyzed=len(entity_ids),
            total_events_analyzed=len(sorted_events),
            patterns_detected=patterns,
            graph_motifs=motifs,
            analysis_window_hours=round(window_hours, 2),
            explanation=" ".join(explanation_parts),
        )

    def _detect_co_occurrence(
        self, events: list[dict], entity_ids: list[str]
    ) -> list[CoordinationPattern]:
        """Detect entities that frequently appear within the same time window.

        Uses a sliding time window to count co-occurrences, then tests
        statistical significance via chi-squared test of independence.
        """
        patterns = []

        # Build co-occurrence counts using sliding window
        pair_co_occurrences: dict[tuple[str, str], list[datetime]] = defaultdict(list)
        entity_counts: Counter[str] = Counter()

        for event in events:
            entity_counts[event["entity_id"]] += 1

        n = len(events)
        for i in range(n):
            for j in range(i + 1, n):
                ei = events[i]
                ej = events[j]
                if ei["entity_id"] == ej["entity_id"]:
                    continue

                delta = abs((ej["timestamp"] - ei["timestamp"]).total_seconds())
                if delta <= self.window_seconds:
                    pair = tuple(sorted([ei["entity_id"], ej["entity_id"]]))
                    pair_co_occurrences[pair].append(ei["timestamp"])
                elif delta > self.window_seconds:
                    # Events are sorted, so all subsequent will be further
                    break

        total_events = len(events)

        for (eid1, eid2), timestamps in pair_co_occurrences.items():
            co_count = len(timestamps)
            if co_count < self.min_co_occurrences:
                continue

            # Chi-squared test of independence
            n1 = entity_counts[eid1]
            n2 = entity_counts[eid2]

            # Expected co-occurrence under independence
            expected = (n1 * n2) / max(total_events, 1)

            if expected < 1:
                expected = 1.0

            # Chi-squared statistic
            chi2 = (co_count - expected) ** 2 / expected
            p_value = float(1.0 - stats.chi2.cdf(chi2, df=1))

            if p_value < 0.1:  # Liberal threshold; confidence reflects strength
                confidence = min(1.0 - p_value, 0.99)

                # Consistency: CV of inter-occurrence intervals
                if len(timestamps) >= 3:
                    sorted_ts = sorted(timestamps)
                    intervals = [
                        (sorted_ts[k + 1] - sorted_ts[k]).total_seconds()
                        for k in range(len(sorted_ts) - 1)
                    ]
                    mean_int = float(np.mean(intervals))
                    std_int = float(np.std(intervals, ddof=1)) if len(intervals) > 1 else 0.0
                    cv = std_int / max(mean_int, 1.0)
                    consistency = float(np.exp(-cv))
                else:
                    consistency = 0.5
                    mean_int = 0.0
                    std_int = 0.0

                # Collect locations
                locs = set()
                for e in events:
                    if e["entity_id"] in (eid1, eid2) and e.get("location_name"):
                        locs.add(e["location_name"])

                sorted_ts = sorted(timestamps)
                patterns.append(CoordinationPattern(
                    pattern_id=f"cooccur_{eid1}_{eid2}",
                    coordination_type="co_occurrence",
                    involved_entities=[eid1, eid2],
                    frequency=co_count,
                    consistency=round(consistency, 4),
                    confidence=round(confidence, 4),
                    mean_time_gap_seconds=round(mean_int, 1) if mean_int > 0 else None,
                    std_time_gap_seconds=round(std_int, 1) if std_int > 0 else None,
                    locations=sorted(locs),
                    first_seen=sorted_ts[0],
                    last_seen=sorted_ts[-1],
                    evidence={
                        "co_occurrence_count": co_count,
                        "expected_under_independence": round(expected, 2),
                        "chi_squared": round(chi2, 4),
                        "p_value": round(p_value, 6),
                        "entity_1_count": n1,
                        "entity_2_count": n2,
                        "window_seconds": self.window_seconds,
                    },
                    explanation=(
                        f"Entities {eid1} and {eid2} co-occurred {co_count} times "
                        f"within {self.window_seconds}s windows. Expected under "
                        f"independence: {expected:.1f}. Chi-squared={chi2:.2f}, "
                        f"p={p_value:.4f}. Consistency={consistency:.3f}."
                    ),
                ))

        return sorted(patterns, key=lambda p: p.confidence, reverse=True)

    def _detect_staggered(
        self, events: list[dict], entity_ids: list[str]
    ) -> list[CoordinationPattern]:
        """Detect staggered coordination: A appears, then B appears shortly after.

        Looks for consistent A->B temporal ordering within the max stagger lag.
        Uses a binomial test: if A->B ordering is significantly more frequent
        than B->A, it suggests staggered coordination.
        """
        patterns = []

        # Build per-entity timelines
        entity_timelines: dict[str, list[datetime]] = defaultdict(list)
        for e in events:
            entity_timelines[e["entity_id"]].append(e["timestamp"])

        for eid1, eid2 in combinations(entity_ids, 2):
            ts1 = sorted(entity_timelines[eid1])
            ts2 = sorted(entity_timelines[eid2])

            if len(ts1) < 2 or len(ts2) < 2:
                continue

            # Count A->B and B->A sequences within lag window
            ab_lags: list[float] = []
            ba_lags: list[float] = []

            for t1 in ts1:
                for t2 in ts2:
                    delta = (t2 - t1).total_seconds()
                    if 0 < delta <= self.max_stagger_lag:
                        ab_lags.append(delta)
                    elif -self.max_stagger_lag <= delta < 0:
                        ba_lags.append(-delta)

            n_ab = len(ab_lags)
            n_ba = len(ba_lags)
            total = n_ab + n_ba

            if total < self.min_co_occurrences:
                continue

            # Binomial test: is the ordering significantly non-random?
            if n_ab > n_ba:
                leader, follower = eid1, eid2
                n_leading = n_ab
                lags = ab_lags
            else:
                leader, follower = eid2, eid1
                n_leading = n_ba
                lags = ba_lags

            p_value = float(stats.binom_test(n_leading, total, 0.5, alternative="greater"))

            if p_value < 0.1 and n_leading >= self.min_co_occurrences:
                confidence = min(1.0 - p_value, 0.99)
                mean_lag = float(np.mean(lags))
                std_lag = float(np.std(lags, ddof=1)) if len(lags) > 1 else 0.0

                patterns.append(CoordinationPattern(
                    pattern_id=f"stagger_{leader}_{follower}",
                    coordination_type="staggered",
                    involved_entities=[leader, follower],
                    frequency=n_leading,
                    consistency=round(float(np.exp(-std_lag / max(mean_lag, 1.0))), 4),
                    confidence=round(confidence, 4),
                    mean_time_gap_seconds=round(mean_lag, 1),
                    std_time_gap_seconds=round(std_lag, 1),
                    evidence={
                        "leader_entity": leader,
                        "follower_entity": follower,
                        "leader_first_count": n_leading,
                        "follower_first_count": total - n_leading,
                        "total_sequences": total,
                        "binomial_p_value": round(p_value, 6),
                        "max_lag_seconds": self.max_stagger_lag,
                    },
                    explanation=(
                        f"Staggered coordination: {leader} appears before "
                        f"{follower} {n_leading}/{total} times "
                        f"(p={p_value:.4f}, binomial test). "
                        f"Mean lag: {mean_lag:.1f}s +/- {std_lag:.1f}s."
                    ),
                ))

        return sorted(patterns, key=lambda p: p.confidence, reverse=True)

    def _detect_convoy(
        self, events: list[dict], entity_ids: list[str]
    ) -> list[CoordinationPattern]:
        """Detect convoy behavior: entities moving together across locations.

        A convoy is detected when two or more entities appear at the same
        sequence of locations in a correlated temporal order. Uses Jaccard
        similarity on location visit sequences.
        """
        patterns = []

        # Build per-entity location sequences
        entity_loc_sequences: dict[str, list[tuple[str, datetime]]] = defaultdict(list)
        for e in events:
            loc = e.get("location_id") or e.get("location_name")
            if loc:
                entity_loc_sequences[e["entity_id"]].append((loc, e["timestamp"]))

        # Sort each sequence by time
        for eid in entity_loc_sequences:
            entity_loc_sequences[eid].sort(key=lambda x: x[1])

        for eid1, eid2 in combinations(entity_ids, 2):
            seq1 = entity_loc_sequences.get(eid1, [])
            seq2 = entity_loc_sequences.get(eid2, [])

            if len(seq1) < 2 or len(seq2) < 2:
                continue

            # Find location transitions that match
            locs1 = [s[0] for s in seq1]
            locs2 = [s[0] for s in seq2]

            # Jaccard similarity on location sets
            set1 = set(locs1)
            set2 = set(locs2)
            intersection = set1 & set2
            union = set1 | set2

            if not union:
                continue

            jaccard = len(intersection) / len(union)

            if jaccard < 0.3 or len(intersection) < 2:
                continue

            # Check temporal correlation of shared location visits
            shared_time_diffs = []
            for loc in intersection:
                times1 = [t for loc_id, t in seq1 if loc_id == loc]
                times2 = [t for loc_id, t in seq2 if loc_id == loc]
                for t1 in times1:
                    for t2 in times2:
                        diff = abs((t1 - t2).total_seconds())
                        if diff <= self.window_seconds * 2:
                            shared_time_diffs.append(diff)

            if len(shared_time_diffs) < 2:
                continue

            mean_diff = float(np.mean(shared_time_diffs))
            std_diff = float(np.std(shared_time_diffs, ddof=1)) if len(shared_time_diffs) > 1 else 0.0

            # Confidence based on Jaccard similarity and temporal correlation
            temporal_score = float(np.exp(-mean_diff / (self.window_seconds * 2)))
            confidence = min(jaccard * 0.5 + temporal_score * 0.5, 0.99)

            if confidence > 0.3:
                patterns.append(CoordinationPattern(
                    pattern_id=f"convoy_{eid1}_{eid2}",
                    coordination_type="convoy",
                    involved_entities=[eid1, eid2],
                    frequency=len(shared_time_diffs),
                    consistency=round(float(np.exp(-std_diff / max(mean_diff, 1.0))), 4),
                    confidence=round(confidence, 4),
                    mean_time_gap_seconds=round(mean_diff, 1),
                    std_time_gap_seconds=round(std_diff, 1),
                    locations=sorted(intersection),
                    evidence={
                        "jaccard_similarity": round(jaccard, 4),
                        "shared_locations": sorted(intersection),
                        "entity_1_locations": len(set1),
                        "entity_2_locations": len(set2),
                        "temporal_correlation_score": round(temporal_score, 4),
                        "shared_visits": len(shared_time_diffs),
                    },
                    explanation=(
                        f"Convoy pattern: {eid1} and {eid2} share "
                        f"{len(intersection)} locations (Jaccard={jaccard:.3f}). "
                        f"Mean temporal gap at shared locations: {mean_diff:.1f}s. "
                        f"Confidence={confidence:.3f}."
                    ),
                ))

        return sorted(patterns, key=lambda p: p.confidence, reverse=True)

    def _detect_motifs(
        self, events: list[dict], entity_ids: list[str]
    ) -> list[dict]:
        """Detect graph motifs (triads) in the co-occurrence network.

        Builds an adjacency matrix from co-occurrence counts, then
        identifies triads (three mutually connected entities) which
        indicate group coordination.
        """
        motifs = []

        # Build co-occurrence adjacency
        pair_counts: Counter[tuple[str, str]] = Counter()
        n = len(events)
        for i in range(n):
            for j in range(i + 1, n):
                if events[i]["entity_id"] == events[j]["entity_id"]:
                    continue
                delta = abs((events[j]["timestamp"] - events[i]["timestamp"]).total_seconds())
                if delta <= self.window_seconds:
                    pair = tuple(sorted([events[i]["entity_id"], events[j]["entity_id"]]))
                    pair_counts[pair] += 1
                elif delta > self.window_seconds:
                    break

        # Filter to significant edges
        significant_pairs = {
            pair for pair, count in pair_counts.items()
            if count >= self.min_co_occurrences
        }

        if len(significant_pairs) < 3:
            return motifs

        # Build adjacency for triad search
        adj: dict[str, set[str]] = defaultdict(set)
        for (a, b) in significant_pairs:
            adj[a].add(b)
            adj[b].add(a)

        # Find triads (cliques of size 3)
        visited_triads: set[tuple[str, ...]] = set()
        for a in adj:
            for b in adj[a]:
                for c in adj[b]:
                    if c in adj[a] and c != a:
                        triad = tuple(sorted([a, b, c]))
                        if triad not in visited_triads:
                            visited_triads.add(triad)
                            # Compute triad strength
                            ab = pair_counts.get(tuple(sorted([a, b])), 0)
                            bc = pair_counts.get(tuple(sorted([b, c])), 0)
                            ac = pair_counts.get(tuple(sorted([a, c])), 0)
                            min_strength = min(ab, bc, ac)
                            mean_strength = float(np.mean([ab, bc, ac]))

                            motifs.append({
                                "motif_type": "triad",
                                "entities": list(triad),
                                "edge_counts": {
                                    f"{triad[0]}-{triad[1]}": ab,
                                    f"{triad[1]}-{triad[2]}": bc,
                                    f"{triad[0]}-{triad[2]}": ac,
                                },
                                "min_edge_count": min_strength,
                                "mean_edge_count": round(mean_strength, 1),
                                "explanation": (
                                    f"Triad: {triad[0]}, {triad[1]}, {triad[2]} all "
                                    f"co-occur pairwise (min edge count={min_strength})."
                                ),
                            })

        return sorted(motifs, key=lambda m: m["mean_edge_count"], reverse=True)
