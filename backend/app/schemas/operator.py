"""Pydantic schemas for operator endpoints."""

from typing import Optional

from pydantic import BaseModel, Field

# --- Dashboard ---

class SeverityBreakdown(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class DashboardSummary(BaseModel):
    unread_alerts: int
    critical_alerts_24h: int
    high_risk_entities: int
    watchlist_count: int
    recent_events_1h: int
    total_tracked_entities: int
    severity_breakdown_24h: SeverityBreakdown
    timestamp: str


# --- Operator Alert ---

class OperatorAlert(BaseModel):
    id: str
    alert_type: str
    severity: str
    title: str
    description: str
    entity_ids: list[str] = []
    confidence: float
    priority_score: float
    is_read: bool
    is_acknowledged: bool
    recommended_actions: list[str] = []
    created_at: str
    dedup_hash: str
    group_id: Optional[str] = None


# --- Live Feed ---

class FeedEvent(BaseModel):
    id: str
    entity_id: str
    event_type: str
    timestamp: str
    location_id: Optional[str] = None
    location_name: str = "Unknown"
    confidence: Optional[float] = None
    co_occurring_entities: list[str] = []
    hour_of_day: Optional[int] = None
    is_weekend: Optional[bool] = None


# --- Watchlist ---

class WatchlistEntry(BaseModel):
    entity_id: str
    added_at: str = ""
    reason: str = ""
    priority: str = "medium"
    entity_type: str = "unknown"
    risk_score: float = 0.0
    risk_level: str = "low"
    last_seen: Optional[str] = None
    last_location: Optional[str] = None
    visit_count: int = 0
    behavior_tags: list[str] = []


class WatchlistAddRequest(BaseModel):
    reason: str = ""
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")


class WatchlistActionResponse(BaseModel):
    entity_id: str
    status: str


# --- Alert Actions ---

class AlertActionResponse(BaseModel):
    id: str
    status: str
    new_severity: Optional[str] = None


# --- Entity Profile (Investigation) ---

class EntityBehavior(BaseModel):
    type: str
    description: str
    confidence: float
    severity: str
    started_at: str
    is_active: bool


class EntityEvent(BaseModel):
    id: str
    event_type: str
    timestamp: str
    location_name: str = "Unknown"
    confidence: Optional[float] = None


class EntityAlert(BaseModel):
    id: str
    severity: str
    title: str
    alert_type: str
    created_at: str


class EntityInsight(BaseModel):
    id: str
    type: str
    title: str
    description: str
    severity: str
    confidence: float


class EntityFullProfile(BaseModel):
    entity_id: str
    entity_type: str
    risk_score: float
    risk_level: str
    risk_summary: str
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    visit_count: int = 0
    last_location: Optional[str] = None
    common_locations: list = []
    associated_entities: list = []
    behavior_tags: list[str] = []
    behaviors: list[EntityBehavior] = []
    recent_events: list[EntityEvent] = []
    alerts: list[EntityAlert] = []
    insights: list[EntityInsight] = []
    temporal_pattern: Optional[dict] = None
    predicted_next_time: Optional[dict] = None
    predicted_next_location: Optional[dict] = None
    is_on_watchlist: bool = False
    profile_completeness: float = 0.0
    last_analyzed_at: Optional[str] = None


# --- Investigation Timeline ---

class TimelineItem(BaseModel):
    type: str  # "event" or "alert"
    id: str
    timestamp: str
    entity_id: Optional[str] = None
    event_type: Optional[str] = None
    location_name: Optional[str] = None
    confidence: Optional[float] = None
    co_occurring_entities: Optional[list[str]] = None
    alert_type: Optional[str] = None
    severity: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


class InvestigationTimeline(BaseModel):
    entity_id: Optional[str] = None
    from_time: str
    to_time: str
    total_events: int
    total_alerts: int
    items: list[TimelineItem] = []


# --- Entity Search ---

class EntitySearchResult(BaseModel):
    entity_id: str
    entity_type: str
    risk_score: float
    risk_level: str
    visit_count: int = 0
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    last_location: Optional[str] = None
    behavior_tags: list[str] = []


# --- Intelligence Summary ---

class TopRiskEntity(BaseModel):
    entity_id: str
    entity_type: str
    risk_score: float
    risk_level: str
    visit_count: int = 0
    last_seen: Optional[str] = None
    behavior_tags: list[str] = []


class AlertTrendPoint(BaseModel):
    date: str
    count: int


class EntityTrendPoint(BaseModel):
    date: str
    new_entities: int


class LocationCount(BaseModel):
    location: str
    event_count: int


class InsightSummary(BaseModel):
    id: str
    type: str
    title: str
    description: str
    severity: str
    confidence: float
    created_at: str


class IntelligenceSummary(BaseModel):
    period_days: int
    risk_distribution: dict[str, int] = {}
    top_risk_entities: list[TopRiskEntity] = []
    behavior_distribution: dict[str, int] = {}
    alert_trend: list[AlertTrendPoint] = []
    entity_trend: list[EntityTrendPoint] = []
    active_insights: list[InsightSummary] = []
    top_locations: list[LocationCount] = []
    generated_at: str
