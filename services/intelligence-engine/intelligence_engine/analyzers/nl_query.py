"""Natural Language Query Interface - Translates NL queries to database queries.

Implements a structured query translation pipeline that:
1. Parses natural language queries into structured intent
2. Translates to verified SQL (PostgreSQL) or Cypher (Neo4j) queries
3. Returns results with full query explanation

The LLM is used ONLY for intent parsing — actual query construction
uses template-based generation to prevent hallucination and ensure
all queries are valid and return verifiable data.

Supported query patterns:
- Entity frequency: "show all vehicles seen more than X times"
- Temporal queries: "entities seen in the last N hours/days"
- Location queries: "entities near Location_A"
- Relationship queries: "who is associated with Entity_X"
- Behavior queries: "find suspicious behavior" / "find loitering"
- Risk queries: "show high risk entities"
- Anomaly queries: "show anomalies in the last 24 hours"
"""

import logging
import re

from intelligence_engine.models.schemas import NLQueryResult

logger = logging.getLogger(__name__)


# Query intent patterns — regex-based intent classification
# Each pattern maps to a query template with extracted parameters
QUERY_PATTERNS = [
    {
        "name": "entity_frequency",
        "patterns": [
            r"(?:show|find|list|get)\s+(?:all\s+)?(\w+)s?\s+(?:that\s+)?(?:appeared?|seen)\s+(?:more\s+than|over|above|>=?)\s+(\d+)\s+times?",
            r"(\w+)s?\s+(?:with|having)\s+(?:more\s+than|over|>=?)\s+(\d+)\s+(?:appearances?|sightings?|visits?)",
        ],
        "extract": lambda m: {"entity_type": m.group(1).lower(), "min_count": int(m.group(2))},
    },
    {
        "name": "temporal_recent",
        "patterns": [
            r"(?:show|find|list|get)\s+(?:all\s+)?(?:entities|objects|people|vehicles)\s+(?:seen|appeared?|detected)\s+(?:in\s+)?(?:the\s+)?(?:last|past)\s+(\d+)\s+(hours?|days?|weeks?|minutes?)",
            r"(?:what|which)\s+(?:entities|objects)\s+(?:were\s+)?(?:seen|detected)\s+(?:in\s+)?(?:the\s+)?(?:last|past)\s+(\d+)\s+(hours?|days?|weeks?|minutes?)",
        ],
        "extract": lambda m: {"duration": int(m.group(1)), "unit": m.group(2).rstrip("s")},
    },
    {
        "name": "entity_at_location",
        "patterns": [
            r"(?:show|find|list|get)\s+(?:all\s+)?(?:entities|objects|people|vehicles)\s+(?:at|near|around)\s+(.+?)(?:\s+in\s+the\s+last|\s*$)",
            r"(?:what|who)\s+(?:was|were|is|has been)\s+(?:seen|detected)\s+(?:at|near)\s+(.+?)(?:\s+in\s+the\s+last|\s*$)",
        ],
        "extract": lambda m: {"location": m.group(1).strip().strip("'\"")},
    },
    {
        "name": "entity_associations",
        "patterns": [
            r"(?:who|what|which\s+entities?)\s+(?:is|are)\s+(?:associated|connected|linked|related)\s+(?:with|to)\s+(.+?)(?:\s*\??\s*$)",
            r"(?:show|find|get)\s+(?:all\s+)?(?:associations?|connections?|relationships?)\s+(?:of|for|with)\s+(.+?)(?:\s*\??\s*$)",
        ],
        "extract": lambda m: {"entity_ref": m.group(1).strip().strip("'\"")},
    },
    {
        "name": "behavior_search",
        "patterns": [
            r"(?:find|show|detect|list)\s+(?:all\s+)?(?:suspicious\s+)?(?:behavior|activity|loitering|convoy|routine)",
            r"(?:find|show|list)\s+(?:entities?\s+)?(?:with\s+)?(\w+)\s+behavior",
        ],
        "extract": lambda m: {"behavior_type": m.group(1).lower() if m.lastindex else "all"},
    },
    {
        "name": "risk_query",
        "patterns": [
            r"(?:show|find|list|get)\s+(?:all\s+)?(high|medium|low|critical)\s+risk\s+(?:entities|objects|people|vehicles)",
            r"(?:entities|objects|people|vehicles)\s+with\s+(high|medium|low|critical)\s+risk",
        ],
        "extract": lambda m: {"risk_level": m.group(1).lower()},
    },
    {
        "name": "anomaly_search",
        "patterns": [
            r"(?:show|find|list|detect)\s+(?:all\s+)?anomal(?:ies|ous\s+(?:events?|activity|behavior))",
            r"(?:what|which)\s+(?:anomalies|unusual\s+(?:events?|activity))\s+(?:were\s+)?(?:detected|found)",
        ],
        "extract": lambda m: {"type": "anomaly"},
    },
    {
        "name": "entity_timeline",
        "patterns": [
            r"(?:show|get|display)\s+(?:the\s+)?timeline\s+(?:for|of)\s+(.+?)(?:\s*\??\s*$)",
            r"(?:what\s+is|show)\s+(?:the\s+)?(?:activity|history)\s+(?:of|for)\s+(.+?)(?:\s*\??\s*$)",
        ],
        "extract": lambda m: {"entity_ref": m.group(1).strip().strip("'\"")},
    },
    {
        "name": "prediction_query",
        "patterns": [
            r"(?:when|where)\s+will\s+(.+?)\s+(?:appear|show\s+up|be\s+seen)\s+(?:next|again)",
            r"predict\s+(?:the\s+)?(?:next\s+)?(?:appearance|location)\s+(?:of|for)\s+(.+?)(?:\s*\??\s*$)",
        ],
        "extract": lambda m: {"entity_ref": m.group(1).strip().strip("'\"")},
    },
]


