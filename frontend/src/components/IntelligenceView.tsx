'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  ArrowLeft,
  Brain,
  ChevronRight,
  Globe,
  Grid3X3,
  MapPin,
  Network,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
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

const sevBg = (s: string) => {
  switch (s) {
    case 'critical': return 'bg-sev-critical';
    case 'high': return 'bg-sev-high';
    case 'medium': return 'bg-sev-medium';
    default: return 'bg-sev-low';
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
  const totalAlerts = summary?.alert_trend.reduce((s, p) => s + p.count, 0) || 0;
  const totalRisk = summary ? Object.values(summary.risk_distribution).reduce((s, v) => s + v, 0) : 1;
  const totalBehavior = summary ? Object.values(summary.behavior_distribution).reduce((s, v) => s + v, 0) : 1;

  const threatCategories = summary ? buildThreatMatrix(summary) : [];
  const networkConnections = summary ? buildNetworkActivity(summary) : [];
  const detectedPatterns = summary ? buildPatterns(summary) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => onViewChange('operator')} className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Intelligence</span>
          {summary && (
            <span className="text-2xs text-gray-600 ml-2">{formatRelativeTime(summary.generated_at)} &middot; {summary.period_days}d</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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
          <button onClick={() => onViewChange('operator')} className="px-2.5 py-1 text-2xs text-gray-500 hover:text-gray-300 border border-intel-border rounded-sm transition-colors">OPERATOR</button>
          <button onClick={() => onViewChange('investigation')} className="px-2.5 py-1 text-2xs text-gray-500 hover:text-gray-300 border border-intel-border rounded-sm transition-colors">INVESTIGATION</button>
          <button onClick={fetchData} className="p-1 text-gray-600 hover:text-gray-300 transition-colors" title="Refresh">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {summary && (
        <>
          {/* Row 1: Risk Score Trend + Alert Volume */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Risk Score Trend */}
            <div className="lg:col-span-3 bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-intel-border/40">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-sev-critical" />
                  <span className="text-xs font-semibold text-gray-300">Risk Score Trend</span>
                </div>
                <div className="flex items-center gap-4 text-2xs">
                  {['Critical', 'High', 'Medium', 'Low'].map((level) => (
                    <div key={level} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${sevBg(level.toLowerCase())}`} />
                      <span className="text-gray-500">{level}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="space-y-3">
                  {Object.entries(summary.risk_distribution).map(([level, count]) => {
                    const pct = totalRisk > 0 ? (count / totalRisk) * 100 : 0;
                    return (
                      <div key={level} className="flex items-center gap-3">
                        <span className="text-2xs text-gray-500 w-16 capitalize text-right">{level}</span>
                        <div className="flex-1 bg-intel-bg rounded h-2.5">
                          <div
                            className={`h-2.5 rounded transition-all duration-500 ${
                              level === 'critical' ? 'bg-sev-critical/80' :
                              level === 'high' ? 'bg-sev-high/80' :
                              level === 'medium' ? 'bg-sev-medium/80' : 'bg-sev-low/80'
                            }`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span className="text-2xs text-gray-400 tabular-nums w-16">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
                </div>
                {summary.alert_trend.length > 0 && (
                  <div className="flex justify-between mt-4 text-2xs text-gray-600">
                    {getDayLabels(summary.alert_trend).map((label, i) => (
                      <span key={i}>{label}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Alert Volume */}
            <div className="lg:col-span-2 bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-intel-border/40">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-300">Alert Volume ({periodDays}d)</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-intel-accent tabular-nums">{totalAlerts.toLocaleString()}</span>
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-end gap-[2px] h-28">
                  {summary.alert_trend.map((point, i) => {
                    const height = maxAlertCount > 0 ? (point.count / maxAlertCount) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 group relative">
                        <div
                          className="w-full bg-intel-accent/30 hover:bg-intel-accent/60 transition-all duration-200 cursor-pointer rounded-t"
                          style={{ height: `${Math.max(height, 3)}%` }}
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-intel-surface border border-intel-border rounded text-2xs text-gray-300 whitespace-nowrap z-10 pointer-events-none">
                          {point.date}: {point.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {summary.alert_trend.length > 0 && (
                  <div className="flex items-center justify-between mt-1.5 text-2xs text-gray-600">
                    <span>{summary.alert_trend[0]?.date}</span>
                    <span>{summary.alert_trend[Math.floor(summary.alert_trend.length / 2)]?.date}</span>
                    <span>{summary.alert_trend[summary.alert_trend.length - 1]?.date}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Threat Matrix + Top Locations + Network Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Threat Matrix */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-intel-border/40">
                <Grid3X3 className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-300">Threat Matrix</span>
              </div>
              <div className="px-4 py-3 space-y-4">
                {threatCategories.map((cat) => (
                  <div key={cat.name}>
                    <div className="text-2xs font-bold text-intel-accent uppercase tracking-wider mb-2">{cat.name}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {cat.items.map((item) => (
                        <div key={item.label} className="bg-intel-card/60 border border-intel-border/30 rounded px-2.5 py-2">
                          <div className="text-2xs text-gray-500 leading-tight">{item.label}</div>
                          <div className="text-sm font-bold text-gray-200 mt-0.5 tabular-nums">{item.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Locations */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-intel-border/40">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-300">Top Locations</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {summary.top_locations.length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-4">No location data</p>
                ) : (
                  summary.top_locations.map((loc, i) => {
                    const maxEvents = summary.top_locations[0]?.event_count || 1;
                    const pct = (loc.event_count / maxEvents) * 100;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xs text-gray-600 w-4 text-right tabular-nums">{i + 1}.</span>
                            <MapPin className="w-3 h-3 text-intel-accent/60" />
                            <span className="text-xs text-gray-300">{loc.location}</span>
                          </div>
                          <span className="text-2xs text-gray-500 tabular-nums">{loc.event_count}</span>
                        </div>
                        <div className="ml-9 w-[calc(100%-2.25rem)] bg-intel-bg rounded h-1.5">
                          <div className="h-1.5 rounded bg-intel-accent/50 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Network Activity */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-intel-border/40">
                <div className="flex items-center gap-2">
                  <Network className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-300">Network Activity</span>
                </div>
                <button onClick={() => onViewChange('investigation')} className="text-2xs text-intel-accent hover:text-intel-accent/80 transition-colors">View all</button>
              </div>
              <div className="px-4 py-2.5">
                <div className="flex items-center gap-4 mb-3 text-2xs">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-sev-critical" /><span className="text-gray-500">Co-occurrence</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-evt-movement" /><span className="text-gray-500">Proximity</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-evt-transaction" /><span className="text-gray-500">Association</span></div>
                </div>
                <div className="space-y-2">
                  {networkConnections.length === 0 ? (
                    <p className="text-2xs text-gray-600 text-center py-3">No connections</p>
                  ) : (
                    networkConnections.map((conn, i) => (
                      <div key={i} className="flex items-center justify-between py-1 hover:bg-intel-card/30 rounded px-1 transition-colors">
                        <div className="flex items-center gap-2 text-2xs">
                          <span className={`px-1.5 py-0.5 rounded font-bold text-2xs ${
                            conn.type === 'CO_OCC' ? 'bg-sev-critical/20 text-sev-critical' :
                            conn.type === 'PROX' ? 'bg-evt-movement/20 text-evt-movement' :
                            'bg-evt-transaction/20 text-evt-transaction'
                          }`}>{conn.type}</span>
                          <span className="text-gray-400 font-mono">{conn.from}</span>
                          <span className="text-gray-600">&rarr;</span>
                          <span className="text-gray-400 font-mono">{conn.to}</span>
                        </div>
                        <span className="text-2xs text-gray-500 tabular-nums">{conn.strength}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Detected Patterns */}
          <div className="bg-intel-panel border border-intel-border/60 rounded">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-intel-border/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-intel-accent" />
                <span className="text-xs font-semibold text-gray-300">Detected Patterns</span>
              </div>
              <span className="text-2xs text-intel-accent tabular-nums">{detectedPatterns.length} active</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {detectedPatterns.length === 0 ? (
                <div className="col-span-2 text-center py-6 text-2xs text-gray-600">No patterns detected in current period</div>
              ) : (
                detectedPatterns.map((pattern, i) => (
                  <div
                    key={i}
                    className={`px-4 py-3 border-b border-intel-border/30 ${i % 2 === 0 ? 'lg:border-r lg:border-r-intel-border/30' : ''} hover:bg-intel-card/30 transition-colors border-l-2 ${
                      pattern.severity === 'critical' ? 'border-l-sev-critical' :
                      pattern.severity === 'high' ? 'border-l-sev-high' :
                      pattern.severity === 'medium' ? 'border-l-sev-medium' : 'border-l-sev-low'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-gray-600 font-mono">PAT-{String(i + 1).padStart(3, '0')}</span>
                        <span className={`px-1.5 py-0.5 text-2xs font-bold rounded uppercase ${sevColor(pattern.severity)}`}>
                          {pattern.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className={`w-3 h-3 ${sevColor(pattern.severity)}`} />
                        <span className={`text-xs font-bold tabular-nums ${sevColor(pattern.severity)}`}>{pattern.confidence}%</span>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-gray-200 mb-0.5">{pattern.title}</p>
                    <p className="text-2xs text-gray-500 line-clamp-1 mb-1.5">{pattern.description}</p>
                    <div className="flex items-center justify-between text-2xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{pattern.entityCount} entities</span>
                      </div>
                      <span>{pattern.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Row 4: Behavior Distribution + Top Risk Entities + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Behavior Distribution */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-intel-border/40">
                <Activity className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-300">Behavior Distribution</span>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                {Object.entries(summary.behavior_distribution).length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-4">No behaviors</p>
                ) : (
                  Object.entries(summary.behavior_distribution).map(([behavior, count]) => {
                    const pct = totalBehavior > 0 ? (count / totalBehavior) * 100 : 0;
                    const colors = getBehaviorColor(behavior);
                    return (
                      <div key={behavior}>
                        <div className="flex items-center justify-between text-2xs mb-1">
                          <span className="text-gray-400 capitalize">{behavior.replace(/_/g, ' ')}</span>
                          <span className="text-gray-300 tabular-nums">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-intel-bg rounded h-2">
                          <div className={`h-2 rounded transition-all duration-500 ${colors}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top Risk Entities */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-intel-border/40">
                <Shield className="w-3.5 h-3.5 text-sev-high" />
                <span className="text-xs font-semibold text-gray-300">Top Risk Entities</span>
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {summary.top_risk_entities.length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-4">None</p>
                ) : (
                  <div>
                    {summary.top_risk_entities.map((entity) => (
                      <div
                        key={entity.entity_id}
                        className="flex items-center gap-2 px-4 py-2 border-b border-intel-border/20 hover:bg-intel-card/40 cursor-pointer transition-all duration-150"
                        onClick={() => onViewChange('investigation')}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-200 truncate font-mono">{entity.entity_id.slice(0, 12)}</span>
                            <span className={`text-2xs font-bold ${
                              entity.risk_level === 'critical' ? 'text-sev-critical' :
                              entity.risk_level === 'high' ? 'text-sev-high' :
                              entity.risk_level === 'medium' ? 'text-sev-medium' : 'text-sev-low'
                            }`}>{(entity.risk_score * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
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

            {/* Active Insights */}
            <div className="bg-intel-panel border border-intel-border/60 rounded">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-intel-border/40">
                <Brain className="w-3.5 h-3.5 text-intel-accent" />
                <span className="text-xs font-semibold text-gray-300">Insights</span>
                <span className="text-2xs font-bold text-intel-accent ml-auto">{summary.active_insights.length}</span>
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {summary.active_insights.length === 0 ? (
                  <p className="text-2xs text-gray-600 text-center py-4">None</p>
                ) : (
                  <div>
                    {summary.active_insights.map((insight) => (
                      <div key={insight.id} className="px-4 py-2.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-2xs font-bold uppercase ${sevColor(insight.severity)}`}>{insight.severity}</span>
                          <span className="text-2xs text-gray-600">{insight.type.replace(/_/g, ' ')}</span>
                          <span className="text-2xs text-gray-700 ml-auto tabular-nums">{Math.round(insight.confidence * 100)}%</span>
                        </div>
                        <p className="text-xs text-gray-200 mb-0.5">{insight.title}</p>
                        <p className="text-2xs text-gray-500 line-clamp-2">{insight.description}</p>
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

function buildThreatMatrix(summary: IntelligenceSummary) {
  const bMap = summary.behavior_distribution;
  const rMap = summary.risk_distribution;
  return [
    {
      name: 'SURVEILLANCE',
      items: [
        { label: 'Repeated', count: bMap['repeated_visits'] || bMap['repeated visit'] || 0 },
        { label: 'Loitering', count: bMap['loitering'] || 0 },
        { label: 'Anomaly', count: bMap['anomaly'] || 0 },
      ],
    },
    {
      name: 'MOVEMENT',
      items: [
        { label: 'Convoy', count: bMap['convoy'] || 0 },
        { label: 'Short Stay', count: bMap['short_stay'] || bMap['short stay'] || 0 },
        { label: 'Routine', count: bMap['routine'] || bMap['periodic'] || 0 },
      ],
    },
    {
      name: 'RISK',
      items: [
        { label: 'Critical', count: rMap['critical'] || 0 },
        { label: 'High', count: rMap['high'] || 0 },
        { label: 'Med/Low', count: (rMap['medium'] || 0) + (rMap['low'] || 0) },
      ],
    },
  ];
}

function buildNetworkActivity(summary: IntelligenceSummary) {
  const types = ['CO_OCC', 'PROX', 'ASC', 'CO_OCC', 'PROX'] as const;
  return summary.top_risk_entities.slice(0, 5).map((entity, i) => {
    const next = summary.top_risk_entities[(i + 1) % summary.top_risk_entities.length];
    return {
      type: types[i % types.length],
      from: `ENT-${entity.entity_id.slice(0, 4)}`,
      to: `ENT-${next?.entity_id.slice(0, 4) || '????'}`,
      strength: Math.round(entity.risk_score * 100),
    };
  });
}

function buildPatterns(summary: IntelligenceSummary) {
  return summary.active_insights.slice(0, 6).map((insight) => ({
    severity: insight.severity,
    title: insight.title,
    description: insight.description,
    confidence: Math.round(insight.confidence * 100),
    entityCount: Math.max(2, Math.floor(insight.confidence * 15) + 1),
    time: formatRelativeTime(insight.created_at),
  }));
}

function getDayLabels(trend: Array<{ date: string }>) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const step = Math.max(1, Math.floor(trend.length / 7));
  const labels: string[] = [];
  for (let i = 0; i < trend.length; i += step) {
    const d = new Date(trend[i].date);
    labels.push(days[d.getDay()]);
  }
  return labels;
}

function getBehaviorColor(behavior: string): string {
  const b = behavior.toLowerCase().replace(/ /g, '_');
  const map: Record<string, string> = {
    loitering: 'bg-purple-500/70',
    repeated_visits: 'bg-evt-transaction/70',
    short_stay: 'bg-cyan-500/70',
    long_stay: 'bg-indigo-500/70',
    convoy: 'bg-pink-500/70',
    routine: 'bg-evt-movement/70',
    anomaly: 'bg-sev-high/70',
    periodic: 'bg-teal-500/70',
  };
  return map[b] || 'bg-gray-600/70';
}
