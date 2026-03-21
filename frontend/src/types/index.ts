// Core data types for the VIOSINT platform

export interface Stream {
  id: string;
  name: string;
  source_type: 'rtsp' | 'file' | 'webrtc';
  source_url?: string;
  file_path?: string;
  status: 'inactive' | 'active' | 'processing' | 'error' | 'ready';
  fps?: number;
  width?: number;
  height?: number;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  is_live: boolean;
  started_at?: string;
  stopped_at?: string;
  total_frames_processed: number;
  total_detections: number;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  entity_type: 'person' | 'vehicle' | 'object';
  label: string;
  confidence: number;
  attributes?: Record<string, string | number>;
  thumbnail_path?: string;
  first_seen: string;
  last_seen: string;
  total_sightings: number;
  first_stream_id?: string;
  last_stream_id?: string;
  match_cluster_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Target {
  id: string;
  name: string;
  description?: string;
  target_type: 'person' | 'vehicle' | 'object';
  is_active: boolean;
  text_query?: string;
  reference_image_path?: string;
  similarity_threshold: number;
  attribute_filters?: Record<string, string>;
  alert_enabled: boolean;
  webhook_url?: string;
  total_matches: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  alert_type: 'target_match' | 'reappearance' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  entity_id?: string;
  target_id?: string;
  stream_id?: string;
  confidence?: number;
  similarity_score?: number;
  frame_number?: number;
  thumbnail_path?: string;
  is_read: boolean;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  webhook_delivered: boolean;
  metadata_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Detection {
  entity_id: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number]; // x, y, w, h
  track_id?: number;
  entity_type: string;
  attributes?: Record<string, string | number>;
}

export interface WSFrameDetections {
  type: 'frame_detections';
  stream_id: string;
  frame_number: number;
  timestamp: string;
  detections: Detection[];
  active_tracks: number;
  fps: number;
}

export interface WSStreamStats {
  type: 'stream_stats';
  stream_id: string;
  frames_processed: number;
  detections_count: number;
  active_tracks: number;
  current_fps: number;
}

export interface WSAlertNotification {
  type: 'alert';
  alert_id: string;
  alert_type: string;
  severity: string;
  title: string;
  entity_id?: string;
  target_id?: string;
  stream_id?: string;
  similarity_score?: number;
  timestamp: string;
}

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface EntityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Intelligence Engine Types

export interface EntityProfile {
  id: string;
  entity_id: string;
  entity_type: string;
  first_seen: string;
  last_seen: string;
  visit_count: number;
  total_duration_seconds: number;
  common_locations?: Array<{ location_id: string; name: string; visit_count: number }>;
  last_location_id?: string;
  last_location_name?: string;
  behavior_summary?: { behaviors: string[]; behavior_count: number };
  behavior_tags?: string[];
  temporal_pattern?: {
    has_periodicity: boolean;
    dominant_period_hours?: number;
    peak_hours?: number[];
    peak_days?: number[];
    periodicity_confidence?: number;
  };
  associated_entities?: Array<{ entity_id: string; strength: number }>;
  association_count: number;
  risk_score: number;
  risk_factors?: Array<{ factor: string; weight: number; description: string }>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  predicted_next_location?: { location_id: string; name: string; probability: number };
  predicted_next_time?: { window_start: string; window_end: string; confidence: number };
  profile_completeness: number;
  last_analyzed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TemporalEvent {
  id: string;
  entity_id: string;
  stream_id: string;
  location_id?: string;
  location_name?: string;
  event_type: string;
  timestamp: string;
  duration_seconds?: number;
  confidence: number;
  attributes?: Record<string, unknown>;
  co_occurring_entities?: string[];
  hour_of_day: number;
  day_of_week: number;
  is_weekend: boolean;
  created_at: string;
}

export interface BehaviorRecord {
  id: string;
  entity_id: string;
  behavior_type: string;
  description: string;
  confidence: number;
  severity: string;
  location_id?: string;
  location_name?: string;
  stream_id?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  associated_entity_ids?: string[];
  pattern_data?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface IntelligenceInsight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  severity: string;
  entity_ids?: string[];
  location_ids?: string[];
  stream_ids?: string[];
  confidence: number;
  evidence?: Record<string, unknown>;
  recommendation?: string;
  is_reviewed: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface AnalysisResult {
  entity_id: string;
  status: string;
  temporal_pattern?: Record<string, unknown>;
  anomaly?: Record<string, unknown>;
  behaviors: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
  risk?: Record<string, unknown>;
  prediction?: Record<string, unknown>;
  analysis_timestamp?: string;
}

export interface NLQueryResult {
  original_query: string;
  interpreted_query: string;
  generated_sql?: string;
  generated_cypher?: string;
  query_explanation: string;
  results: Array<Record<string, unknown>>;
  result_count: number;
  confidence: number;
}

export interface RiskScore {
  entity_id: string;
  risk_score: number;
  risk_level: string;
  anomaly_component: number;
  association_component: number;
  behavior_component: number;
  w1: number;
  w2: number;
  w3: number;
  risk_factors: Array<{ factor: string; weight: number; description: string }>;
  explanation: string;
}

export interface Prediction {
  entity_id: string;
  predicted_time_window_start?: string;
  predicted_time_window_end?: string;
  time_confidence: number;
  predicted_location_id?: string;
  predicted_location_name?: string;
  location_confidence: number;
  method: string;
  evidence?: Record<string, unknown>;
  explanation: string;
}

// ===================== Operator Types =====================

export interface OperatorDashboardData {
  unread_alerts: number;
  critical_alerts_24h: number;
  high_risk_entities: number;
  watchlist_count: number;
  recent_events_1h: number;
  total_tracked_entities: number;
  severity_breakdown_24h: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  timestamp: string;
}

export interface OperatorAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entity_ids: string[];
  confidence: number;
  priority_score: number;
  is_read: boolean;
  is_acknowledged: boolean;
  recommended_actions: string[];
  created_at: string;
  dedup_hash: string;
  group_id?: string;
}

export interface FeedEvent {
  id: string;
  entity_id: string;
  event_type: string;
  timestamp: string;
  location_id?: string;
  location_name: string;
  confidence?: number;
  co_occurring_entities: string[];
  hour_of_day?: number;
  is_weekend?: boolean;
}

export interface WatchlistEntry {
  entity_id: string;
  added_at: string;
  reason: string;
  priority: string;
  entity_type: string;
  risk_score: number;
  risk_level: string;
  last_seen?: string;
  last_location?: string;
  visit_count: number;
  behavior_tags: string[];
}

export interface EntityFullProfile {
  entity_id: string;
  entity_type: string;
  risk_score: number;
  risk_level: string;
  risk_summary: string;
  first_seen?: string;
  last_seen?: string;
  visit_count: number;
  last_location?: string;
  common_locations: Array<{ location_id: string; name: string; visit_count: number }>;
  associated_entities: Array<{ entity_id: string; strength: number }>;
  behavior_tags: string[];
  behaviors: Array<{
    type: string;
    description: string;
    confidence: number;
    severity: string;
    started_at: string;
    is_active: boolean;
  }>;
  recent_events: Array<{
    id: string;
    event_type: string;
    timestamp: string;
    location_name: string;
    confidence?: number;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    alert_type: string;
    created_at: string;
  }>;
  insights: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    severity: string;
    confidence: number;
  }>;
  temporal_pattern?: Record<string, unknown>;
  predicted_next_time?: Record<string, unknown>;
  predicted_next_location?: Record<string, unknown>;
  is_on_watchlist: boolean;
  profile_completeness: number;
  last_analyzed_at?: string;
}

export interface TimelineItem {
  type: 'event' | 'alert';
  id: string;
  timestamp: string;
  entity_id?: string;
  event_type?: string;
  location_name?: string;
  confidence?: number;
  co_occurring_entities?: string[];
  alert_type?: string;
  severity?: string;
  title?: string;
  description?: string;
}

export interface InvestigationTimeline {
  entity_id?: string;
  from_time: string;
  to_time: string;
  total_events: number;
  total_alerts: number;
  items: TimelineItem[];
}

export interface EntitySearchResult {
  entity_id: string;
  entity_type: string;
  risk_score: number;
  risk_level: string;
  visit_count: number;
  first_seen?: string;
  last_seen?: string;
  last_location?: string;
  behavior_tags: string[];
}

export interface IntelligenceSummary {
  period_days: number;
  risk_distribution: Record<string, number>;
  top_risk_entities: Array<{
    entity_id: string;
    entity_type: string;
    risk_score: number;
    risk_level: string;
    visit_count: number;
    last_seen?: string;
    behavior_tags: string[];
  }>;
  behavior_distribution: Record<string, number>;
  alert_trend: Array<{ date: string; count: number }>;
  entity_trend: Array<{ date: string; new_entities: number }>;
  active_insights: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    severity: string;
    confidence: number;
    created_at: string;
  }>;
  top_locations: Array<{ location: string; event_count: number }>;
  generated_at: string;
}
