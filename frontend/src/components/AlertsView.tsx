'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  Eye,
  X,
  Zap,
} from 'lucide-react';
import { alertsApi } from '@/lib/api';
import type { Alert } from '@/types';
import { formatRelativeTime, cn } from '@/lib/utils';

interface AlertDetailProps {
  alert: Alert;
  onClose: () => void;
  onAcknowledge: (id: string) => Promise<void>;
  onMarkRead: (id: string) => Promise<void>;
}

function AlertDetail({ alert, onClose, onAcknowledge, onMarkRead }: AlertDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-g-surface border border-g-border rounded-xl overflow-hidden shadow-2xl shadow-black/50 animate-fade-in">
        {/* Severity Banner */}
        <div className={cn(
          'px-5 py-3.5 border-b flex items-center justify-between',
          alert.severity === 'critical' ? 'border-red-500/20 bg-red-500/[0.05]' :
          alert.severity === 'high' ? 'border-orange-500/20 bg-orange-500/[0.05]' :
          alert.severity === 'medium' ? 'border-yellow-500/20 bg-yellow-500/[0.05]' :
          'border-blue-500/20 bg-blue-500/[0.05]'
        )}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={cn(
              'w-4 h-4',
              alert.severity === 'critical' ? 'text-red-400' :
              alert.severity === 'high' ? 'text-orange-400' :
              alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
            )} />
            <span className="text-xs font-medium text-g-text capitalize">
              {alert.severity} — {alert.alert_type.replace(/_/g, ' ')}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] transition-colors rounded-md">
            <X className="w-4 h-4 text-g-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-g-text mb-1">{alert.title}</h3>
            {alert.description && (
              <p className="text-xs text-g-text-muted">{alert.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {alert.confidence != null && (
              <div className="bg-g-card border border-g-border rounded-lg p-3">
                <div className="text-[11px] text-g-text-muted mb-1">Confidence</div>
                <div className="text-sm font-semibold text-white">{Math.round(alert.confidence * 100)}%</div>
              </div>
            )}
            {alert.similarity_score != null && (
              <div className="bg-g-card border border-g-border rounded-lg p-3">
                <div className="text-[11px] text-g-text-muted mb-1">Similarity</div>
                <div className="text-sm font-semibold text-white">{Math.round(alert.similarity_score * 100)}%</div>
              </div>
            )}
            {alert.frame_number != null && (
              <div className="bg-g-card border border-g-border rounded-lg p-3">
                <div className="text-[11px] text-g-text-muted mb-1">Frame</div>
                <div className="text-sm font-semibold text-white font-mono">#{alert.frame_number}</div>
              </div>
            )}
            <div className="bg-g-card border border-g-border rounded-lg p-3">
              <div className="text-[11px] text-g-text-muted mb-1">Time</div>
              <div className="text-sm text-white">{formatRelativeTime(alert.created_at)}</div>
            </div>
          </div>

          {/* References */}
          <div className="bg-g-card border border-g-border rounded-lg divide-y divide-g-border">
            {alert.entity_id && (
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-g-text-muted">Entity</span>
                <span className="text-[11px] font-mono text-g-text-secondary bg-white/[0.03] px-2 py-0.5 rounded">{alert.entity_id.slice(0, 16)}...</span>
              </div>
            )}
            {alert.target_id && (
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-g-text-muted">Target</span>
                <span className="text-[11px] font-mono text-g-text-secondary bg-white/[0.03] px-2 py-0.5 rounded">{alert.target_id.slice(0, 16)}...</span>
              </div>
            )}
            {alert.stream_id && (
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-g-text-muted">Stream</span>
                <span className="text-[11px] font-mono text-g-text-secondary bg-white/[0.03] px-2 py-0.5 rounded">{alert.stream_id.slice(0, 16)}...</span>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {alert.is_read && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-blue-400 bg-blue-400/10 rounded-full">
                <Eye className="w-3 h-3" /> Read
              </span>
            )}
            {alert.is_acknowledged && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-green-400 bg-green-400/10 rounded-full">
                <CheckCircle className="w-3 h-3" /> Acknowledged
              </span>
            )}
            {alert.webhook_delivered && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-purple-400 bg-purple-400/10 rounded-full">
                <Zap className="w-3 h-3" /> Webhook Sent
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            {!alert.is_read && (
              <button
                onClick={() => onMarkRead(alert.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-g-text border border-g-border rounded-md hover:bg-white/[0.04] transition-all"
              >
                <Eye className="w-3.5 h-3.5" /> Mark Read
              </button>
            )}
            {!alert.is_acknowledged && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-g-success border border-g-success/20 rounded-md hover:bg-g-success/10 transition-all"
              >
                <Check className="w-3.5 h-3.5" /> Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsView() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterRead, setFilterRead] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const fetchAlerts = useCallback(async () => {
    try {
      const params: {
        severity?: string;
        alert_type?: string;
        is_read?: boolean;
        limit: number;
        offset: number;
      } = { limit: pageSize, offset: page * pageSize };
      if (filterSeverity) params.severity = filterSeverity;
      if (filterType) params.alert_type = filterType;
      if (filterRead === 'unread') params.is_read = false;
      if (filterRead === 'read') params.is_read = true;
      const data = await alertsApi.list(params);
      setAlerts(data);
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterType, filterRead, page]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await alertsApi.acknowledge(id);
      await fetchAlerts();
      setSelectedAlert(null);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await alertsApi.markAsRead(id);
      await fetchAlerts();
      setSelectedAlert(null);
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const filterChip = (active: boolean) => cn(
    'px-3 py-1.5 text-xs font-medium rounded-md border transition-all capitalize',
    active ? 'text-g-accent bg-g-accent/10 border-g-accent/20' : 'text-g-text-muted border-g-border hover:text-g-text hover:border-g-border-light'
  );

  return (
    <div className="p-6 pb-14 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Intelligence Alerts</h2>
          <p className="text-sm text-g-text-secondary mt-1">Target matches, reappearances, and anomaly notifications</p>
        </div>
        <span className="text-xs text-g-text-muted">
          {alerts.filter(a => !a.is_read).length} unread
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-g-text-muted mr-1">Severity</span>
          {['', 'critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev || 'all'}
              onClick={() => { setFilterSeverity(sev); setPage(0); }}
              className={filterChip(filterSeverity === sev)}
            >{sev || 'All'}</button>
          ))}
        </div>

        <div className="h-5 w-px bg-g-border" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-g-text-muted mr-1">Status</span>
          {[
            { value: '', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'read', label: 'Read' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilterRead(opt.value); setPage(0); }}
              className={filterChip(filterRead === opt.value)}
            >{opt.label}</button>
          ))}
        </div>

        <div className="h-5 w-px bg-g-border" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-g-text-muted mr-1">Type</span>
          {[
            { value: '', label: 'All' },
            { value: 'target_match', label: 'Match' },
            { value: 'reappearance', label: 'Reappear' },
            { value: 'anomaly', label: 'Anomaly' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilterType(opt.value); setPage(0); }}
              className={filterChip(filterType === opt.value)}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-g-text-muted">
          <Bell className="w-4 h-4 animate-pulse mr-2" />
          <span className="text-sm">Loading alerts...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-white/[0.04] rounded-xl">
            <Bell className="w-6 h-6 text-g-text-muted" />
          </div>
          <p className="text-g-text-secondary text-sm font-medium">No alerts found</p>
          <p className="text-xs text-g-text-muted mt-1">Alerts will appear when targets are matched</p>
        </div>
      ) : (
        <div className="bg-g-card border border-g-border rounded-lg divide-y divide-g-border overflow-hidden">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={cn(
                'w-full px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors',
                !alert.is_read && 'border-l-2 border-l-g-accent'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertTriangle className={cn(
                    'w-4 h-4',
                    alert.severity === 'critical' ? 'text-red-400' :
                    alert.severity === 'high' ? 'text-orange-400' :
                    alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm text-g-text truncate font-medium">{alert.title}</h3>
                    {!alert.is_read && (
                      <span className="w-1.5 h-1.5 bg-g-accent rounded-full flex-shrink-0" />
                    )}
                  </div>
                  {alert.description && (
                    <p className="text-xs text-g-text-muted truncate mb-1">{alert.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-g-text-dim">
                    <span className={cn(
                      'capitalize',
                      alert.severity === 'critical' ? 'text-red-400' :
                      alert.severity === 'high' ? 'text-orange-400' :
                      alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                    )}>{alert.severity}</span>
                    <span className="capitalize">{alert.alert_type.replace(/_/g, ' ')}</span>
                    <span>{formatRelativeTime(alert.created_at)}</span>
                    {alert.is_acknowledged && <span className="text-g-success">Ack</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(page > 0 || alerts.length >= pageSize) && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-1.5 text-xs font-medium text-g-text-secondary border border-g-border rounded-md hover:bg-white/[0.04] disabled:opacity-30 transition-all"
          >Previous</button>
          <span className="text-xs text-g-text-muted px-3">Page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={alerts.length < pageSize}
            className="px-4 py-1.5 text-xs font-medium text-g-text-secondary border border-g-border rounded-md hover:bg-white/[0.04] disabled:opacity-30 transition-all"
          >Next</button>
        </div>
      )}

      {selectedAlert && (
        <AlertDetail
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={handleAcknowledge}
          onMarkRead={handleMarkRead}
        />
      )}
    </div>
  );
}
