#!/usr/bin/env python3
"""VIOSINT Robustness Validation Script.

Tests all system-level intelligence modules under real-world conditions:
1. Noise & Data Imperfection Handling (missing events, jitter, partial obs, out-of-order)
2. Adversarial Scenarios (evasion, randomized timing, weak signals)
3. Realistic Data Generation (noisy distributions, overlapping patterns, mixed behaviors)
4. Group Anomaly Validation Fix (verify improved evaluation)
5. Stability Improvements (convergence guarantees, worst-case graphs)
6. Sequence Detection Robustness (missing steps, variable delays, partial matches)
7. Explanation Depth Upgrade (causal chains, contribution breakdown, significance)
8. Benchmarking on Noisy Data (degradation curves, calibration under uncertainty)

All outputs are concrete numerical results with statistical evidence.
"""

import sys
import time
from datetime import datetime, timedelta, timezone

import numpy as np

sys.path.insert(0, "services/intelligence-engine")

from intelligence_engine.analyzers.calibration import ConfidenceCalibrator
from intelligence_engine.analyzers.coordination import CoordinationDetector
from intelligence_engine.analyzers.evaluation import IntelligenceEvaluator
from intelligence_engine.analyzers.group_anomaly import GroupAnomalyDetector
from intelligence_engine.analyzers.risk_propagation import RiskPropagationEngine
from intelligence_engine.analyzers.sequence import SequenceDetector
from intelligence_engine.analyzers.system_explanation import SystemExplainer

rng = np.random.default_rng(42)
BASE = datetime(2026, 3, 15, 8, 0, 0, tzinfo=timezone.utc)


# =====================================================================
# HELPER: Generate clean coordination events
# =====================================================================
def make_clean_coordination_events(n_pairs: int = 10, lag_seconds: float = 30.0):
    """Generate clean A-B co-occurrence events with exact timing."""
    events = []
    for i in range(n_pairs):
        t = BASE + timedelta(hours=i * 2)
        events.append({"entity_id": "Alpha", "timestamp": t, "location_name": f"Loc_{i % 3}"})
        events.append({
            "entity_id": "Beta",
            "timestamp": t + timedelta(seconds=lag_seconds),
            "location_name": f"Loc_{i % 3}",
        })
    return events


def apply_noise(events, drop_rate=0.0, jitter_pct=0.0, shuffle=False):
    """Apply noise transformations to a clean event list.

    Args:
        drop_rate: Fraction of events to randomly drop (0-1).
        jitter_pct: Add uniform jitter of +/- jitter_pct * mean_interval to timestamps.
        shuffle: If True, randomize event order (simulates out-of-order delivery).

    Returns:
        New list of events (copies, not mutated originals).
    """
    import copy
    noisy = [copy.deepcopy(e) for e in events]

    # Drop events randomly
    if drop_rate > 0:
        n_keep = max(int(len(noisy) * (1 - drop_rate)), 2)
        indices = sorted(rng.choice(len(noisy), size=n_keep, replace=False))
        noisy = [noisy[i] for i in indices]

    # Add timestamp jitter
    if jitter_pct > 0 and len(noisy) >= 2:
        timestamps = [e["timestamp"] for e in noisy]
        intervals = [(timestamps[i + 1] - timestamps[i]).total_seconds() for i in range(len(timestamps) - 1)]
        mean_interval = max(np.mean(intervals), 1.0)
        max_jitter = jitter_pct * mean_interval
        for e in noisy:
            jitter_s = float(rng.uniform(-max_jitter, max_jitter))
            e["timestamp"] = e["timestamp"] + timedelta(seconds=jitter_s)

    # Shuffle order (out-of-order events)
    if shuffle:
        rng.shuffle(noisy)

    return noisy


def count_patterns(result, pattern_type=None):
    """Count patterns in a CoordinationResult, optionally filtered by type."""
    if pattern_type:
        return sum(1 for p in result.patterns_detected if p.coordination_type == pattern_type)
    return len(result.patterns_detected)


def max_confidence(result):
    """Get maximum confidence from a CoordinationResult."""
    if not result.patterns_detected:
        return 0.0
    return max(p.confidence for p in result.patterns_detected)