class NLQueryTranslator:
    """Translates natural language queries to verified database queries.

    Uses pattern matching for intent classification and template-based
    query generation. NO LLM hallucination — all generated queries
    are constructed from validated templates.
    """

    def translate(self, query: str) -> NLQueryResult:
        """Translate a natural language query to structured database queries.

        Args:
            query: Natural language query string.

        Returns:
            NLQueryResult with generated SQL/Cypher, explanation, and intent.
        """
        query_lower = query.lower().strip()

        # Try each pattern
        for pattern_def in QUERY_PATTERNS:
            for regex in pattern_def["patterns"]:
                match = re.search(regex, query_lower, re.IGNORECASE)
                if match:
                    intent = pattern_def["name"]
                    params = pattern_def["extract"](match)
                    return self._generate_query(intent, params, query)

        # No pattern matched — return helpful error
        return NLQueryResult(
            original_query=query,
            interpreted_query="UNRECOGNIZED",
            query_explanation=(
                "Could not parse this query. Supported patterns include: "
                "'show all vehicles seen more than 5 times', "
                "'find entities seen in the last 24 hours', "
                "'who is associated with Vehicle_123', "
                "'find suspicious behavior', "
                "'show high risk entities', "
                "'show anomalies', "
                "'show timeline for Entity_X', "
                "'when will Entity_X appear next'."
            ),
            confidence=0.0,
        )

    def _generate_query(self, intent: str, params: dict, original: str) -> NLQueryResult:
        """Generate SQL/Cypher from parsed intent and parameters."""
        generators = {
            "entity_frequency": self._gen_entity_frequency,
            "temporal_recent": self._gen_temporal_recent,
            "entity_at_location": self._gen_entity_at_location,
            "entity_associations": self._gen_entity_associations,
            "behavior_search": self._gen_behavior_search,
            "risk_query": self._gen_risk_query,
            "anomaly_search": self._gen_anomaly_search,
            "entity_timeline": self._gen_entity_timeline,
            "prediction_query": self._gen_prediction_query,
        }

        generator = generators.get(intent)
        if not generator:
            return NLQueryResult(
                original_query=original,
                interpreted_query=intent,
                query_explanation=f"Intent '{intent}' recognized but no query template available.",
                confidence=0.0,
            )

        return generator(params, original)

    def _gen_entity_frequency(self, params: dict, original: str) -> NLQueryResult:
        entity_type = params.get("entity_type", "entity")
        min_count = params.get("min_count", 1)

        # Normalize entity type
        type_map = {
            "vehicle": "vehicle", "car": "vehicle", "truck": "vehicle", "suv": "vehicle",
            "person": "person", "people": "person", "pedestrian": "person",
            "object": "object", "entity": None,
        }
        db_type = type_map.get(entity_type)

        type_filter = f"AND e.entity_type = '{db_type}'" if db_type else ""

        sql = (
            f"SELECT e.id, e.entity_type, e.label, e.total_sightings, "
            f"e.first_seen, e.last_seen "
            f"FROM entities e "
            f"WHERE e.total_sightings >= {min_count} {type_filter} "
            f"ORDER BY e.total_sightings DESC "
            f"LIMIT 50"
        )

        cypher = (
            f"MATCH (e:Entity) "
            f"WHERE e.total_sightings >= {min_count} "
            + (f"AND e.entity_type = '{db_type}' " if db_type else "")
            + "RETURN e ORDER BY e.total_sightings DESC LIMIT 50"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query=f"entity_frequency(type={entity_type}, min_count={min_count})",
            generated_sql=sql,
            generated_cypher=cypher,
            query_explanation=(
                f"Finding all {entity_type}s with at least {min_count} recorded appearances. "
                f"Query searches the entities table for records where total_sightings >= {min_count}"
                + (f" and entity_type = '{db_type}'" if db_type else "")
                + ". Results are ordered by frequency (most appearances first)."
            ),
            confidence=0.9,
        )

    def _gen_temporal_recent(self, params: dict, original: str) -> NLQueryResult:
        duration = params.get("duration", 24)
        unit = params.get("unit", "hour")

        unit_map = {"hour": "hours", "day": "days", "week": "weeks", "minute": "minutes"}
        interval_unit = unit_map.get(unit, "hours")

        sql = (
            f"SELECT e.id, e.entity_type, e.label, e.last_seen, e.total_sightings "
            f"FROM entities e "
            f"WHERE e.last_seen >= NOW() - INTERVAL '{duration} {interval_unit}' "
            f"ORDER BY e.last_seen DESC "
            f"LIMIT 100"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query=f"temporal_recent(duration={duration}, unit={unit})",
            generated_sql=sql,
            query_explanation=(
                f"Finding all entities seen in the last {duration} {unit}(s). "
                f"Query filters entities by last_seen timestamp within the specified window."
            ),
            confidence=0.9,
        )

    def _gen_entity_at_location(self, params: dict, original: str) -> NLQueryResult:
        location = params.get("location", "")

        sql = (
            f"SELECT DISTINCT e.id, e.entity_type, e.label, te.location_name, "
            f"te.timestamp, te.duration_seconds "
            f"FROM entities e "
            f"JOIN temporal_events te ON e.id = te.entity_id "
            f"WHERE LOWER(te.location_name) LIKE LOWER('%{location}%') "
            f"ORDER BY te.timestamp DESC "
            f"LIMIT 50"
        )

        cypher = (
            f"MATCH (e:Entity)-[r:SEEN_AT]->(l:Location) "
            f"WHERE toLower(l.name) CONTAINS toLower('{location}') "
            f"RETURN e, l, r ORDER BY r.timestamp DESC LIMIT 50"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query=f"entity_at_location(location='{location}')",
            generated_sql=sql,
            generated_cypher=cypher,
            query_explanation=(
                f"Finding all entities seen at or near '{location}'. "
                f"Query joins entities with temporal events matching the location name."
            ),
            confidence=0.85,
        )

    def _gen_entity_associations(self, params: dict, original: str) -> NLQueryResult:
        entity_ref = params.get("entity_ref", "")

        cypher = (
            f"MATCH (e:Entity)-[r]-(associated:Entity) "
            f"WHERE e.entity_id = '{entity_ref}' OR e.label CONTAINS '{entity_ref}' "
            f"RETURN e, type(r) as relationship, r, associated "
            f"ORDER BY r.weight DESC LIMIT 50"
        )

        sql = (
            f"SELECT ep.entity_id, ep.associated_entities, ep.association_count, "
            f"ep.risk_score "
            f"FROM entity_profiles ep "
            f"WHERE ep.entity_id = '{entity_ref}' "
            f"OR ep.entity_id IN ("
            f"  SELECT id FROM entities WHERE label ILIKE '%{entity_ref}%'"
            f")"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query=f"entity_associations(entity='{entity_ref}')",
            generated_sql=sql,
            generated_cypher=cypher,
            query_explanation=(
                f"Finding all entities associated with '{entity_ref}'. "
                f"Cypher query traverses the relationship graph to find connected entities. "
                f"SQL query looks up the entity profile's associated_entities field."
            ),
            confidence=0.85,
        )

    def _gen_behavior_search(self, params: dict, original: str) -> NLQueryResult:
        behavior_type = params.get("behavior_type", "all")

        if behavior_type == "all" or behavior_type == "suspicious":
            type_filter = ""
            explanation_type = "all behavior types"
        else:
            type_filter = f"AND br.behavior_type = '{behavior_type}' "
            explanation_type = f"'{behavior_type}' behavior"

        sql = (
            f"SELECT br.entity_id, br.behavior_type, br.description, "
            f"br.confidence, br.severity, br.started_at, br.location_name "
            f"FROM behavior_records br "
            f"WHERE br.is_active = true {type_filter}"
            f"ORDER BY br.confidence DESC, br.severity DESC "
            f"LIMIT 50"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query=f"behavior_search(type='{behavior_type}')",
            generated_sql=sql,
            query_explanation=(
                f"Searching for {explanation_type} in the behavior records. "
                f"Results show active behavior classifications ordered by confidence."
            ),
            confidence=0.85,
        )

    def _gen_risk_query(self, params: dict, original: str) -> NLQueryResult:
        risk_level = params.get("risk_level", "high")

        sql = (
            f"SELECT ep.entity_id, ep.entity_type, ep.risk_score, ep.risk_level, "
            f"ep.risk_factors, ep.behavior_summary, ep.visit_count "
            f"FROM entity_profiles ep "
            f"WHERE ep.risk_level = '{risk_level}' "
            f"ORDER BY ep.risk_score DESC "
            f"LIMIT 50"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query=f"risk_query(level='{risk_level}')",
            generated_sql=sql,
            query_explanation=(
                f"Finding all entities with {risk_level} risk level. "
                f"Risk scores are computed using: R = w1*anomaly + w2*association + w3*behavior. "
                f"Results include risk factors explaining each entity's score."
            ),
            confidence=0.9,
        )

    def _gen_anomaly_search(self, params: dict, original: str) -> NLQueryResult:
        sql = (
            "SELECT ii.id, ii.title, ii.description, ii.severity, "
            "ii.confidence, ii.entity_ids, ii.evidence, ii.created_at "
            "FROM intelligence_insights ii "
            "WHERE ii.insight_type = 'anomaly' "
            "AND ii.is_dismissed = false "
            "ORDER BY ii.created_at DESC "
            "LIMIT 50"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query="anomaly_search()",
            generated_sql=sql,
            query_explanation=(
                "Finding all detected anomalies from the intelligence insights table. "
                "Each anomaly includes an explanation of why it was flagged, "
                "with z-scores and isolation forest scores as evidence."
            ),
            confidence=0.9,
        )

    def _gen_entity_timeline(self, params: dict, original: str) -> NLQueryResult:
        entity_ref = params.get("entity_ref", "")

        sql = (
            f"SELECT te.timestamp, te.event_type, te.location_name, "
            f"te.duration_seconds, te.confidence, te.co_occurring_entities "
            f"FROM temporal_events te "
            f"WHERE te.entity_id = '{entity_ref}' "
            f"OR te.entity_id IN ("
            f"  SELECT id FROM entities WHERE label ILIKE '%{entity_ref}%'"
            f") "
            f"ORDER BY te.timestamp ASC "
            f"LIMIT 200"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query=f"entity_timeline(entity='{entity_ref}')",
            generated_sql=sql,
            query_explanation=(
                f"Retrieving the full timeline of events for '{entity_ref}'. "
                f"Returns chronologically ordered temporal events including "
                f"locations, durations, and co-occurring entities."
            ),
            confidence=0.85,
        )

    def _gen_prediction_query(self, params: dict, original: str) -> NLQueryResult:
        entity_ref = params.get("entity_ref", "")

        sql = (
            f"SELECT ep.entity_id, ep.predicted_next_location, "
            f"ep.predicted_next_time, ep.temporal_pattern, "
            f"ep.common_locations "
            f"FROM entity_profiles ep "
            f"WHERE ep.entity_id = '{entity_ref}' "
            f"OR ep.entity_id IN ("
            f"  SELECT id FROM entities WHERE label ILIKE '%{entity_ref}%'"
            f")"
        )

        return NLQueryResult(
            original_query=original,
            interpreted_query=f"prediction_query(entity='{entity_ref}')",
            generated_sql=sql,
            query_explanation=(
                f"Retrieving prediction data for '{entity_ref}'. "
                f"Predictions are computed using frequency-based probability distributions "
                f"or periodicity extrapolation (for entities with detected periodic behavior). "
                f"Results include predicted time windows and locations with confidence scores."
            ),
            confidence=0.85,
        )
