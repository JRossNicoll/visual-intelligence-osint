#!/usr/bin/env python3
"""System-Level Intelligence Validation Script.

Exercises all 8 new system-level modules with synthetic scenarios
and produces concrete numerical outputs with statistical evidence.

Modules validated:
1. Coordinated Behavior Detection
2. Graph-Based Risk Propagation
3. Sequence & Causal Pattern Detection
4. Adaptive Risk Model
5. Confidence Calibration
6. Multi-Entity Anomaly Detection
7. System-Level Explanation
8. Evaluation Framework
"""

import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add intelligence engine to path
sys.path.insert(0, str(Path(__file__).parent / "services" / "intelligence-engine"))

import numpy as np

from intelligence_engine.analyzers.adaptive_risk import AdaptiveRiskModel
from intelligence_engine.analyzers.calibration import ConfidenceCalibrator
from intelligence_engine.analyzers.coordination import CoordinationDetector
from intelligence_engine.analyzers.evaluation import IntelligenceEvaluator
from intelligence_engine.analyzers.group_anomaly import GroupAnomalyDetector
from intelligence_engine.analyzers.risk_propagation import RiskPropagationEngine
from intelligence_engine.analyzers.sequence import SequenceDetector
from intelligence_engine.analyzers.system_explanation import SystemExplainer


def header(title: str) -> None:
    print(f"\n{'='*72}")
    print(f"  {title}")
    print(f"{'='*72}")


def subheader(title: str) -> None:
    print(f"\n--- {title} ---")


# ================================================================
# 1. COORDINATED BEHAVIOR DETECTION
# ================================================================
def validate_coordination() -> dict:
    header("1. COORDINATED BEHAVIOR DETECTION")
    detector = CoordinationDetector()
    base = datetime(2026, 3, 20, 8, 0, 0, tzinfo=timezone.utc)

    # Scenario A: Two entities that ALWAYS appear together at same locations
    print("\nScenario A: Strong co-occurrence (A and B always together)")
    events_coordinated = []
    for i in range(10):
        t = base + timedelta(hours=i * 2)
        loc = f"Location_{i % 3}"
        events_coordinated.append({"entity_id": "Entity_A", "timestamp": t, "location_id": loc, "location_name": loc, "co_occurring_entities": ["Entity_B"]})
        events_coordinated.append({"entity_id": "Entity_B", "timestamp": t + timedelta(seconds=30), "location_id": loc, "location_name": loc, "co_occurring_entities": ["Entity_A"]})

    result_a = detector.detect(events_coordinated)
    print(f"  Events analyzed: {result_a.total_events_analyzed}")
    print(f"  Entities analyzed: {result_a.total_entities_analyzed}")
    print(f"  Patterns detected: {len(result_a.patterns_detected)}")
    for p in result_a.patterns_detected:
        print(f"    Type: {p.coordination_type}, Entities: {p.involved_entities}")
        print(f"    Confidence: {p.confidence}, Frequency: {p.frequency}")
        print(f"    Mean gap: {p.mean_time_gap_seconds}s, Std: {p.std_time_gap_seconds}s")
        if p.evidence:
            for k, v in p.evidence.items():
                print(f"      {k}: {v}")
    print(f"  Graph motifs: {len(result_a.graph_motifs)}")

    # Scenario B: Staggered coordination (A appears, then B follows 2-5 min later)
    print("\nScenario B: Staggered coordination (A then B, 2-5 min lag)")
    events_staggered = []
    for i in range(12):
        t = base + timedelta(hours=i * 3)
        loc = f"Location_{i % 4}"
        events_staggered.append({"entity_id": "Entity_X", "timestamp": t, "location_id": loc, "location_name": loc, "co_occurring_entities": []})
        rng = np.random.default_rng(42 + i)
        lag = 120 + int(rng.integers(0, 180))  # 2-5 min lag
        events_staggered.append({"entity_id": "Entity_Y", "timestamp": t + timedelta(seconds=lag), "location_id": loc, "location_name": loc, "co_occurring_entities": []})

    result_b = detector.detect(events_staggered)
    print(f"  Events analyzed: {result_b.total_events_analyzed}")
    print(f"  Patterns detected: {len(result_b.patterns_detected)}")
    for p in result_b.patterns_detected:
        print(f"    Type: {p.coordination_type}, Entities: {p.involved_entities}")
        print(f"    Confidence: {p.confidence}, Frequency: {p.frequency}")
        if p.evidence:
            for k, v in p.evidence.items():
                print(f"      {k}: {v}")

    # Scenario C: No coordination (random, independent entities)
    print("\nScenario C: No coordination (independent entities)")
    events_random = []
    for i in range(20):
        rng_r = np.random.default_rng(42 + i)
        eid = f"Random_{int(rng_r.integers(0, 5))}"
        t = base + timedelta(hours=int(rng_r.integers(0, 100)))
        loc = f"Location_{int(rng_r.integers(0, 10))}"
        events_random.append({"entity_id": eid, "timestamp": t, "location_id": loc, "location_name": loc, "co_occurring_entities": []})

    result_c = detector.detect(events_random)
    print(f"  Events analyzed: {result_c.total_events_analyzed}")
    print(f"  Patterns detected: {len(result_c.patterns_detected)} (expected: few or none)")
    print(f"  Graph motifs: {len(result_c.graph_motifs)}")

    return {
        "coordinated_patterns": len(result_a.patterns_detected),
        "staggered_patterns": len(result_b.patterns_detected),
        "random_patterns": len(result_c.patterns_detected),
    }


