"""Ontology models — formal type hierarchy, relationship types, property schemas, and actions.

The ontology defines *what kinds of things exist* in the intelligence domain,
how they relate, what properties they carry, and what actions can be taken.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin

# ------------------------------------------------------------------ #
# Entity Type Hierarchy
# ------------------------------------------------------------------ #


class OntologyEntityType(Base, UUIDMixin, TimestampMixin):
    """A type in the entity hierarchy (e.g. Person, Vehicle, Device).

    Supports single-inheritance via parent_type_id so that
    ``Sedan -> Vehicle -> PhysicalObject`` is representable.
    """

    __tablename__ = "ontology_entity_types"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Hierarchy
    parent_type_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ontology_entity_types.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    hierarchy_depth: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Schema for required / optional properties on entities of this type
    property_schema: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Example: {"license_plate": {"type": "string", "required": true}, ...}

    # Whether this type is abstract (can't be instantiated directly)
    is_abstract: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ------------------------------------------------------------------ #
# Relationship Types
# ------------------------------------------------------------------ #


class OntologyRelationType(Base, UUIDMixin, TimestampMixin):
    """A typed, directed relationship between two entity types.

    E.g. ``Person -[DRIVES]-> Vehicle``, ``Person -[ASSOCIATES_WITH]-> Person``.
    """

    __tablename__ = "ontology_relation_types"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Allowed source/target entity type constraints (NULL = any)
    source_type_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ontology_entity_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_type_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ontology_entity_types.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Directionality
    is_directed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_symmetric: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Property schema for relationship attributes
    property_schema: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Inference weight — how strongly this relation propagates risk/attributes
    propagation_weight: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)

    is_builtin: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ------------------------------------------------------------------ #
# Entity Relationships (instances)
# ------------------------------------------------------------------ #


class EntityRelationship(Base, UUIDMixin, TimestampMixin):
    """A concrete relationship instance between two entities."""

    __tablename__ = "entity_relationships"

    relation_type_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ontology_relation_types.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    source_entity_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    target_entity_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Strength / confidence of this relationship
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    # Properties (typed per relation_type property_schema)
    properties: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Provenance
    source_system: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    evidence_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Time bounds
    valid_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    valid_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    is_inferred: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# ------------------------------------------------------------------ #
# Inference Rules
# ------------------------------------------------------------------ #


class InferenceRule(Base, UUIDMixin, TimestampMixin):
    """A declarative rule that the system evaluates to infer new facts.

    Example: IF entity.type == "person" AND entity.risk_score > 0.8
             AND relation(entity, ?, "associates_with")
             THEN create_alert(severity="high", ...)
    """

    __tablename__ = "inference_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=50, nullable=False)

    # Conditions — evaluated as a conjunction of predicates
    # Each condition: {"field": "...", "op": "==|>|<|in|contains|...", "value": ...}
    conditions: Mapped[dict] = mapped_column(JSON, nullable=False)

    # What entity types this rule applies to (NULL = all)
    applicable_entity_types: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Actions to fire when conditions are met
    # Each action: {"type": "create_alert|create_relationship|tag_entity|...", "params": {...}}
    actions: Mapped[list] = mapped_column(JSON, nullable=False)

    # Execution tracking
    last_evaluated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    times_fired: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_fired_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Cooldown — minimum seconds between firings for the same entity
    cooldown_seconds: Mapped[int] = mapped_column(Integer, default=300, nullable=False)


# ------------------------------------------------------------------ #
# Action Definitions
# ------------------------------------------------------------------ #


class ActionDefinition(Base, UUIDMixin, TimestampMixin):
    """A reusable action template that can be triggered by rules or workflows.

    Actions are the *verbs* of the ontology — what the system can *do*.
    """

    __tablename__ = "action_definitions"

    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(50), default="general", nullable=False,
    )  # alert, notification, escalation, enrichment, restriction, integration

    # Parameter schema — describes what inputs this action expects
    parameter_schema: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Execution type
    execution_type: Mapped[str] = mapped_column(
        String(50), default="internal", nullable=False,
    )  # internal, webhook, workflow, script

    # For webhook actions
    webhook_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    webhook_method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    webhook_headers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    is_builtin: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ActionExecution(Base, UUIDMixin, TimestampMixin):
    """Record of a single action execution — audit trail."""

    __tablename__ = "action_executions"

    action_definition_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("action_definitions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    triggered_by: Mapped[str] = mapped_column(
        String(100), nullable=False,
    )  # rule:<id>, workflow:<id>, user:<username>
    trigger_context: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Execution state
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True,
    )  # pending, running, completed, failed, skipped
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Input / output
    parameters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Linked resources
    entity_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("entities.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    case_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("cases.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
