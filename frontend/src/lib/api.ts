/**
 * API client for the VIOSINT backend.
 */

import type {
  Stream, Entity, Target, Alert, EntityGraph,
  EntityProfile, TemporalEvent, BehaviorRecord,
  IntelligenceInsight, AnalysisResult, NLQueryResult,
  RiskScore, Prediction,
  OperatorDashboardData, OperatorAlert, FeedEvent,
  WatchlistEntry, EntityFullProfile, InvestigationTimeline,
  EntitySearchResult, IntelligenceSummary,
  CaseSummary, CaseDetail, CaseEvidence, CaseNote,
  CaseTimeline, CaseIntelSummary, AuditLogEntry,
  VideoFile, PendingMatch, CaseIntelligenceResult,
  AuthToken, AuthUser,
  OntologyEntityType, OntologyRelationType, OntologyRelationship,
  InferenceRule, ActionDefinition, ActionExecution,
  DataSource, IngestedRecord, CorrelationRecord, FusionSummaryItem,
  WorkflowDefinition, WorkflowExecution, StepExecution, ApprovalRequest,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1';
const REQUEST_TIMEOUT_MS = 10000;

// --- Auth token management (in-memory only, NOT localStorage) ---
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

export function clearAuth() {
  _authToken = null;
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${API_PREFIX}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (res.status === 401) {
      _authToken = null;
      throw new Error('Unauthorized — please log in again');
    }

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${res.status}: ${error}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Raw fetch without JSON content-type (for file uploads)
async function fetchAPIRaw(path: string, options?: RequestInit): Promise<Response> {
  const url = `${API_URL}${API_PREFIX}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2min for uploads

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (res.status === 401) {
      _authToken = null;
      throw new Error('Unauthorized — please log in again');
    }

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${res.status}: ${error}`);
    }

    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Auth API ---
export const authApi = {
  login: async (username: string, password: string): Promise<AuthToken> => {
    const url = `${API_URL}${API_PREFIX}/auth/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(res.status === 401 ? 'Invalid credentials' : `Login failed: ${error}`);
    }
    const data: AuthToken = await res.json();
    _authToken = data.access_token;
    return data;
  },

  me: (): AuthUser | null => {
    // Not a real endpoint — username/role are extracted from login response
    return null;
  },

  logout: () => {
    _authToken = null;
  },
};

// Stream endpoints
export const streamsApi = {
  list: (params?: { status?: string; source_type?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.source_type) query.set('source_type', params.source_type);
    const qs = query.toString();
    return fetchAPI<Stream[]>(`/streams${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => fetchAPI<Stream>(`/streams/${id}`),

  create: (data: {
    name: string;
    source_type: string;
    source_url?: string;
    location_name?: string;
    latitude?: number;
    longitude?: number;
    is_live?: boolean;
  }) => fetchAPI<Stream>('/streams', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Stream>) =>
    fetchAPI<Stream>(`/streams/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    fetch(`${API_URL}${API_PREFIX}/streams/${id}`, { method: 'DELETE' }),

  start: (id: string) =>
    fetchAPI<Stream>(`/streams/${id}/start`, { method: 'POST' }),

  stop: (id: string) =>
    fetchAPI<Stream>(`/streams/${id}/stop`, { method: 'POST' }),

  getStatus: (id: string) =>
    fetchAPI<{ stream_id: string; status: string; current_fps?: number; frames_processed: number; detections_count: number; active_tracks: number }>(
      `/streams/${id}/status`
    ),
};

// Entity endpoints
export const entitiesApi = {
  list: (params?: {
    entity_type?: string;
    label?: string;
    min_confidence?: number;
    stream_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.entity_type) query.set('entity_type', params.entity_type);
    if (params?.label) query.set('label', params.label);
    if (params?.min_confidence) query.set('min_confidence', params.min_confidence.toString());
    if (params?.stream_id) query.set('stream_id', params.stream_id);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const qs = query.toString();
    return fetchAPI<Entity[]>(`/entities${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => fetchAPI<Entity>(`/entities/${id}`),

  getGraph: (id: string, depth?: number) =>
    fetchAPI<EntityGraph>(`/entities/${id}/graph${depth ? `?depth=${depth}` : ''}`),

  getTimeline: (id: string) =>
    fetchAPI<Array<{ id: string; stream_id: string; first_timestamp: string; last_timestamp: string; detection_count: number; avg_confidence: number }>>(
      `/entities/${id}/timeline`
    ),
};

// Target endpoints
export const targetsApi = {
  list: (params?: { is_active?: boolean; target_type?: string }) => {
    const query = new URLSearchParams();
    if (params?.is_active !== undefined) query.set('is_active', params.is_active.toString());
    if (params?.target_type) query.set('target_type', params.target_type);
    const qs = query.toString();
    return fetchAPI<Target[]>(`/targets${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => fetchAPI<Target>(`/targets/${id}`),

  create: (data: {
    name: string;
    target_type: string;
    text_query?: string;
    description?: string;
    similarity_threshold?: number;
    attribute_filters?: Record<string, string>;
    alert_enabled?: boolean;
    webhook_url?: string;
    priority?: string;
  }) => fetchAPI<Target>('/targets', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Target>) =>
    fetchAPI<Target>(`/targets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    fetch(`${API_URL}${API_PREFIX}/targets/${id}`, { method: 'DELETE' }),
};

// Alert endpoints
export const alertsApi = {
  list: (params?: {
    alert_type?: string;
    severity?: string;
    is_read?: boolean;
    is_acknowledged?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.alert_type) query.set('alert_type', params.alert_type);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.is_read !== undefined) query.set('is_read', params.is_read.toString());
    if (params?.is_acknowledged !== undefined) query.set('is_acknowledged', params.is_acknowledged.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const qs = query.toString();
    return fetchAPI<Alert[]>(`/alerts${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => fetchAPI<Alert>(`/alerts/${id}`),

  getUnreadCount: () =>
    fetchAPI<{ unread_count: number }>('/alerts/unread-count'),

  markAsRead: (id: string) =>
    fetchAPI<Alert>(`/alerts/${id}/read`, { method: 'POST' }),

  acknowledge: (id: string) =>
    fetchAPI<Alert>(`/alerts/${id}/acknowledge`, { method: 'POST' }),
};

// Health check
export const healthApi = {
  check: () => fetch(`${API_URL}/health`).then(r => r.json()),
  detailed: () => fetch(`${API_URL}/health/detailed`).then(r => r.json()),
};

// Intelligence endpoints
export const intelligenceApi = {
  // Entity Profiles
  listProfiles: (params?: {
    risk_level?: string;
    entity_type?: string;
    min_risk_score?: number;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.risk_level) query.set('risk_level', params.risk_level);
    if (params?.entity_type) query.set('entity_type', params.entity_type);
    if (params?.min_risk_score !== undefined) query.set('min_risk_score', params.min_risk_score.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const qs = query.toString();
    return fetchAPI<EntityProfile[]>(`/intelligence/profiles${qs ? `?${qs}` : ''}`);
  },

  getProfile: (entityId: string) =>
    fetchAPI<EntityProfile>(`/intelligence/profiles/${entityId}`),

  // Temporal Events
  listEvents: (params?: {
    entity_id?: string;
    stream_id?: string;
    event_type?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.entity_id) query.set('entity_id', params.entity_id);
    if (params?.stream_id) query.set('stream_id', params.stream_id);
    if (params?.event_type) query.set('event_type', params.event_type);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<TemporalEvent[]>(`/intelligence/events${qs ? `?${qs}` : ''}`);
  },

  // Behavior Records
  listBehaviors: (params?: {
    entity_id?: string;
    behavior_type?: string;
    is_active?: boolean;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.entity_id) query.set('entity_id', params.entity_id);
    if (params?.behavior_type) query.set('behavior_type', params.behavior_type);
    if (params?.is_active !== undefined) query.set('is_active', params.is_active.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<BehaviorRecord[]>(`/intelligence/behaviors${qs ? `?${qs}` : ''}`);
  },

  // Intelligence Insights
  listInsights: (params?: {
    insight_type?: string;
    severity?: string;
    is_reviewed?: boolean;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.insight_type) query.set('insight_type', params.insight_type);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.is_reviewed !== undefined) query.set('is_reviewed', params.is_reviewed.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<IntelligenceInsight[]>(`/intelligence/insights${qs ? `?${qs}` : ''}`);
  },

  reviewInsight: (insightId: string) =>
    fetchAPI<IntelligenceInsight>(`/intelligence/insights/${insightId}/review`, { method: 'POST' }),

  dismissInsight: (insightId: string) =>
    fetchAPI<IntelligenceInsight>(`/intelligence/insights/${insightId}/dismiss`, { method: 'POST' }),

  // Analysis
  analyzeEntity: (entityId: string) =>
    fetchAPI<AnalysisResult>('/intelligence/analyze', {
      method: 'POST',
      body: JSON.stringify({ entity_id: entityId }),
    }),

  analyzeBatch: (minEvents?: number) =>
    fetchAPI<{ entities_analyzed: number; errors: number; total_eligible: number }>(
      '/intelligence/analyze-batch',
      { method: 'POST', body: JSON.stringify({ min_events: minEvents || 3 }) },
    ),

  // NL Query
  query: (queryText: string, maxResults?: number) =>
    fetchAPI<NLQueryResult>('/intelligence/query', {
      method: 'POST',
      body: JSON.stringify({ query: queryText, max_results: maxResults || 20 }),
    }),

  // Risk Scores
  getRisk: (entityId: string) =>
    fetchAPI<RiskScore>(`/intelligence/risk/${entityId}`),

  // Predictions
  getPrediction: (entityId: string) =>
    fetchAPI<Prediction>(`/intelligence/predictions/${entityId}`),
};

// Operator endpoints
export const operatorApi = {
  // Dashboard
  getDashboard: () =>
    fetchAPI<OperatorDashboardData>('/operator/dashboard'),

  // Alerts (prioritized, deduplicated, grouped)
  getAlerts: (params?: {
    severity?: string;
    alert_type?: string;
    unread_only?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.severity) query.set('severity', params.severity);
    if (params?.alert_type) query.set('alert_type', params.alert_type);
    if (params?.unread_only) query.set('unread_only', 'true');
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const qs = query.toString();
    return fetchAPI<OperatorAlert[]>(`/operator/alerts${qs ? `?${qs}` : ''}`);
  },

  reviewAlert: (alertId: string) =>
    fetchAPI<{ id: string; status: string }>(`/operator/alerts/${alertId}/review`, { method: 'POST' }),

  escalateAlert: (alertId: string) =>
    fetchAPI<{ id: string; status: string; new_severity?: string }>(`/operator/alerts/${alertId}/escalate`, { method: 'POST' }),

  dismissAlert: (alertId: string) =>
    fetchAPI<{ id: string; status: string }>(`/operator/alerts/${alertId}/dismiss`, { method: 'POST' }),

  // Live Feed
  getFeed: (params?: { limit?: number; entity_id?: string; since?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.entity_id) query.set('entity_id', params.entity_id);
    if (params?.since) query.set('since', params.since);
    const qs = query.toString();
    return fetchAPI<FeedEvent[]>(`/operator/feed${qs ? `?${qs}` : ''}`);
  },

  // Watchlist
  getWatchlist: () =>
    fetchAPI<WatchlistEntry[]>('/operator/watchlist'),

  addToWatchlist: (entityId: string, reason?: string, priority?: string) =>
    fetchAPI<{ entity_id: string; status: string }>(`/operator/watchlist/${entityId}`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '', priority: priority || 'medium' }),
    }),

  removeFromWatchlist: (entityId: string) =>
    fetch(`${API_URL}${API_PREFIX}/operator/watchlist/${entityId}`, { method: 'DELETE' }).then(r => r.json()),

  // Investigation Mode
  getEntityProfile: (entityId: string) =>
    fetchAPI<EntityFullProfile>(`/operator/entities/${entityId}/profile`),

  getTimeline: (params?: {
    entity_id?: string;
    from_time?: string;
    to_time?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.entity_id) query.set('entity_id', params.entity_id);
    if (params?.from_time) query.set('from_time', params.from_time);
    if (params?.to_time) query.set('to_time', params.to_time);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<InvestigationTimeline>(`/operator/timeline${qs ? `?${qs}` : ''}`);
  },

  searchEntities: (params?: {
    query?: string;
    risk_level?: string;
    entity_type?: string;
    min_risk_score?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.query) query.set('query', params.query);
    if (params?.risk_level) query.set('risk_level', params.risk_level);
    if (params?.entity_type) query.set('entity_type', params.entity_type);
    if (params?.min_risk_score !== undefined) query.set('min_risk_score', params.min_risk_score.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<EntitySearchResult[]>(`/operator/search${qs ? `?${qs}` : ''}`);
  },

  // Intelligence Mode
  getIntelligenceSummary: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return fetchAPI<IntelligenceSummary>(`/operator/intelligence${query}`);
  },
};

// Case Management endpoints
export const casesApi = {
  // Case CRUD
  list: (params?: {
    status?: string;
    priority?: string;
    assigned_to?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.assigned_to) query.set('assigned_to', params.assigned_to);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    const qs = query.toString();
    return fetchAPI<CaseSummary[]>(`/cases${qs ? `?${qs}` : ''}`);
  },

  get: (caseId: string) =>
    fetchAPI<CaseDetail>(`/cases/${caseId}`),

  create: (data: {
    title: string;
    description?: string;
    priority?: string;
    severity?: string;
    assigned_to?: string;
    tags?: string[];
    source_type?: string;
    source_id?: string;
    linked_entity_ids?: string[];
    linked_alert_ids?: string[];
  }) => fetchAPI<CaseDetail>('/cases', { method: 'POST', body: JSON.stringify(data) }),

  update: (caseId: string, data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    severity?: string;
    assigned_to?: string;
    tags?: string[];
  }) => fetchAPI<CaseDetail>(`/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Quick-create flows
  createFromAlert: (alertId: string) =>
    fetchAPI<CaseDetail>(`/cases/from-alert/${alertId}`, { method: 'POST' }),

  createFromEntity: (entityId: string) =>
    fetchAPI<CaseDetail>(`/cases/from-entity/${entityId}`, { method: 'POST' }),

  // Linking
  linkEntities: (caseId: string, entityIds: string[]) =>
    fetchAPI<{ id: string; status: string; message: string }>(`/cases/${caseId}/entities`, {
      method: 'POST', body: JSON.stringify({ entity_ids: entityIds }),
    }),

  linkAlerts: (caseId: string, alertIds: string[]) =>
    fetchAPI<{ id: string; status: string; message: string }>(`/cases/${caseId}/alerts`, {
      method: 'POST', body: JSON.stringify({ alert_ids: alertIds }),
    }),

  // Evidence
  addEvidence: (caseId: string, data: {
    evidence_type: string;
    source_table: string;
    source_id: string;
    title: string;
    description?: string;
    data_snapshot?: Record<string, unknown>;
    confidence?: number;
    relevance_note?: string;
    computation_params?: Record<string, unknown>;
  }) => fetchAPI<CaseEvidence>(`/cases/${caseId}/evidence`, {
    method: 'POST', body: JSON.stringify(data),
  }),

  getEvidence: (caseId: string, evidenceType?: string) => {
    const query = evidenceType ? `?evidence_type=${evidenceType}` : '';
    return fetchAPI<CaseEvidence[]>(`/cases/${caseId}/evidence${query}`);
  },

  // Notes
  addNote: (caseId: string, data: {
    content: string;
    author?: string;
    note_type?: string;
  }) => fetchAPI<CaseNote>(`/cases/${caseId}/notes`, {
    method: 'POST', body: JSON.stringify(data),
  }),

  getNotes: (caseId: string) =>
    fetchAPI<CaseNote[]>(`/cases/${caseId}/notes`),

  // Timeline
  getTimeline: (caseId: string, limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return fetchAPI<CaseTimeline>(`/cases/${caseId}/timeline${query}`);
  },

  // Summary
  generateSummary: (caseId: string) =>
    fetchAPI<CaseIntelSummary>(`/cases/${caseId}/summary`, { method: 'POST' }),

  // Audit
  getAudit: (caseId: string, limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return fetchAPI<AuditLogEntry[]>(`/cases/${caseId}/audit${query}`);
  },

  getAllAudit: (params?: {
    resource_type?: string;
    actor?: string;
    action?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.resource_type) query.set('resource_type', params.resource_type);
    if (params?.actor) query.set('actor', params.actor);
    if (params?.action) query.set('action', params.action);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<AuditLogEntry[]>(`/cases/audit/all${qs ? `?${qs}` : ''}`);
  },
};

// Sprint 1: Video Pipeline endpoints
export const videosApi = {
  upload: async (caseId: string, file: File): Promise<VideoFile> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchAPIRaw(`/videos/cases/${caseId}/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  list: (caseId: string) =>
    fetchAPI<VideoFile[]>(`/videos/cases/${caseId}`),

  get: (videoId: string) =>
    fetchAPI<VideoFile>(`/videos/${videoId}`),

  checkComplete: (caseId: string) =>
    fetchAPI<{ all_complete: boolean; total: number; complete: number; processing: number; failed: number; queued: number }>(
      `/videos/cases/${caseId}/check-complete`
    ),
};

// Sprint 1: Matching endpoints
export const matchingApi = {
  getPending: (caseId: string) =>
    fetchAPI<PendingMatch[]>(`/matching/cases/${caseId}/pending`),

  review: (matchId: string, decision: 'accepted' | 'rejected') =>
    fetchAPI<PendingMatch>(`/matching/${matchId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),

  run: (caseId: string) =>
    fetchAPI<{ matches_found: number; auto_merged: number; pending_review: number }>(
      `/matching/cases/${caseId}/run`,
      { method: 'POST' },
    ),

  stats: (caseId: string) =>
    fetchAPI<{ total_matches: number; auto_merged: number; pending: number; accepted: number; rejected: number }>(
      `/matching/cases/${caseId}/stats`
    ),
};

// Sprint 1: Case Intelligence endpoints
export const caseIntelligenceApi = {
  get: (caseId: string) =>
    fetchAPI<CaseIntelligenceResult>(`/case-intelligence/${caseId}`),

  generate: (caseId: string) =>
    fetchAPI<CaseIntelligenceResult>(`/case-intelligence/${caseId}/generate`, {
      method: 'POST',
    }),
};

// ===================== Ontology API =====================

export const ontologyApi = {
  listEntityTypes: (includeAbstract?: boolean) => {
    const q = includeAbstract === false ? '?include_abstract=false' : '';
    return fetchAPI<OntologyEntityType[]>(`/ontology/entity-types${q}`);
  },
  getEntityType: (id: string) => fetchAPI<OntologyEntityType>(`/ontology/entity-types/${id}`),
  createEntityType: (data: {
    name: string; display_name: string; description?: string;
    icon?: string; color?: string; parent_type_id?: string;
    property_schema?: Record<string, unknown>; is_abstract?: boolean;
  }) => fetchAPI<OntologyEntityType>('/ontology/entity-types', { method: 'POST', body: JSON.stringify(data) }),
  getTypeHierarchy: () => fetchAPI<Record<string, unknown>[]>('/ontology/entity-types/hierarchy'),

  listRelationTypes: () => fetchAPI<OntologyRelationType[]>('/ontology/relation-types'),
  getRelationType: (id: string) => fetchAPI<OntologyRelationType>(`/ontology/relation-types/${id}`),
  createRelationType: (data: {
    name: string; display_name: string; description?: string;
    source_type_id?: string; target_type_id?: string;
    is_directed?: boolean; is_symmetric?: boolean; propagation_weight?: number;
  }) => fetchAPI<OntologyRelationType>('/ontology/relation-types', { method: 'POST', body: JSON.stringify(data) }),

  listRelationships: (params?: { entity_id?: string; relation_type_id?: string; min_confidence?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.entity_id) query.set('entity_id', params.entity_id);
    if (params?.relation_type_id) query.set('relation_type_id', params.relation_type_id);
    if (params?.min_confidence !== undefined) query.set('min_confidence', params.min_confidence.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<OntologyRelationship[]>(`/ontology/relationships${qs ? `?${qs}` : ''}`);
  },

  listRules: (activeOnly?: boolean) => {
    const q = activeOnly === false ? '?active_only=false' : '';
    return fetchAPI<InferenceRule[]>(`/ontology/rules${q}`);
  },
  getRule: (id: string) => fetchAPI<InferenceRule>(`/ontology/rules/${id}`),
  createRule: (data: {
    name: string; description?: string; conditions: Record<string, unknown>;
    actions: Array<Record<string, unknown>>; applicable_entity_types?: string[];
    priority?: number; cooldown_seconds?: number;
  }) => fetchAPI<InferenceRule>('/ontology/rules', { method: 'POST', body: JSON.stringify(data) }),

  listActions: (category?: string) => {
    const q = category ? `?category=${category}` : '';
    return fetchAPI<ActionDefinition[]>(`/ontology/actions${q}`);
  },
  getAction: (id: string) => fetchAPI<ActionDefinition>(`/ontology/actions/${id}`),
  listActionExecutions: (params?: { entity_id?: string; status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.entity_id) query.set('entity_id', params.entity_id);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<ActionExecution[]>(`/ontology/actions/executions/history${qs ? `?${qs}` : ''}`);
  },

  seed: () => fetchAPI<{ status: string; seeded: Record<string, number> }>('/ontology/seed', { method: 'POST' }),
};

// ===================== Data Fusion API =====================

export const fusionApi = {
  listSources: (params?: { source_type?: string; status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.source_type) query.set('source_type', params.source_type);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<DataSource[]>(`/fusion/sources${qs ? `?${qs}` : ''}`);
  },
  getSource: (id: string) => fetchAPI<DataSource>(`/fusion/sources/${id}`),
  getSourceStats: () => fetchAPI<Record<string, unknown>>('/fusion/sources/stats'),
  createSource: (data: {
    name: string; display_name: string; description?: string;
    source_type: string; adapter_type?: string;
    connection_config?: Record<string, unknown>; field_mapping?: Record<string, unknown>;
    reliability_rating?: string; credibility_rating?: string;
  }) => fetchAPI<DataSource>('/fusion/sources', { method: 'POST', body: JSON.stringify(data) }),
  updateSource: (id: string, data: Record<string, unknown>) =>
    fetchAPI<DataSource>(`/fusion/sources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSource: (id: string) =>
    fetchAPI<{ status: string }>(`/fusion/sources/${id}`, { method: 'DELETE' }),

  ingestRecord: (data: { data_source_id: string; raw_data: Record<string, unknown>; external_id?: string }) =>
    fetchAPI<IngestedRecord>('/fusion/ingest', { method: 'POST', body: JSON.stringify(data) }),
  listRecords: (params?: { data_source_id?: string; processing_status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.data_source_id) query.set('data_source_id', params.data_source_id);
    if (params?.processing_status) query.set('processing_status', params.processing_status);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<IngestedRecord[]>(`/fusion/records${qs ? `?${qs}` : ''}`);
  },

  correlatePending: (batchSize?: number) => {
    const q = batchSize ? `?batch_size=${batchSize}` : '';
    return fetchAPI<Record<string, unknown>>(`/fusion/correlate/pending${q}`, { method: 'POST' });
  },
  listCorrelations: (params?: { entity_id?: string; status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.entity_id) query.set('entity_id', params.entity_id);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<CorrelationRecord[]>(`/fusion/correlations${qs ? `?${qs}` : ''}`);
  },
  reviewCorrelation: (id: string, decision: string) =>
    fetchAPI<CorrelationRecord>(`/fusion/correlations/${id}/review`, {
      method: 'POST', body: JSON.stringify({ decision }),
    }),

  listFusionSummaries: (minSources?: number) => {
    const q = minSources ? `?min_sources=${minSources}` : '';
    return fetchAPI<FusionSummaryItem[]>(`/fusion/summaries${q}`);
  },
  getFusionSummary: (entityId: string) => fetchAPI<FusionSummaryItem>(`/fusion/summaries/${entityId}`),
  computeFusionSummary: (entityId: string) =>
    fetchAPI<FusionSummaryItem>(`/fusion/summaries/${entityId}/compute`, { method: 'POST' }),
};

// ===================== Workflow API =====================

export const workflowApi = {
  listDefinitions: (params?: { category?: string; active_only?: boolean; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.active_only !== undefined) query.set('active_only', params.active_only.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<WorkflowDefinition[]>(`/workflows/definitions${qs ? `?${qs}` : ''}`);
  },
  getDefinition: (id: string) => fetchAPI<WorkflowDefinition>(`/workflows/definitions/${id}`),
  createDefinition: (data: {
    name: string; display_name: string; description?: string;
    category?: string; trigger_config: Record<string, unknown>;
    steps: Array<Record<string, unknown>>; sla_seconds?: number;
  }) => fetchAPI<WorkflowDefinition>('/workflows/definitions', { method: 'POST', body: JSON.stringify(data) }),
  deleteDefinition: (id: string) =>
    fetchAPI<{ status: string }>(`/workflows/definitions/${id}`, { method: 'DELETE' }),

  listExecutions: (params?: { workflow_definition_id?: string; status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.workflow_definition_id) query.set('workflow_definition_id', params.workflow_definition_id);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return fetchAPI<WorkflowExecution[]>(`/workflows/executions${qs ? `?${qs}` : ''}`);
  },
  getExecution: (id: string) => fetchAPI<WorkflowExecution>(`/workflows/executions/${id}`),
  getExecutionStats: () => fetchAPI<Record<string, unknown>>('/workflows/executions/stats'),
  getExecutionSteps: (id: string) => fetchAPI<StepExecution[]>(`/workflows/executions/${id}/steps`),
  startExecution: (data: {
    workflow_definition_id: string; trigger_type?: string;
    trigger_data?: Record<string, unknown>; context?: Record<string, unknown>;
    entity_id?: string; case_id?: string; alert_id?: string;
  }) => fetchAPI<WorkflowExecution>('/workflows/executions', { method: 'POST', body: JSON.stringify(data) }),
  advanceExecution: (id: string, stepResult?: Record<string, unknown>) =>
    fetchAPI<WorkflowExecution>(`/workflows/executions/${id}/advance`, {
      method: 'POST', body: JSON.stringify({ step_result: stepResult }),
    }),
  cancelExecution: (id: string, reason?: string) =>
    fetchAPI<WorkflowExecution>(`/workflows/executions/${id}/cancel`, {
      method: 'POST', body: JSON.stringify({ reason: reason || '' }),
    }),

  listPendingApprovals: (role?: string) => {
    const q = role ? `?role=${role}` : '';
    return fetchAPI<ApprovalRequest[]>(`/workflows/approvals${q}`);
  },
  decideApproval: (id: string, decision: string, comment?: string) =>
    fetchAPI<ApprovalRequest>(`/workflows/approvals/${id}/decide`, {
      method: 'POST', body: JSON.stringify({ decision, comment: comment || '' }),
    }),

  checkSlaBreaches: () => fetchAPI<{ breaches: Record<string, unknown>[]; count: number }>('/workflows/sla/breaches'),

  seed: () => fetchAPI<{ status: string; seeded: Record<string, number> }>('/workflows/seed', { method: 'POST' }),
};
