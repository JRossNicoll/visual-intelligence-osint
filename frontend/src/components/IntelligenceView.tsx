'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Brain,
  ChevronRight,
  MapPin,
  PieChart,
  RefreshCw,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { operatorApi } from '@/lib/api';
import type { IntelligenceSummary } from '@/types';
import { formatRelativeTime, severityColor } from '@/lib/utils';

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

  const riskColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };

  const behaviorColors: Record<string, string> = {
    loitering: 'bg-purple-500',
    repeated_visits: 'bg-blue-500',
    short_stay: 'bg-cyan-500',
    long_stay: 'bg-indigo-500',
    convoy: 'bg-pink-500',
    periodic: 'bg-teal-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading intelligence summary...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onViewChange('operator')}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Intelligence Mode</h2>
            <p className="text-xs text-gray-500">Long-term pattern tracking, trend analysis, strategic insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="bg-intel-bg border border-intel-border text-xs text-gray-300 rounded-lg px-3 py-2"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => onViewChange('operator')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-intel-surface border border-intel-border rounded-lg hover:bg-intel-card transition-colors"
          >
            Operator Mode
          </button>
          <button
            onClick={() => onViewChange('investigation')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-intel-surface border border-intel-border rounded-lg hover:bg-intel-card transition-colors"
          >
            Investigation Mode
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

      {summary && (
        <>
          {/* Generated At */}
          <div className="text-xs text-gray-500 text-right">
            Generated: {formatRelativeTime(summary.generated_at)} &middot; Period: {summary.period_days} days
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Distribution */}
            <div className="bg-intel-card border border-intel-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-intel-accent" />
                <h3 className="text-sm font-semibold text-white">Risk Distribution</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(summary.risk_distribution).map(([level, count]) => {
                  const pct = totalRisk > 0 ? (count / totalRisk) * 100 : 0;
                  return (
                    <div key={level}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400 capitalize">{level}</span>
                        <span className="text-white font-medium">{count} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-intel-bg rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${riskColors[level] || 'bg-gray-500'}`}
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Behavior Distribution */}
            <div className="bg-intel-card border border-intel-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Behavior Distribution</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(summary.behavior_distribution).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No behaviors recorded</p>
                ) : (
                  Object.entries(summary.behavior_distribution).map(([behavior, count]) => {
                    const pct = totalBehavior > 0 ? (count / totalBehavior) * 100 : 0;
                    return (
                      <div key={behavior}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400">{behavior.replace(/_/g, ' ')}</span>
                          <span className="text-white font-medium">{count} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-intel-bg rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${behaviorColors[behavior] || 'bg-gray-500'}`}
                            style={{ width: `${Math.max(pct, 1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Alert Trend */}
            <div className="bg-intel-card border border-intel-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-white">Alert Trend</h3>
              </div>
              {summary.alert_trend.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No alert data</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {summary.alert_trend.map((point, i) => {
                    const height = maxAlertCount > 0 ? (point.count / maxAlertCount) * 100 : 0;
                    return (
                      <div
                        key={i}
                        className="flex-1 group relative"
                        title={`${point.date}: ${point.count} alerts`}
                      >
                        <div
                          className="w-full bg-red-500/60 hover:bg-red-500 rounded-t transition-all cursor-pointer"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-intel-surface border border-intel-border rounded text-xs text-white whitespace-nowrap z-10">
                          {point.date}: {point.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {summary.alert_trend.length > 0 && (
                <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                  <span>{summary.alert_trend[0]?.date}</span>
                  <span>{summary.alert_trend[summary.alert_trend.length - 1]?.date}</span>
                </div>
              )}
            </div>

            {/* Entity Trend */}
            <div className="bg-intel-card border border-intel-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">New Entity Trend</h3>
              </div>
              {summary.entity_trend.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No entity data</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {summary.entity_trend.map((point, i) => {
                    const height = maxEntityCount > 0 ? (point.new_entities / maxEntityCount) * 100 : 0;
                    return (
                      <div
                        key={i}
                        className="flex-1 group relative"
                        title={`${point.date}: ${point.new_entities} new entities`}
                      >
                        <div
                          className="w-full bg-cyan-500/60 hover:bg-cyan-500 rounded-t transition-all cursor-pointer"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-intel-surface border border-intel-border rounded text-xs text-white whitespace-nowrap z-10">
                          {point.date}: {point.new_entities}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {summary.entity_trend.length > 0 && (
                <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                  <span>{summary.entity_trend[0]?.date}</span>
                  <span>{summary.entity_trend[summary.entity_trend.length - 1]?.date}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Risk Entities */}
            <div className="bg-intel-card border border-intel-border rounded-xl">
              <div className="flex items-center gap-2 p-4 border-b border-intel-border">
                <Shield className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-white">Top Risk Entities</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {summary.top_risk_entities.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No high-risk entities</p>
                ) : (
                  <div className="divide-y divide-intel-border/50">
                    {summary.top_risk_entities.map((entity) => (
                      <div
                        key={entity.entity_id}
                        className="p-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => {
                          onViewChange('investigation');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">{entity.entity_id}</span>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                entity.risk_level === 'critical' ? 'text-red-400 bg-red-500/10' :
                                entity.risk_level === 'high' ? 'text-orange-400 bg-orange-500/10' :
                                entity.risk_level === 'medium' ? 'text-yellow-400 bg-yellow-500/10' :
                                'text-green-400 bg-green-500/10'
                              }`}>
                                {(entity.risk_score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">{entity.entity_type}</span>
                              <span className="text-xs text-gray-600">{entity.visit_count} visits</span>
                            </div>
                            {entity.behavior_tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {entity.behavior_tags.slice(0, 2).map((tag, i) => (
                                  <span key={i} className="text-xs bg-intel-bg/50 text-gray-400 px-1.5 py-0.5 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Locations */}
            <div className="bg-intel-card border border-intel-border rounded-xl">
              <div className="flex items-center gap-2 p-4 border-b border-intel-border">
                <MapPin className="w-4 h-4 text-green-400" />
                <h3 className="text-sm font-semibold text-white">Top Locations</h3>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {summary.top_locations.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No location data</p>
                ) : (
                  <div className="divide-y divide-intel-border/50">
                    {summary.top_locations.map((loc, i) => {
                      const maxEvents = summary.top_locations[0]?.event_count || 1;
                      const pct = (loc.event_count / maxEvents) * 100;
                      return (
                        <div key={i} className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-white truncate">{loc.location}</span>
                            <span className="text-xs text-gray-400 ml-2">{loc.event_count}</span>
                          </div>
                          <div className="w-full bg-intel-bg rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-green-500/60"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Active Insights */}
            <div className="bg-intel-card border border-intel-border rounded-xl">
              <div className="flex items-center gap-2 p-4 border-b border-intel-border">
                <Brain className="w-4 h-4 text-intel-accent" />
                <h3 className="text-sm font-semibold text-white">Active Insights</h3>
                <span className="px-2 py-0.5 text-xs bg-intel-accent/20 text-intel-accent rounded-full">
                  {summary.active_insights.length}
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {summary.active_insights.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No active insights</p>
                ) : (
                  <div className="divide-y divide-intel-border/50">
                    {summary.active_insights.map((insight) => (
                      <div key={insight.id} className="p-3 hover:bg-white/[0.02]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${severityColor(insight.severity)}`}>
                            {insight.severity}
                          </span>
                          <span className="text-xs text-gray-500">{insight.type}</span>
                          <span className="text-xs text-gray-600 ml-auto">
                            {Math.round(insight.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-sm text-white">{insight.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{insight.description}</p>
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
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Brain className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">No intelligence data available</p>
          <p className="text-xs mt-1 opacity-50">Data will appear as events are processed</p>
        </div>
      )}
    </div>
  );
}
