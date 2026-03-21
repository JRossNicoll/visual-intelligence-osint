'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Bell,
  CheckCircle,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Radio,
  RefreshCw,
  Shield,
  Star,
  Users,
  XCircle,
} from 'lucide-react';
import { operatorApi } from '@/lib/api';
import type {
  OperatorDashboardData,
  OperatorAlert,
  FeedEvent,
  WatchlistEntry,
} from '@/types';
import { formatRelativeTime, severityColor } from '@/lib/utils';

interface OperatorDashboardProps {
  onViewChange: (view: string) => void;
  onEntitySelect?: (entityId: string) => void;
}

export default function OperatorDashboard({ onViewChange, onEntitySelect }: OperatorDashboardProps) {
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

  const handleRemoveFromWatchlist = async (entityId: string) => {
    try {
      await operatorApi.removeFromWatchlist(entityId);
      setWatchlist(prev => prev.filter(w => w.entity_id !== entityId));
    } catch { /* */ }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'high': return <ArrowUp className="w-4 h-4 text-orange-400" />;
      case 'medium': return <Bell className="w-4 h-4 text-yellow-400" />;
      default: return <Shield className="w-4 h-4 text-blue-400" />;
    }
  };

  const riskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading operator dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-sm font-semibold text-white uppercase tracking-wider">Operator Console</span>
          </div>
          <span className="text-xs text-gray-500">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewChange('investigation')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-intel-surface border border-intel-border rounded-lg hover:bg-intel-card transition-colors"
          >
            Investigation Mode
          </button>
          <button
            onClick={() => onViewChange('intel-summary')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-intel-surface border border-intel-border rounded-lg hover:bg-intel-card transition-colors"
          >
            Intelligence Mode
          </button>
          <button
            onClick={fetchData}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-intel-card border border-intel-border rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Unread Alerts</div>
            <div className="text-2xl font-bold text-red-400">{dashboard.unread_alerts}</div>
          </div>
          <div className="bg-intel-card border border-intel-border rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Critical (24h)</div>
            <div className="text-2xl font-bold text-orange-400">{dashboard.critical_alerts_24h}</div>
          </div>
          <div className="bg-intel-card border border-intel-border rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">High Risk</div>
            <div className="text-2xl font-bold text-yellow-400">{dashboard.high_risk_entities}</div>
          </div>
          <div className="bg-intel-card border border-intel-border rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Watchlist</div>
            <div className="text-2xl font-bold text-intel-accent">{dashboard.watchlist_count}</div>
          </div>
          <div className="bg-intel-card border border-intel-border rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Events (1h)</div>
            <div className="text-2xl font-bold text-cyan-400">{dashboard.recent_events_1h}</div>
          </div>
          <div className="bg-intel-card border border-intel-border rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Tracked</div>
            <div className="text-2xl font-bold text-purple-400">{dashboard.total_tracked_entities}</div>
          </div>
          <div className="bg-intel-card border border-intel-border rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Severity (24h)</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-red-400 font-bold">{dashboard.severity_breakdown_24h.critical}C</span>
              <span className="text-xs text-orange-400 font-bold">{dashboard.severity_breakdown_24h.high}H</span>
              <span className="text-xs text-yellow-400 font-bold">{dashboard.severity_breakdown_24h.medium}M</span>
              <span className="text-xs text-blue-400 font-bold">{dashboard.severity_breakdown_24h.low}L</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ACTIVE ALERTS — Primary Panel */}
        <div className="lg:col-span-2 bg-intel-card border border-intel-border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-intel-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-white">Active Alerts</h3>
              <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                {alerts.filter(a => !a.is_read).length} unread
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  showUnreadOnly ? 'bg-intel-accent/20 text-intel-accent' : 'text-gray-400 hover:text-white'
                }`}
              >
                {showUnreadOnly ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {showUnreadOnly ? 'Unread' : 'All'}
              </button>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-intel-bg border border-intel-border text-xs text-gray-300 rounded-md px-2 py-1"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No active alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-intel-border/50">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 hover:bg-white/[0.02] transition-colors ${
                      !alert.is_read ? 'border-l-2 border-l-intel-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{severityIcon(alert.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${severityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs text-gray-500">{alert.alert_type.replace(/_/g, ' ')}</span>
                          {!alert.is_read && (
                            <span className="w-2 h-2 bg-intel-accent rounded-full" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-white">{alert.title}</p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{alert.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-500">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatRelativeTime(alert.created_at)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Confidence: {Math.round(alert.confidence * 100)}%
                          </span>
                          {alert.entity_ids.length > 0 && (
                            <span className="text-xs text-gray-500">
                              <Users className="w-3 h-3 inline mr-1" />
                              {alert.entity_ids.length} entities
                            </span>
                          )}
                        </div>
                        {alert.recommended_actions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {alert.recommended_actions.slice(0, 2).map((action, i) => (
                              <span key={i} className="text-xs bg-intel-bg/50 text-gray-400 px-2 py-0.5 rounded">
                                {action}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {!alert.is_read && (
                          <button
                            onClick={() => handleReviewAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-intel-accent hover:bg-intel-accent/10 rounded transition-colors"
                            title="Mark as reviewed"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEscalateAlert(alert.id)}
                          className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                          title="Escalate"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        {!alert.is_acknowledged && (
                          <button
                            onClick={() => handleDismissAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-white/5 rounded transition-colors"
                            title="Dismiss"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Watchlist + Live Feed */}
        <div className="space-y-6">
          {/* Watchlist */}
          <div className="bg-intel-card border border-intel-border rounded-xl">
            <div className="flex items-center justify-between p-4 border-b border-intel-border">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-white">Watchlist</h3>
                <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                  {watchlist.length}
                </span>
              </div>
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {watchlist.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Watchlist empty</p>
              ) : (
                <div className="divide-y divide-intel-border/50">
                  {watchlist.map((entry) => (
                    <div
                      key={entry.entity_id}
                      className="p-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => onEntitySelect?.(entry.entity_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{entry.entity_id}</span>
                            <span className={`text-xs font-bold ${riskLevelColor(entry.risk_level)}`}>
                              {entry.risk_level.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{entry.entity_type}</span>
                            {entry.last_location && (
                              <span className="text-xs text-gray-500">@ {entry.last_location}</span>
                            )}
                          </div>
                          {entry.behavior_tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {entry.behavior_tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-xs bg-intel-bg/50 text-gray-400 px-1.5 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveFromWatchlist(entry.entity_id); }}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                            title="Remove from watchlist"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Feed */}
          <div className="bg-intel-card border border-intel-border rounded-xl">
            <div className="flex items-center justify-between p-4 border-b border-intel-border">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-green-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-white">Live Feed</h3>
              </div>
              <span className="text-xs text-gray-500">{feed.length} events</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {feed.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No recent events</p>
              ) : (
                <div className="divide-y divide-intel-border/50">
                  {feed.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">{event.entity_id}</span>
                            <span className="text-xs text-gray-500">{event.event_type}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {event.location_name && (
                              <span className="text-xs text-gray-500">@ {event.location_name}</span>
                            )}
                            {event.co_occurring_entities.length > 0 && (
                              <span className="text-xs text-gray-500">
                                +{event.co_occurring_entities.length} co-occurring
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap ml-2">
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
