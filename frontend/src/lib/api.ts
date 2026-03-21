/**
 * API client for the VIOSINT backend.
 */

import type { Stream, Entity, Target, Alert, EntityGraph } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${API_PREFIX}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  return res.json();
}

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
