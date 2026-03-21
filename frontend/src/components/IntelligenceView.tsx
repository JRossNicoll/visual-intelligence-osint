'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Brain,
  ChevronRight,
  MapPin,
  RefreshCw,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { operatorApi } from '@/lib/api';
import type { IntelligenceSummary } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

const sevColor = (s: string) => {
  switch (s) {
    case 'critical': return 'text-sev-critical';
    case 'high': return 'text-sev-high';
    case 'medium': return 'text-sev-medium';
    default: return 'text-sev-low';
  }
};

interface IntelligenceViewProps {
  onViewChange: (view: string) => void;
}

export default function IntelligenceView({ onViewChange }: IntelligenceViewProps) {
  const [summary, setSummary] = useState<IntelligenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await operatorApi.getIntelligenceSummary(periodDays);
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxAlertCount = summary?.alert_trend.reduce((max, p) => Math.max(max, p.count), 0) || 1;
  const maxEntityCount = summary?.entity_trend.reduce((max, p) => Math.max(max, p.new_entities), 0) || 1;
  const totalRisk = summary ? Object.values(summary.risk_distribution).reduce((s, v) => s + v, 0) : 1;
  const totalBehavior = summary ? Object.values(summary.behavior_distribution).reduce((s, v) => s + v, 0) : 1;

  const riskBarColors: Record<string, string> = {
    critical: 'bg-sev-critical',
    high: 'bg-sev-high',
    medium: 'bg-sev-medium',
    low: 'bg-sev-low',
  };

  const behaviorBarColors: Record<string, string> = {
    loitering: 'bg-purple-500/70',
    repeated_visits: 'bg-blue-500/70',
    short_stay: 'bg-cyan-500/70',
    long_stay: 'bg-indigo-500/70',
    convoy: 'bg-pink-500/70',
    periodic: 'bg-teal-500/70',
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => onViewChange('operator')} className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-2xs font-semibold text-gray-400 uppercase tracking-widest">Intelligence</span>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="bg-intel-bg border border-intel-border text-2xs text-gray-400 rounded px-2 py-1"
          >
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
            <option value={60}>60d</option>
            <option value={90}>90d</option>
          </select>
          <button onClick={() => onViewChange('operator')} className="px-2 py-1 text-2xs text-gray-500 hover:text-gray-300 border border-intel-border rounded-sm transition-colors">OPERATOR</button>
          <button onClick={() => onViewChange('investigation')} className="px-2 py-1 text-2xs text-gray-500 hover:text-gray-300 border border-intel-border rounded-sm transition-colors">INVESTIGATION</button>
          <button onClick={fetchData} className="p-1 text-gray-600 hover:text-gray-300 transition-colors" title="Refresh">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {summary && (
        <>
          <div className="text-2xs text-gray-600 text-right">
            {formatRelativeTime(summary.generated_at)} &middot; {summary.period_days}d period
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Risk Distribution */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
                <Shield className="w-3 h-3 text-sev-high" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Risk Distribution</span>
              </div>
              <div className="px-3 py-2 space-y-2">
                {Object.entries(summary.risk_distribution).map(([level, count]) => {
                  const pct = totalRisk > 0 ? (count / totalRisk) * 100 : 0;
                  return (
                    <div key={level}>
                      <div className="flex items-center justify-between text-2xs mb-0.5">
                        <span className="text-gray-500 capitalize">{level}</span>
                        <span className="text-gray-300 tabular-nums">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                        <div className="w-full bg-intel-bg rounded h-1.5">
                          <div className={`h-1.5 rounded transition-all ${riskBarColors[level] || 'bg-gray-600'}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Behavior Distribution */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
                <Activity className="w-3 h-3 text-gray-400" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Behavior Distribution</span>
              </div>
              <div className="px-3 py-2 space-y-2">
                {Object.entries(summary.behavior_distribution).length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-3">No behaviors</p>
                ) : (
                  Object.entries(summary.behavior_distribution).map(([behavior, count]) => {
                    const pct = totalBehavior > 0 ? (count / totalBehavior) * 100 : 0;
                    return (
                      <div key={behavior}>
                        <div className="flex items-center justify-between text-2xs mb-0.5">
                          <span className="text-gray-500">{behavior.replace(/_/g, ' ')}</span>
                          <span className="text-gray-300 tabular-nums">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                            <div className="w-full bg-intel-bg rounded h-1.5">
                              <div className={`h-1.5 rounded transition-all ${behaviorBarColors[behavior] || 'bg-gray-600'}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Alert Trend */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
                <BarChart3 className="w-3 h-3 text-sev-critical" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Alert Trend</span>
              </div>
              <div className="px-3 py-2">
                {summary.alert_trend.length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-3">No data</p>
                ) : (
                  <div className="flex items-end gap-px h-24">
                    {summary.alert_trend.map((point, i) => {
                      const height = maxAlertCount > 0 ? (point.count / maxAlertCount) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 group relative" title={`${point.date}: ${point.count}`}>
                          <div className="w-full bg-sev-critical/30 hover:bg-sev-critical/60 transition-all duration-200 cursor-pointer rounded-t" style={{ height: `${Math.max(height, 2)}%` }} />
                          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-intel-surface border border-intel-border rounded text-2xs text-gray-300 whitespace-nowrap z-10">
                            {point.date}: {point.count}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {summary.alert_trend.length > 0 && (
                  <div className="flex items-center justify-between mt-1 text-2xs text-gray-700">
                    <span>{summary.alert_trend[0]?.date}</span>
                    <span>{summary.alert_trend[summary.alert_trend.length - 1]?.date}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Entity Trend */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
                <TrendingUp className="w-3 h-3 text-gray-400" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Entity Trend</span>
              </div>
              <div className="px-3 py-2">
                {summary.entity_trend.length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-3">No data</p>
                ) : (
                  <div className="flex items-end gap-px h-24">
                    {summary.entity_trend.map((point, i) => {
                      const height = maxEntityCount > 0 ? (point.new_entities / maxEntityCount) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 group relative" title={`${point.date}: ${point.new_entities}`}>
                          <div className="w-full bg-intel-accent/25 hover:bg-intel-accent/50 transition-all duration-200 cursor-pointer rounded-t" style={{ height: `${Math.max(height, 2)}%` }} />
                          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-intel-surface border border-intel-border rounded text-2xs text-gray-300 whitespace-nowrap z-10">
                            {point.date}: {point.new_entities}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {summary.entity_trend.length > 0 && (
                  <div className="flex items-center justify-between mt-1 text-2xs text-gray-700">
                    <span>{summary.entity_trend[0]?.date}</span>
                    <span>{summary.entity_trend[summary.entity_trend.length - 1]?.date}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Top Risk Entities */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
                <Shield className="w-3 h-3 text-sev-high" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Top Risk Entities</span>
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {summary.top_risk_entities.length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-4">None</p>
                ) : (
                  <div>
                    {summary.top_risk_entities.map((entity) => (
                      <div
                        key={entity.entity_id}
                        className="flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 cursor-pointer transition-all duration-150"
                        onClick={() => onViewChange('investigation')}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-200 truncate font-mono">{entity.entity_id.slice(0, 12)}</span>
                            <span className={`text-2xs font-bold ${
                              entity.risk_level === 'critical' ? 'text-sev-critical' :
                              entity.risk_level === 'high' ? 'text-sev-high' :
                              entity.risk_level === 'medium' ? 'text-sev-medium' : 'text-intel-accent'
                            }`}>{(entity.risk_score * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-2xs text-gray-600">{entity.entity_type}</span>
                            <span className="text-2xs text-gray-700">{entity.visit_count}v</span>
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Locations */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Top Locations</span>
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {summary.top_locations.length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-4">None</p>
                ) : (
                  <div className="px-3 py-2 space-y-1.5">
                    {summary.top_locations.map((loc, i) => {
                      const maxEvents = summary.top_locations[0]?.event_count || 1;
                      const pct = (loc.event_count / maxEvents) * 100;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-2xs mb-0.5">
                            <span className="text-gray-300 truncate">{loc.location}</span>
                            <span className="text-gray-500 tabular-nums ml-2">{loc.event_count}</span>
                          </div>
                                <div className="w-full bg-intel-bg rounded h-1">
                                  <div className="h-1 rounded bg-intel-accent/40" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Active Insights */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
                <Brain className="w-3 h-3 text-intel-accent" />
                <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Insights</span>
                <span className="text-2xs font-bold text-intel-accent">{summary.active_insights.length}</span>
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {summary.active_insights.length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-4">None</p>
                ) : (
                  <div>
                    {summary.active_insights.map((insight) => (
                      <div key={insight.id} className="px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-2xs font-bold uppercase ${sevColor(insight.severity)}`}>{insight.severity}</span>
                          <span className="text-2xs text-gray-600">{insight.type}</span>
                          <span className="text-2xs text-gray-700 ml-auto tabular-nums">{Math.round(insight.confidence * 100)}%</span>
                        </div>
                        <p className="text-xs text-gray-200 mt-0.5">{insight.title}</p>
                        <p className="text-2xs text-gray-500 mt-0.5 line-clamp-1">{insight.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!summary && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Brain className="w-6 h-6 mb-2 opacity-30" />
          <p className="text-xs">No intelligence data available</p>
          <p className="text-xs mt-1 opacity-50">Data will appear as events are processed</p>
        </div>
      )}
    </div>
  );
}
