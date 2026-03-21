"""System-Level Intelligence Explanation Layer.

Upgrades explanations from per-entity to system-level reasoning.
Each alert explains:
- What pattern was detected
- Which entities contributed
- How risk propagated
- Why this is statistically significant

Generates unified narratives that connect coordination patterns,
risk propagation chains, sequence detections, and group anomalies
into coherent intelligence reports.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from intelligence_engine.models.system_schemas import (
    CoordinationResult,
    GroupAnomalyResult,
    PropagatedRiskScore,
    SequenceResult,
    SystemExplanation,
)

logger = logging.getLogger(__name__)


class SystemExplainer:
    """Generates system-level explanations for intelligence alerts.

    Synthesizes results from multiple analysis modules into unified,
    human-readable explanations with statistical evidence.
    """

    def explain_coordination(
        self,
        coordination: CoordinationResult,
        alert_id: str = "",
    ) -> SystemExplanation:
        """Generate explanation for coordination detection results.

        Args:
            coordination: Result from CoordinationDetector.
            alert_id: Optional alert ID for tracking.

        Returns:
            SystemExplanation with synthesis of all coordination patterns.
        """
        if not coordination.patterns_detected:
            return SystemExplanation(
                alert_id=alert_id,
                alert_type="coordination",
                summary="No coordination patterns detected.",
                confidence=0.0,
                explanation="Analysis did not find statistically significant coordination.",
            )

        # Categorize patterns
        co_occ = [p for p in coordination.patterns_detected if p.coordination_type == "co_occurrence"]
        staggered = [p for p in coordination.patterns_detected if p.coordination_type == "staggered"]
        convoy = [p for p in coordination.patterns_detected if p.coordination_type == "convoy"]

        # Build contributing entities summary
        all_entities: dict[str, int] = {}
        for p in coordination.patterns_detected:
            for e in p.involved_entities:
                all_entities[e] = all_entities.get(e, 0) + 1

        contributing = [
            {
                "entity_id": eid,
                "patterns_involved": count,
                "role": "hub" if count >= 3 else "participant",
            }
            for eid, count in sorted(all_entities.items(), key=lambda x: -x[1])
        ]

        # Build summary
        summary_parts = []
        if co_occ:
            top = co_occ[0]
            summary_parts.append(
                f"{len(co_occ)} co-occurrence pattern(s), strongest: "
                f"{' & '.join(top.involved_entities)} "
                f"(conf={top.confidence:.3f}, freq={top.frequency})"
            )
        if staggered:
            top = staggered[0]
            summary_parts.append(
                f"{len(staggered)} staggered pattern(s), strongest: "
                f"{top.involved_entities[0]} -> {top.involved_entities[1]} "
                f"(conf={top.confidence:.3f}, lag={top.mean_time_gap_seconds:.0f}s)"
            )
        if convoy:
            top = convoy[0]
            summary_parts.append(
                f"{len(convoy)} convoy pattern(s), strongest: "
                f"{' & '.join(top.involved_entities)} "
                f"(conf={top.confidence:.3f})"
            )

        # Statistical significance summary
        sig_stats = {
            "total_patterns": len(coordination.patterns_detected),
            "high_confidence_patterns": sum(
                1 for p in coordination.patterns_detected if p.confidence > 0.8
            ),
            "entities_analyzed": coordination.total_entities_analyzed,
            "events_analyzed": coordination.total_events_analyzed,
            "motifs_found": len(coordination.graph_motifs),
        }

        # Overall confidence: weighted average of pattern confidences
        if coordination.patterns_detected:
            avg_conf = sum(p.confidence for p in coordination.patterns_detected) / len(
                coordination.patterns_detected
            )
        else:
            avg_conf = 0.0

        # Recommended actions
        actions = []
        if co_occ:
            actions.append("Monitor co-occurring entity pairs for continued joint appearances.")
        if staggered:
            actions.append(
                "Investigate staggered timing — may indicate planned sequential movement."
            )
        if convoy:
            actions.append(
                "Track convoy entities across locations to confirm coordinated movement."
            )
        if coordination.graph_motifs:
            actions.append(
                f"Investigate {len(coordination.graph_motifs)} triad(s) "
                f"for potential group coordination."
            )

        return SystemExplanation(
            alert_id=alert_id,
            alert_type="coordination",
            summary="; ".join(summary_parts),
            pattern_description=(
                f"Coordination analysis over {coordination.analysis_window_hours:.1f}h "
                f"window identified {len(coordination.patterns_detected)} patterns "
                f"across {coordination.total_entities_analyzed} entities."
            ),
            contributing_entities=contributing,
            statistical_significance=sig_stats,
            confidence=round(avg_conf, 4),
            recommended_actions=actions,
            explanation=coordination.explanation,
        )

    def explain_risk_propagation(
        self,
        propagated_risks: list[PropagatedRiskScore],
        alert_id: str = "",
    ) -> SystemExplanation:
        """Generate explanation for risk propagation results.

        Args:
            propagated_risks: Results from RiskPropagationEngine.
            alert_id: Optional alert ID.

        Returns:
            SystemExplanation with risk propagation chain details.
        """
        if not propagated_risks:
            return SystemExplanation(
                alert_id=alert_id,
                alert_type="risk_propagation",
                summary="No risk propagation computed.",
                confidence=0.0,
            )

        # Find entities whose risk increased significantly
        significant_increases = [
            r for r in propagated_risks
            if r.final_risk > r.original_risk + 0.05
        ]

        # Build propagation chains
        chains = []
        for r in significant_increases:
            chain = {
                "entity_id": r.entity_id,
                "original_risk": r.original_risk,
                "final_risk": r.final_risk,
                "increase": round(r.final_risk - r.original_risk, 4),
                "top_contributors": [
                    {
                        "source": c.source_entity_id,
                        "contribution": c.contribution,
                        "hop": c.hop_distance,
                    }
                    for c in r.neighbor_contributions[:3]
                ],
            }
            chains.append(chain)

        # Contributing entities
        contributing = []
        risk_sources: dict[str, float] = {}
        for r in propagated_risks:
            for c in r.neighbor_contributions:
                risk_sources[c.source_entity_id] = max(
                    risk_sources.get(c.source_entity_id, 0.0),
                    c.contribution,
                )

        for eid, max_contrib in sorted(risk_sources.items(), key=lambda x: -x[1])[:10]:
            contributing.append({
                "entity_id": eid,
                "max_contribution": round(max_contrib, 4),
                "role": "risk_source",
            })

        # Summary
        high_risk = [r for r in propagated_risks if r.risk_level in ("high", "critical")]
        summary = (
            f"Risk propagation across {len(propagated_risks)} entities: "
            f"{len(significant_increases)} had significant risk increases, "
            f"{len(high_risk)} at high/critical level."
        )

        actions = []
        if significant_increases:
            top = max(significant_increases, key=lambda r: r.final_risk - r.original_risk)
            actions.append(
                f"Investigate {top.entity_id}: risk increased from "
                f"{top.original_risk:.3f} to {top.final_risk:.3f} via graph propagation."
            )
        if high_risk:
            actions.append(
                f"Priority monitoring for {len(high_risk)} high/critical risk entities."
            )

        return SystemExplanation(
            alert_id=alert_id,
            alert_type="risk_propagation",
            summary=summary,
            pattern_description=(
                f"Graph-based risk propagation with damping={propagated_risks[0].damping_factor}, "
                f"blend_alpha={propagated_risks[0].blend_alpha}."
            ),
            contributing_entities=contributing,
            risk_propagation_chain=chains,
            statistical_significance={
                "total_entities": len(propagated_risks),
                "significant_increases": len(significant_increases),
                "high_risk_entities": len(high_risk),
            },
            confidence=round(
                min(len(significant_increases) / max(len(propagated_risks), 1), 0.99), 4
            ),
            recommended_actions=actions,
            explanation=(
                f"Risk propagated through {len(propagated_risks)} entities. "
                f"{len(significant_increases)} entities saw risk increase > 0.05 "
                f"due to connections with high-risk neighbors."
            ),
        )

    def explain_sequences(
        self,
        sequences: SequenceResult,
        alert_id: str = "",
    ) -> SystemExplanation:
        """Generate explanation for sequence detection results."""
        if not sequences.frequent_sequences and not sequences.causal_relationships:
            return SystemExplanation(
                alert_id=alert_id,
                alert_type="sequence",
                summary="No significant sequences or causal relationships detected.",
                confidence=0.0,
            )

        contributing = []
        entity_roles: dict[str, str] = {}

        for cr in sequences.causal_relationships:
            entity_roles[cr.leader_entity] = "leader"
            entity_roles[cr.follower_entity] = "follower"

        for eid, role in entity_roles.items():
            contributing.append({"entity_id": eid, "role": role})

        summary_parts = []
        if sequences.frequent_sequences:
            top = sequences.frequent_sequences[0]
            summary_parts.append(
                f"{len(sequences.frequent_sequences)} frequent sequence(s), "
                f"top: {' -> '.join(top.sequence)} (support={top.support})"
            )
        if sequences.causal_relationships:
            top = sequences.causal_relationships[0]
            summary_parts.append(
                f"{len(sequences.causal_relationships)} causal relationship(s), "
                f"top: {top.leader_entity} -> {top.follower_entity} "
                f"(P={top.conditional_probability:.3f}, lift={top.lift:.2f})"
            )

        actions = []
        for cr in sequences.causal_relationships[:3]:
            if cr.lift > 2.0:
                actions.append(
                    f"Strong causal link: {cr.leader_entity} -> {cr.follower_entity} "
                    f"(lift={cr.lift:.1f}x). Monitor {cr.leader_entity} to predict "
                    f"{cr.follower_entity} appearances."
                )

        avg_conf = 0.0
        all_confs = [s.confidence for s in sequences.frequent_sequences] + \
                    [c.confidence for c in sequences.causal_relationships]
        if all_confs:
            avg_conf = sum(all_confs) / len(all_confs)

        return SystemExplanation(
            alert_id=alert_id,
            alert_type="sequence",
            summary="; ".join(summary_parts),
            pattern_description=sequences.explanation,
            contributing_entities=contributing,
            statistical_significance={
                "frequent_sequences": len(sequences.frequent_sequences),
                "causal_relationships": len(sequences.causal_relationships),
                "total_events": sequences.total_events_analyzed,
            },
            confidence=round(avg_conf, 4),
            recommended_actions=actions,
            explanation=sequences.explanation,
        )

    def explain_group_anomaly(
        self,
        group_result: GroupAnomalyResult,
        alert_id: str = "",
    ) -> SystemExplanation:
        """Generate explanation for group anomaly detection results."""
        if not group_result.anomalies:
            return SystemExplanation(
                alert_id=alert_id,
                alert_type="group_anomaly",
                summary="No group-level anomalies detected.",
                confidence=0.0,
            )

        # Categorize anomalies
        by_type: dict[str, int] = {}
        for a in group_result.anomalies:
            by_type[a.anomaly_type] = by_type.get(a.anomaly_type, 0) + 1

        all_entities: set[str] = set()
        for a in group_result.anomalies:
            all_entities.update(a.involved_entities)

        contributing = [
            {"entity_id": eid, "role": "involved"}
            for eid in sorted(all_entities)
        ]

        summary_parts = []
        for atype, count in sorted(by_type.items(), key=lambda x: -x[1]):
            summary_parts.append(f"{count} {atype}")

        top = max(group_result.anomalies, key=lambda a: a.anomaly_score)
        summary = (
            f"Group anomalies: {', '.join(summary_parts)}. "
            f"Most significant: {top.anomaly_type} (score={top.anomaly_score:.3f})."
        )

        actions = []
        for a in group_result.anomalies:
            if a.anomaly_type == "unusual_gathering":
                actions.append(
                    f"Investigate gathering at {a.location}: "
                    f"{len(a.involved_entities)} entities (z={a.z_score:.1f})."
                )
            elif a.anomaly_type == "new_cluster":
                actions.append(
                    f"New cluster of {len(a.involved_entities)} entities — "
                    f"no prior co-occurrence history."
                )
            elif a.anomaly_type == "interaction_surge":
                actions.append(
                    f"Interaction rate surge: {a.observed_metric:.1f}/h "
                    f"vs baseline {a.baseline_metric:.1f}/h."
                )

        avg_conf = sum(a.confidence for a in group_result.anomalies) / len(
            group_result.anomalies
        )

        return SystemExplanation(
            alert_id=alert_id,
            alert_type="group_anomaly",
            summary=summary,
            pattern_description=group_result.explanation,
            contributing_entities=contributing,
            statistical_significance={
                "total_anomalies": len(group_result.anomalies),
                "by_type": by_type,
                "clusters_detected": group_result.clusters_detected,
                "density_change": group_result.density_change,
            },
            confidence=round(avg_conf, 4),
            recommended_actions=actions,
            explanation=group_result.explanation,
        )

    def synthesize_system_alert(
        self,
        coordination: Optional[CoordinationResult] = None,
        propagated_risks: Optional[list[PropagatedRiskScore]] = None,
        sequences: Optional[SequenceResult] = None,
        group_anomalies: Optional[GroupAnomalyResult] = None,
    ) -> SystemExplanation:
        """Synthesize a unified system-level alert from all analysis modules.

        Combines insights from coordination, risk propagation, sequence
        detection, and group anomaly detection into a single coherent report.
        """
        alert_id = f"system_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        findings = []
        all_entities: set[str] = set()
        total_confidence = 0.0
        n_modules = 0
        actions = []

        if coordination and coordination.patterns_detected:
            n_patterns = len(coordination.patterns_detected)
            top = max(coordination.patterns_detected, key=lambda p: p.confidence)
            findings.append(
                f"COORDINATION: {n_patterns} patterns detected, "
                f"top confidence={top.confidence:.3f}"
            )
            for p in coordination.patterns_detected:
                all_entities.update(p.involved_entities)
            total_confidence += top.confidence
            n_modules += 1

        if propagated_risks:
            significant = [r for r in propagated_risks if r.final_risk > r.original_risk + 0.05]
            high_risk = [r for r in propagated_risks if r.risk_level in ("high", "critical")]
            if significant:
                findings.append(
                    f"RISK PROPAGATION: {len(significant)} entities with increased risk, "
                    f"{len(high_risk)} high/critical"
                )
                for r in high_risk:
                    all_entities.add(r.entity_id)
                total_confidence += 0.8  # Graph-based propagation is inherently reliable
                n_modules += 1

        if sequences and (sequences.frequent_sequences or sequences.causal_relationships):
            findings.append(
                f"SEQUENCES: {len(sequences.frequent_sequences)} frequent sequences, "
                f"{len(sequences.causal_relationships)} causal links"
            )
            for cr in sequences.causal_relationships:
                all_entities.add(cr.leader_entity)
                all_entities.add(cr.follower_entity)
            if sequences.causal_relationships:
                total_confidence += max(c.confidence for c in sequences.causal_relationships)
                n_modules += 1

        if group_anomalies and group_anomalies.anomalies:
            findings.append(
                f"GROUP ANOMALIES: {len(group_anomalies.anomalies)} detected"
            )
            for a in group_anomalies.anomalies:
                all_entities.update(a.involved_entities)
            total_confidence += max(a.confidence for a in group_anomalies.anomalies)
            n_modules += 1

        if not findings:
            return SystemExplanation(
                alert_id=alert_id,
                alert_type="system_synthesis",
                summary="No significant system-level intelligence detected.",
                confidence=0.0,
            )

        avg_confidence = total_confidence / max(n_modules, 1)

        contributing = [
            {"entity_id": eid, "role": "involved"}
            for eid in sorted(all_entities)
        ]

        return SystemExplanation(
            alert_id=alert_id,
            alert_type="system_synthesis",
            summary=f"System-level analysis: {'; '.join(findings)}.",
            pattern_description=(
                f"Multi-module synthesis across {n_modules} analysis modules "
                f"involving {len(all_entities)} entities."
            ),
            contributing_entities=contributing,
            statistical_significance={
                "modules_with_findings": n_modules,
                "total_entities_involved": len(all_entities),
            },
            confidence=round(min(avg_confidence, 0.99), 4),
            recommended_actions=actions,
            explanation=(
                f"Unified system analysis produced {len(findings)} findings "
                f"across {n_modules} modules. "
                f"{len(all_entities)} entities involved. "
                f"Average confidence: {avg_confidence:.3f}."
            ),
        )
