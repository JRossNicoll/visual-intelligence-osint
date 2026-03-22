'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  Filter,
  Shield,
  X,
  Zap,
} from 'lucide-react';
import { alertsApi } from '@/lib/api';
import type { Alert } from '@/types';
import { formatRelativeTime, formatTimestamp, severityColor, cn } from '@/lib/utils';

interface AlertDetailProps {
  alert: Alert;
  onClose: () => void;
  onAcknowledge: (id: string) => Promise<void>;
  onMarkRead: (id: string) => Promise<void>;
}

function AlertDetail({ alert, onClose, onAcknowledge, onMarkRead }: AlertDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-intel-surface border border-intel-border rounded-2xl overflow-hidden">
        {/* Severity Banner */}
        <div className={cn(
          'px-6 py-4 border-b',
          alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/20' :
          alert.severity === 'high' ? 'bg-orange-500/10 border-orange-500/20' :
          alert.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
          'bg-blue-500/10 border-blue-500/20'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className={cn(
                'w-5 h-5',
                alert.severity === 'critical' ? 'text-red-400' :
                alert.severity === 'high' ? 'text-orange-400' :
                alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
              )} />
              <span className="text-sm font-bold uppercase tracking-wider text-white">
                {alert.severity} - {alert.alert_type.replace(/_/g, ' ')}
              </span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white mb-1">{alert.title}</h3>
            {alert.description && (
              <p className="text-sm text-gray-400">{alert.description}</p>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {alert.confidence != null && (
              <div className="bg-intel-card border border-intel-border rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Confidence</div>
                <div className="text-sm font-bold text-white">
                  {Math.round(alert.confidence * 100)}%
                </div>
              </div>
            )}
            {alert.similarity_score != null && (
              <div className="bg-intel-card border border-intel-border rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Similarity</div>
                <div className="text-sm font-bold text-intel-accent">
                  {Math.round(alert.similarity_score * 100)}%
                </div>
              </div>
            )}
            {alert.frame_number != null && (
              <div className="bg-intel-card border border-intel-border rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Frame</div>
                <div className="text-sm font-bold text-white">#{alert.frame_number}</div>
              </div>
            )}
            <div className="bg-intel-card border border-intel-border rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Time</div>
              <div className="text-sm font-bold text-white">
                {formatRelativeTime(alert.created_at)}
              </div>
            </div>
          </div>

          {/* References */}
          <div className="space-y-2 text-sm">
            {alert.entity_id && (
              <div className="flex items-center justify-between py-1.5 border-b border-intel-border/30">
                <span className="text-gray-400">Entity</span>
                <span className="text-white font-mono text-xs">{alert.entity_id.slice(0, 16)}...</span>
              </div>
            )}
            {alert.target_id && (
              <div className="flex items-center justify-between py-1.5 border-b border-intel-border/30">
                <span className="text-gray-400">Target</span>
                <span className="text-white font-mono text-xs">{alert.target_id.slice(0, 16)}...</span>
              </div>
            )}
            {alert.stream_id && (
              <div className="flex items-center justify-between py-1.5 border-b border-intel-border/30">
                <span className="text-gray-400">Stream</span>
                <span className="text-white font-mono text-xs">{alert.stream_id.slice(0, 16)}...</span>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2">
            {alert.is_read && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Eye className="w-3 h-3" /> Read
              </span>
            )}
            {alert.is_acknowledged && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                <CheckCircle className="w-3 h-3" /> Acknowledged
              </span>
            )}
            {alert.webhook_delivered && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Zap className="w-3 h-3" /> Webhook Sent
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!alert.is_read && (
              <button
                onClick={() => onMarkRead(alert.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-medium hover:bg-blue-500/20 transition-colors"
              >
                <Eye className="w-4 h-4" /> Mark Read
              </button>
            )}
            {!alert.is_acknowledged && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-intel-accent/10 text-intel-accent border border-intel-accent/30 rounded-lg text-sm font-medium hover:bg-intel-accent/20 transition-colors"
              >
                <Check className="w-4 h-4" /> Acknowledge
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
    const interval = setInterval(fetchAlerts, 5000);
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

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'medium': return <Bell className="w-4 h-4 text-yellow-400" />;
      case 'low': return <Bell className="w-4 h-4 text-blue-400" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Intelligence Alerts</h2>
          <p className="text-sm text-gray-400 mt-1">
            Target matches, reappearances, and anomaly notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {alerts.filter(a => !a.is_read).length} unread
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Severity */}
        <div className="flex items-center gap-1">
          {['', 'critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                filterSeverity === sev
                  ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/30'
                  : 'text-gray-400 border-intel-border hover:text-white'
              )}
            >
              {sev || 'All'}
            </button>
          ))}
        </div>

        {/* Read status */}
        <select
          value={filterRead}
          onChange={(e) => setFilterRead(e.target.value)}
          className="px-3 py-1.5 bg-intel-card border border-intel-border rounded-lg text-xs text-gray-300 focus:outline-none focus:border-intel-accent"
        >
          <option value="">All Alerts</option>
          <option value="unread">Unread Only</option>
          <option value="read">Read Only</option>
        </select>

        {/* Type */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 bg-intel-card border border-intel-border rounded-lg text-xs text-gray-300 focus:outline-none focus:border-intel-accent"
        >
          <option value="">All Types</option>
          <option value="target_match">Target Match</option>
          <option value="reappearance">Reappearance</option>
          <option value="anomaly">Anomaly</option>
        </select>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Bell className="w-6 h-6 text-intel-accent animate-pulse" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <BellOff className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No alerts</p>
          <p className="text-sm text-gray-500 mt-1">
            Alerts are generated when targets are matched or entities reappear
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={cn(
                'flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-lg',
                !alert.is_read
                  ? 'bg-intel-card border-intel-border hover:border-intel-accent/30'
                  : 'bg-intel-card/50 border-intel-border/50 hover:border-intel-border',
                alert.severity === 'critical' && !alert.is_read && 'glow-red'
              )}
            >
              {/* Severity Icon */}
              <div className={cn(
                'p-2 rounded-lg mt-0.5',
                alert.severity === 'critical' ? 'bg-red-500/10' :
                alert.severity === 'high' ? 'bg-orange-500/10' :
                alert.severity === 'medium' ? 'bg-yellow-500/10' : 'bg-blue-500/10'
              )}>
                {severityIcon(alert.severity)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn(
                    'text-sm font-semibold truncate',
                    !alert.is_read ? 'text-white' : 'text-gray-300'
                  )}>
                    {alert.title}
                  </h3>
                  {!alert.is_read && (
                    <span className="flex-shrink-0 w-2 h-2 bg-intel-accent rounded-full" />
                  )}
                </div>
                {alert.description && (
                  <p className="text-xs text-gray-400 truncate mb-1">{alert.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="capitalize">{alert.alert_type.replace(/_/g, ' ')}</span>
                  {alert.similarity_score != null && (
                    <span className="text-intel-accent">
                      {Math.round(alert.similarity_score * 100)}% match
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(alert.created_at)}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col items-end gap-2">
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs font-semibold uppercase',
                  severityColor(alert.severity)
                )}>
                  {alert.severity}
                </span>
                {alert.is_acknowledged && (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {alerts.length >= pageSize && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={alerts.length < pageSize}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Alert Detail Modal */}
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
