"""Graph-Based Risk Propagation Engine.

Extends entity-level risk scoring to propagate risk through the
relationship graph. High-risk entities increase the risk of their
neighbors proportionally to relationship strength.

Key features:
- Multi-hop propagation (depth 2-3 max)
- Damping factor to prevent runaway amplification
- Per-neighbor contribution breakdown
- Convergence checking for iterative propagation
- Blending of original + propagated risk

Algorithm:
    For each entity e:
        propagated_risk(e) = Σ_i (risk(neighbor_i) * weight(e, neighbor_i) * damping^hop)
    final_risk(e) = alpha * original_risk(e) + (1-alpha) * propagated_risk(e)

Damping factor (default 0.5) ensures risk decays with each hop:
    - Hop 1: damping = 0.5
    - Hop 2: damping = 0.25
    - Hop 3: damping = 0.125
"""

import logging

import numpy as np

from intelligence_engine.models.system_schemas import (
    PropagatedRiskScore,
    RiskContribution,
    StabilityMetrics,
)

logger = logging.getLogger(__name__)

DEFAULT_DAMPING = 0.5
DEFAULT_BLEND_ALPHA = 0.7  # 70% original, 30% propagated
DEFAULT_MAX_DEPTH = 2
MAX_ITERATIONS = 10
CONVERGENCE_THRESHOLD = 1e-4


