"""Evaluation Framework for Intelligence Modules.

Provides measurable evaluation metrics for:
1. Coordination detection precision/recall (synthetic scenarios)
2. Sequence prediction accuracy
3. Risk propagation stability
4. Calibration error (ECE, Brier score)
5. Overall system performance

Uses synthetic ground-truth scenarios to compute standard
classification metrics (precision, recall, F1) and calibration
metrics (ECE, MCE, Brier score).

All evaluations are reproducible — same inputs yield same outputs.
"""

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np

from intelligence_engine.analyzers.calibration import ConfidenceCalibrator
from intelligence_engine.analyzers.coordination import CoordinationDetector
from intelligence_engine.analyzers.group_anomaly import GroupAnomalyDetector
from intelligence_engine.analyzers.risk_propagation import RiskPropagationEngine
from intelligence_engine.analyzers.sequence import SequenceDetector
from intelligence_engine.models.system_schemas import (
    EvaluationMetrics,
    StabilityMetrics,
)

logger = logging.getLogger(__name__)


class IntelligenceEvaluator:
    """Evaluates intelligence module performance using synthetic scenarios.

    Generates controlled test scenarios with known ground truth,
    runs the analysis modules, and computes precision/recall/F1
    and calibration metrics.
    """

    def evaluate_coordination_detection(
        self,
        detector: Optional[CoordinationDetector] = None,
    ) -> EvaluationMetrics:
        """Evaluate coordination detection with synthetic scenarios.

        Creates scenarios with known coordination patterns and measures
        detection accuracy.
        """
        if detector is None:
            detector = CoordinationDetector()

        base = datetime(2026, 3, 1, 8, 0, 0, tzinfo=timezone.utc)
        tp = fp = tn = fn = 0

        # --- Scenario 1: Clear co-occurrence (should detect) ---
        events_1 = []
        for i in range(15):
            t = base + timedelta(hours=i * 2)
            events_1.append({"entity_id": "A", "timestamp": t, "location_name": "L1"})
            events_1.append({
                "entity_id": "B",
                "timestamp": t + timedelta(seconds=30),
                "location_name": "L1",
            })
        # Add noise entities
        rng = np.random.default_rng(42)
        for i in range(10):
            events_1.append({
                "entity_id": f"Noise_{i}",
                "timestamp": base + timedelta(hours=float(rng.uniform(0, 30))),
                "location_name": f"L{rng.integers(1, 5)}",
            })

        result_1 = detector.detect(events_1)
        co_occ_found = any(
            p.coordination_type == "co_occurrence"
            and set(p.involved_entities) == {"A", "B"}
            for p in result_1.patterns_detected
        )
        if co_occ_found:
            tp += 1
        else:
            fn += 1

        # --- Scenario 2: Independent entities (should NOT detect) ---
        events_2 = []
        for i in range(15):
            events_2.append({
                "entity_id": "C",
                "timestamp": base + timedelta(hours=i * 3),
                "location_name": "L1",
            })
            events_2.append({
                "entity_id": "D",
                "timestamp": base + timedelta(hours=i * 3 + 1.5),
                "location_name": "L2",
            })

        result_2 = detector.detect(events_2)
        cd_co = [
            p for p in result_2.patterns_detected
            if p.coordination_type == "co_occurrence"
            and set(p.involved_entities) == {"C", "D"}
        ]
        if not cd_co:
            tn += 1
        else:
            fp += 1

        # --- Scenario 3: Staggered coordination (should detect) ---
        events_3 = []
        for i in range(12):
            t = base + timedelta(hours=i * 4)
            events_3.append({"entity_id": "E", "timestamp": t, "location_name": "L1"})
            events_3.append({
                "entity_id": "F",
                "timestamp": t + timedelta(minutes=3),
                "location_name": "L1",
            })

        result_3 = detector.detect(events_3)
        stagger_found = any(
            p.coordination_type in ("staggered", "co_occurrence")
            and "E" in p.involved_entities
            and "F" in p.involved_entities
            for p in result_3.patterns_detected
        )
        if stagger_found:
            tp += 1
        else:
            fn += 1

        # --- Scenario 4: Random events (should NOT detect strong patterns) ---
        events_4 = []
        for i in range(30):
            events_4.append({
                "entity_id": f"R{rng.integers(0, 10)}",
                "timestamp": base + timedelta(hours=float(rng.uniform(0, 100))),
                "location_name": f"L{rng.integers(1, 8)}",
            })

        result_4 = detector.detect(events_4)
        high_conf = [p for p in result_4.patterns_detected if p.confidence > 0.8]
        if not high_conf:
            tn += 1
        else:
            fp += 1

        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)

        return EvaluationMetrics(
            module_name="coordination_detection",
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1_score=round(f1, 4),
            accuracy=round((tp + tn) / max(tp + tn + fp + fn, 1), 4),
            n_true_positives=tp,
            n_false_positives=fp,
            n_true_negatives=tn,
            n_false_negatives=fn,
            details={
                "scenarios": 4,
                "positive_scenarios": 2,
                "negative_scenarios": 2,
            },
            explanation=(
                f"Coordination detection: P={precision:.3f}, R={recall:.3f}, "
                f"F1={f1:.3f}. {tp} TP, {fp} FP, {tn} TN, {fn} FN "
                f"across 4 synthetic scenarios."
            ),
        )

    def evaluate_sequence_detection(
        self,
        detector: Optional[SequenceDetector] = None,
    ) -> EvaluationMetrics:
        """Evaluate sequence detection with synthetic scenarios."""
        if detector is None:
            detector = SequenceDetector(min_support=3, time_window_seconds=600)

        base = datetime(2026, 3, 1, 8, 0, 0, tzinfo=timezone.utc)
        tp = fp = tn = fn = 0

        # --- Scenario 1: Clear A->B sequence (should detect) ---
        events_1 = []
        for i in range(10):
            t = base + timedelta(hours=i * 2)
            events_1.append({"entity_id": "A", "timestamp": t, "location_name": "L1"})
            events_1.append({
                "entity_id": "B",
                "timestamp": t + timedelta(seconds=120),
                "location_name": "L1",
            })

        result_1 = detector.detect(events_1)
        seq_ab = any(
            s.sequence == ["A", "B"] for s in result_1.frequent_sequences
        )
        causal_ab = any(
            c.leader_entity == "A" and c.follower_entity == "B"
            for c in result_1.causal_relationships
        )
        if seq_ab or causal_ab:
            tp += 1
        else:
            fn += 1

        # --- Scenario 2: Random ordering (should NOT detect strong causal) ---
        rng = np.random.default_rng(42)
        events_2 = []
        for i in range(20):
            events_2.append({
                "entity_id": rng.choice(["C", "D"]),
                "timestamp": base + timedelta(seconds=float(rng.uniform(0, 36000))),
                "location_name": "L1",
            })

        result_2 = detector.detect(events_2)
        strong_causal = [
            c for c in result_2.causal_relationships
            if c.lift > 2.0 and c.confidence > 0.8
        ]
        if not strong_causal:
            tn += 1
        else:
            fp += 1

        # --- Scenario 3: A->B->C chain (should detect) ---
        events_3 = []
        for i in range(8):
            t = base + timedelta(hours=i * 3)
            events_3.append({"entity_id": "X", "timestamp": t, "location_name": "L1"})
            events_3.append({
                "entity_id": "Y",
                "timestamp": t + timedelta(seconds=60),
                "location_name": "L1",
            })
            events_3.append({
                "entity_id": "Z",
                "timestamp": t + timedelta(seconds=180),
                "location_name": "L1",
            })

        result_3 = detector.detect(events_3)
        chain = any(
            len(s.sequence) >= 3 and s.sequence[0] == "X"
            for s in result_3.frequent_sequences
        )
        causal_xy = any(
            c.leader_entity == "X" and c.follower_entity == "Y"
            for c in result_3.causal_relationships
        )
        if chain or causal_xy:
            tp += 1
        else:
            fn += 1

        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)

        return EvaluationMetrics(
            module_name="sequence_detection",
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1_score=round(f1, 4),
            accuracy=round((tp + tn) / max(tp + tn + fp + fn, 1), 4),
            n_true_positives=tp,
            n_false_positives=fp,
            n_true_negatives=tn,
            n_false_negatives=fn,
            details={"scenarios": 3, "positive_scenarios": 2, "negative_scenarios": 1},
            explanation=(
                f"Sequence detection: P={precision:.3f}, R={recall:.3f}, "
                f"F1={f1:.3f}. {tp} TP, {fp} FP, {tn} TN, {fn} FN "
                f"across 3 synthetic scenarios."
            ),
        )

    def evaluate_risk_propagation_stability(
        self,
        engine: Optional[RiskPropagationEngine] = None,
    ) -> StabilityMetrics:
        """Evaluate risk propagation convergence and stability.

        Tests that iterative propagation converges without oscillation
        and doesn't cause runaway risk amplification.
        """
        if engine is None:
            engine = RiskPropagationEngine()

        # Create a graph with known structure
        entity_risks = {
            "HighRisk": 0.9,
            "MedRisk": 0.4,
            "LowRisk": 0.1,
            "Clean1": 0.0,
            "Clean2": 0.0,
            "Isolated": 0.05,
        }

        adjacency = {
            "HighRisk": [
                {"entity_id": "MedRisk", "weight": 0.8},
                {"entity_id": "Clean1", "weight": 0.5},
            ],
            "MedRisk": [
                {"entity_id": "HighRisk", "weight": 0.8},
                {"entity_id": "LowRisk", "weight": 0.6},
                {"entity_id": "Clean2", "weight": 0.3},
            ],
            "LowRisk": [
                {"entity_id": "MedRisk", "weight": 0.6},
            ],
            "Clean1": [
                {"entity_id": "HighRisk", "weight": 0.5},
            ],
            "Clean2": [
                {"entity_id": "MedRisk", "weight": 0.3},
            ],
            "Isolated": [],
        }

        _, stability = engine.iterative_propagation(entity_risks, adjacency)
        return stability

    def evaluate_group_anomaly_detection(
        self,
        detector: Optional[GroupAnomalyDetector] = None,
    ) -> EvaluationMetrics:
        """Evaluate group anomaly detection with synthetic scenarios."""
        if detector is None:
            detector = GroupAnomalyDetector()

        base = datetime(2026, 3, 1, 8, 0, 0, tzinfo=timezone.utc)
        tp = fp = tn = fn = 0

        # --- Build historical baseline ---
        rng = np.random.default_rng(42)
        historical = []
        for day in range(14):
            # Normal: 2-3 entities per cluster window
            for _ in range(3):
                t = base - timedelta(days=14 - day) + timedelta(hours=float(rng.uniform(8, 18)))
                historical.append({
                    "entity_id": f"E{rng.integers(0, 5)}",
                    "timestamp": t,
                    "location_name": f"L{rng.integers(1, 4)}",
                })

        # --- Scenario 1: Unusual gathering (should detect) ---
        events_1 = []
        t = base
        for i in range(8):  # 8 distinct entities at same time
            events_1.append({
                "entity_id": f"G{i}",
                "timestamp": t + timedelta(seconds=i * 10),
                "location_name": "L1",
            })

        result_1 = detector.detect(events_1, historical)
        gathering = any(a.anomaly_type == "unusual_gathering" for a in result_1.anomalies)
        if gathering:
            tp += 1
        else:
            fn += 1

        # --- Scenario 2: Normal activity (should NOT detect) ---
        events_2 = []
        for i in range(3):
            events_2.append({
                "entity_id": f"N{i}",
                "timestamp": base + timedelta(hours=i * 2),
                "location_name": f"L{i + 1}",
            })
        # Need enough events for analysis
        for i in range(3, 12):
            events_2.append({
                "entity_id": f"N{i % 3}",
                "timestamp": base + timedelta(hours=i),
                "location_name": f"L{(i % 3) + 1}",
            })

        result_2 = detector.detect(events_2, historical)
        anomalous = [a for a in result_2.anomalies if a.anomaly_score > 0.5]
        if not anomalous:
            tn += 1
        else:
            fp += 1

        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)

        return EvaluationMetrics(
            module_name="group_anomaly_detection",
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1_score=round(f1, 4),
            accuracy=round((tp + tn) / max(tp + tn + fp + fn, 1), 4),
            n_true_positives=tp,
            n_false_positives=fp,
            n_true_negatives=tn,
            n_false_negatives=fn,
            details={"scenarios": 2, "positive_scenarios": 1, "negative_scenarios": 1},
            explanation=(
                f"Group anomaly detection: P={precision:.3f}, R={recall:.3f}, "
                f"F1={f1:.3f}. {tp} TP, {fp} FP, {tn} TN, {fn} FN."
            ),
        )

    def evaluate_calibration(
        self,
        calibrator: Optional[ConfidenceCalibrator] = None,
    ) -> dict:
        """Evaluate confidence calibration quality.

        Generates synthetic predictions with known bias, fits calibration,
        and reports before/after metrics.
        """
        if calibrator is None:
            calibrator = ConfidenceCalibrator()

        rng = np.random.default_rng(42)

        # Generate synthetic predictions with systematic overconfidence
        n = 200
        true_probs = rng.uniform(0, 1, n)
        outcomes = (rng.random(n) < true_probs).astype(int)

        # Raw predictions are overconfident (pushed toward 0 and 1)
        raw_predictions = np.clip(true_probs * 1.5 - 0.25, 0.01, 0.99).tolist()

        # Compute raw calibration
        raw_result = calibrator.compute_reliability_diagram(raw_predictions, outcomes.tolist())

        # Fit Platt scaling
        platt_result = calibrator.fit_platt(raw_predictions, outcomes.tolist())

        # Fit isotonic regression
        calibrator2 = ConfidenceCalibrator()
        isotonic_result = calibrator2.fit_isotonic(raw_predictions, outcomes.tolist())

        return {
            "raw": {
                "ece": raw_result.ece,
                "mce": raw_result.mce,
                "brier": raw_result.brier_score,
            },
            "platt": {
                "ece": platt_result.ece,
                "mce": platt_result.mce,
                "brier": platt_result.brier_score,
                "a": platt_result.platt_a,
                "b": platt_result.platt_b,
            },
            "isotonic": {
                "ece": isotonic_result.ece,
                "mce": isotonic_result.mce,
                "brier": isotonic_result.brier_score,
            },
            "improvement": {
                "platt_ece_reduction": round(raw_result.ece - platt_result.ece, 4),
                "isotonic_ece_reduction": round(raw_result.ece - isotonic_result.ece, 4),
            },
        }

    def run_full_evaluation(self) -> dict:
        """Run all evaluations and return comprehensive results."""
        start = time.time()

        results = {
            "coordination": self.evaluate_coordination_detection().model_dump(),
            "sequence": self.evaluate_sequence_detection().model_dump(),
            "risk_stability": self.evaluate_risk_propagation_stability().model_dump(),
            "group_anomaly": self.evaluate_group_anomaly_detection().model_dump(),
            "calibration": self.evaluate_calibration(),
            "total_evaluation_time_ms": 0.0,
        }

        results["total_evaluation_time_ms"] = round((time.time() - start) * 1000, 2)
        return results