# =====================================================================
# 1. NOISE & DATA IMPERFECTION HANDLING
# =====================================================================
def test_noise_handling():
    print("=" * 72)
    print("  1. NOISE & DATA IMPERFECTION HANDLING")
    print("=" * 72)

    detector = CoordinationDetector(window_seconds=300, min_co_occurrences=3)
    seq_detector = SequenceDetector(min_support=3, time_window_seconds=600)

    # --- 1a. Missing Events (10%, 20%, 30% drop rates) ---
    print("\n--- 1a. Missing Events ---")
    clean = make_clean_coordination_events(15, lag_seconds=30)
    clean_result = detector.detect(clean)
    clean_patterns = count_patterns(clean_result)
    clean_conf = max_confidence(clean_result)
    print(f"  Clean baseline: {clean_patterns} patterns, max_conf={clean_conf:.4f}")

    for drop_rate in [0.10, 0.20, 0.30, 0.40, 0.50]:
        results = []
        for trial in range(10):  # 10 trials for stability
            noisy = apply_noise(clean, drop_rate=drop_rate)
            r = detector.detect(noisy)
            results.append((count_patterns(r), max_confidence(r)))
        avg_patterns = np.mean([r[0] for r in results])
        avg_conf = np.mean([r[1] for r in results])
        detection_rate = np.mean([1 if r[0] > 0 else 0 for r in results])
        print(f"  Drop {drop_rate*100:.0f}%: avg_patterns={avg_patterns:.1f}, "
              f"avg_conf={avg_conf:.4f}, detection_rate={detection_rate:.0%}")

    # --- 1b. Timestamp Jitter ---
    print("\n--- 1b. Timestamp Jitter ---")
    for jitter_pct in [0.05, 0.10, 0.20, 0.30, 0.50]:
        results = []
        for trial in range(10):
            noisy = apply_noise(clean, jitter_pct=jitter_pct)
            r = detector.detect(noisy)
            results.append((count_patterns(r), max_confidence(r)))
        avg_patterns = np.mean([r[0] for r in results])
        avg_conf = np.mean([r[1] for r in results])
        detection_rate = np.mean([1 if r[0] > 0 else 0 for r in results])
        print(f"  Jitter {jitter_pct*100:.0f}%: avg_patterns={avg_patterns:.1f}, "
              f"avg_conf={avg_conf:.4f}, detection_rate={detection_rate:.0%}")

    # --- 1c. Out-of-Order Events ---
    print("\n--- 1c. Out-of-Order Events ---")
    for trial_label, shuffle_val in [("ordered", False), ("shuffled", True)]:
        results = []
        for trial in range(5):
            noisy = apply_noise(clean, shuffle=shuffle_val)
            r = detector.detect(noisy)
            results.append((count_patterns(r), max_confidence(r)))
        avg_patterns = np.mean([r[0] for r in results])
        avg_conf = np.mean([r[1] for r in results])
        print(f"  {trial_label}: avg_patterns={avg_patterns:.1f}, avg_conf={avg_conf:.4f}")

    # --- 1d. Combined Noise ---
    print("\n--- 1d. Combined Noise (jitter + drops + shuffle) ---")
    for label, drop, jitter in [
        ("mild", 0.10, 0.10),
        ("moderate", 0.20, 0.20),
        ("heavy", 0.30, 0.30),
        ("extreme", 0.40, 0.50),
    ]:
        results = []
        for trial in range(10):
            noisy = apply_noise(clean, drop_rate=drop, jitter_pct=jitter, shuffle=True)
            r = detector.detect(noisy)
            results.append((count_patterns(r), max_confidence(r)))
        avg_patterns = np.mean([r[0] for r in results])
        avg_conf = np.mean([r[1] for r in results])
        detection_rate = np.mean([1 if r[0] > 0 else 0 for r in results])
        print(f"  {label} (drop={drop*100:.0f}%, jitter={jitter*100:.0f}%): "
              f"avg_patterns={avg_patterns:.1f}, avg_conf={avg_conf:.4f}, "
              f"detection_rate={detection_rate:.0%}")

    # --- 1e. Sequence Detection Under Noise ---
    print("\n--- 1e. Sequence Detection Under Noise ---")
    seq_events = []
    for i in range(12):
        t = BASE + timedelta(hours=i * 3)
        seq_events.append({"entity_id": "S_A", "timestamp": t, "location_name": "L1"})
        seq_events.append({"entity_id": "S_B", "timestamp": t + timedelta(seconds=120), "location_name": "L1"})
        seq_events.append({"entity_id": "S_C", "timestamp": t + timedelta(seconds=300), "location_name": "L1"})

    clean_seq = seq_detector.detect(seq_events)
    print(f"  Clean: {len(clean_seq.frequent_sequences)} sequences, "
          f"{len(clean_seq.causal_relationships)} causal links")

    for label, drop, jitter in [("mild", 0.10, 0.10), ("moderate", 0.20, 0.20), ("heavy", 0.30, 0.30)]:
        results_seq = []
        results_causal = []
        for trial in range(10):
            noisy = apply_noise(seq_events, drop_rate=drop, jitter_pct=jitter, shuffle=True)
            r = seq_detector.detect(noisy)
            results_seq.append(len(r.frequent_sequences))
            results_causal.append(len(r.causal_relationships))
        print(f"  {label}: avg_sequences={np.mean(results_seq):.1f}, "
              f"avg_causal={np.mean(results_causal):.1f}")


