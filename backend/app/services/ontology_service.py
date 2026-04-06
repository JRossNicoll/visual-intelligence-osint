"""Ontology service — manages entity types, relation types, inference rules, and actions.

Provides the semantic backbone: what kinds of things exist, how they relate,
what properties they carry, and what the system can do about them.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ontology import (
    ActionDefinition,
    ActionExecution,
    EntityRelationship,
    InferenceRule,
    OntologyEntityType,
    OntologyRelationType,
)

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
# Built-in seed data
# ------------------------------------------------------------------ #

BUILTIN_ENTITY_TYPES = [
    {
        "name": "physical_object",
        "display_name": "Physical Object",
        "description": "Root type for all physical entities detected in video",
        "icon": "box",
        "is_abstract": True,
        "hierarchy_depth": 0,
        "property_schema": {
            "color": {"type": "string", "required": False},
            "size_estimate": {"type": "string", "required": False},
        },
    },
    {
        "name": "person",
        "display_name": "Person",
        "description": "A human individual detected and tracked by the CV pipeline",
        "icon": "user",
        "color": "#3b82f6",
        "hierarchy_depth": 1,
        "property_schema": {
            "gender_estimate": {"type": "string", "required": False},
            "age_estimate": {"type": "string", "required": False},
            "clothing_description": {"type": "string", "required": False},
            "hair_color": {"type": "string", "required": False},
            "height_estimate_cm": {"type": "number", "required": False},
            "carrying_items": {"type": "array", "required": False},
            "name": {"type": "string", "required": False},
            "alias": {"type": "array", "required": False},
        },
    },
    {
        "name": "vehicle",
        "display_name": "Vehicle",
        "description": "A vehicle (car, truck, motorcycle, etc.)",
        "icon": "car",
        "color": "#f59e0b",
        "hierarchy_depth": 1,
        "property_schema": {
            "make": {"type": "string", "required": False},
            "model": {"type": "string", "required": False},
            "year": {"type": "number", "required": False},
            "color": {"type": "string", "required": False},
            "license_plate": {"type": "string", "required": False},
            "vehicle_subtype": {"type": "string", "required": False},
        },
    },
    {
        "name": "sedan",
        "display_name": "Sedan",
        "description": "A four-door passenger car",
        "icon": "car",
        "color": "#f59e0b",
        "hierarchy_depth": 2,
        "property_schema": {},
    },
    {
        "name": "suv",
        "display_name": "SUV",
        "description": "Sport utility vehicle",
        "icon": "car",
        "color": "#f59e0b",
        "hierarchy_depth": 2,
        "property_schema": {},
    },
    {
        "name": "truck",
        "display_name": "Truck",
        "description": "A commercial or heavy-duty truck",
        "icon": "truck",
        "color": "#f59e0b",
        "hierarchy_depth": 2,
        "property_schema": {
            "cargo_type": {"type": "string", "required": False},
        },
    },
    {
        "name": "device",
        "display_name": "Device",
        "description": "An electronic device (phone, laptop, radio, etc.)",
        "icon": "smartphone",
        "color": "#8b5cf6",
        "hierarchy_depth": 1,
        "property_schema": {
            "device_type": {"type": "string", "required": False},
            "mac_address": {"type": "string", "required": False},
            "imei": {"type": "string", "required": False},
        },
    },
    {
        "name": "location",
        "display_name": "Location",
        "description": "A named geographic location or point of interest",
        "icon": "map-pin",
        "color": "#10b981",
        "hierarchy_depth": 0,
        "property_schema": {
            "latitude": {"type": "number", "required": False},
            "longitude": {"type": "number", "required": False},
            "address": {"type": "string", "required": False},
            "location_type": {"type": "string", "required": False},
        },
    },
    {
        "name": "organization",
        "display_name": "Organization",
        "description": "A group, company, or organizational entity",
        "icon": "building",
        "color": "#ef4444",
        "hierarchy_depth": 0,
        "property_schema": {
            "org_type": {"type": "string", "required": False},
            "sector": {"type": "string", "required": False},
        },
    },
]

BUILTIN_RELATION_TYPES = [
    {
        "name": "associates_with",
        "display_name": "Associates With",
        "description": "Two entities have been observed together or have a known relationship",
        "is_directed": False,
        "is_symmetric": True,
        "propagation_weight": 0.6,
        "property_schema": {
            "strength": {"type": "number"},
            "first_observed": {"type": "string"},
            "observation_count": {"type": "number"},
        },
    },
    {
        "name": "drives",
        "display_name": "Drives",
        "description": "A person drives or operates a vehicle",
        "is_directed": True,
        "propagation_weight": 0.8,
        "property_schema": {"frequency": {"type": "string"}},
    },
    {
        "name": "owns",
        "display_name": "Owns",
        "description": "Ownership relationship between entities",
        "is_directed": True,
        "propagation_weight": 0.9,
        "property_schema": {},
    },
    {
        "name": "co_located",
        "display_name": "Co-located",
        "description": "Entities observed at the same location within a time window",
        "is_directed": False,
        "is_symmetric": True,
        "propagation_weight": 0.4,
        "property_schema": {
            "location": {"type": "string"},
            "time_window_seconds": {"type": "number"},
        },
    },
    {
        "name": "communicates_with",
        "display_name": "Communicates With",
        "description": "Communication relationship (phone, radio, digital)",
        "is_directed": True,
        "propagation_weight": 0.7,
        "property_schema": {
            "channel": {"type": "string"},
            "frequency": {"type": "string"},
        },
    },
    {
        "name": "member_of",
        "display_name": "Member Of",
        "description": "Entity is a member of a group or organization",
        "is_directed": True,
        "propagation_weight": 0.7,
        "property_schema": {"role": {"type": "string"}},
    },
    {
        "name": "travels_with",
        "display_name": "Travels With",
        "description": "Entities that travel together across locations",
        "is_directed": False,
        "is_symmetric": True,
        "propagation_weight": 0.5,
        "property_schema": {
            "route": {"type": "string"},
            "frequency": {"type": "string"},
        },
    },
    {
        "name": "supervises",
        "display_name": "Supervises",
        "description": "Hierarchical supervision or command relationship",
        "is_directed": True,
        "propagation_weight": 0.8,
        "property_schema": {},
    },
    {
        "name": "frequents",
        "display_name": "Frequents",
        "description": "Entity regularly visits a location",
        "is_directed": True,
        "propagation_weight": 0.3,
        "property_schema": {
            "visit_count": {"type": "number"},
            "typical_times": {"type": "array"},
        },
    },
    {
        "name": "resembles",
        "display_name": "Resembles",
        "description": "Visual similarity between entities (potential identity match)",
        "is_directed": False,
        "is_symmetric": True,
        "propagation_weight": 0.2,
        "property_schema": {"similarity_score": {"type": "number"}},
    },
]

BUILTIN_ACTION_DEFINITIONS = [
    {
        "name": "create_alert",
        "display_name": "Create Alert",
        "description": "Generate a new alert in the system",
        "category": "alert",
        "execution_type": "internal",
        "parameter_schema": {
            "severity": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
            "title": {"type": "string", "required": True},
            "description": {"type": "string"},
        },
    },
    {
        "name": "create_case",
        "display_name": "Create Case",
        "description": "Open a new intelligence case",
        "category": "escalation",
        "execution_type": "internal",
        "parameter_schema": {
            "title": {"type": "string", "required": True},
            "priority": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
        },
    },
    {
        "name": "tag_entity",
        "display_name": "Tag Entity",
        "description": "Add tags or labels to an entity",
        "category": "enrichment",
        "execution_type": "internal",
        "parameter_schema": {
            "tags": {"type": "array", "required": True},
        },
    },
    {
        "name": "update_risk_score",
        "display_name": "Update Risk Score",
        "description": "Adjust an entity's risk score",
        "category": "enrichment",
        "execution_type": "internal",
        "parameter_schema": {
            "risk_delta": {"type": "number"},
            "reason": {"type": "string"},
        },
    },
    {
        "name": "send_notification",
        "display_name": "Send Notification",
        "description": "Send a notification to operators or external systems",
        "category": "notification",
        "execution_type": "internal",
        "parameter_schema": {
            "recipients": {"type": "array", "required": True},
            "message": {"type": "string", "required": True},
            "channel": {"type": "string", "enum": ["ui", "email", "webhook"]},
        },
    },
    {
        "name": "add_to_watchlist",
        "display_name": "Add to Watchlist",
        "description": "Place an entity on the active watchlist",
        "category": "restriction",
        "execution_type": "internal",
        "parameter_schema": {
            "watchlist_name": {"type": "string"},
            "reason": {"type": "string"},
            "expiry_hours": {"type": "number"},
        },
    },
    {
        "name": "create_relationship",
        "display_name": "Create Relationship",
        "description": "Establish a new relationship between two entities",
        "category": "enrichment",
        "execution_type": "internal",
        "parameter_schema": {
            "relation_type": {"type": "string", "required": True},
            "target_entity_id": {"type": "string", "required": True},
            "confidence": {"type": "number"},
        },
    },
    {
        "name": "webhook_call",
        "display_name": "Webhook Call",
        "description": "Call an external webhook URL",
        "category": "integration",
        "execution_type": "webhook",
        "parameter_schema": {
            "url": {"type": "string", "required": True},
            "method": {"type": "string", "enum": ["POST", "PUT"]},
            "payload": {"type": "object"},
        },
    },
    {
        "name": "enrich_entity",
        "display_name": "Enrich Entity",
        "description": "Trigger data fusion enrichment for an entity from all connected sources",
        "category": "enrichment",
        "execution_type": "internal",
        "parameter_schema": {
            "sources": {"type": "array"},
        },
    },
    {
        "name": "escalate_case",
        "display_name": "Escalate Case",
        "description": "Escalate a case to a higher priority or different assignee",
        "category": "escalation",
        "execution_type": "internal",
        "parameter_schema": {
            "new_priority": {"type": "string"},
            "assign_to": {"type": "string"},
            "reason": {"type": "string"},
        },
    },
]


class OntologyService:
    """Manages the ontology — entity types, relation types, rules, and actions."""

    # ------------------------------------------------------------------ #
    # Seed / Initialize
    # ------------------------------------------------------------------ #

    @staticmethod
    async def seed_builtins(db: AsyncSession) -> dict:
        """Seed built-in ontology types if not already present."""
        stats = {"entity_types": 0, "relation_types": 0, "action_definitions": 0}

        # Entity types — resolve parent IDs
        type_id_map: dict[str, str] = {}
        parent_map = {
            "person": "physical_object",
            "vehicle": "physical_object",
            "sedan": "vehicle",
            "suv": "vehicle",
            "truck": "vehicle",
            "device": "physical_object",
        }

        for spec in BUILTIN_ENTITY_TYPES:
            existing = await db.execute(
                select(OntologyEntityType).where(OntologyEntityType.name == spec["name"])
            )
            if existing.scalar_one_or_none():
                # Grab its ID for parent resolution
                row = await db.execute(
                    select(OntologyEntityType.id).where(OntologyEntityType.name == spec["name"])
                )
                type_id_map[spec["name"]] = row.scalar_one()
                continue

            parent_id = type_id_map.get(parent_map.get(spec["name"], ""))
            et = OntologyEntityType(
                name=spec["name"],
                display_name=spec["display_name"],
                description=spec.get("description"),
                icon=spec.get("icon"),
                color=spec.get("color"),
                parent_type_id=parent_id,
                hierarchy_depth=spec.get("hierarchy_depth", 0),
                property_schema=spec.get("property_schema"),
                is_abstract=spec.get("is_abstract", False),
                is_builtin=True,
            )
            db.add(et)
            await db.flush()
            type_id_map[spec["name"]] = et.id
            stats["entity_types"] += 1

        # Relation types
        for spec in BUILTIN_RELATION_TYPES:
            existing = await db.execute(
                select(OntologyRelationType).where(OntologyRelationType.name == spec["name"])
            )
            if existing.scalar_one_or_none():
                continue
            rt = OntologyRelationType(
                name=spec["name"],
                display_name=spec["display_name"],
                description=spec.get("description"),
                is_directed=spec.get("is_directed", True),
                is_symmetric=spec.get("is_symmetric", False),
                propagation_weight=spec.get("propagation_weight", 0.5),
                property_schema=spec.get("property_schema"),
                is_builtin=True,
            )
            db.add(rt)
            stats["relation_types"] += 1

        # Action definitions
        for spec in BUILTIN_ACTION_DEFINITIONS:
            existing = await db.execute(
                select(ActionDefinition).where(ActionDefinition.name == spec["name"])
            )
            if existing.scalar_one_or_none():
                continue
            ad = ActionDefinition(
                name=spec["name"],
                display_name=spec["display_name"],
                description=spec.get("description"),
                category=spec.get("category", "general"),
                execution_type=spec.get("execution_type", "internal"),
                parameter_schema=spec.get("parameter_schema"),
                is_builtin=True,
            )
            db.add(ad)
            stats["action_definitions"] += 1

        await db.flush()
        logger.info("Ontology seed complete: %s", stats)
        return stats

    # ------------------------------------------------------------------ #
    # Entity Types
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_entity_types(
        db: AsyncSession,
        *,
        include_abstract: bool = True,
    ) -> list[dict]:
        query = select(OntologyEntityType).order_by(
            OntologyEntityType.hierarchy_depth, OntologyEntityType.name
        )
        if not include_abstract:
            query = query.where(OntologyEntityType.is_abstract == False)  # noqa: E712
        result = await db.execute(query)
        return [_entity_type_to_dict(et) for et in result.scalars().all()]

    @staticmethod
    async def get_entity_type(db: AsyncSession, type_id: str) -> Optional[dict]:
        result = await db.execute(
            select(OntologyEntityType).where(OntologyEntityType.id == type_id)
        )
        et = result.scalar_one_or_none()
        return _entity_type_to_dict(et) if et else None

    @staticmethod
    async def get_entity_type_by_name(db: AsyncSession, name: str) -> Optional[dict]:
        result = await db.execute(
            select(OntologyEntityType).where(OntologyEntityType.name == name)
        )
        et = result.scalar_one_or_none()
        return _entity_type_to_dict(et) if et else None

    @staticmethod
    async def create_entity_type(
        db: AsyncSession,
        *,
        name: str,
        display_name: str,
        description: str = "",
        icon: Optional[str] = None,
        color: Optional[str] = None,
        parent_type_id: Optional[str] = None,
        property_schema: Optional[dict] = None,
        is_abstract: bool = False,
    ) -> dict:
        depth = 0
        if parent_type_id:
            parent = await db.execute(
                select(OntologyEntityType).where(OntologyEntityType.id == parent_type_id)
            )
            p = parent.scalar_one_or_none()
            if p:
                depth = p.hierarchy_depth + 1

        et = OntologyEntityType(
            name=name,
            display_name=display_name,
            description=description,
            icon=icon,
            color=color,
            parent_type_id=parent_type_id,
            hierarchy_depth=depth,
            property_schema=property_schema or {},
            is_abstract=is_abstract,
            is_builtin=False,
        )
        db.add(et)
        await db.flush()
        return _entity_type_to_dict(et)

    @staticmethod
    async def update_entity_type(
        db: AsyncSession,
        type_id: str,
        **kwargs: object,
    ) -> Optional[dict]:
        result = await db.execute(
            select(OntologyEntityType).where(OntologyEntityType.id == type_id)
        )
        et = result.scalar_one_or_none()
        if not et:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(et, key):
                setattr(et, key, value)
        et.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return _entity_type_to_dict(et)

    @staticmethod
    async def get_type_hierarchy(db: AsyncSession) -> list[dict]:
        """Return the full entity type hierarchy as a tree."""
        result = await db.execute(
            select(OntologyEntityType).order_by(OntologyEntityType.hierarchy_depth)
        )
        all_types = result.scalars().all()

        nodes: dict[str, dict] = {}
        roots: list[dict] = []

        for et in all_types:
            node = _entity_type_to_dict(et)
            node["children"] = []
            nodes[et.id] = node

        for et in all_types:
            node = nodes[et.id]
            if et.parent_type_id and et.parent_type_id in nodes:
                nodes[et.parent_type_id]["children"].append(node)
            else:
                roots.append(node)

        return roots

    # ------------------------------------------------------------------ #
    # Relation Types
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_relation_types(db: AsyncSession) -> list[dict]:
        result = await db.execute(
            select(OntologyRelationType).order_by(OntologyRelationType.name)
        )
        return [_relation_type_to_dict(rt) for rt in result.scalars().all()]

    @staticmethod
    async def get_relation_type(db: AsyncSession, relation_id: str) -> Optional[dict]:
        result = await db.execute(
            select(OntologyRelationType).where(OntologyRelationType.id == relation_id)
        )
        rt = result.scalar_one_or_none()
        return _relation_type_to_dict(rt) if rt else None

    @staticmethod
    async def create_relation_type(
        db: AsyncSession,
        *,
        name: str,
        display_name: str,
        description: str = "",
        source_type_id: Optional[str] = None,
        target_type_id: Optional[str] = None,
        is_directed: bool = True,
        is_symmetric: bool = False,
        propagation_weight: float = 0.5,
        property_schema: Optional[dict] = None,
    ) -> dict:
        rt = OntologyRelationType(
            name=name,
            display_name=display_name,
            description=description,
            source_type_id=source_type_id,
            target_type_id=target_type_id,
            is_directed=is_directed,
            is_symmetric=is_symmetric,
            propagation_weight=propagation_weight,
            property_schema=property_schema or {},
            is_builtin=False,
        )
        db.add(rt)
        await db.flush()
        return _relation_type_to_dict(rt)

    # ------------------------------------------------------------------ #
    # Entity Relationships (instances)
    # ------------------------------------------------------------------ #

    @staticmethod
    async def create_relationship(
        db: AsyncSession,
        *,
        relation_type_id: str,
        source_entity_id: str,
        target_entity_id: str,
        confidence: float = 1.0,
        weight: float = 1.0,
        properties: Optional[dict] = None,
        source_system: Optional[str] = None,
        evidence_ids: Optional[list[str]] = None,
        valid_from: Optional[datetime] = None,
        valid_until: Optional[datetime] = None,
        is_inferred: bool = False,
    ) -> dict:
        rel = EntityRelationship(
            relation_type_id=relation_type_id,
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            confidence=confidence,
            weight=weight,
            properties=properties,
            source_system=source_system,
            evidence_ids=evidence_ids,
            valid_from=valid_from,
            valid_until=valid_until,
            is_inferred=is_inferred,
        )
        db.add(rel)
        await db.flush()
        return _relationship_to_dict(rel)

    @staticmethod
    async def list_relationships(
        db: AsyncSession,
        *,
        entity_id: Optional[str] = None,
        relation_type_id: Optional[str] = None,
        min_confidence: Optional[float] = None,
        limit: int = 100,
    ) -> list[dict]:
        conditions = []
        if entity_id:
            conditions.append(
                (EntityRelationship.source_entity_id == entity_id)
                | (EntityRelationship.target_entity_id == entity_id)
            )
        if relation_type_id:
            conditions.append(EntityRelationship.relation_type_id == relation_type_id)
        if min_confidence is not None:
            conditions.append(EntityRelationship.confidence >= min_confidence)

        query = select(EntityRelationship)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(EntityRelationship.confidence.desc()).limit(limit)

        result = await db.execute(query)
        return [_relationship_to_dict(r) for r in result.scalars().all()]

    @staticmethod
    async def get_entity_relationships(
        db: AsyncSession, entity_id: str
    ) -> dict:
        """Get all relationships for an entity, grouped by direction."""
        outgoing_q = select(EntityRelationship).where(
            EntityRelationship.source_entity_id == entity_id
        )
        incoming_q = select(EntityRelationship).where(
            EntityRelationship.target_entity_id == entity_id
        )
        out_result = await db.execute(outgoing_q)
        in_result = await db.execute(incoming_q)
        return {
            "entity_id": entity_id,
            "outgoing": [_relationship_to_dict(r) for r in out_result.scalars().all()],
            "incoming": [_relationship_to_dict(r) for r in in_result.scalars().all()],
        }

    # ------------------------------------------------------------------ #
    # Inference Rules
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_inference_rules(
        db: AsyncSession, *, active_only: bool = True
    ) -> list[dict]:
        query = select(InferenceRule).order_by(InferenceRule.priority.desc())
        if active_only:
            query = query.where(InferenceRule.is_active == True)  # noqa: E712
        result = await db.execute(query)
        return [_rule_to_dict(r) for r in result.scalars().all()]

    @staticmethod
    async def get_inference_rule(db: AsyncSession, rule_id: str) -> Optional[dict]:
        result = await db.execute(
            select(InferenceRule).where(InferenceRule.id == rule_id)
        )
        r = result.scalar_one_or_none()
        return _rule_to_dict(r) if r else None

    @staticmethod
    async def create_inference_rule(
        db: AsyncSession,
        *,
        name: str,
        description: str = "",
        conditions: dict,
        actions: list,
        applicable_entity_types: Optional[list[str]] = None,
        priority: int = 50,
        cooldown_seconds: int = 300,
    ) -> dict:
        rule = InferenceRule(
            name=name,
            description=description,
            conditions=conditions,
            actions=actions,
            applicable_entity_types=applicable_entity_types,
            priority=priority,
            cooldown_seconds=cooldown_seconds,
        )
        db.add(rule)
        await db.flush()
        return _rule_to_dict(rule)

    @staticmethod
    async def update_inference_rule(
        db: AsyncSession, rule_id: str, **kwargs: object
    ) -> Optional[dict]:
        result = await db.execute(
            select(InferenceRule).where(InferenceRule.id == rule_id)
        )
        rule = result.scalar_one_or_none()
        if not rule:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(rule, key):
                setattr(rule, key, value)
        rule.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return _rule_to_dict(rule)

    @staticmethod
    async def evaluate_rules_for_entity(
        db: AsyncSession,
        entity_id: str,
        entity_data: dict,
    ) -> list[dict]:
        """Evaluate all active inference rules against an entity.

        Returns a list of fired actions.
        """
        rules_result = await db.execute(
            select(InferenceRule)
            .where(InferenceRule.is_active == True)  # noqa: E712
            .order_by(InferenceRule.priority.desc())
        )
        rules = rules_result.scalars().all()
        fired_actions: list[dict] = []
        now = datetime.now(timezone.utc)

        for rule in rules:
            # Check entity type applicability
            if rule.applicable_entity_types:
                entity_type = entity_data.get("entity_type", "")
                if entity_type not in rule.applicable_entity_types:
                    continue

            # Check cooldown
            if rule.last_fired_at:
                elapsed = (now - rule.last_fired_at).total_seconds()
                if elapsed < rule.cooldown_seconds:
                    continue

            # Evaluate conditions
            if _evaluate_conditions(rule.conditions, entity_data):
                # Fire actions
                for action_spec in rule.actions:
                    execution = ActionExecution(
                        action_definition_id=action_spec.get("action_id", ""),
                        triggered_by=f"rule:{rule.id}",
                        trigger_context={
                            "entity_id": entity_id,
                            "rule_name": rule.name,
                            "entity_data": entity_data,
                        },
                        status="completed",
                        started_at=now,
                        completed_at=now,
                        parameters=action_spec.get("params", {}),
                        result={"fired": True},
                        entity_id=entity_id,
                    )
                    db.add(execution)
                    fired_actions.append({
                        "rule_id": rule.id,
                        "rule_name": rule.name,
                        "action_type": action_spec.get("type", "unknown"),
                        "params": action_spec.get("params", {}),
                    })

                rule.times_fired += 1
                rule.last_fired_at = now
                rule.last_evaluated_at = now

        if fired_actions:
            await db.flush()
            logger.info(
                "Rules evaluated for entity %s: %d fired",
                entity_id, len(fired_actions),
            )

        return fired_actions

    # ------------------------------------------------------------------ #
    # Action Definitions
    # ------------------------------------------------------------------ #

    @staticmethod
    async def list_action_definitions(
        db: AsyncSession, *, category: Optional[str] = None
    ) -> list[dict]:
        query = select(ActionDefinition).order_by(ActionDefinition.category, ActionDefinition.name)
        if category:
            query = query.where(ActionDefinition.category == category)
        result = await db.execute(query)
        return [_action_def_to_dict(ad) for ad in result.scalars().all()]

    @staticmethod
    async def get_action_definition(db: AsyncSession, action_id: str) -> Optional[dict]:
        result = await db.execute(
            select(ActionDefinition).where(ActionDefinition.id == action_id)
        )
        ad = result.scalar_one_or_none()
        return _action_def_to_dict(ad) if ad else None

    @staticmethod
    async def create_action_definition(
        db: AsyncSession,
        *,
        name: str,
        display_name: str,
        description: str = "",
        category: str = "general",
        execution_type: str = "internal",
        parameter_schema: Optional[dict] = None,
        webhook_url: Optional[str] = None,
        webhook_method: Optional[str] = None,
        webhook_headers: Optional[dict] = None,
    ) -> dict:
        ad = ActionDefinition(
            name=name,
            display_name=display_name,
            description=description,
            category=category,
            execution_type=execution_type,
            parameter_schema=parameter_schema,
            webhook_url=webhook_url,
            webhook_method=webhook_method,
            webhook_headers=webhook_headers,
            is_builtin=False,
        )
        db.add(ad)
        await db.flush()
        return _action_def_to_dict(ad)

    @staticmethod
    async def list_action_executions(
        db: AsyncSession,
        *,
        entity_id: Optional[str] = None,
        case_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        conditions = []
        if entity_id:
            conditions.append(ActionExecution.entity_id == entity_id)
        if case_id:
            conditions.append(ActionExecution.case_id == case_id)
        if status:
            conditions.append(ActionExecution.status == status)

        query = select(ActionExecution)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(ActionExecution.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return [_action_exec_to_dict(ae) for ae in result.scalars().all()]


# ------------------------------------------------------------------ #
# Rule evaluation helpers
# ------------------------------------------------------------------ #


def _evaluate_conditions(conditions: dict, data: dict) -> bool:
    """Evaluate a conjunction of predicates against entity data."""
    predicates = conditions.get("predicates", [])
    if not predicates:
        return False

    match_mode = conditions.get("mode", "all")  # all = AND, any = OR

    results = []
    for pred in predicates:
        field = pred.get("field", "")
        op = pred.get("op", "==")
        expected = pred.get("value")
        actual = _resolve_field(data, field)

        matched = False
        if op == "==" and actual == expected:
            matched = True
        elif op == "!=" and actual != expected:
            matched = True
        elif op == ">" and actual is not None and expected is not None and actual > expected:
            matched = True
        elif op == ">=" and actual is not None and expected is not None and actual >= expected:
            matched = True
        elif op == "<" and actual is not None and expected is not None and actual < expected:
            matched = True
        elif op == "<=" and actual is not None and expected is not None and actual <= expected:
            matched = True
        elif op == "in" and isinstance(expected, list) and actual in expected:
            matched = True
        elif op == "contains" and isinstance(actual, (list, str)) and expected in actual:
            matched = True
        elif op == "exists" and actual is not None:
            matched = True
        elif op == "not_exists" and actual is None:
            matched = True

        results.append(matched)

    if match_mode == "any":
        return any(results)
    return all(results)


def _resolve_field(data: dict, field_path: str) -> object:
    """Resolve a dotted field path like 'attributes.license_plate'."""
    parts = field_path.split(".")
    current: object = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


# ------------------------------------------------------------------ #
# Serializers
# ------------------------------------------------------------------ #


def _entity_type_to_dict(et: OntologyEntityType) -> dict:
    return {
        "id": et.id,
        "name": et.name,
        "display_name": et.display_name,
        "description": et.description,
        "icon": et.icon,
        "color": et.color,
        "parent_type_id": et.parent_type_id,
        "hierarchy_depth": et.hierarchy_depth,
        "property_schema": et.property_schema,
        "is_abstract": et.is_abstract,
        "is_builtin": et.is_builtin,
        "created_at": et.created_at.isoformat(),
    }


def _relation_type_to_dict(rt: OntologyRelationType) -> dict:
    return {
        "id": rt.id,
        "name": rt.name,
        "display_name": rt.display_name,
        "description": rt.description,
        "source_type_id": rt.source_type_id,
        "target_type_id": rt.target_type_id,
        "is_directed": rt.is_directed,
        "is_symmetric": rt.is_symmetric,
        "propagation_weight": rt.propagation_weight,
        "property_schema": rt.property_schema,
        "is_builtin": rt.is_builtin,
        "created_at": rt.created_at.isoformat(),
    }


def _relationship_to_dict(rel: EntityRelationship) -> dict:
    return {
        "id": rel.id,
        "relation_type_id": rel.relation_type_id,
        "source_entity_id": rel.source_entity_id,
        "target_entity_id": rel.target_entity_id,
        "confidence": rel.confidence,
        "weight": rel.weight,
        "properties": rel.properties,
        "source_system": rel.source_system,
        "evidence_ids": rel.evidence_ids,
        "valid_from": rel.valid_from.isoformat() if rel.valid_from else None,
        "valid_until": rel.valid_until.isoformat() if rel.valid_until else None,
        "is_inferred": rel.is_inferred,
        "created_at": rel.created_at.isoformat(),
    }


def _rule_to_dict(r: InferenceRule) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "is_active": r.is_active,
        "priority": r.priority,
        "conditions": r.conditions,
        "applicable_entity_types": r.applicable_entity_types,
        "actions": r.actions,
        "cooldown_seconds": r.cooldown_seconds,
        "times_fired": r.times_fired,
        "last_fired_at": r.last_fired_at.isoformat() if r.last_fired_at else None,
        "last_evaluated_at": r.last_evaluated_at.isoformat() if r.last_evaluated_at else None,
        "created_at": r.created_at.isoformat(),
    }


def _action_def_to_dict(ad: ActionDefinition) -> dict:
    return {
        "id": ad.id,
        "name": ad.name,
        "display_name": ad.display_name,
        "description": ad.description,
        "category": ad.category,
        "execution_type": ad.execution_type,
        "parameter_schema": ad.parameter_schema,
        "webhook_url": ad.webhook_url,
        "is_builtin": ad.is_builtin,
        "is_active": ad.is_active,
        "created_at": ad.created_at.isoformat(),
    }


def _action_exec_to_dict(ae: ActionExecution) -> dict:
    return {
        "id": ae.id,
        "action_definition_id": ae.action_definition_id,
        "triggered_by": ae.triggered_by,
        "status": ae.status,
        "started_at": ae.started_at.isoformat() if ae.started_at else None,
        "completed_at": ae.completed_at.isoformat() if ae.completed_at else None,
        "error_message": ae.error_message,
        "parameters": ae.parameters,
        "result": ae.result,
        "entity_id": ae.entity_id,
        "case_id": ae.case_id,
        "created_at": ae.created_at.isoformat(),
    }