# ================================================================
# 2. GRAPH-BASED RISK PROPAGATION
# ================================================================
def validate_risk_propagation() -> dict:
    header("2. GRAPH-BASED RISK PROPAGATION")
    engine = RiskPropagationEngine()

    # Build a small network: A(high risk) -> B -> C -> D(low risk)
    entity_risks = {
        "Entity_A": 0.9,   # High risk
        "Entity_B": 0.3,
        "Entity_C": 0.1,
        "Entity_D": 0.05,
        "Entity_E": 0.2,
    }
    adjacency = {
        "Entity_A": [
            {"entity_id": "Entity_B", "weight": 0.8},
            {"entity_id": "Entity_E", "weight": 0.3},
        ],
        "Entity_B": [
            {"entity_id": "Entity_A", "weight": 0.8},
            {"entity_id": "Entity_C", "weight": 0.6},
        ],
        "Entity_C": [
            {"entity_id": "Entity_B", "weight": 0.6},
            {"entity_id": "Entity_D", "weight": 0.4},
        ],
        "Entity_D": [
            {"entity_id": "Entity_C", "weight": 0.4},
        ],
        "Entity_E": [
            {"entity_id": "Entity_A", "weight": 0.3},
        ],
    }

    subheader("BFS Propagation (depth=2, damping=0.5)")
    propagated = engine.propagate(entity_risks, adjacency)
    print(f"  Entities propagated: {len(propagated)}")
    for p in propagated:
        print(f"  {p.entity_id}: original={p.original_risk:.3f} -> final={p.final_risk:.3f} "
              f"(propagated_component={p.propagated_risk:.3f}, level={p.risk_level})")
        for c in p.neighbor_contributions:
            print(f"    <- {c.source_entity_id}: contribution={c.contribution:.4f} "
                  f"(risk={c.source_risk:.3f}, weight={c.relationship_weight:.3f}, "
                  f"hop={c.hop_distance}, damping={c.damping_applied:.3f})")

    subheader("Iterative (PageRank-style) Propagation")
    updated_risks, stability = engine.iterative_propagation(entity_risks, adjacency)
    print(f"  Converged: {stability.converged}")
    print(f"  Iterations to converge: {stability.iterations_to_converge}")
    print(f"  Max risk change: {stability.max_risk_change:.6f}")
    print(f"  Oscillation detected: {stability.oscillation_detected}")
    print(f"  Updated risks:")
    for eid, risk in sorted(updated_risks.items()):
        orig = entity_risks[eid]
        print(f"    {eid}: {orig:.3f} -> {risk:.3f} (delta={risk - orig:+.3f})")

    # Verify damping prevents runaway
    subheader("Damping Verification")
    max_risk = max(updated_risks.values())
    print(f"  Max risk after propagation: {max_risk:.4f}")
    print(f"  Original max risk: {max(entity_risks.values()):.4f}")
    print(f"  Damping prevents runaway: {max_risk <= 1.0}")

    return {
        "entities_propagated": len(propagated),
        "converged": stability.converged,
        "iterations": stability.iterations_to_converge,
        "max_change": stability.max_risk_change,
        "oscillation": stability.oscillation_detected,
    }


