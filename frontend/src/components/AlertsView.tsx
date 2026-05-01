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
  const severityBanner: Record<string, string> = {
    critical: 'bg-red-500/10 border-red-500/20',
    high: 'bg-orange-500/10 border-orange-500/20',
    medium: 'bg-yellow-500/10 border-yellow-500/20',
    low: 'bg-blue-500/10 border-blue-500/20',
  };

  const severityIconColor: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-blue-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md glass-card rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Severity Banner */}
        <div className={cn(
          'px-6 py-4 border-b',
          severityBanner[alert.severity] || severityBanner.medium
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className={cn(
                'w-5 h-5',
                severityIconColor[alert.severity] || 'text-gray-400'
              )} />
              <span className="text-sm font-bold uppercase tracking-wider text-white">
                {alert.severity} - {alert.alert_type.replace(/_/g, ' ')}
              </span>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
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
              <div className="glass-card rounded-xl p-3">
                <div className="text-[10px] text-gray-500 mb-1 font-medium">Confidence</div>
                <div className="text-sm font-bold text-white">
                  {Math.round(alert.confidence * 100)}%
                </div>
              </div>
            )}
            {alert.similarity_score != null && (
              <div className="glass-card rounded-xl p-3">
                <div className="text-[10px] text-gray-500 mb-1 font-medium">Similarity</div>
                <div className="text-sm font-bold text-intel-accent">
                  {Math.round(alert.similarity_score * 100)}%
                </div>
              </div>
            )}
            {alert.frame_number != null && (
              <div className="glass-card rounded-xl p-3">
                <div className="text-[10px] text-gray-500 mb-1 font-medium">Frame</div>
                <div className="text-sm font-bold text-white font-mono">#{alert.frame_number}</div>
              </div>
            )}
            <div className="glass-card rounded-xl p-3">
              <div className="text-[10px] text-gray-500 mb-1 font-medium">Time</div>
              <div className="text-sm font-bold text-white">
                {formatRelativeTime(alert.created_at)}
              </div>
            </div>
          </div>

          {/* References */}
          <div className="space-y-2 text-sm">
            {alert.entity_id && (
              <div className="flex items-center justify-between py-1.5 border-b border-intel-border/20">
                <span className="text-gray-400">Entity</span>
                <span className="text-white font-mono text-[11px] bg-intel-bg/60 px-2 py-0.5 rounded">{alert.entity_id.slice(0, 16)}...</span>
              </div>
            )}
            {alert.target_id && (
              <div className="flex items-center justify-between py-1.5 border-b border-intel-border/20">
                <span className="text-gray-400">Target</span>
                <span className="text-white font-mono text-[11px] bg-intel-bg/60 px-2 py-0.5 rounded">{alert.target_id.slice(0, 16)}...</span>
              </div>
            )}
            {alert.stream_id && (
              <div className="flex items-center justify-between py-1.5 border-b border-intel-border/20">
                <span className="text-gray-400">Stream</span>
                <span className="text-white font-mono text-[11px] bg-intel-bg/60 px-2 py-0.5 rounded">{alert.stream_id.slice(0, 16)}...</span>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {alert.is_read && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                <Eye className="w-3 h-3" /> Read
              </span>
            )}
            {alert.is_acknowledged && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                <CheckCircle className="w-3 h-3" /> Acknowledged
              </span>
            )}
            {alert.webhook_delivered && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                <Zap className="w-3 h-3" /> Webhook
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!alert.is_read && (
              <button
                onClick={() => onMarkRead(alert.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-medium hover:bg-blue-500/20 transition-colors"
              >
                <Eye className="w-4 h-4" /> Mark Read
              </button>
            )}
            {!alert.is_acknowledged && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-intel-accent/10 text-intel-accent border border-intel-accent/20 rounded-xl text-sm font-medium hover:bg-intel-accent/20 hover:shadow-glow-sm transition-all"
              >
                <Check className="w-4 h-4" /> Acknowledge
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
    <div className="p-6 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Intelligence Alerts</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Target matches, reappearances, and anomaly notifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-mono">
            {alerts.filter(a => !a.is_read).length} unread
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Severity Filters */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-1 font-semibold">Severity:</span>
          {['', 'critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev || 'all'}
              onClick={() => { setFilterSeverity(sev); setPage(0); }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all capitalize',
                filterSeverity === sev
                  ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/20'
                  : 'text-gray-500 border-intel-border/30 hover:text-white'
              )}
            >
              {sev || 'All'}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-intel-border/30" />

        {/* Read Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-1 font-semibold">Status:</span>
          {[
            { value: '', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'read', label: 'Read' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilterRead(opt.value); setPage(0); }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
                filterRead === opt.value
                  ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/20'
                  : 'text-gray-500 border-intel-border/30 hover:text-white'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-intel-border/30" />

        {/* Type Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-1 font-semibold">Type:</span>
          {[
            { value: '', label: 'All' },
            { value: 'target_match', label: 'Target Match' },
            { value: 'reappearance', label: 'Reappearance' },
            { value: 'anomaly', label: 'Anomaly' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilterType(opt.value); setPage(0); }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
                filterType === opt.value
                  ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/20'
                  : 'text-gray-500 border-intel-border/30 hover:text-white'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Bell className="w-5 h-5 animate-pulse mr-2" />
          <span className="text-sm">Loading alerts...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-intel-card flex items-center justify-center mx-auto mb-4 border border-intel-border/30">
            <Bell className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No alerts found</p>
          <p className="text-sm text-gray-600 mt-1">Alerts will appear when targets are matched</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          {alerts.map((alert, i) => (
            <motion.button
              key={alert.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelectedAlert(alert)}
              className={cn(
                'w-full glass-card glass-card-hover rounded-xl p-4 text-left',
                !alert.is_read && 'border-l-2 border-l-intel-accent/50'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {severityIcon(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-white truncate">{alert.title}</h3>
                    {!alert.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-intel-accent flex-shrink-0" />
                    )}
                  </div>
                  {alert.description && (
                    <p className="text-xs text-gray-500 truncate mb-1.5">{alert.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span className={cn(
                      'font-bold uppercase',
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
                    <CheckCircle className="w-3.5 h-3.5 text-green-500/60" />
                  )}
                  {alert.webhook_delivered && (
                    <Zap className="w-3.5 h-3.5 text-purple-500/60" />
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
          className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-intel-border/30 rounded-lg hover:text-white disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-gray-500 font-mono">Page {page + 1}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={alerts.length < pageSize}
          className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-intel-border/30 rounded-lg hover:text-white disabled:opacity-30 transition-colors"
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