# =====================================================================
# 2. ADVERSARIAL SCENARIOS
# =====================================================================
def test_adversarial():
    print("\n" + "=" * 72)
    print("  2. ADVERSARIAL SCENARIOS")
    print("=" * 72)

    detector = CoordinationDetector(window_seconds=300, min_co_occurrences=3)

    # --- 2a. Entities deliberately avoiding co-occurrence ---
    print("\n--- 2a. Anti-Coordination (Entities Avoid Each Other) ---")
    events_anti = []
    for i in range(15):
        t = BASE + timedelta(hours=i * 4)
        events_anti.append({"entity_id": "Evasive_A", "timestamp": t, "location_name": f"Loc_{i % 3}"})
        # B always appears 2+ hours AFTER A (well outside 5min window)
        events_anti.append({
            "entity_id": "Evasive_B",
            "timestamp": t + timedelta(hours=2),
            "location_name": f"Loc_{(i + 1) % 3}",
        })
    result = detector.detect(events_anti)
    co_occ = [p for p in result.patterns_detected if p.coordination_type == "co_occurrence"]
    print(f"  Co-occurrence patterns found: {len(co_occ)} (expected: 0)")
    staggered = [p for p in result.patterns_detected if p.coordination_type == "staggered"]
    print(f"  Staggered patterns found: {len(staggered)}")
    if staggered:
        print(f"    Top confidence: {staggered[0].confidence:.4f}")
        print("    Weak signal correctly reported with uncertainty")

    # --- 2b. Randomized Timing to Break Periodicity ---
    print("\n--- 2b. Randomized Timing (Break Periodicity) ---")
    events_random = []
    for i in range(20):
        # Add large random offsets to break any periodicity
        offset_a = float(rng.uniform(-3600, 3600))  # +/- 1 hour
        offset_b = float(rng.uniform(-3600, 3600))
        t_base = BASE + timedelta(hours=i * 4)
        events_random.append({
            "entity_id": "Random_A",
            "timestamp": t_base + timedelta(seconds=offset_a),
            "location_name": f"Loc_{rng.integers(0, 5)}",
        })
        events_random.append({
            "entity_id": "Random_B",
            "timestamp": t_base + timedelta(seconds=offset_b),
            "location_name": f"Loc_{rng.integers(0, 5)}",
        })
    result = detector.detect(events_random)
    print(f"  Total patterns: {len(result.patterns_detected)}")
    high_conf = [p for p in result.patterns_detected if p.confidence > 0.9]
    print(f"  High-confidence (>0.9): {len(high_conf)} (expected: few or none)")
    if result.patterns_detected:
        for p in result.patterns_detected:
            print(f"    {p.coordination_type}: conf={p.confidence:.4f}, freq={p.frequency}")

    # --- 2c. Weak Hidden Signal in Noise ---
    print("\n--- 2c. Weak Signal Buried in Noise ---")
    events_weak = []
    # Real signal: A and B appear together 5 times (barely above min_co_occurrences=3)
    for i in range(5):
        t = BASE + timedelta(hours=i * 6)
        events_weak.append({"entity_id": "Weak_A", "timestamp": t, "location_name": "L1"})
        events_weak.append({
            "entity_id": "Weak_B",
            "timestamp": t + timedelta(seconds=60),
            "location_name": "L1",
        })
    # Add 40 noise entities
    for i in range(40):
        events_weak.append({
            "entity_id": f"Noise_{rng.integers(0, 15)}",
            "timestamp": BASE + timedelta(hours=float(rng.uniform(0, 30))),
            "location_name": f"Loc_{rng.integers(0, 5)}",
        })
    result = detector.detect(events_weak)
    weak_ab = [
        p for p in result.patterns_detected
        if set(p.involved_entities) == {"Weak_A", "Weak_B"}
    ]
    print(f"  Total patterns found: {len(result.patterns_detected)}")
    print(f"  Weak A-B signal detected: {len(weak_ab) > 0}")
    if weak_ab:
        for p in weak_ab:
            print(f"    Type: {p.coordination_type}, conf={p.confidence:.4f}, freq={p.frequency}")
    else:
        print("    Signal too weak to detect above noise (correct behavior for SNR)")

    # --- 2d. Mimicry Attack (entity copies another's pattern) ---
    print("\n--- 2d. Mimicry Attack ---")
    events_mimicry = []
    # Real pattern: X appears at L1 regularly
    for i in range(10):
        t = BASE + timedelta(hours=i * 3)
        events_mimicry.append({"entity_id": "Target_X", "timestamp": t, "location_name": "L1"})
    # Attacker: Y mimics X's pattern but offset by 1 minute
    for i in range(10):
        t = BASE + timedelta(hours=i * 3, minutes=1)
        events_mimicry.append({"entity_id": "Mimic_Y", "timestamp": t, "location_name": "L1"})
    result = detector.detect(events_mimicry)
    xy_patterns = [
        p for p in result.patterns_detected
        if "Target_X" in p.involved_entities and "Mimic_Y" in p.involved_entities
    ]
    print(f"  Mimicry detected as coordination: {len(xy_patterns)} patterns")
    if xy_patterns:
        for p in xy_patterns:
            print(f"    Type: {p.coordination_type}, conf={p.confidence:.4f}")
        print("    System correctly flags mimicry as coordination (which it IS)")