# ================================================================
# 3. SEQUENCE & CAUSAL PATTERN DETECTION
# ================================================================
def validate_sequences() -> dict:
    header("3. SEQUENCE & CAUSAL PATTERN DETECTION")
    detector = SequenceDetector(min_support=3, time_window_seconds=600)
    base = datetime(2026, 3, 20, 8, 0, 0, tzinfo=timezone.utc)

    # Scenario: A -> B -> C appears repeatedly
    print("\nScenario: Recurring sequence A -> B -> C")
    events = []
    for i in range(8):
        t = base + timedelta(hours=i * 3)
        events.append({"entity_id": "Seq_A", "timestamp": t, "location_id": "Loc_1"})
        events.append({"entity_id": "Seq_B", "timestamp": t + timedelta(minutes=2), "location_id": "Loc_2"})
        events.append({"entity_id": "Seq_C", "timestamp": t + timedelta(minutes=5), "location_id": "Loc_3"})

    # Add some noise
    for i in range(5):
        t = base + timedelta(hours=i * 7 + 1)
        events.append({"entity_id": "Noise_1", "timestamp": t, "location_id": "Loc_5"})

    result = detector.detect(events)
    print(f"  Total events analyzed: {result.total_events_analyzed}")
    print(f"  Frequent sequences found: {len(result.frequent_sequences)}")
    for s in result.frequent_sequences[:5]:
        print(f"    Sequence: {' -> '.join(s.sequence)}")
        print(f"    Support: {s.support}, Confidence: {s.confidence}")
        print(f"    Mean delays: {s.mean_delay_seconds}")
        print(f"    Std delays: {s.std_delay_seconds}")

    print(f"\n  Causal relationships found: {len(result.causal_relationships)}")
    for c in result.causal_relationships[:5]:
        print(f"    {c.leader_entity} -> {c.follower_entity}")
        print(f"    P(follower|leader) = {c.conditional_probability:.4f}")
        print(f"    P(follower baseline) = {c.baseline_probability:.4f}")
        print(f"    Lift = {c.lift:.4f}")
        print(f"    Mean lag = {c.mean_lag_seconds:.1f}s +/- {c.std_lag_seconds:.1f}s")
        print(f"    Occurrences: {c.occurrences}, Confidence: {c.confidence}")

    return {
        "sequences_found": len(result.frequent_sequences),
        "causal_found": len(result.causal_relationships),
        "total_events": result.total_events_analyzed,
    }


# ================================================================
# 4. ADAPTIVE RISK MODEL
# ================================================================
def validate_adaptive_risk() -> dict:
    header("4. ADAPTIVE RISK MODEL (Bayesian Weight Updating)")
    model = AdaptiveRiskModel()

    state = model.get_state()
    print(f"\nInitial state:")
    print(f"  Weights: w1={state.current_w1:.4f}, w2={state.current_w2:.4f}, w3={state.current_w3:.4f}")
    print(f"  Alpha: {state.posterior_alpha}")
    print(f"  Update count: {state.update_count}")

    # Simulate feedback: anomaly component was most predictive
    print("\nSimulating 5 true positives where anomaly scored highest...")
    for i in range(5):
        state = model.update_from_feedback(
            feedback_type="true_positive",
            component_scores={"anomaly": 0.8, "association": 0.2, "behavior": 0.3},
            outcome=True,
        )
    print(f"  After 5 TP (anomaly-driven):")
    print(f"  Weights: w1={state.current_w1:.4f}, w2={state.current_w2:.4f}, w3={state.current_w3:.4f}")
    print(f"  Alpha: {[round(a, 2) for a in state.posterior_alpha]}")
    print(f"  Update count: {state.update_count}")
    w1_after_tp = state.current_w1

    print("\nSimulating 3 false positives where behavior scored highest...")
    for _i in range(3):
        state = model.update_from_feedback(
            feedback_type="false_positive",
            component_scores={"anomaly": 0.2, "association": 0.3, "behavior": 0.9},
            outcome=False,
        )
    print(f"  After 3 FP (behavior-driven):")
    print(f"  Weights: w1={state.current_w1:.4f}, w2={state.current_w2:.4f}, w3={state.current_w3:.4f}")
    print(f"  Alpha: {[round(a, 2) for a in state.posterior_alpha]}")
    print(f"  Update count: {state.update_count}")

    # Test risk computation with adaptive weights
    subheader("Risk computation with adapted weights")
    risk, details = model.compute_risk_with_adaptive_weights(
        anomaly_score=0.7,
        association_score=0.3,
        behavior_score=0.5,
    )
    print(f"  Computed risk: {risk:.4f}")
    w1, w2, w3 = model.weights
    expected = w1 * 0.7 + w2 * 0.3 + w3 * 0.5
    print(f"  Formula: {w1:.4f}*0.7 + {w2:.4f}*0.3 + {w3:.4f}*0.5 = {expected:.4f}")
    print(f"  Weight uncertainty: {details['weight_uncertainty']}")
    print(f"  Alpha sum: {details['alpha_sum']}")
    print(f"  Match: {abs(risk - round(expected, 4)) < 1e-3}")

    subheader("Weight history (last 5)")
    for snap in state.weight_history[-5:]:
        print(f"  [{snap.trigger}] "
              f"w1={snap.w1_anomaly:.4f}, w2={snap.w2_association:.4f}, w3={snap.w3_behavior:.4f}")

    return {
        "final_w1": state.current_w1,
        "final_w2": state.current_w2,
        "final_w3": state.current_w3,
        "update_count": state.update_count,
        "w1_increased_after_tp": w1_after_tp > 0.4,
    }


