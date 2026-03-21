"""Intelligence Engine Orchestrator.

Coordinates all analysis modules to produce comprehensive intelligence
for entities. Manages the flow:

1. Receive detection events
2. Store as temporal events
3. Run temporal pattern analysis (FFT + autocorrelation)
4. Run anomaly detection (z-score + isolation forest)
5. Run behavior classification (statistical)
6. Compute relationship weights (decay-weighted)
7. Compute risk scores (formalized model)
8. Generate predictions (frequency distribution / periodicity)
9. Produce intelligence insights with full explainability
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from intelligence_engine.analyzers.anomaly import AnomalyDetector
from intelligence_engine.analyzers.behavior import BehaviorModeler
from intelligence_engine.analyzers.nl_query import NLQueryTranslator
from intelligence_engine.analyzers.predictor import Predictor
from intelligence_engine.analyzers.relationships import RelationshipEngine
from intelligence_engine.analyzers.risk import RiskScorer
from intelligence_engine.analyzers.temporal import TemporalPatternAnalyzer
from intelligence_engine.config import settings
from intelligence_engine.models.schemas import (
    AnomalyResult,
    BehaviorClassification,
    NLQueryResult,
    PredictionResult,
    RelationshipWeight,
    RiskScore,
    TemporalPatternResult,
)

logger = logging.getLogger(__name__)


class IntelligenceEngine:
    """Main intelligence engine that orchestrates all analysis modules.

    This is the primary interface for the intelligence system. It
    coordinates temporal analysis, anomaly detection, behavior modeling,
    relationship scoring, risk computation, and predictions.

    All results include explainability — every insight comes with
    the statistical evidence and reasoning that produced it.
    """

    def __init__(self) -> None:
        """Initialize all analysis modules."""
        self.temporal_analyzer = TemporalPatternAnalyzer()
        self.anomaly_detector = AnomalyDetector(
            contamination=settings.anomaly_contamination
        )
        self.behavior_modeler = BehaviorModeler()
        self.relationship_engine = RelationshipEngine(
            decay_rate=settings.relationship_decay_rate
        )
        self.risk_scorer = RiskScorer(
            w1=settings.risk_w1_anomaly,
            w2=settings.risk_w2_association,
            w3=settings.risk_w3_behavior,
        )
        self.predictor = Predictor()
        self.nl_translator = NLQueryTranslator()

    def analyze_temporal_patterns(
        self,
        entity_id: str,
        timestamps: list[datetime],
    ) -> TemporalPatternResult:
        """Analyze temporal patterns for an entity.

        Uses FFT-based periodicity detection and autocorrelation to
        identify repeating patterns in appearance timestamps.

        Args:
            entity_id: Entity to analyze.
            timestamps: List of appearance timestamps.

        Returns:
            TemporalPatternResult with periodicity, distributions, and explanation.
        """
        return self.temporal_analyzer.analyze(timestamps, entity_id)

    def detect_anomaly(
        self,
        current_event: dict,
        historical_events: list[dict],
    ) -> AnomalyResult:
        """Detect if a new event is anomalous.

        Uses z-score analysis and isolation forest to score the event
        against the entity's learned baseline.

        Args:
            current_event: The new event to evaluate.
            historical_events: Historical events for baseline.

        Returns:
            AnomalyResult with score, method details, and explanation.
        """
        return self.anomaly_detector.detect(current_event, historical_events)

    def classify_behavior(
        self,
        entity_id: str,
        events: list[dict],
        co_occurrence_map: Optional[dict[str, list[str]]] = None,
    ) -> list[BehaviorClassification]:
        """Classify entity behavior patterns.

        Runs all behavior classifiers (loitering, repeated visits,
        convoy detection, duration classification, routine detection).

        Args:
            entity_id: Entity to classify.
            events: Historical events for the entity.
            co_occurrence_map: Optional co-occurrence data for convoy detection.

        Returns:
            List of detected behavior classifications.
        """
        return self.behavior_modeler.classify_all(entity_id, events, co_occurrence_map)

    def compute_relationship(
        self,
        entity_id_1: str,
        entity_id_2: str,
        co_occurrence_timestamps: list[datetime],
        reference_time: Optional[datetime] = None,
        total_events_1: int = 0,
        total_events_2: int = 0,
    ) -> RelationshipWeight:
        """Compute decay-weighted relationship strength.

        Uses exponential decay, temporal proximity, and consistency
        to derive a principled relationship weight.

        Args:
            entity_id_1, entity_id_2: The two entities.
            co_occurrence_timestamps: Times they appeared together.
            reference_time: Current time for decay calculation.
            total_events_1, total_events_2: Total appearances of each entity.

        Returns:
            RelationshipWeight with component scores and explanation.
        """
        return self.relationship_engine.compute_weight(
            entity_id_1, entity_id_2,
            co_occurrence_timestamps,
            reference_time,
            total_events_1, total_events_2,
        )

    def compute_risk(
        self,
        entity_id: str,
        anomaly_scores: list[float],
        associated_entities: list[dict],
        behavior_classifications: list[dict],
    ) -> RiskScore:
        """Compute formalized risk score.

        Risk(entity) = w1 * anomaly + w2 * association + w3 * behavior

        All components are mathematically defined with tunable weights.

        Args:
            entity_id: Entity to score.
            anomaly_scores: Recent anomaly scores (0-1).
            associated_entities: Associated entities with weights and risks.
            behavior_classifications: Behavior classification results.

        Returns:
            RiskScore with components, factors, and explanation.
        """
        return self.risk_scorer.compute(
            entity_id, anomaly_scores, associated_entities, behavior_classifications
        )

    def predict_next_appearance(
        self,
        entity_id: str,
        timestamps: list[datetime],
        temporal_pattern: Optional[TemporalPatternResult] = None,
        location_history: Optional[list[dict]] = None,
        reference_time: Optional[datetime] = None,
    ) -> PredictionResult:
        """Predict next entity appearance time and location.

        Uses periodicity extrapolation (if periodic) or frequency-based
        probability distributions (log-normal model).

        Args:
            entity_id: Entity to predict.
            timestamps: Historical appearance timestamps.
            temporal_pattern: Pre-computed temporal pattern.
            location_history: Location visit history.
            reference_time: Current time.

        Returns:
            PredictionResult with time window, location, confidence, and evidence.
        """
        return self.predictor.predict_next_appearance(
            entity_id, timestamps, temporal_pattern, location_history, reference_time
        )

    def translate_nl_query(self, query: str) -> NLQueryResult:
        """Translate a natural language query to database queries.

        Uses pattern-based intent classification and template-based
        query generation. No LLM hallucination — all queries are
        constructed from validated templates.

        Args:
            query: Natural language query string.

        Returns:
            NLQueryResult with SQL/Cypher, explanation, and confidence.
        """
        return self.nl_translator.translate(query)

    def full_entity_analysis(
        self,
        entity_id: str,
        events: list[dict],
        co_occurrence_data: Optional[dict] = None,
        associated_entity_risks: Optional[list[dict]] = None,
    ) -> dict:
        """Run complete intelligence analysis on an entity.

        Orchestrates all modules and produces a comprehensive
        intelligence report.

        Args:
            entity_id: Entity to analyze.
            events: All temporal events for the entity.
            co_occurrence_data: Co-occurrence timestamps per entity pair.
            associated_entity_risks: Risk data for associated entities.

        Returns:
            Dict with all analysis results and unified explanation.
        """
        if not events:
            return {
                "entity_id": entity_id,
                "status": "insufficient_data",
                "explanation": "No events available for analysis.",
            }

        # 1. Temporal pattern analysis
        timestamps = [
            e["timestamp"] for e in events
            if isinstance(e.get("timestamp"), datetime)
        ]
        temporal = self.analyze_temporal_patterns(entity_id, timestamps)

        # 2. Anomaly detection (on the most recent event)
        anomaly = None
        if len(events) > 1:
            anomaly = self.detect_anomaly(events[-1], events[:-1])

        # 3. Behavior classification
        behaviors = self.classify_behavior(
            entity_id, events, co_occurrence_data
        )

        # 4. Relationship analysis
        relationships = []
        if co_occurrence_data:
            for other_id, co_times in co_occurrence_data.items():
                if other_id != entity_id and co_times:
                    rel = self.compute_relationship(
                        entity_id, other_id, co_times,
                        total_events_1=len(events),
                    )
                    relationships.append(rel)

        # 5. Risk scoring
        anomaly_scores = [anomaly.anomaly_score] if anomaly else []
        behavior_dicts = [
            {"behavior_type": b.behavior_type, "confidence": b.confidence, "severity": b.severity}
            for b in behaviors
        ]
        risk = self.compute_risk(
            entity_id,
            anomaly_scores,
            associated_entity_risks or [],
            behavior_dicts,
        )

        # 6. Predictions
        location_history = [
            {
                "location_id": e.get("location_id"),
                "location_name": e.get("location_name"),
                "timestamp": e.get("timestamp"),
                "duration_seconds": e.get("duration_seconds"),
            }
            for e in events if e.get("location_id")
        ]
        prediction = self.predict_next_appearance(
            entity_id, timestamps, temporal, location_history
        )

        return {
            "entity_id": entity_id,
            "status": "analyzed",
            "temporal_pattern": temporal.model_dump(),
            "anomaly": anomaly.model_dump() if anomaly else None,
            "behaviors": [b.model_dump() for b in behaviors],
            "relationships": [r.model_dump() for r in relationships],
            "risk": risk.model_dump(),
            "prediction": prediction.model_dump(),
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        }