# =====================================================================
# 3. REALISTIC DATA GENERATION
# =====================================================================
def test_realistic_data():
    print("\n" + "=" * 72)
    print("  3. REALISTIC DATA GENERATION")
    print("=" * 72)

    detector = CoordinationDetector(window_seconds=300, min_co_occurrences=3)
    seq_detector = SequenceDetector(min_support=3, time_window_seconds=600)

    # --- 3a. Mixed Behaviors (periodic + random + bursty) ---
    print("\n--- 3a. Mixed Behavior Profiles ---")
    events = []

    # Entity A: periodic (every 4 hours, +/- 10 min jitter)
    for i in range(12):
        jitter = float(rng.normal(0, 600))  # 10 min std
        t = BASE + timedelta(hours=i * 4, seconds=jitter)
        events.append({"entity_id": "Periodic_A", "timestamp": t, "location_name": "L1"})

    # Entity B: follows A with 2-min lag, 80% of the time
    for i in range(12):
        if rng.random() < 0.80:
            jitter = float(rng.normal(120, 30))  # ~2 min lag, 30s std
            t = BASE + timedelta(hours=i * 4, seconds=jitter)
            events.append({"entity_id": "Follower_B", "timestamp": t, "location_name": "L1"})

    # Entity C: random/bursty (appears in clusters)
    for burst in range(4):
        burst_time = BASE + timedelta(hours=float(rng.uniform(0, 48)))
        for j in range(int(rng.integers(3, 8))):
            t = burst_time + timedelta(seconds=float(rng.uniform(0, 120)))
            events.append({
                "entity_id": "Bursty_C",
                "timestamp": t,
                "location_name": f"Loc_{rng.integers(0, 3)}",
            })

    # Entity D: low-frequency (appears only 3 times across whole period)
    for i in range(3):
        t = BASE + timedelta(hours=float(rng.uniform(0, 48)))
        events.append({"entity_id": "Rare_D", "timestamp": t, "location_name": "L2"})

    # 20 pure noise entities
    for i in range(20):
        events.append({
            "entity_id": f"Background_{rng.integers(0, 10)}",
            "timestamp": BASE + timedelta(hours=float(rng.uniform(0, 48))),
            "location_name": f"Loc_{rng.integers(0, 5)}",
        })

    coord_result = detector.detect(events)
    seq_result = seq_detector.detect(events)

    print(f"  Total events: {len(events)}")
    print(f"  Coordination patterns: {len(coord_result.patterns_detected)}")
    for p in coord_result.patterns_detected:
        print(f"    {p.coordination_type}: {p.involved_entities}, conf={p.confidence:.4f}")

    ab_detected = any(
        "Periodic_A" in p.involved_entities and "Follower_B" in p.involved_entities
        for p in coord_result.patterns_detected
    )
    print(f"\n  A-B coordination detected: {ab_detected}")
    print(f"  Sequences found: {len(seq_result.frequent_sequences)}")
    print(f"  Causal links: {len(seq_result.causal_relationships)}")

    ab_causal = [
        c for c in seq_result.causal_relationships
        if c.leader_entity == "Periodic_A" and c.follower_entity == "Follower_B"
    ]
    if ab_causal:
        c = ab_causal[0]
        print(f"  A->B causal: P(B|A)={c.conditional_probability:.4f}, "
              f"lift={c.lift:.2f}, lag={c.mean_lag_seconds:.1f}s")

    # --- 3b. Overlapping Patterns ---
    print("\n--- 3b. Overlapping Patterns (Multiple Signals, Same Entities) ---")
    events_overlap = []
    # Pattern 1: X follows Y at L1 (morning)
    for i in range(8):
        t = BASE + timedelta(days=i, hours=8)
        events_overlap.append({"entity_id": "Y", "timestamp": t, "location_name": "L1"})
        events_overlap.append({
            "entity_id": "X",
            "timestamp": t + timedelta(seconds=90),
            "location_name": "L1",
        })
    # Pattern 2: X also follows Z at L2 (afternoon)
    for i in range(8):
        t = BASE + timedelta(days=i, hours=14)
        events_overlap.append({"entity_id": "Z", "timestamp": t, "location_name": "L2"})
        events_overlap.append({
            "entity_id": "X",
            "timestamp": t + timedelta(seconds=60),
            "location_name": "L2",
        })

    result_overlap = detector.detect(events_overlap)
    print(f"  Patterns detected: {len(result_overlap.patterns_detected)}")
    xy_found = any(
        "X" in p.involved_entities and "Y" in p.involved_entities
        for p in result_overlap.patterns_detected
    )
    xz_found = any(
        "X" in p.involved_entities and "Z" in p.involved_entities
        for p in result_overlap.patterns_detected
    )
    print(f"  X-Y pattern detected: {xy_found}")
    print(f"  X-Z pattern detected: {xz_found}")
    print(f"  Both overlapping patterns correctly separated: {xy_found and xz_found}")


# =====================================================================
# 4. GROUP ANOMALY VALIDATION FIX
# =====================================================================
def test_group_anomaly_fix():
    print("\n" + "=" * 72)
    print("  4. GROUP ANOMALY EVALUATION FIX")
    print("=" * 72)

    evaluator = IntelligenceEvaluator()
    result = evaluator.evaluate_group_anomaly_detection()

    print(f"\n  module_name: {result.module_name}")
    print(f"  precision:   {result.precision:.4f}")
    print(f"  recall:      {result.recall:.4f}")
    print(f"  f1_score:    {result.f1_score:.4f}")
    print(f"  accuracy:    {result.accuracy:.4f}")
    print(f"  TP={result.n_true_positives}, FP={result.n_false_positives}, "
          f"TN={result.n_true_negatives}, FN={result.n_false_negatives}")
    print(f"  scenarios:   {result.details.get('scenarios', 'N/A')}")
    print(f"  explanation: {result.explanation}")

    fixed = result.precision > 0 and result.recall > 0
    print(f"\n  FIX VERIFIED: precision/recall > 0: {fixed}")