# ================================================================
# 5. CONFIDENCE CALIBRATION
# ================================================================
def validate_calibration() -> dict:
    header("5. CONFIDENCE CALIBRATION")
    calibrator = ConfidenceCalibrator()

    # Generate synthetic predictions: overconfident model
    rng = np.random.default_rng(42)
    n = 200
    true_prob = rng.beta(2, 5, n)  # Actual probability
    actual = (rng.random(n) < true_prob).astype(int)
    # Overconfident predictions: push toward 0 and 1
    predicted = np.clip(true_prob * 1.5 + 0.1, 0.01, 0.99).tolist()
    actual_list = actual.tolist()

    subheader("Platt Scaling Calibration")
    platt_result = calibrator.fit_platt(predicted, actual_list)
    print(f"  ECE (Expected Calibration Error): {platt_result.ece:.4f}")
    print(f"  MCE (Maximum Calibration Error): {platt_result.mce:.4f}")
    print(f"  Brier Score: {platt_result.brier_score:.4f}")
    print(f"  Number of bins: {len(platt_result.bins)}")
    print(f"  Calibration bins:")
    for b in platt_result.bins:
        print(f"    [{b.bin_lower:.2f}-{b.bin_upper:.2f}] "
              f"mean_pred={b.mean_predicted:.4f}, mean_actual={b.mean_actual:.4f}, "
              f"gap={b.gap:.4f}, count={b.count}")

    subheader("Isotonic Regression Calibration")
    calibrator2 = ConfidenceCalibrator()
    iso_result = calibrator2.fit_isotonic(predicted, actual_list)
    print(f"  ECE: {iso_result.ece:.4f}")
    print(f"  MCE: {iso_result.mce:.4f}")
    print(f"  Brier Score: {iso_result.brier_score:.4f}")

    # Compare: calibrate some raw scores
    subheader("Calibration Example")
    raw_scores = [0.1, 0.3, 0.5, 0.7, 0.9]
    platt_calibrated = calibrator.calibrate_platt(raw_scores)
    iso_calibrated = calibrator2.calibrate_isotonic(raw_scores)
    print(f"  Raw scores:           {raw_scores}")
    print(f"  Platt calibrated:     {[round(x, 4) for x in platt_calibrated]}")
    print(f"  Isotonic calibrated:  {[round(x, 4) for x in iso_calibrated]}")

    return {
        "platt_ece": platt_result.ece,
        "platt_mce": platt_result.mce,
        "platt_brier": platt_result.brier_score,
        "isotonic_ece": iso_result.ece,
        "isotonic_mce": iso_result.mce,
        "isotonic_brier": iso_result.brier_score,
    }


