'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="relative w-full max-w-md bg-intel-surface border border-intel-border overflow-hidden"
      >
        {/* Severity Banner */}
        <div className={cn(
          'px-5 py-3 border-b flex items-center justify-between',
          alert.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
          alert.severity === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
          alert.severity === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' :
          'border-blue-500/30 bg-blue-500/5'
        )}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn(
              'w-4 h-4',
              alert.severity === 'critical' ? 'text-red-400' :
              alert.severity === 'high' ? 'text-orange-400' :
              alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
            )} />
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-200">
              {alert.severity} — {alert.alert_type.replace(/_/g, ' ')}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-sm text-zinc-200 mb-1">{alert.title}</h3>
            {alert.description && (
              <p className="text-[11px] text-zinc-500">{alert.description}</p>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-px bg-intel-border">
            {alert.confidence != null && (
              <div className="bg-intel-card p-3">
                <div className="mono-label mb-1">Confidence</div>
                <div className="text-sm font-mono text-zinc-200">
                  {Math.round(alert.confidence * 100)}%
                </div>
              </div>
            )}
            {alert.similarity_score != null && (
              <div className="bg-intel-card p-3">
                <div className="mono-label mb-1">Similarity</div>
                <div className="text-sm font-mono text-zinc-200">
                  {Math.round(alert.similarity_score * 100)}%
                </div>
              </div>
            )}
            {alert.frame_number != null && (
              <div className="bg-intel-card p-3">
                <div className="mono-label mb-1">Frame</div>
                <div className="text-sm font-mono text-zinc-200">#{alert.frame_number}</div>
              </div>
            )}
            <div className="bg-intel-card p-3">
              <div className="mono-label mb-1">Time</div>
              <div className="text-sm text-zinc-200">
                {formatRelativeTime(alert.created_at)}
              </div>
            </div>
          </div>

          {/* References */}
          <div className="space-y-1 border border-intel-border divide-y divide-intel-border">
            {alert.entity_id && (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Entity</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-intel-bg px-2 py-0.5 border border-intel-border">{alert.entity_id.slice(0, 16)}...</span>
              </div>
            )}
            {alert.target_id && (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Target</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-intel-bg px-2 py-0.5 border border-intel-border">{alert.target_id.slice(0, 16)}...</span>
              </div>
            )}
            {alert.stream_id && (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Stream</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-intel-bg px-2 py-0.5 border border-intel-border">{alert.stream_id.slice(0, 16)}...</span>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {alert.is_read && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase border border-blue-500/20 text-blue-400">
                <Eye className="w-3 h-3" /> Read
              </span>
            )}
            {alert.is_acknowledged && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase border border-green-500/20 text-green-400">
                <CheckCircle className="w-3 h-3" /> Ack
              </span>
            )}
            {alert.webhook_delivered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase border border-purple-500/20 text-purple-400">
                <Zap className="w-3 h-3" /> Webhook
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!alert.is_read && (
              <button
                onClick={() => onMarkRead(alert.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-1.5 text-blue-400 border border-blue-500/20 text-[11px] font-mono uppercase hover:bg-blue-500/10 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Mark Read
              </button>
            )}
            {!alert.is_acknowledged && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-1.5 text-green-400 border border-green-500/20 text-[11px] font-mono uppercase hover:bg-green-500/10 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Acknowledge
              </button>
            )}
          </div>
        </div>
      </motion.div>
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

  const filterBtn = (active: boolean) => cn(
    'px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors',
    active ? 'text-white border-intel-border-light bg-white/[0.04]' : 'text-zinc-600 border-intel-border hover:text-zinc-300 hover:border-intel-border-light'
  );

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-white">Intelligence Alerts</h2>
          <p className="text-[11px] font-mono text-zinc-600 mt-1 uppercase tracking-wider">
            Target matches, reappearances, and anomaly notifications
          </p>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 uppercase">
          {alerts.filter(a => !a.is_read).length} unread
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Severity Filters */}
        <div className="flex items-center gap-1.5">
          <span className="mono-label mr-1">Severity</span>
          {['', 'critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev || 'all'}
              onClick={() => { setFilterSeverity(sev); setPage(0); }}
              className={filterBtn(filterSeverity === sev)}
            >
              {sev || 'All'}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-intel-border" />

        {/* Read Filter */}
        <div className="flex items-center gap-1.5">
          <span className="mono-label mr-1">Status</span>
          {[
            { value: '', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'read', label: 'Read' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilterRead(opt.value); setPage(0); }}
              className={filterBtn(filterRead === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-intel-border" />

        {/* Type Filter */}
        <div className="flex items-center gap-1.5">
          <span className="mono-label mr-1">Type</span>
          {[
            { value: '', label: 'All' },
            { value: 'target_match', label: 'Match' },
            { value: 'reappearance', label: 'Reappear' },
            { value: 'anomaly', label: 'Anomaly' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilterType(opt.value); setPage(0); }}
              className={filterBtn(filterType === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600">
          <Bell className="w-4 h-4 animate-pulse mr-2" />
          <span className="text-[11px] font-mono uppercase">Loading alerts...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 border border-intel-border">
            <Bell className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-zinc-400 text-sm">No alerts found</p>
          <p className="text-[11px] font-mono text-zinc-600 mt-1">Alerts will appear when targets are matched</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="divide-y divide-intel-border border border-intel-border"
        >
          {alerts.map((alert, i) => (
            <motion.button
              key={alert.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelectedAlert(alert)}
              className={cn(
                'w-full px-4 py-3 text-left hover:bg-white/[0.02] transition-colors',
                !alert.is_read && 'border-l-2 border-l-zinc-400'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertTriangle className={cn(
                    'w-3.5 h-3.5',
                    alert.severity === 'critical' ? 'text-red-400' :
                    alert.severity === 'high' ? 'text-orange-400' :
                    alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-xs text-zinc-200 truncate">{alert.title}</h3>
                    {!alert.is_read && (
                      <span className="w-1.5 h-1.5 bg-zinc-300 flex-shrink-0" />
                    )}
                  </div>
                  {alert.description && (
                    <p className="text-[10px] text-zinc-600 truncate mb-1">{alert.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-600 uppercase">
                    <span className={cn(
                      alert.severity === 'critical' ? 'text-red-400' :
                      alert.severity === 'high' ? 'text-orange-400' :
                      alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                    )}>
                      {alert.severity}
                    </span>
                    <span>{alert.alert_type.replace(/_/g, ' ')}</span>
                    <span className="ml-auto">{formatRelativeTime(alert.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {alert.is_acknowledged && (
                    <CheckCircle className="w-3 h-3 text-green-500/60" />
                  )}
                  {alert.webhook_delivered && (
                    <Zap className="w-3 h-3 text-purple-500/60" />
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-3 py-1 text-[10px] font-mono uppercase text-zinc-500 border border-intel-border hover:text-white disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <span className="text-[10px] font-mono text-zinc-600">Page {page + 1}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={alerts.length < pageSize}
          className="px-3 py-1 text-[10px] font-mono uppercase text-zinc-500 border border-intel-border hover:text-white disabled:opacity-30 transition-colors"
        >
          Next
        </button>
      </div>

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <AlertDetail
            alert={selectedAlert}
            onClose={() => setSelectedAlert(null)}
            onAcknowledge={handleAcknowledge}
            onMarkRead={handleMarkRead}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