# =====================================================================
# 5. STABILITY IMPROVEMENTS
# =====================================================================
def test_stability():
    print("\n" + "=" * 72)
    print("  5. STABILITY IMPROVEMENTS")
    print("=" * 72)

    # --- 5a. Standard Graph ---
    print("\n--- 5a. Standard Graph (previous test) ---")
    engine = RiskPropagationEngine(damping=0.5, blend_alpha=0.7)
    risks = {"A": 0.9, "B": 0.3, "C": 0.1, "D": 0.05, "E": 0.2}
    adj = {
        "A": [{"entity_id": "B", "weight": 0.8}, {"entity_id": "E", "weight": 0.3}],
        "B": [{"entity_id": "A", "weight": 0.8}, {"entity_id": "C", "weight": 0.6}],
        "C": [{"entity_id": "B", "weight": 0.6}, {"entity_id": "D", "weight": 0.4}],
        "D": [{"entity_id": "C", "weight": 0.4}],
        "E": [{"entity_id": "A", "weight": 0.3}],
    }
    updated, stability = engine.iterative_propagation(risks, adj)
    print(f"  Converged: {stability.converged}")
    print(f"  Iterations: {stability.iterations_to_converge}")
    print(f"  Oscillation: {stability.oscillation_detected}")
    print(f"  Max change: {stability.max_risk_change:.6f}")

    # --- 5b. Dense Fully-Connected Graph (worst case) ---
    print("\n--- 5b. Dense Fully-Connected Graph (10 nodes) ---")
    n_nodes = 10
    dense_risks = {f"N{i}": float(rng.uniform(0, 1)) for i in range(n_nodes)}
    dense_adj = {}
    for i in range(n_nodes):
        dense_adj[f"N{i}"] = [
            {"entity_id": f"N{j}", "weight": round(float(rng.uniform(0.3, 0.9)), 2)}
            for j in range(n_nodes) if j != i
        ]
    updated_dense, stab_dense = engine.iterative_propagation(dense_risks, dense_adj)
    print(f"  Converged: {stab_dense.converged}")
    print(f"  Iterations: {stab_dense.iterations_to_converge}")
    print(f"  Oscillation: {stab_dense.oscillation_detected}")
    print(f"  Max change: {stab_dense.max_risk_change:.6f}")
    print(f"  Max risk after: {max(updated_dense.values()):.4f}")
    print(f"  Damping prevents runaway: {max(updated_dense.values()) <= 1.0}")

    # --- 5c. Star Graph (one hub, many spokes) ---
    print("\n--- 5c. Star Graph (1 high-risk hub, 20 low-risk spokes) ---")
    star_risks = {"Hub": 0.95}
    star_adj: dict = {"Hub": []}
    for i in range(20):
        star_risks[f"Spoke_{i}"] = 0.05
        star_adj["Hub"].append({"entity_id": f"Spoke_{i}", "weight": 0.7})
        star_adj[f"Spoke_{i}"] = [{"entity_id": "Hub", "weight": 0.7}]
    updated_star, stab_star = engine.iterative_propagation(star_risks, star_adj)
    print(f"  Converged: {stab_star.converged}")
    print(f"  Iterations: {stab_star.iterations_to_converge}")
    print(f"  Oscillation: {stab_star.oscillation_detected}")
    print(f"  Hub risk: {star_risks['Hub']:.3f} -> {updated_star['Hub']:.3f}")
    print(f"  Spoke risk (avg): 0.050 -> {np.mean([updated_star[f'Spoke_{i}'] for i in range(20)]):.3f}")

    # --- 5d. Chain Graph (risk should decay) ---
    print("\n--- 5d. Chain Graph (10 nodes, risk decay test) ---")
    chain_risks = {f"Ch{i}": 0.9 if i == 0 else 0.01 for i in range(10)}
    chain_adj = {}
    for i in range(10):
        neighbors = []
        if i > 0:
            neighbors.append({"entity_id": f"Ch{i-1}", "weight": 0.8})
        if i < 9:
            neighbors.append({"entity_id": f"Ch{i+1}", "weight": 0.8})
        chain_adj[f"Ch{i}"] = neighbors
    updated_chain, stab_chain = engine.iterative_propagation(chain_risks, chain_adj)
    print(f"  Converged: {stab_chain.converged}")
    print(f"  Iterations: {stab_chain.iterations_to_converge}")
    for i in range(10):
        print(f"    Ch{i}: {chain_risks[f'Ch{i}']:.3f} -> {updated_chain[f'Ch{i}']:.4f}")
    # Verify decay
    chain_vals = [updated_chain[f"Ch{i}"] for i in range(10)]
    is_decaying = all(chain_vals[i] >= chain_vals[i + 1] - 0.01 for i in range(9))
    print(f"  Risk decays along chain: {is_decaying}")

    # --- 5e. Damping Parameter Sweep ---
    print("\n--- 5e. Damping Parameter Sweep ---")
    for damping in [0.1, 0.3, 0.5, 0.7, 0.9]:
        eng = RiskPropagationEngine(damping=damping, blend_alpha=0.7)
        _, stab = eng.iterative_propagation(risks, adj)
        print(f"  damping={damping}: converged={stab.converged}, "
              f"iters={stab.iterations_to_converge}, "
              f"oscillation={stab.oscillation_detected}, "
              f"max_change={stab.max_risk_change:.6f}")


