"""Ontology API endpoints — entity types, relation types, rules, actions, relationships."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.services.ontology_service import OntologyService

router = APIRouter(prefix="/ontology", tags=["ontology"])


# ------------------------------------------------------------------ #
# Request / Response schemas
# ------------------------------------------------------------------ #


class EntityTypeCreate(BaseModel):
    name: str
    display_name: str
    description: str = ""
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_type_id: Optional[str] = None
    property_schema: Optional[dict] = None
    is_abstract: bool = False


class EntityTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    property_schema: Optional[dict] = None


class RelationTypeCreate(BaseModel):
    name: str
    display_name: str
    description: str = ""
    source_type_id: Optional[str] = None
    target_type_id: Optional[str] = None
    is_directed: bool = True
    is_symmetric: bool = False
    propagation_weight: float = 0.5
    property_schema: Optional[dict] = None


class RelationshipCreate(BaseModel):
    relation_type_id: str
    source_entity_id: str
    target_entity_id: str
    confidence: float = 1.0
    weight: float = 1.0
    properties: Optional[dict] = None
    source_system: Optional[str] = None
    is_inferred: bool = False


class InferenceRuleCreate(BaseModel):
    name: str
    description: str = ""
    conditions: dict
    actions: list
    applicable_entity_types: Optional[list[str]] = None
    priority: int = 50
    cooldown_seconds: int = 300


class InferenceRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    conditions: Optional[dict] = None
    actions: Optional[list] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    cooldown_seconds: Optional[int] = None


class ActionDefinitionCreate(BaseModel):
    name: str
    display_name: str
    description: str = ""
    category: str = "general"
    execution_type: str = "internal"
    parameter_schema: Optional[dict] = None
    webhook_url: Optional[str] = None
    webhook_method: Optional[str] = None
    webhook_headers: Optional[dict] = None


class EvaluateRulesRequest(BaseModel):
    entity_id: str
    entity_data: dict


# ------------------------------------------------------------------ #
# Entity Type endpoints
# ------------------------------------------------------------------ #


@router.get("/entity-types")
async def list_entity_types(
    include_abstract: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await OntologyService.list_entity_types(db, include_abstract=include_abstract)


@router.get("/entity-types/hierarchy")
async def get_type_hierarchy(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await OntologyService.get_type_hierarchy(db)


@router.get("/entity-types/{type_id}")
async def get_entity_type(
    type_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.get_entity_type(db, type_id)
    if not result:
        raise HTTPException(status_code=404, detail="Entity type not found")
    return result


@router.post("/entity-types", status_code=201)
async def create_entity_type(
    body: EntityTypeCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.create_entity_type(db, **body.model_dump())
    await db.commit()
    return result


@router.patch("/entity-types/{type_id}")
async def update_entity_type(
    type_id: str,
    body: EntityTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.update_entity_type(
        db, type_id, **body.model_dump(exclude_unset=True)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Entity type not found")
    await db.commit()
    return result


# ------------------------------------------------------------------ #
# Relation Type endpoints
# ------------------------------------------------------------------ #


@router.get("/relation-types")
async def list_relation_types(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await OntologyService.list_relation_types(db)


@router.get("/relation-types/{relation_id}")
async def get_relation_type(
    relation_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.get_relation_type(db, relation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Relation type not found")
    return result


@router.post("/relation-types", status_code=201)
async def create_relation_type(
    body: RelationTypeCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.create_relation_type(db, **body.model_dump())
    await db.commit()
    return result


# ------------------------------------------------------------------ #
# Relationship (instance) endpoints
# ------------------------------------------------------------------ #


@router.get("/relationships")
async def list_relationships(
    entity_id: Optional[str] = Query(None),
    relation_type_id: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await OntologyService.list_relationships(
        db,
        entity_id=entity_id,
        relation_type_id=relation_type_id,
        min_confidence=min_confidence,
        limit=limit,
    )


@router.get("/relationships/entity/{entity_id}")
async def get_entity_relationships(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await OntologyService.get_entity_relationships(db, entity_id)


@router.post("/relationships", status_code=201)
async def create_relationship(
    body: RelationshipCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.create_relationship(db, **body.model_dump())
    await db.commit()
    return result


# ------------------------------------------------------------------ #
# Inference Rule endpoints
# ------------------------------------------------------------------ #


@router.get("/rules")
async def list_inference_rules(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await OntologyService.list_inference_rules(db, active_only=active_only)


@router.get("/rules/{rule_id}")
async def get_inference_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.get_inference_rule(db, rule_id)
    if not result:
        raise HTTPException(status_code=404, detail="Inference rule not found")
    return result


@router.post("/rules", status_code=201)
async def create_inference_rule(
    body: InferenceRuleCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.create_inference_rule(db, **body.model_dump())
    await db.commit()
    return result


@router.patch("/rules/{rule_id}")
async def update_inference_rule(
    rule_id: str,
    body: InferenceRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.update_inference_rule(
        db, rule_id, **body.model_dump(exclude_unset=True)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Inference rule not found")
    await db.commit()
    return result


@router.post("/rules/evaluate")
async def evaluate_rules(
    body: EvaluateRulesRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    fired = await OntologyService.evaluate_rules_for_entity(
        db, body.entity_id, body.entity_data
    )
    await db.commit()
    return {"entity_id": body.entity_id, "fired_actions": fired}


# ------------------------------------------------------------------ #
# Action Definition endpoints
# ------------------------------------------------------------------ #


@router.get("/actions")
async def list_action_definitions(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await OntologyService.list_action_definitions(db, category=category)


@router.get("/actions/{action_id}")
async def get_action_definition(
    action_id: str,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.get_action_definition(db, action_id)
    if not result:
        raise HTTPException(status_code=404, detail="Action definition not found")
    return result


@router.post("/actions", status_code=201)
async def create_action_definition(
    body: ActionDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await OntologyService.create_action_definition(db, **body.model_dump())
    await db.commit()
    return result


@router.get("/actions/executions/history")
async def list_action_executions(
    entity_id: Optional[str] = Query(None),
    case_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    return await OntologyService.list_action_executions(
        db, entity_id=entity_id, case_id=case_id, status=status, limit=limit
    )


# ------------------------------------------------------------------ #
# Seed
# ------------------------------------------------------------------ #


@router.post("/seed")
async def seed_ontology(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    stats = await OntologyService.seed_builtins(db)
    await db.commit()
    return {"status": "ok", "seeded": stats}
