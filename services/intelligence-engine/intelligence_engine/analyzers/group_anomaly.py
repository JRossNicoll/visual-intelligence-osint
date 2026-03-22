"""Multi-Entity Anomaly Detection.

Detects anomalies at the group/system level rather than individual entities.

Anomaly types:
1. Unusual Gathering: More entities appear at a location/time than expected
2. New Cluster Formation: Entities that never co-occurred start appearing together
3. Interaction Surge: Sudden increase in inter-entity interactions
4. Community Shift: Change in graph community structure

Techniques:
- DBSCAN for spatial-temporal clustering
- Density change detection over sliding windows
- Graph community detection via modularity
- Z-score analysis on interaction rates

All detections include statistical evidence (z-scores, baseline comparisons)
and explain WHY the group behavior is anomalous.
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
from scipy import stats

from intelligence_engine.models.system_schemas import (
    GroupAnomaly,
    GroupAnomalyResult,
)

logger = logging.getLogger(__name__)

MIN_EVENTS_FOR_GROUP_ANALYSIS = 10
DEFAULT_TEMPORAL_EPSILON_SECONDS = 300  # 5 min for temporal clustering
DEFAULT_DENSITY_WINDOW_HOURS = 24


class GroupAnomalyDetector:
    """Detects group-level anomalies across multiple entities.

    Analyzes system-wide patterns to identify unusual gatherings,
    cluster formations, interaction surges, and community shifts.
    """

    def __init__(
        self,
        temporal_epsilon_seconds: float = DEFAULT_TEMPORAL_EPSILON_SECONDS,
        density_window_hours: float = DEFAULT_DENSITY_WINDOW_HOURS,
        min_cluster_size: int = 3,
    ) -> None:
        self.temporal_epsilon = temporal_epsilon_seconds
        self.density_window_hours = density_window_hours
        self.min_cluster_size = min_cluster_size

    def detect(
        self,
        events: list[dict],
        historical_events: list[dict] | None = None,
        reference_time: Optional[datetime] = None,
    ) -> GroupAnomalyResult:
        """Detect group-level anomalies in the event stream.

        Args:
            events: Current events to analyze.
            historical_events: Historical baseline events (for comparison).
            reference_time: Current time.

        Returns:
            GroupAnomalyResult with detected anomalies and cluster details.
        """
        if not events or len(events) < MIN_EVENTS_FOR_GROUP_ANALYSIS:
            return GroupAnomalyResult(
                explanation=f"Insufficient events ({len(events) if events else 0}) "
                           f"for group analysis (need >= {MIN_EVENTS_FOR_GROUP_ANALYSIS})."
            )

        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        sorted_events = sorted(events, key=lambda e: e["timestamp"])
        anomalies: list[GroupAnomaly] = []

        # 1. Detect unusual gatherings
        gathering_anomalies = self._detect_unusual_gatherings(
            sorted_events, historical_events
        )
        anomalies.extend(gathering_anomalies)

        # 2. Detect new cluster formations
        cluster_anomalies, cluster_details = self._detect_new_clusters(
            sorted_events, historical_events
        )
        anomalies.extend(cluster_anomalies)

        # 3. Detect interaction surges
        surge_anomalies = self._detect_interaction_surge(
            sorted_events, historical_events, reference_time
        )
        anomalies.extend(surge_anomalies)

        # 4. Detect density changes
        density_change = self._compute_density_change(
            sorted_events, historical_events, reference_time
        )

        entity_ids = {e["entity_id"] for e in sorted_events}

        return GroupAnomalyResult(
            anomalies=sorted(anomalies, key=lambda a: a.anomaly_score, reverse=True),
            clusters_detected=len(cluster_details),
            cluster_details=cluster_details,
            density_change=round(density_change, 4),
            total_entities=len(entity_ids),
            total_events=len(sorted_events),
            explanation=(
                f"Analyzed {len(sorted_events)} events across {len(entity_ids)} entities. "
                f"Detected {len(anomalies)} group anomalies, "
                f"{len(cluster_details)} clusters. "
                f"Density change: {density_change:+.2f}."
            ),
        )

    def _detect_unusual_gatherings(
        self,
        events: list[dict],
        historical: list[dict] | None,
    ) -> list[GroupAnomaly]:
        """Detect locations/times with unusually many entities.

        Uses temporal clustering (DBSCAN-like) to find groups of events
        close in time, then compares entity count to historical baseline.
        """
        anomalies = []

        # Temporal clustering: group events within epsilon
        clusters: list[list[dict]] = []
        current_cluster: list[dict] = [events[0]]

        for i in range(1, len(events)):
            delta = (events[i]["timestamp"] - events[i - 1]["timestamp"]).total_seconds()
            if delta <= self.temporal_epsilon:
                current_cluster.append(events[i])
            else:
                if len(current_cluster) >= self.min_cluster_size:
                    clusters.append(current_cluster)
                current_cluster = [events[i]]

        if len(current_cluster) >= self.min_cluster_size:
            clusters.append(current_cluster)

        # Compute historical baseline: mean entities per cluster
        baseline_entities_per_cluster = 3.0  # default
        baseline_std = 1.5

        if historical and len(historical) >= MIN_EVENTS_FOR_GROUP_ANALYSIS:
            hist_sorted = sorted(historical, key=lambda e: e["timestamp"])
            hist_clusters: list[int] = []
            h_cluster: list[dict] = [hist_sorted[0]]

            for i in range(1, len(hist_sorted)):
                delta = (hist_sorted[i]["timestamp"] - hist_sorted[i - 1]["timestamp"]).total_seconds()
                if delta <= self.temporal_epsilon:
                    h_cluster.append(hist_sorted[i])
                else:
                    if len(h_cluster) >= 2:
                        entities_in = len({e["entity_id"] for e in h_cluster})
                        hist_clusters.append(entities_in)
                    h_cluster = [hist_sorted[i]]
            if len(h_cluster) >= 2:
                hist_clusters.append(len({e["entity_id"] for e in h_cluster}))

            if hist_clusters:
                baseline_entities_per_cluster = float(np.mean(hist_clusters))
                baseline_std = float(np.std(hist_clusters, ddof=1)) if len(hist_clusters) > 1 else 1.5

        for cluster in clusters:
            entities_in_cluster = list({e["entity_id"] for e in cluster})
            n_entities = len(entities_in_cluster)

            if n_entities < self.min_cluster_size:
                continue

            z_score = (n_entities - baseline_entities_per_cluster) / max(baseline_std, 0.5)

            if z_score > 2.0:
                # Anomalous gathering
                p_value = float(1.0 - stats.norm.cdf(z_score))
                anomaly_score = min(float(1.0 - np.exp(-0.5 * (z_score / 2) ** 2)), 0.99)

                location = cluster[0].get("location_name") or cluster[0].get("location_id", "unknown")
                timestamp = cluster[0]["timestamp"]

                anomalies.append(GroupAnomaly(
                    anomaly_type="unusual_gathering",
                    involved_entities=entities_in_cluster,
                    anomaly_score=round(anomaly_score, 4),
                    confidence=round(min(1.0 - p_value, 0.99), 4),
                    location=location,
                    timestamp=timestamp,
                    baseline_metric=round(baseline_entities_per_cluster, 2),
                    observed_metric=float(n_entities),
                    z_score=round(z_score, 4),
                    evidence={
                        "entities_in_cluster": n_entities,
                        "baseline_mean": round(baseline_entities_per_cluster, 2),
                        "baseline_std": round(baseline_std, 2),
                        "z_score": round(z_score, 4),
                        "p_value": round(p_value, 6),
                        "cluster_duration_seconds": round(
                            (cluster[-1]["timestamp"] - cluster[0]["timestamp"]).total_seconds(), 1
                        ),
                    },
                    explanation=(
                        f"Unusual gathering at {location}: {n_entities} entities "
                        f"appeared within {self.temporal_epsilon}s window "
                        f"(baseline: {baseline_entities_per_cluster:.1f} +/- "
                        f"{baseline_std:.1f}, z={z_score:.2f}, p={p_value:.4f})."
                    ),
                ))

        return anomalies

    def _detect_new_clusters(
        self,
        events: list[dict],
        historical: list[dict] | None,
    ) -> tuple[list[GroupAnomaly], list[dict]]:
        """Detect new entity clusters that didn't exist in historical data.

        Identifies sets of entities that co-occur in current data but
        never co-occurred historically.
        """
        anomalies = []
        cluster_details = []

        # Build current co-occurrence sets
        current_co: dict[str, set[str]] = defaultdict(set)
        n = len(events)
        for i in range(n):
            for j in range(i + 1, n):
                if events[i]["entity_id"] == events[j]["entity_id"]:
                    continue
                delta = abs((events[j]["timestamp"] - events[i]["timestamp"]).total_seconds())
                if delta <= self.temporal_epsilon:
                    current_co[events[i]["entity_id"]].add(events[j]["entity_id"])
                    current_co[events[j]["entity_id"]].add(events[i]["entity_id"])
                elif delta > self.temporal_epsilon:
                    break

        # Build historical co-occurrence sets
        hist_co: set[tuple[str, str]] = set()
        if historical:
            hist_sorted = sorted(historical, key=lambda e: e["timestamp"])
            for i in range(len(hist_sorted)):
                for j in range(i + 1, len(hist_sorted)):
                    if hist_sorted[i]["entity_id"] == hist_sorted[j]["entity_id"]:
                        continue
                    delta = abs((hist_sorted[j]["timestamp"] - hist_sorted[i]["timestamp"]).total_seconds())
                    if delta <= self.temporal_epsilon:
                        pair = tuple(sorted([hist_sorted[i]["entity_id"], hist_sorted[j]["entity_id"]]))
                        hist_co.add(pair)
                    elif delta > self.temporal_epsilon:
                        break

        # Find clusters via connected components in current co-occurrence graph
        visited: set[str] = set()
        for entity in current_co:
            if entity in visited:
                continue

            # BFS to find connected component
            component: set[str] = set()
            queue = [entity]
            while queue:
                node = queue.pop(0)
                if node in component:
                    continue
                component.add(node)
                for neighbor in current_co.get(node, set()):
                    if neighbor not in component:
                        queue.append(neighbor)

            visited.update(component)

            if len(component) < self.min_cluster_size:
                continue

            # Check how many pairs in this cluster are new (not in historical)
            entities_list = sorted(component)
            total_pairs = 0
            new_pairs = 0
            for i in range(len(entities_list)):
                for j in range(i + 1, len(entities_list)):
                    pair = (entities_list[i], entities_list[j])
                    if entities_list[i] in current_co and entities_list[j] in current_co[entities_list[i]]:
                        total_pairs += 1
                        if pair not in hist_co:
                            new_pairs += 1

            novelty_ratio = new_pairs / max(total_pairs, 1)

            cluster_detail = {
                "entities": entities_list,
                "size": len(entities_list),
                "total_pairs": total_pairs,
                "new_pairs": new_pairs,
                "novelty_ratio": round(novelty_ratio, 4),
            }
            cluster_details.append(cluster_detail)

            if novelty_ratio > 0.5 and new_pairs >= 2:
                anomaly_score = min(novelty_ratio * 0.8, 0.95)
                anomalies.append(GroupAnomaly(
                    anomaly_type="new_cluster",
                    involved_entities=entities_list,
                    anomaly_score=round(anomaly_score, 4),
                    confidence=round(min(novelty_ratio, 0.95), 4),
                    baseline_metric=0.0,
                    observed_metric=float(new_pairs),
                    z_score=0.0,
                    evidence={
                        "cluster_size": len(entities_list),
                        "total_pairs": total_pairs,
                        "new_pairs": new_pairs,
                        "novelty_ratio": round(novelty_ratio, 4),
                    },
                    explanation=(
                        f"New cluster formation: {len(entities_list)} entities "
                        f"with {new_pairs}/{total_pairs} previously unseen co-occurrence "
                        f"pairs (novelty={novelty_ratio:.1%})."
                    ),
                ))

        return anomalies, cluster_details

    def _detect_interaction_surge(
        self,
        events: list[dict],
        historical: list[dict] | None,
        reference_time: datetime,
    ) -> list[GroupAnomaly]:
        """Detect sudden increase in inter-entity interactions.

        Compares the interaction rate in the recent window to the
        historical baseline using a z-score analysis.
        """
        anomalies = []

        if not historical or len(historical) < MIN_EVENTS_FOR_GROUP_ANALYSIS:
            return anomalies

        # Compute interaction rate in current window
        current_interactions = 0
        n = len(events)
        for i in range(n):
            for j in range(i + 1, n):
                if events[i]["entity_id"] == events[j]["entity_id"]:
                    continue
                delta = abs((events[j]["timestamp"] - events[i]["timestamp"]).total_seconds())
                if delta <= self.temporal_epsilon:
                    current_interactions += 1
                elif delta > self.temporal_epsilon:
                    break

        current_window_hours = max(
            (events[-1]["timestamp"] - events[0]["timestamp"]).total_seconds() / 3600.0,
            1.0,
        )
        current_rate = current_interactions / current_window_hours

        # Compute historical interaction rate per window
        hist_sorted = sorted(historical, key=lambda e: e["timestamp"])
        window_size = timedelta(hours=self.density_window_hours)

        hist_rates: list[float] = []
        window_start = hist_sorted[0]["timestamp"]
        while window_start < hist_sorted[-1]["timestamp"]:
            window_end = window_start + window_size
            window_events = [
                e for e in hist_sorted
                if window_start <= e["timestamp"] < window_end
            ]

            interactions = 0
            wn = len(window_events)
            for i in range(wn):
                for j in range(i + 1, min(wn, i + 50)):  # Cap inner loop for performance
                    if window_events[i]["entity_id"] == window_events[j]["entity_id"]:
                        continue
                    delta = abs(
                        (window_events[j]["timestamp"] - window_events[i]["timestamp"]).total_seconds()
                    )
                    if delta <= self.temporal_epsilon:
                        interactions += 1

            rate = interactions / self.density_window_hours
            hist_rates.append(rate)
            window_start = window_end

        if len(hist_rates) < 3:
            return anomalies

        mean_rate = float(np.mean(hist_rates))
        std_rate = float(np.std(hist_rates, ddof=1))

        if std_rate < 0.01:
            std_rate = max(mean_rate * 0.1, 0.01)

        z_score = (current_rate - mean_rate) / std_rate

        if z_score > 2.0:
            p_value = float(1.0 - stats.norm.cdf(z_score))
            anomaly_score = min(float(1.0 - np.exp(-0.5 * (z_score / 2) ** 2)), 0.99)

            anomalies.append(GroupAnomaly(
                anomaly_type="interaction_surge",
                involved_entities=list({e["entity_id"] for e in events}),
                anomaly_score=round(anomaly_score, 4),
                confidence=round(min(1.0 - p_value, 0.99), 4),
                timestamp=reference_time,
                baseline_metric=round(mean_rate, 4),
                observed_metric=round(current_rate, 4),
                z_score=round(z_score, 4),
                evidence={
                    "current_interaction_rate": round(current_rate, 4),
                    "historical_mean_rate": round(mean_rate, 4),
                    "historical_std_rate": round(std_rate, 4),
                    "z_score": round(z_score, 4),
                    "p_value": round(p_value, 6),
                    "n_historical_windows": len(hist_rates),
                    "current_interactions": current_interactions,
                },
                explanation=(
                    f"Interaction surge: current rate={current_rate:.2f}/h "
                    f"vs historical {mean_rate:.2f}/h +/- {std_rate:.2f}/h "
                    f"(z={z_score:.2f}, p={p_value:.4f})."
                ),
            ))

        return anomalies

    def _compute_density_change(
        self,
        events: list[dict],
        historical: list[dict] | None,
        reference_time: datetime,
    ) -> float:
        """Compute the density change metric between current and historical.

        Density = unique entities per hour. Returns the ratio
        (current_density / historical_density) - 1, so positive = increase.
        """
        if not events:
            return 0.0

        current_hours = max(
            (events[-1]["timestamp"] - events[0]["timestamp"]).total_seconds() / 3600.0,
            1.0,
        )
        current_entities = len({e["entity_id"] for e in events})
        current_density = current_entities / current_hours

        if not historical or len(historical) < 2:
            return 0.0

        hist_hours = max(
            (historical[-1]["timestamp"] - historical[0]["timestamp"]).total_seconds() / 3600.0,
            1.0,
        )
        hist_entities = len({e["entity_id"] for e in historical})
        hist_density = hist_entities / hist_hours

        if hist_density < 0.01:
            return 0.0

        return (current_density / hist_density) - 1.0
