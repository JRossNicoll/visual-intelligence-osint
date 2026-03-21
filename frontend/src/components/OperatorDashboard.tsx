'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Briefcase,
  CheckCircle,
  Eye,
  EyeOff,
  Radio,
  RefreshCw,
  Star,
  XCircle,
} from 'lucide-react';
import { operatorApi, casesApi } from '@/lib/api';
import type {
  OperatorDashboardData,
  OperatorAlert,
  FeedEvent,
  WatchlistEntry,
} from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface OperatorDashboardProps {
  onViewChange: (view: string) => void;
  onEntitySelect?: (entityId: string) => void;
  onCaseCreated?: (caseId: string) => void;
}

export default function OperatorDashboard({ onViewChange, onEntitySelect, onCaseCreated }: OperatorDashboardProps) {
  const [dashboard, setDashboard] = useState<OperatorDashboardData | null>(null);
  const [alerts, setAlerts] = useState<OperatorAlert[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [d, a, f, w] = await Promise.all([
        operatorApi.getDashboard().catch(() => null),
        operatorApi.getAlerts({
          severity: severityFilter !== 'all' ? severityFilter : undefined,
          unread_only: showUnreadOnly || undefined,
          limit: 50,
        }).catch(() => []),
        operatorApi.getFeed({ limit: 30 }).catch(() => []),
        operatorApi.getWatchlist().catch(() => []),
      ]);
      setDashboard(d);
      setAlerts(a);
      setFeed(f);
      setWatchlist(w);
      setLastRefresh(new Date());
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  }, [severityFilter, showUnreadOnly]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleReviewAlert = async (alertId: string) => {
    try {
      await operatorApi.reviewAlert(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    } catch { /* */ }
  };

  const handleEscalateAlert = async (alertId: string) => {
    try {
      await operatorApi.escalateAlert(alertId);
      fetchData();
    } catch { /* */ }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await operatorApi.dismissAlert(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_acknowledged: true } : a));
    } catch { /* */ }
  };

  const handleCreateCase = async (alertId: string) => {
    try {
      const caseData = await casesApi.createFromAlert(alertId);
      onCaseCreated?.(caseData.id);
    } catch { /* */ }
  };

  const handleRemoveFromWatchlist = async (entityId: string) => {
    try {
      await operatorApi.removeFromWatchlist(entityId);
      setWatchlist(prev => prev.filter(w => w.entity_id !== entityId));
    } catch { /* */ }
  };

  const riskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-sev-critical';
      case 'high': return 'text-sev-high';
      case 'medium': return 'text-sev-medium';
      default: return 'text-intel-accent';
    }
  };

  const eventTypeBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('alert')) return { label: 'ALR', bg: 'bg-evt-alert/20', text: 'text-evt-alert' };
    if (t.includes('movement') || t.includes('mov')) return { label: 'MOV', bg: 'bg-evt-movement/20', text: 'text-evt-movement' };
    if (t.includes('transaction') || t.includes('txn')) return { label: 'TXN', bg: 'bg-evt-transaction/20', text: 'text-evt-transaction' };
    if (t.includes('detection') || t.includes('det')) return { label: 'DET', bg: 'bg-evt-detection/20', text: 'text-evt-detection' };
    if (t.includes('appearance') || t.includes('app')) return { label: 'APP', bg: 'bg-evt-appearance/20', text: 'text-evt-appearance' };
    return { label: t.slice(0, 3).toUpperCase(), bg: 'bg-evt-system/20', text: 'text-evt-system' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Top Bar — mode + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3 h-3 text-intel-accent animate-pulse" />
          <span className="text-2xs font-semibold text-gray-400 uppercase tracking-widest">Operator Console</span>
          <span className="text-2xs text-gray-500 ml-2">
            {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewChange('investigation')}
            className="px-2 py-1 text-2xs text-gray-500 hover:text-gray-300 border border-intel-border rounded-sm hover:border-intel-border-light hover:bg-intel-card/50 transition-all duration-200"
          >
            INVESTIGATION
          </button>
          <button
            onClick={() => onViewChange('intel-summary')}
            className="px-2 py-1 text-2xs text-gray-500 hover:text-gray-300 border border-intel-border rounded-sm hover:border-intel-border-light hover:bg-intel-card/50 transition-all duration-200"
          >
            INTELLIGENCE
          </button>
          <button
            onClick={fetchData}
            className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Stat Strip — horizontal, compact */}
      {dashboard && (
        <div className="flex items-center gap-px bg-intel-border/60 rounded overflow-hidden">
          {[
            { label: 'UNREAD', value: dashboard.unread_alerts, color: 'text-sev-critical' },
            { label: 'CRITICAL 24H', value: dashboard.critical_alerts_24h, color: 'text-sev-high' },
            { label: 'HIGH RISK', value: dashboard.high_risk_entities, color: 'text-sev-medium' },
            { label: 'WATCHLIST', value: dashboard.watchlist_count, color: 'text-intel-accent' },
            { label: 'EVENTS 1H', value: dashboard.recent_events_1h, color: 'text-gray-200' },
            { label: 'TRACKED', value: dashboard.total_tracked_entities, color: 'text-gray-200' },
          ].map((stat) => (
            <div key={stat.label} className="flex-1 bg-intel-panel px-3 py-2 text-center">
              <div className={`text-sm font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
              <div className="text-2xs text-gray-600 mt-0.5">{stat.label}</div>
            </div>
          ))}
          <div className="flex-1 bg-intel-panel px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xs text-sev-critical font-bold">{dashboard.severity_breakdown_24h.critical}C</span>
              <span className="text-2xs text-sev-high font-bold">{dashboard.severity_breakdown_24h.high}H</span>
              <span className="text-2xs text-sev-medium font-bold">{dashboard.severity_breakdown_24h.medium}M</span>
              <span className="text-2xs text-sev-low font-bold">{dashboard.severity_breakdown_24h.low}L</span>
            </div>
            <div className="text-2xs text-gray-600 mt-0.5">SEVERITY 24H</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* ALERTS — Table-like rows */}
        <div className="lg:col-span-2 bg-intel-panel border border-intel-border/60 rounded">
          {/* Alert header bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-intel-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-sev-critical" />
              <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Active Alerts</span>
              <span className="text-2xs font-bold text-sev-critical bg-sev-critical/10 px-1.5 py-px rounded">
                {alerts.filter(a => !a.is_read).length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                className={`flex items-center gap-1 px-1.5 py-0.5 text-2xs rounded-sm transition-colors ${
                  showUnreadOnly ? 'bg-intel-accent/10 text-intel-accent' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {showUnreadOnly ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                {showUnreadOnly ? 'UNREAD' : 'ALL'}
              </button>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-intel-bg border border-intel-border text-2xs text-gray-400 rounded-sm px-1.5 py-0.5"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Alert list */}
          <div className="max-h-[520px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-xs">No active alerts</span>
              </div>
            ) : (
              <div>
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-intel-border/30 hover:bg-intel-card/40 transition-all duration-150 ${
                      !alert.is_read ? `sev-${alert.severity}` : ''
                    }`}
                  >
                    {/* Severity dot */}
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      alert.severity === 'critical' ? 'bg-sev-critical' :
                      alert.severity === 'high' ? 'bg-sev-high' :
                      alert.severity === 'medium' ? 'bg-sev-medium' : 'bg-sev-low'
                    }`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-2xs font-bold uppercase ${
                          alert.severity === 'critical' ? 'text-sev-critical' :
                          alert.severity === 'high' ? 'text-sev-high' :
                          alert.severity === 'medium' ? 'text-sev-medium' : 'text-sev-low'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="text-2xs text-gray-600">{alert.alert_type.replace(/_/g, ' ')}</span>
                        {!alert.is_read && <span className="w-1 h-1 bg-intel-accent rounded-full" />}
                      </div>
                      <p className="text-xs text-gray-200 truncate">{alert.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xs text-gray-600">{formatRelativeTime(alert.created_at)}</span>
                        <span className="text-2xs text-gray-600">{Math.round(alert.confidence * 100)}%</span>
                        {alert.entity_ids.length > 0 && (
                          <span className="text-2xs text-gray-600">{alert.entity_ids.length} ent</span>
                        )}
                      </div>
                    </div>

                    {/* Actions — inline */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {!alert.is_read && (
                        <button onClick={() => handleReviewAlert(alert.id)} className="p-1 text-gray-600 hover:text-intel-accent transition-colors" title="Review">
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => handleEscalateAlert(alert.id)} className="p-1 text-gray-600 hover:text-sev-high transition-colors" title="Escalate">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      {!alert.is_acknowledged && (
                        <button onClick={() => handleDismissAlert(alert.id)} className="p-1 text-gray-600 hover:text-gray-400 transition-colors" title="Dismiss">
                          <XCircle className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => handleCreateCase(alert.id)} className="p-1 text-gray-600 hover:text-gray-300 transition-colors" title="Create Case">
                        <Briefcase className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Watchlist + Feed */}
        <div className="space-y-3">
          {/* Watchlist */}
          <div className="bg-intel-panel border border-intel-border/60 rounded">
            <div className="flex items-center justify-between px-3 py-2 border-b border-intel-border/60">
              <div className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-intel-accent" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Watchlist</span>
                <span className="text-2xs font-bold text-sev-medium">{watchlist.length}</span>
              </div>
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              {watchlist.length === 0 ? (
                <p className="text-2xs text-gray-600 text-center py-4">Empty</p>
              ) : (
                <div>
                  {watchlist.map((entry) => (
                    <div
                      key={entry.entity_id}
                      className="flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 cursor-pointer transition-all duration-150"
                      onClick={() => onEntitySelect?.(entry.entity_id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-200 truncate font-mono">{entry.entity_id.slice(0, 12)}</span>
                          <span className={`text-2xs font-bold ${riskLevelColor(entry.risk_level)}`}>
                            {entry.risk_level.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-2xs text-gray-600">{entry.entity_type}</span>
                          {entry.last_location && (
                            <span className="text-2xs text-gray-600 truncate">@ {entry.last_location}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveFromWatchlist(entry.entity_id); }}
                        className="p-0.5 text-gray-700 hover:text-sev-critical transition-colors"
                        title="Remove"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Feed */}
          <div className="bg-intel-panel border border-intel-border/60 rounded">
            <div className="flex items-center justify-between px-3 py-2 border-b border-intel-border/60">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-intel-accent animate-pulse" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Live Feed</span>
              </div>
              <span className="text-2xs text-gray-600">{feed.length}</span>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {feed.length === 0 ? (
                <p className="text-2xs text-gray-600 text-center py-4">No events</p>
              ) : (
                <div>
                  {feed.map((event) => {
                    const badge = eventTypeBadge(event.event_type);
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150"
                      >
                        <span className={`px-1.5 py-0.5 text-2xs font-bold rounded ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-200 font-mono">{event.entity_id.slice(0, 10)}</span>
                          </div>
                          {(event.location_name || event.co_occurring_entities.length > 0) && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {event.location_name && <span className="text-2xs text-gray-500">@ {event.location_name}</span>}
                              {event.co_occurring_entities.length > 0 && (
                                <span className="text-2xs text-gray-500">+{event.co_occurring_entities.length}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-2xs text-gray-400 whitespace-nowrap font-medium">{formatRelativeTime(event.timestamp)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