# ================================================================
# 6. MULTI-ENTITY ANOMALY DETECTION
# ================================================================
def validate_group_anomalies() -> dict:
    header("6. MULTI-ENTITY ANOMALY DETECTION")
    detector = GroupAnomalyDetector()
    base = datetime(2026, 3, 20, 8, 0, 0, tzinfo=timezone.utc)

    # Historical baseline: 2-3 entities per location per time window
    historical = []
    rng = np.random.default_rng(42)
    for day in range(7):
        for hour in [8, 12, 17]:
            t = base - timedelta(days=day + 1) + timedelta(hours=hour)
            for j in range(int(rng.integers(2, 4))):
                historical.append({
                    "entity_id": f"Regular_{j}",
                    "timestamp": t + timedelta(seconds=int(rng.integers(0, 60))),
                    "location_id": "Loc_Main",
                    "location_name": "Main Plaza",
                    "co_occurring_entities": [],
                })

    # Current: unusual gathering of 8 entities
    print("\nScenario A: Unusual gathering (12 entities at once)")
    current_gathering = []
    t_now = base
    for i in range(12):
        current_gathering.append({
            "entity_id": f"Gather_{i}",
            "timestamp": t_now + timedelta(seconds=i * 10),
            "location_id": "Loc_Main",
            "location_name": "Main Plaza",
            "co_occurring_entities": [f"Gather_{j}" for j in range(12) if j != i],
        })

    result_a = detector.detect(current_gathering, historical, t_now)
    print(f"  Anomalies detected: {len(result_a.anomalies)}")
    for a in result_a.anomalies:
        print(f"    Type: {a.anomaly_type}")
        print(f"    Score: {a.anomaly_score:.4f}, Confidence: {a.confidence:.4f}")
        print(f"    Entities: {len(a.involved_entities)} entities")
        print(f"    Baseline: {a.baseline_metric:.2f}, Observed: {a.observed_metric:.2f}, Z: {a.z_score:.4f}")
        print(f"    Explanation: {a.explanation}")
        if a.evidence:
            for k, v in a.evidence.items():
                print(f"      {k}: {v}")
    print(f"  Density change: {result_a.density_change:.4f}")
    print(f"  Clusters: {result_a.clusters_detected}")

    # Scenario B: Interaction surge
    print("\nScenario B: Interaction surge (many new connections)")
    current_surge = []
    for i in range(6):
        for j in range(i + 1, 6):
            t = t_now + timedelta(minutes=i * 2 + j)
            current_surge.append({
                "entity_id": f"Surge_{i}",
                "timestamp": t,
                "location_id": f"Loc_{j % 3}",
                "location_name": f"Location {j % 3}",
                "co_occurring_entities": [f"Surge_{j}"],
            })

    result_b = detector.detect(current_surge, historical, t_now)
    print(f"  Anomalies detected: {len(result_b.anomalies)}")
    for a in result_b.anomalies:
        print(f"    Type: {a.anomaly_type}, Score: {a.anomaly_score:.4f}")
        print(f"    Explanation: {a.explanation}")

    return {
        "gathering_anomalies": len(result_a.anomalies),
        "surge_anomalies": len(result_b.anomalies),
        "density_change": result_a.density_change,
    }