class RiskPropagationEngine:
    """Propagates risk through the entity relationship graph.

    Uses a breadth-first traversal with damping to compute how much
    risk flows from high-risk entities to their neighbors.
    """

    def __init__(
        self,
        damping: float = DEFAULT_DAMPING,
        blend_alpha: float = DEFAULT_BLEND_ALPHA,
        max_depth: int = DEFAULT_MAX_DEPTH,
    ) -> None:
        """Initialize risk propagation engine.

        Args:
            damping: Damping factor per hop (0,1). Lower = faster decay.
            blend_alpha: Weight on original risk vs propagated (0,1).
                         alpha=1.0 means only original risk, 0.0 means only propagated.
            max_depth: Maximum propagation depth (hops).
        """
        if not 0 < damping < 1:
            raise ValueError(f"Damping must be in (0,1), got {damping}")
        if not 0 <= blend_alpha <= 1:
            raise ValueError(f"Blend alpha must be in [0,1], got {blend_alpha}")
        if max_depth < 1:
            raise ValueError(f"Max depth must be >= 1, got {max_depth}")

        self.damping = damping
        self.blend_alpha = blend_alpha
        self.max_depth = max_depth

    def propagate(
        self,
        entity_risks: dict[str, float],
        adjacency: dict[str, list[dict]],
    ) -> list[PropagatedRiskScore]:
        """Propagate risk through the graph for all entities.

        Args:
            entity_risks: Dict mapping entity_id -> original risk score (0-1).
            adjacency: Dict mapping entity_id -> list of neighbor dicts:
                - entity_id: str (neighbor)
                - weight: float (relationship weight 0-1)

        Returns:
            List of PropagatedRiskScore for each entity.
        """
        results = []

        for entity_id in entity_risks:
            result = self.propagate_for_entity(
                entity_id, entity_risks, adjacency
            )
            results.append(result)

        return sorted(results, key=lambda r: r.final_risk, reverse=True)

    def propagate_for_entity(
        self,
        entity_id: str,
        entity_risks: dict[str, float],
        adjacency: dict[str, list[dict]],
    ) -> PropagatedRiskScore:
        """Compute propagated risk for a single entity via BFS.

        Args:
            entity_id: The entity to compute propagated risk for.
            entity_risks: All entity risk scores.
            adjacency: Graph adjacency with weights.

        Returns:
            PropagatedRiskScore with contribution breakdown.
        """
        original_risk = entity_risks.get(entity_id, 0.0)
        contributions: list[RiskContribution] = []

        # BFS propagation
        visited: set[str] = {entity_id}
        current_frontier = [entity_id]
        propagated_sum = 0.0

        for depth in range(1, self.max_depth + 1):
            next_frontier = []
            hop_damping = self.damping ** depth

            for current in current_frontier:
                neighbors = adjacency.get(current, [])
                for neighbor_info in neighbors:
                    neighbor_id = neighbor_info["entity_id"]
                    rel_weight = neighbor_info.get("weight", 0.0)

                    if neighbor_id in visited:
                        continue

                    neighbor_risk = entity_risks.get(neighbor_id, 0.0)
                    contribution = neighbor_risk * rel_weight * hop_damping

                    if contribution > 0.001:  # Skip negligible contributions
                        contributions.append(RiskContribution(
                            source_entity_id=neighbor_id,
                            source_risk=round(neighbor_risk, 4),
                            relationship_weight=round(rel_weight, 4),
                            hop_distance=depth,
                            damping_applied=round(hop_damping, 4),
                            contribution=round(contribution, 6),
                        ))
                        propagated_sum += contribution

                    visited.add(neighbor_id)
                    next_frontier.append(neighbor_id)

            current_frontier = next_frontier
            if not current_frontier:
                break

        # Normalize propagated risk to [0,1]
        propagated_risk = min(propagated_sum, 1.0)

        # Blend original and propagated
        final_risk = (
            self.blend_alpha * original_risk
            + (1 - self.blend_alpha) * propagated_risk
        )
        final_risk = min(max(final_risk, 0.0), 1.0)

        # Risk level
        risk_level = "low"
        if final_risk >= 0.75:
            risk_level = "critical"
        elif final_risk >= 0.50:
            risk_level = "high"
        elif final_risk >= 0.25:
            risk_level = "medium"

        # Sort contributions by magnitude
        contributions.sort(key=lambda c: c.contribution, reverse=True)

        explanation_parts = [
            f"Original risk: {original_risk:.3f}.",
            f"Propagated risk: {propagated_risk:.3f} "
            f"(from {len(contributions)} neighbor contributions, "
            f"max depth={self.max_depth}, damping={self.damping}).",
            f"Final risk: {self.blend_alpha}*{original_risk:.3f} + "
            f"{1-self.blend_alpha}*{propagated_risk:.3f} = {final_risk:.3f}.",
        ]
        if contributions:
            top = contributions[0]
            explanation_parts.append(
                f"Largest contributor: {top.source_entity_id} "
                f"(risk={top.source_risk:.3f}, weight={top.relationship_weight:.3f}, "
                f"hop={top.hop_distance}, contribution={top.contribution:.4f})."
            )

        return PropagatedRiskScore(
            entity_id=entity_id,
            original_risk=round(original_risk, 4),
            propagated_risk=round(propagated_risk, 4),
            final_risk=round(final_risk, 4),
            risk_level=risk_level,
            neighbor_contributions=contributions,
            propagation_depth=self.max_depth,
            damping_factor=self.damping,
            blend_alpha=self.blend_alpha,
            explanation=" ".join(explanation_parts),
        )

    def iterative_propagation(
        self,
        entity_risks: dict[str, float],
        adjacency: dict[str, list[dict]],
        max_iterations: int = MAX_ITERATIONS,
    ) -> tuple[dict[str, float], StabilityMetrics]:
        """Run iterative risk propagation until convergence.

        Similar to PageRank-style iteration: update all risks simultaneously,
        repeat until convergence or max iterations.

        Args:
            entity_risks: Initial risk scores.
            adjacency: Graph adjacency.
            max_iterations: Maximum iterations.

        Returns:
            (updated_risks, stability_metrics)
        """
        current_risks = dict(entity_risks)
        original_risks = dict(entity_risks)
        converged = False
        risk_history: list[dict[str, float]] = [dict(current_risks)]

        for iteration in range(max_iterations):
            new_risks: dict[str, float] = {}

            for entity_id in current_risks:
                neighbors = adjacency.get(entity_id, [])
                propagated = 0.0

                for n in neighbors:
                    nid = n["entity_id"]
                    w = n.get("weight", 0.0)
                    propagated += current_risks.get(nid, 0.0) * w * self.damping

                propagated = min(propagated, 1.0)
                new_risks[entity_id] = (
                    self.blend_alpha * original_risks[entity_id]
                    + (1 - self.blend_alpha) * propagated
                )
                new_risks[entity_id] = min(max(new_risks[entity_id], 0.0), 1.0)

            # Check convergence
            max_change = max(
                abs(new_risks[e] - current_risks[e])
                for e in current_risks
            ) if current_risks else 0.0

            current_risks = new_risks
            risk_history.append(dict(current_risks))

            if max_change < CONVERGENCE_THRESHOLD:
                converged = True
                break

        # Check for oscillation
        oscillation = False
        if len(risk_history) >= 3:
            for entity_id in current_risks:
                vals = [h.get(entity_id, 0) for h in risk_history[-3:]]
                if len(vals) == 3:
                    if (vals[0] > vals[1] and vals[1] < vals[2]) or \
                       (vals[0] < vals[1] and vals[1] > vals[2]):
                        oscillation = True
                        break

        # Compute metrics
        changes = [
            abs(current_risks[e] - original_risks[e])
            for e in current_risks
        ]

        stability = StabilityMetrics(
            converged=converged,
            iterations_to_converge=len(risk_history) - 1,
            max_risk_change=round(max(changes) if changes else 0.0, 6),
            mean_risk_change=round(float(np.mean(changes)) if changes else 0.0, 6),
            oscillation_detected=oscillation,
            explanation=(
                f"{'Converged' if converged else 'Did not converge'} "
                f"after {len(risk_history)-1} iterations. "
                f"Max risk change: {max(changes) if changes else 0:.6f}. "
                f"Oscillation: {'yes' if oscillation else 'no'}."
            ),
        )

        return current_risks, stability
