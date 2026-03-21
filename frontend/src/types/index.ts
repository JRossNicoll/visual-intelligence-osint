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