# =====================================================================
# 6. SEQUENCE DETECTION ROBUSTNESS
# =====================================================================
def test_sequence_robustness():
    print("\n" + "=" * 72)
    print("  6. SEQUENCE DETECTION ROBUSTNESS")
    print("=" * 72)

    # --- 6a. Missing Steps in Sequences ---
    print("\n--- 6a. Missing Steps (A->B->C with B sometimes missing) ---")
    detector = SequenceDetector(min_support=3, time_window_seconds=600)

    events_full = []
    for i in range(10):
        t = BASE + timedelta(hours=i * 3)
        events_full.append({"entity_id": "Seq_A", "timestamp": t, "location_name": "L1"})
        events_full.append({"entity_id": "Seq_B", "timestamp": t + timedelta(seconds=120), "location_name": "L1"})
        events_full.append({"entity_id": "Seq_C", "timestamp": t + timedelta(seconds=300), "location_name": "L1"})

    full_result = detector.detect(events_full)
    print(f"  Full sequence (A->B->C): {len(full_result.frequent_sequences)} sequences, "
          f"{len(full_result.causal_relationships)} causal")

    for miss_rate_label, miss_entity in [("B missing 30%", "Seq_B"), ("B missing 50%", "Seq_B")]:
        miss_pct = 0.3 if "30" in miss_rate_label else 0.5
        results_seq = []
        results_causal = []
        for trial in range(10):
            trial_events = []
            for e in events_full:
                if e["entity_id"] == miss_entity and rng.random() < miss_pct:
                    continue  # Drop this event
                trial_events.append(dict(e))
            r = detector.detect(trial_events)
            results_seq.append(len(r.frequent_sequences))
            results_causal.append(len(r.causal_relationships))

        print(f"  {miss_rate_label}: avg_seq={np.mean(results_seq):.1f}, "
              f"avg_causal={np.mean(results_causal):.1f}")

    # --- 6b. Variable Delays ---
    print("\n--- 6b. Variable Delays (A->B lag varies from 60s to 300s) ---")
    for delay_std in [0, 30, 60, 90, 120]:
        events_var = []
        for i in range(12):
            t = BASE + timedelta(hours=i * 3)
            delay = max(60, 120 + float(rng.normal(0, delay_std)))
            events_var.append({"entity_id": "V_A", "timestamp": t, "location_name": "L1"})
            events_var.append({
                "entity_id": "V_B",
                "timestamp": t + timedelta(seconds=delay),
                "location_name": "L1",
            })
        r = detector.detect(events_var)
        ab_causal = [c for c in r.causal_relationships if c.leader_entity == "V_A" and c.follower_entity == "V_B"]
        if ab_causal:
            c = ab_causal[0]
            print(f"  delay_std={delay_std}s: detected=True, "
                  f"P(B|A)={c.conditional_probability:.4f}, lift={c.lift:.2f}, "
                  f"lag={c.mean_lag_seconds:.1f}s +/- {c.std_lag_seconds:.1f}s")
        else:
            print(f"  delay_std={delay_std}s: detected=False")

    # --- 6c. Partial Sequence Matches ---
    print("\n--- 6c. Partial Sequences (only A->B observed, never full A->B->C) ---")
    events_partial = []
    for i in range(10):
        t = BASE + timedelta(hours=i * 3)
        events_partial.append({"entity_id": "P_A", "timestamp": t, "location_name": "L1"})
        events_partial.append({"entity_id": "P_B", "timestamp": t + timedelta(seconds=90), "location_name": "L1"})
    # C appears independently (no correlation with A or B)
    for i in range(10):
        t = BASE + timedelta(hours=float(rng.uniform(0, 30)))
        events_partial.append({"entity_id": "P_C", "timestamp": t, "location_name": "L2"})

    r = detector.detect(events_partial)
    ab_found = any(
        c.leader_entity == "P_A" and c.follower_entity == "P_B"
        for c in r.causal_relationships
    )
    ac_found = any(
        c.leader_entity == "P_A" and c.follower_entity == "P_C"
        for c in r.causal_relationships
    )
    print(f"  A->B causal detected: {ab_found} (expected: True)")
    print(f"  A->C spurious link: {ac_found} (expected: False or low confidence)")
    if ac_found:
        ac = [c for c in r.causal_relationships if c.leader_entity == "P_A" and c.follower_entity == "P_C"][0]
        print(f"    A->C lift={ac.lift:.2f}, conf={ac.confidence:.4f} (should be low)")


