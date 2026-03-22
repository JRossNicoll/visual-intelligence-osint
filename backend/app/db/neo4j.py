"""Neo4j graph database connection management."""

import logging
from typing import Any, Optional

from neo4j import AsyncDriver, AsyncGraphDatabase

from app.core.config import settings

logger = logging.getLogger(__name__)


class Neo4jManager:
    """Manages Neo4j connections and provides graph query utilities."""

    def __init__(self) -> None:
        self._driver: Optional[AsyncDriver] = None

    async def connect(self) -> None:
        """Initialize the Neo4j driver."""
        try:
            self._driver = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            )
            async with self._driver.session() as session:
                await session.run("RETURN 1")
            logger.info("Neo4j connection established")

            # Create indexes and constraints
            await self._setup_schema()
        except Exception as e:
            logger.warning("Neo4j connection failed: %s. Continuing without Neo4j.", e)
            self._driver = None

    async def disconnect(self) -> None:
        """Close the Neo4j driver."""
        if self._driver:
            await self._driver.close()
            logger.info("Neo4j connection closed")

    @property
    def driver(self) -> Optional[AsyncDriver]:
        return self._driver

    async def _setup_schema(self) -> None:
        """Create graph database indexes and constraints."""
        if not self._driver:
            return

        async with self._driver.session() as session:
            # Constraints for unique entity IDs
            constraints = [
                "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.entity_id IS UNIQUE",
                "CREATE CONSTRAINT location_id IF NOT EXISTS FOR (l:Location) REQUIRE l.location_id IS UNIQUE",
                "CREATE CONSTRAINT stream_id IF NOT EXISTS FOR (s:Stream) REQUIRE s.stream_id IS UNIQUE",
            ]
            for constraint in constraints:
                try:
                    await session.run(constraint)
                except Exception as e:
                    logger.debug("Constraint may already exist: %s", e)

            # Indexes for common queries
            indexes = [
                "CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.entity_type)",
                "CREATE INDEX entity_first_seen IF NOT EXISTS FOR (e:Entity) ON (e.first_seen)",
                "CREATE INDEX location_name IF NOT EXISTS FOR (l:Location) ON (l.name)",
            ]
            for index in indexes:
                try:
                    await session.run(index)
                except Exception as e:
                    logger.debug("Index may already exist: %s", e)

    async def execute_query(
        self, query: str, parameters: Optional[dict[str, Any]] = None
    ) -> list[dict]:
        """Execute a Cypher query and return results."""
        if not self._driver:
            return []

        async with self._driver.session() as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

    async def create_entity_node(self, entity_data: dict) -> Optional[dict]:
        """Create or update an entity node in the graph."""
        query = """
        MERGE (e:Entity {entity_id: $entity_id})
        SET e.entity_type = $entity_type,
            e.label = $label,
            e.first_seen = COALESCE(e.first_seen, $timestamp),
            e.last_seen = $timestamp,
            e.confidence = $confidence,
            e.attributes = $attributes
        RETURN e
        """
        results = await self.execute_query(query, entity_data)
        return results[0] if results else None

    async def create_location_node(self, location_data: dict) -> Optional[dict]:
        """Create or update a location node."""
        query = """
        MERGE (l:Location {location_id: $location_id})
        SET l.name = $name,
            l.latitude = $latitude,
            l.longitude = $longitude,
            l.stream_source = $stream_source
        RETURN l
        """
        results = await self.execute_query(query, location_data)
        return results[0] if results else None

    async def create_seen_at_relationship(
        self, entity_id: str, location_id: str, timestamp: str, stream_id: str
    ) -> None:
        """Create a SEEN_AT relationship between an entity and location."""
        query = """
        MATCH (e:Entity {entity_id: $entity_id})
        MATCH (l:Location {location_id: $location_id})
        CREATE (e)-[:SEEN_AT {timestamp: $timestamp, stream_id: $stream_id}]->(l)
        """
        await self.execute_query(
            query,
            {
                "entity_id": entity_id,
                "location_id": location_id,
                "timestamp": timestamp,
                "stream_id": stream_id,
            },
        )

    async def create_co_occurred_relationship(
        self, entity_id_1: str, entity_id_2: str, timestamp: str, stream_id: str
    ) -> None:
        """Create a CO_OCCURRED_WITH relationship between two entities.

        Uses decay-weighted edge model:
        - Tracks co-occurrence count, first/last seen timestamps
        - Stores all co-occurrence timestamps for temporal analysis
        - Weight is computed by the intelligence engine using exponential decay
        """
        query = """
        MATCH (e1:Entity {entity_id: $entity_id_1})
        MATCH (e2:Entity {entity_id: $entity_id_2})
        MERGE (e1)-[r:CO_OCCURRED_WITH]->(e2)
        SET r.last_seen = $timestamp,
            r.stream_id = $stream_id,
            r.count = COALESCE(r.count, 0) + 1,
            r.first_seen = COALESCE(r.first_seen, $timestamp),
            r.timestamps = COALESCE(r.timestamps, []) + [$timestamp]
        """
        await self.execute_query(
            query,
            {
                "entity_id_1": entity_id_1,
                "entity_id_2": entity_id_2,
                "timestamp": timestamp,
                "stream_id": stream_id,
            },
        )

    async def get_entity_relationships(self, entity_id: str) -> list[dict]:
        """Get all relationships for a given entity."""
        query = """
        MATCH (e:Entity {entity_id: $entity_id})-[r]-(n)
        RETURN type(r) as relationship_type, properties(r) as relationship_props,
               labels(n) as node_labels, properties(n) as node_props
        ORDER BY r.timestamp DESC
        LIMIT 100
        """
        return await self.execute_query(query, {"entity_id": entity_id})

    async def get_entity_graph(self, entity_id: str, depth: int = 2) -> list[dict]:
        """Get the subgraph around an entity up to a given depth.

        Note: Neo4j does not support parameterised variable-length path bounds,
        so we cap depth to a safe range and interpolate it into the query string.
        """
        depth = max(1, min(depth, 5))
        query = f"""
        MATCH path = (e:Entity {{entity_id: $entity_id}})-[*1..{depth}]-(n)
        UNWIND relationships(path) as r
        WITH startNode(r) as source, endNode(r) as target, type(r) as rel_type, properties(r) as rel_props
        RETURN DISTINCT
            properties(source) as source_props, labels(source) as source_labels,
            properties(target) as target_props, labels(target) as target_labels,
            rel_type, rel_props
        LIMIT 200
        """
        return await self.execute_query(query, {"entity_id": entity_id})


neo4j_manager = Neo4jManager()