# ================================================================
# 7. SYSTEM-LEVEL EXPLANATION
# ================================================================
def validate_explanation() -> dict:
    header("7. SYSTEM-LEVEL EXPLANATION")
    explainer = SystemExplainer()
    detector = CoordinationDetector()
    seq_detector = SequenceDetector(min_support=3)
    group_detector = GroupAnomalyDetector()
    risk_engine = RiskPropagationEngine()

    base = datetime(2026, 3, 20, 8, 0, 0, tzinfo=timezone.utc)

    # Build a realistic multi-module scenario
    events = []
    for i in range(10):
        t = base + timedelta(hours=i * 2)
        events.append({"entity_id": "Alpha", "timestamp": t, "location_id": "HQ", "location_name": "HQ", "co_occurring_entities": ["Beta"]})
        events.append({"entity_id": "Beta", "timestamp": t + timedelta(minutes=3), "location_id": "HQ", "location_name": "HQ", "co_occurring_entities": ["Alpha"]})
        events.append({"entity_id": "Gamma", "timestamp": t + timedelta(minutes=7), "location_id": "Warehouse", "location_name": "Warehouse", "co_occurring_entities": []})

    # Run each module
    coordination = detector.detect(events)
    sequences = seq_detector.detect(events)
    group_anomalies = group_detector.detect(events, events)
    propagated = risk_engine.propagate(
        {"Alpha": 0.8, "Beta": 0.4, "Gamma": 0.2},
        {
            "Alpha": [{"entity_id": "Beta", "weight": 0.7}],
            "Beta": [{"entity_id": "Alpha", "weight": 0.7}, {"entity_id": "Gamma", "weight": 0.3}],
            "Gamma": [{"entity_id": "Beta", "weight": 0.3}],
        },
    )

    # Synthesize
    explanation = explainer.synthesize_system_alert(
        coordination=coordination,
        propagated_risks=propagated,
        sequences=sequences,
        group_anomalies=group_anomalies,
    )

    print(f"\n  Alert ID: {explanation.alert_id}")
    print(f"  Alert type: {explanation.alert_type}")
    print(f"  Summary: {explanation.summary}")
    print(f"\n  Pattern description: {explanation.pattern_description}")
    print(f"\n  Contributing entities ({len(explanation.contributing_entities)}):")
    for ce in explanation.contributing_entities[:10]:
        print(f"    {ce}")
    print(f"\n  Risk propagation chain ({len(explanation.risk_propagation_chain)}):")
    for chain in explanation.risk_propagation_chain[:5]:
        print(f"    {chain}")
    print(f"\n  Statistical significance:")
    for k, v in explanation.statistical_significance.items():
        print(f"    {k}: {v}")
    print(f"\n  Recommended actions ({len(explanation.recommended_actions)}):")
    for action in explanation.recommended_actions:
        print(f"    - {action}")
    print(f"\n  Overall confidence: {explanation.confidence:.4f}")

    return {
        "contributing_entities": len(explanation.contributing_entities),
        "recommended_actions": len(explanation.recommended_actions),
        "overall_confidence": explanation.confidence,
        "alert_type": explanation.alert_type,
    }


# ================================================================
# 8. EVALUATION FRAMEWORK
# ================================================================
def validate_evaluation() -> dict:
    header("8. EVALUATION FRAMEWORK")
    evaluator = IntelligenceEvaluator()

    start = time.time()
    results = evaluator.run_full_evaluation()
    elapsed = time.time() - start
    print(f"\n  Evaluation completed in {elapsed:.2f}s")

    for module_name, metrics in results.items():
        subheader(f"Module: {module_name}")
        if isinstance(metrics, dict):
            for k, v in metrics.items():
                if isinstance(v, dict):
                    print(f"  {k}:")
                    for k2, v2 in v.items():
                        print(f"    {k2}: {v2}")
                elif isinstance(v, float):
                    print(f"  {k}: {v:.4f}")
                else:
                    print(f"  {k}: {v}")
        else:
            print(f"  {metrics}")

    return {"modules_evaluated": len(results), "elapsed_seconds": elapsed}


# ================================================================
# MAIN
# ================================================================
def main() -> None:
    print("=" * 72)
    print("  VIOSINT System-Level Intelligence Validation")
    print("  Running all 8 new modules with synthetic scenarios")
    print("=" * 72)

    all_results = {}
    total_start = time.time()

    all_results["coordination"] = validate_coordination()
    all_results["risk_propagation"] = validate_risk_propagation()
    all_results["sequences"] = validate_sequences()
    all_results["adaptive_risk"] = validate_adaptive_risk()
    all_results["calibration"] = validate_calibration()
    all_results["group_anomalies"] = validate_group_anomalies()
    all_results["explanation"] = validate_explanation()
    all_results["evaluation"] = validate_evaluation()

    total_elapsed = time.time() - total_start

    header("SUMMARY")
    print(f"\n  Total validation time: {total_elapsed:.2f}s")
    print(f"\n  Results by module:")
    for module, results in all_results.items():
        print(f"\n  {module}:")
        for k, v in results.items():
            if isinstance(v, float):
                print(f"    {k}: {v:.4f}")
            else:
                print(f"    {k}: {v}")

    print(f"\n{'='*72}")
    print("  VALIDATION COMPLETE")
    print(f"{'='*72}")


if __name__ == "__main__":
    main()