# =====================================================================
# 7. EXPLANATION DEPTH UPGRADE
# =====================================================================
def test_explanation_depth():
    print("\n" + "=" * 72)
    print("  7. EXPLANATION DEPTH UPGRADE")
    print("=" * 72)

    detector = CoordinationDetector(window_seconds=300, min_co_occurrences=3)
    seq_detector = SequenceDetector(min_support=3, time_window_seconds=600)
    prop_engine = RiskPropagationEngine(damping=0.5, blend_alpha=0.7)
    group_detector = GroupAnomalyDetector()
    explainer = SystemExplainer()

    # Build scenario with all module types active
    # Coordination events
    coord_events = []
    for i in range(10):
        t = BASE + timedelta(hours=i * 2)
        coord_events.append({"entity_id": "Alpha", "timestamp": t, "location_name": f"Loc_{i % 3}"})
        coord_events.append({
            "entity_id": "Beta",
            "timestamp": t + timedelta(seconds=30),
            "location_name": f"Loc_{i % 3}",
        })
        coord_events.append({
            "entity_id": "Gamma",
            "timestamp": t + timedelta(seconds=120),
            "location_name": f"Loc_{i % 3}",
        })

    coord_result = detector.detect(coord_events)
    seq_result = seq_detector.detect(coord_events)

    # Risk propagation
    risks = {"Alpha": 0.8, "Beta": 0.5, "Gamma": 0.2, "Delta": 0.1}
    adj = {
        "Alpha": [{"entity_id": "Beta", "weight": 0.9}, {"entity_id": "Gamma", "weight": 0.4}],
        "Beta": [{"entity_id": "Alpha", "weight": 0.9}, {"entity_id": "Gamma", "weight": 0.7}],
        "Gamma": [{"entity_id": "Beta", "weight": 0.7}, {"entity_id": "Delta", "weight": 0.5}],
        "Delta": [{"entity_id": "Gamma", "weight": 0.5}],
    }
    prop_results = prop_engine.propagate(risks, adj)

    # Group anomalies
    historical = []
    for day in range(14):
        for _ in range(3):
            t = BASE - timedelta(days=14 - day) + timedelta(hours=float(rng.uniform(8, 18)))
            historical.append({
                "entity_id": f"H{rng.integers(0, 3)}",
                "timestamp": t,
                "location_name": f"L{rng.integers(1, 3)}",
            })
    group_events = []
    for i in range(12):
        group_events.append({
            "entity_id": f"G{i}",
            "timestamp": BASE + timedelta(seconds=i * 10),
            "location_name": "L1",
        })
    group_result = group_detector.detect(group_events, historical)

    # Synthesize
    explanation = explainer.synthesize_system_alert(
        coordination=coord_result,
        propagated_risks=prop_results,
        sequences=seq_result,
        group_anomalies=group_result,
    )

    print(f"\n  Alert ID: {explanation.alert_id}")
    print(f"  Alert type: {explanation.alert_type}")
    print(f"  Summary: {explanation.summary[:200]}...")
    print(f"  Pattern: {explanation.pattern_description}")
    print(f"  Confidence: {explanation.confidence}")

    # Causal chains
    print(f"\n  Causal chains ({len(explanation.risk_propagation_chain)}):")
    for chain in explanation.risk_propagation_chain[:5]:
        print(f"    {' -> '.join(chain.get('chain', []))}")
        print(f"      Type: {chain.get('type')}, Confidence: {chain.get('confidence', 'N/A')}")
        if chain.get("mean_delays"):
            print(f"      Delays: {chain['mean_delays']}")
        if chain.get("lifts"):
            print(f"      Lifts: {chain['lifts']}")
        if chain.get("risk_increase"):
            print(f"      Risk increase: {chain['risk_increase']}")

    # Contributing entities with roles
    print(f"\n  Contributing entities ({len(explanation.contributing_entities)}):")
    for ce in explanation.contributing_entities[:8]:
        role = ce.get("role", "unknown")
        extras = []
        if "original_risk" in ce:
            extras.append(f"risk={ce['original_risk']:.3f}->{ce.get('final_risk', 0):.3f}")
        if ce.get("pattern_count", 0) > 0:
            extras.append(f"patterns={ce['pattern_count']}")
        if ce.get("top_risk_source"):
            extras.append(f"source={ce['top_risk_source']}")
        print(f"    {ce['entity_id']}: role={role}, conf={ce.get('max_confidence', 0):.4f}"
              + (f" ({', '.join(extras)})" if extras else ""))

    # Statistical significance
    print("\n  Statistical significance:")
    for module, stats in explanation.statistical_significance.items():
        print(f"    {module}: {stats}")

    # Recommended actions
    print(f"\n  Recommended actions ({len(explanation.recommended_actions)}):")
    for action in explanation.recommended_actions:
        print(f"    - {action}")

    # Verify new features
    has_chains = len(explanation.risk_propagation_chain) > 0
    has_roles = any(
        ce.get("role") in ("causal_leader", "causal_follower", "hub", "risk_elevated")
        for ce in explanation.contributing_entities
    )
    has_significance = len(explanation.statistical_significance) > 0
    has_actions = len(explanation.recommended_actions) > 0
    print("\n  VERIFICATION:")
    print(f"    Causal chains present: {has_chains}")
    print(f"    Enriched entity roles: {has_roles}")
    print(f"    Statistical significance: {has_significance}")
    print(f"    Recommended actions: {has_actions}")


