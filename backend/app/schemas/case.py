"""Pydantic schemas for case management endpoints."""

from typing import Optional

from pydantic import BaseModel, Field

# --- Case ---

class CaseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str = ""
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    assigned_to: Optional[str] = None
    tags: list[str] = []
    source_type: Optional[str] = None  # alert, entity, manual
    source_id: Optional[str] = None
    linked_entity_ids: list[str] = []
    linked_alert_ids: list[str] = []


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(open|active|closed)$")
    priority: Optional[str] = Field(default=None, pattern="^(low|medium|high|critical)$")
    severity: Optional[str] = Field(default=None, pattern="^(low|medium|high|critical)$")
    assigned_to: Optional[str] = None
    tags: Optional[list[str]] = None


class CaseSummary(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    severity: str
    entity_count: int
    alert_count: int
    evidence_count: int
    created_by: str
    assigned_to: Optional[str] = None
    tags: list[str] = []
    opened_at: str
    closed_at: Optional[str] = None
    created_at: str
    updated_at: str


class CaseDetail(BaseModel):
    id: str
    title: str
    description: str
    status: str
    priority: str
    severity: str
    entity_count: int
    alert_count: int
    evidence_count: int
    linked_entity_ids: list[str] = []
    linked_alert_ids: list[str] = []
    created_by: str
    assigned_to: Optional[str] = None
    tags: list[str] = []
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    summary_json: Optional[dict] = None
    opened_at: str
    closed_at: Optional[str] = None
    created_at: str
    updated_at: str


# --- Evidence ---

class EvidenceAdd(BaseModel):
    evidence_type: str  # event, alert, pattern, relationship, risk_score, behavior, insight
    source_table: str
    source_id: str
    title: str
    description: str = ""
    data_snapshot: Optional[dict] = None
    confidence: Optional[float] = None
    relevance_note: str = ""
    computation_params: Optional[dict] = None


class EvidenceItem(BaseModel):
    id: str
    case_id: str
    evidence_type: str
    source_table: str
    source_id: str
    title: str
    description: str
    data_snapshot: Optional[dict] = None
    confidence: Optional[float] = None
    relevance_note: str = ""
    added_by: str
    computation_params: Optional[dict] = None
    created_at: str


# --- Notes ---

class NoteAdd(BaseModel):
    content: str = Field(..., min_length=1)
    author: str = "operator"
    note_type: str = Field(default="general", pattern="^(general|finding|action|decision)$")


class NoteItem(BaseModel):
    id: str
    case_id: str
    author: str
    content: str
    note_type: str
    created_at: str


# --- Case Timeline ---

class CaseTimelineItem(BaseModel):
    type: str  # event, alert, evidence, note
    id: str
    timestamp: str
    title: str
    description: str = ""
    severity: Optional[str] = None
    confidence: Optional[float] = None
    entity_id: Optional[str] = None
    evidence_type: Optional[str] = None


class CaseTimeline(BaseModel):
    case_id: str
    total_items: int
    items: list[CaseTimelineItem] = []


# --- Intelligence Summary ---

class CaseIntelSummary(BaseModel):
    case_id: str
    title: str
    key_entities: list[dict] = []
    detected_patterns: list[dict] = []
    risk_levels: dict = {}
    confidence_levels: dict = {}
    limitations: list[str] = []
    findings: list[str] = []
    generated_at: str


# --- Audit Log ---

class AuditLogEntry(BaseModel):
    id: str
    actor: str
    role: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    detail: Optional[str] = None
    metadata_json: Optional[dict] = None
    performed_at: str


# --- Link Actions ---

class LinkEntitiesRequest(BaseModel):
    entity_ids: list[str]


class LinkAlertsRequest(BaseModel):
    alert_ids: list[str]


class CaseActionResponse(BaseModel):
    id: str
    status: str
    message: str = ""