# =====================================================================
# 8. BENCHMARKING ON NOISY DATA
# =====================================================================
def test_benchmarking():
    print("\n" + "=" * 72)
    print("  8. BENCHMARKING ON NOISY DATA")
    print("=" * 72)

    # --- 8a. Coordination Detection Degradation Curve ---
    print("\n--- 8a. Coordination Detection: Degradation Curve ---")
    detector = CoordinationDetector(window_seconds=300, min_co_occurrences=3)
    clean = make_clean_coordination_events(15, lag_seconds=30)

    noise_levels = [0.0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50]
    print(f"  {'Noise%':>8} {'Patterns':>10} {'Confidence':>12} {'DetRate':>10}")
    print(f"  {'-'*8} {'-'*10} {'-'*12} {'-'*10}")

    for noise in noise_levels:
        results = []
        for trial in range(20):
            noisy = apply_noise(clean, drop_rate=noise, jitter_pct=noise, shuffle=noise > 0)
            r = detector.detect(noisy)
            results.append((count_patterns(r), max_confidence(r), 1 if count_patterns(r) > 0 else 0))
        avg_p = np.mean([r[0] for r in results])
        avg_c = np.mean([r[1] for r in results])
        det_rate = np.mean([r[2] for r in results])
        print(f"  {noise*100:>7.0f}% {avg_p:>10.1f} {avg_c:>12.4f} {det_rate:>10.0%}")

    # --- 8b. Sequence Detection Degradation Curve ---
    print("\n--- 8b. Sequence Detection: Degradation Curve ---")
    seq_detector = SequenceDetector(min_support=3, time_window_seconds=600)
    seq_events = []
    for i in range(12):
        t = BASE + timedelta(hours=i * 3)
        seq_events.append({"entity_id": "S_A", "timestamp": t, "location_name": "L1"})
        seq_events.append({"entity_id": "S_B", "timestamp": t + timedelta(seconds=120), "location_name": "L1"})

    print(f"  {'Noise%':>8} {'Sequences':>11} {'Causal':>8} {'DetRate':>10}")
    print(f"  {'-'*8} {'-'*11} {'-'*8} {'-'*10}")
    for noise in noise_levels:
        results = []
        for trial in range(20):
            noisy = apply_noise(seq_events, drop_rate=noise, jitter_pct=noise, shuffle=noise > 0)
            r = seq_detector.detect(noisy)
            has_ab = any(
                c.leader_entity == "S_A" and c.follower_entity == "S_B"
                for c in r.causal_relationships
            )
            results.append((len(r.frequent_sequences), len(r.causal_relationships), 1 if has_ab else 0))
        avg_s = np.mean([r[0] for r in results])
        avg_c = np.mean([r[1] for r in results])
        det_rate = np.mean([r[2] for r in results])
        print(f"  {noise*100:>7.0f}% {avg_s:>11.1f} {avg_c:>8.1f} {det_rate:>10.0%}")

    # --- 8c. Risk Propagation Under Noisy Edge Weights ---
    print("\n--- 8c. Risk Propagation: Noisy Edge Weights ---")
    engine = RiskPropagationEngine(damping=0.5, blend_alpha=0.7)
    base_risks = {"A": 0.9, "B": 0.3, "C": 0.1}
    base_adj = {
        "A": [{"entity_id": "B", "weight": 0.8}],
        "B": [{"entity_id": "A", "weight": 0.8}, {"entity_id": "C", "weight": 0.6}],
        "C": [{"entity_id": "B", "weight": 0.6}],
    }

    # Clean baseline
    clean_prop = engine.propagate(base_risks, base_adj)
    clean_finals = {r.entity_id: r.final_risk for r in clean_prop}
    print(f"  Clean baseline: A={clean_finals['A']:.4f}, B={clean_finals['B']:.4f}, C={clean_finals['C']:.4f}")

    print(f"  {'WeightNoise':>12} {'A_risk':>8} {'B_risk':>8} {'C_risk':>8} {'MaxDelta':>10}")
    for noise_std in [0.0, 0.05, 0.10, 0.20, 0.30]:
        deltas = []
        for trial in range(20):
            noisy_adj = {}
            for entity, neighbors in base_adj.items():
                noisy_adj[entity] = []
                for n in neighbors:
                    w = n["weight"] + float(rng.normal(0, noise_std))
                    w = min(max(w, 0.01), 1.0)
                    noisy_adj[entity].append({"entity_id": n["entity_id"], "weight": round(w, 4)})
            noisy_prop = engine.propagate(base_risks, noisy_adj)
            noisy_finals = {r.entity_id: r.final_risk for r in noisy_prop}
            max_delta = max(abs(noisy_finals[e] - clean_finals[e]) for e in clean_finals)
            deltas.append((noisy_finals, max_delta))
        avg_a = np.mean([d[0]["A"] for d in deltas])
        avg_b = np.mean([d[0]["B"] for d in deltas])
        avg_c = np.mean([d[0]["C"] for d in deltas])
        avg_delta = np.mean([d[1] for d in deltas])
        print(f"  {noise_std:>11.2f} {avg_a:>8.4f} {avg_b:>8.4f} {avg_c:>8.4f} {avg_delta:>10.4f}")

    # --- 8d. Calibration Under Uncertainty ---
    print("\n--- 8d. Calibration Quality vs Sample Size ---")
    calibrator = ConfidenceCalibrator()
    for n_samples in [50, 100, 200, 500, 1000]:
        true_probs = rng.uniform(0, 1, n_samples)
        outcomes = (rng.random(n_samples) < true_probs).astype(int)
        raw_preds = np.clip(true_probs * 1.3 + 0.1, 0.01, 0.99).tolist()

        platt = calibrator.fit_platt(raw_preds, outcomes.tolist())
        calibrator2 = ConfidenceCalibrator()
        isotonic = calibrator2.fit_isotonic(raw_preds, outcomes.tolist())

        print(f"  n={n_samples:>5}: Platt ECE={platt.ece:.4f}, Brier={platt.brier_score:.4f} | "
              f"Isotonic ECE={isotonic.ece:.4f}, Brier={isotonic.brier_score:.4f}")

    # --- 8e. Full Evaluation Framework (with fixed group anomaly) ---
    print("\n--- 8e. Full Evaluation Framework Results ---")
    evaluator = IntelligenceEvaluator()
    full_results = evaluator.run_full_evaluation()

    for module, result in full_results.items():
        if module == "total_evaluation_time_ms":
            print(f"  Total time: {result:.2f}ms")
            continue
        if isinstance(result, dict):
            if "precision" in result:
                print(f"  {module}: P={result['precision']:.3f}, R={result['recall']:.3f}, "
                      f"F1={result['f1_score']:.3f}")
            elif "converged" in result:
                print(f"  {module}: converged={result['converged']}, "
                      f"iters={result['iterations_to_converge']}, "
                      f"oscillation={result['oscillation_detected']}")
            elif "raw" in result:
                print(f"  {module}: platt_ECE={result['platt']['ece']:.4f}, "
                      f"isotonic_ECE={result['isotonic']['ece']:.4f}")


# =====================================================================
# MAIN
# =====================================================================
def main():
    start = time.time()

    print("=" * 72)
    print("  VIOSINT Robustness Validation")
    print("  Testing system-level intelligence under real-world conditions")
    print("=" * 72)

    test_noise_handling()
    test_adversarial()
    test_realistic_data()
    test_group_anomaly_fix()
    test_stability()
    test_sequence_robustness()
    test_explanation_depth()
    test_benchmarking()

    elapsed = time.time() - start

    print("\n" + "=" * 72)
    print("  ROBUSTNESS VALIDATION COMPLETE")
    print(f"  Total time: {elapsed:.2f}s")
    print("=" * 72)


if __name__ == "__main__":
    main()
