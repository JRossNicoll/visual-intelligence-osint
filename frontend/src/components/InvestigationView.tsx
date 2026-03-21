'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  Star,
  Users,
} from 'lucide-react';
import { operatorApi } from '@/lib/api';
import type {
  EntitySearchResult,
  InvestigationTimeline,
  EntityFullProfile,
  TimelineItem,
} from '@/types';
import { formatRelativeTime } from '@/lib/utils';

const sevColor = (s: string) => {
  switch (s) {
    case 'critical': return 'text-sev-critical';
    case 'high': return 'text-sev-high';
    case 'medium': return 'text-sev-medium';
    default: return 'text-sev-low';
  }
};

interface InvestigationViewProps {
  onViewChange: (view: string) => void;
  initialEntityId?: string;
}

export default function InvestigationView({ onViewChange, initialEntityId }: InvestigationViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(initialEntityId || null);
  const [entityProfile, setEntityProfile] = useState<EntityFullProfile | null>(null);
  const [timeline, setTimeline] = useState<InvestigationTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Search entities
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() && riskFilter === 'all' && typeFilter === 'all') return;
    setSearchLoading(true);
    try {
      const results = await operatorApi.searchEntities({
        query: searchQuery || undefined,
        risk_level: riskFilter !== 'all' ? riskFilter : undefined,
        entity_type: typeFilter !== 'all' ? typeFilter : undefined,
        limit: 50,
      });
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, riskFilter, typeFilter]);

  // Load entity profile and timeline on selection
  useEffect(() => {
    if (!selectedEntity) return;
    setLoading(true);
    Promise.all([
      operatorApi.getEntityProfile(selectedEntity).catch(() => null),
      operatorApi.getTimeline({ entity_id: selectedEntity, limit: 200 }).catch(() => null),
    ]).then(([profile, tl]) => {
      setEntityProfile(profile);
      setTimeline(tl);
    }).finally(() => setLoading(false));
  }, [selectedEntity]);

  // Load initial entity if provided
  useEffect(() => {
    if (initialEntityId) {
      setSelectedEntity(initialEntityId);
    }
  }, [initialEntityId]);

  const handleAddToWatchlist = async (entityId: string) => {
    try {
      await operatorApi.addToWatchlist(entityId, 'Added from investigation', 'high');
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

  const riskBarWidth = (score: number) => `${Math.min(Math.max(score * 100, 2), 100)}%`;

  return (
    <div className="p-3 space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => onViewChange('operator')} className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-2xs font-semibold text-gray-400 uppercase tracking-widest">Investigation</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onViewChange('operator')} className="px-2 py-1 text-2xs text-gray-500 hover:text-gray-300 border border-intel-border rounded-sm transition-colors">OPERATOR</button>
          <button onClick={() => onViewChange('intel-summary')} className="px-2 py-1 text-2xs text-gray-500 hover:text-gray-300 border border-intel-border rounded-sm transition-colors">INTELLIGENCE</button>
        </div>
      </div>

      {/* Search strip */}
      <div className="flex items-center gap-2 bg-intel-panel border border-intel-border rounded-sm p-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search entities..."
            className="w-full pl-7 pr-3 py-1.5 bg-intel-bg border border-intel-border rounded-sm text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-intel-border-light"
          />
        </div>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="bg-intel-bg border border-intel-border text-2xs text-gray-400 rounded-sm px-2 py-1.5">
          <option value="all">Risk: All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-intel-bg border border-intel-border text-2xs text-gray-400 rounded-sm px-2 py-1.5">
          <option value="all">Type: All</option>
          <option value="person">Person</option>
          <option value="vehicle">Vehicle</option>
          <option value="object">Object</option>
        </select>
        <button onClick={handleSearch} className="px-3 py-1.5 bg-intel-accent/10 text-intel-accent text-2xs font-semibold rounded-sm hover:bg-intel-accent/20 transition-colors">SEARCH</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Results list */}
        <div className="bg-intel-panel border border-intel-border rounded-sm">
          <div className="px-3 py-2 border-b border-intel-border">
            <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">
              {searchResults.length > 0 ? `Results (${searchResults.length})` : 'Entities'}
            </span>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-3.5 h-3.5 text-gray-600 animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <Search className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                <p className="text-2xs">Search to investigate</p>
              </div>
            ) : (
              <div>
                {searchResults.map((entity) => (
                  <div
                    key={entity.entity_id}
                    onClick={() => setSelectedEntity(entity.entity_id)}
                    className={`flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/30 cursor-pointer transition-colors ${
                      selectedEntity === entity.entity_id ? 'bg-intel-accent/5 border-l-2 border-l-intel-accent' : 'hover:bg-white/[0.015]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-200 truncate font-mono">{entity.entity_id.slice(0, 14)}</span>
                        <span className={`text-2xs font-bold ${riskLevelColor(entity.risk_level)}`}>{entity.risk_level.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-2xs text-gray-600">{entity.entity_type}</span>
                        <span className="text-2xs text-gray-700">{entity.visit_count}v</span>
                        {entity.last_location && <span className="text-2xs text-gray-700 truncate">@ {entity.last_location}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Entity detail + timeline */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-4 h-4 text-gray-600 animate-spin" />
            </div>
          ) : selectedEntity && entityProfile ? (
            <>
              {/* Profile panel */}
              <div className="bg-intel-panel border border-intel-border rounded-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-intel-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-200">{entityProfile.entity_id}</span>
                    <span className={`text-2xs font-bold ${riskLevelColor(entityProfile.risk_level)}`}>{entityProfile.risk_level.toUpperCase()}</span>
                    {entityProfile.is_on_watchlist && <Star className="w-3 h-3 text-sev-medium fill-sev-medium" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {!entityProfile.is_on_watchlist && (
                      <button onClick={() => handleAddToWatchlist(entityProfile.entity_id)} className="px-2 py-0.5 text-2xs text-sev-medium border border-sev-medium/30 rounded-sm hover:bg-sev-medium/10 transition-colors">WATCH</button>
                    )}
                  </div>
                </div>
                <div className="px-3 py-2">
                  <p className="text-2xs text-gray-500">{entityProfile.entity_type} &middot; {entityProfile.risk_summary}</p>

                  {/* Risk bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xs text-gray-600 w-12">Risk</span>
                    <div className="flex-1 bg-intel-bg rounded-sm h-1.5">
                      <div className={`h-1.5 rounded-sm transition-all ${
                        entityProfile.risk_score > 0.7 ? 'bg-sev-critical' :
                        entityProfile.risk_score > 0.4 ? 'bg-sev-high' :
                        entityProfile.risk_score > 0.2 ? 'bg-sev-medium' : 'bg-intel-accent'
                      }`} style={{ width: riskBarWidth(entityProfile.risk_score) }} />
                    </div>
                    <span className="text-2xs font-bold text-gray-300 w-8 text-right">{(entityProfile.risk_score * 100).toFixed(0)}%</span>
                  </div>

                  {/* Key data row */}
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {[
                      { l: 'First', v: entityProfile.first_seen ? formatRelativeTime(entityProfile.first_seen) : 'N/A' },
                      { l: 'Last', v: entityProfile.last_seen ? formatRelativeTime(entityProfile.last_seen) : 'N/A' },
                      { l: 'Visits', v: String(entityProfile.visit_count) },
                      { l: 'Location', v: entityProfile.last_location || 'Unknown' },
                    ].map((d) => (
                      <div key={d.l}>
                        <div className="text-2xs text-gray-600">{d.l}</div>
                        <div className="text-xs text-gray-300 truncate">{d.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Associations */}
                  {entityProfile.associated_entities.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-intel-border/50">
                      <div className="text-2xs text-gray-600 mb-1">ASSOCIATED ({entityProfile.associated_entities.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {entityProfile.associated_entities.map((assoc) => (
                          <button key={assoc.entity_id} onClick={() => setSelectedEntity(assoc.entity_id)}
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-intel-bg border border-intel-border rounded-sm text-2xs hover:border-intel-border-light transition-colors">
                            <Users className="w-2.5 h-2.5 text-gray-600" />
                            <span className="text-gray-300">{assoc.entity_id.slice(0, 10)}</span>
                            <span className="text-gray-600">{(assoc.strength * 100).toFixed(0)}%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Behaviors */}
                  {entityProfile.behavior_tags.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-intel-border/50">
                      <div className="flex flex-wrap gap-1">
                        {entityProfile.behavior_tags.map((tag, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-2xs bg-gray-700/20 text-gray-400 border border-intel-border rounded-sm">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  {entityProfile.insights.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-intel-border/50 space-y-1">
                      <div className="text-2xs text-gray-600">INSIGHTS</div>
                      {entityProfile.insights.slice(0, 3).map((insight) => (
                        <div key={insight.id} className="px-2 py-1.5 bg-intel-bg/50 border border-intel-border/50 rounded-sm">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-2xs font-bold uppercase ${sevColor(insight.severity)}`}>{insight.severity}</span>
                            <span className="text-2xs text-gray-600">{insight.type}</span>
                          </div>
                          <p className="text-xs text-gray-300 mt-0.5">{insight.title}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              {timeline && (
                <div className="bg-intel-panel border border-intel-border rounded-sm">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-intel-border">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-intel-accent" />
                      <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Timeline</span>
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-gray-600">
                      <span>{timeline.total_events} events</span>
                      <span>{timeline.total_alerts} alerts</span>
                    </div>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {timeline.items.length === 0 ? (
                      <p className="text-2xs text-gray-600 text-center py-6">No events</p>
                    ) : (
                      <div>
                        {timeline.items.map((item: TimelineItem) => (
                          <div key={item.id} className={`flex items-start gap-2 px-3 py-1.5 border-b border-intel-border/30 hover:bg-white/[0.015] transition-colors ${
                            item.type === 'alert' ? 'sev-' + (item.severity || 'low') : ''
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                              item.type === 'alert' ? 'bg-sev-critical' : 'bg-intel-accent'
                            }`} />
                            <div className="flex-1 min-w-0">
                              {item.type === 'alert' ? (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-2xs font-bold uppercase ${sevColor(item.severity || '')}`}>{item.severity}</span>
                                    <span className="text-2xs text-gray-600">{item.alert_type}</span>
                                  </div>
                                  <p className="text-xs text-gray-200 truncate">{item.title}</p>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-2xs text-intel-accent font-medium">{item.event_type}</span>
                                    {item.location_name && <span className="text-2xs text-gray-600">@ {item.location_name}</span>}
                                  </div>
                                  {item.co_occurring_entities && item.co_occurring_entities.length > 0 && (
                                    <span className="text-2xs text-gray-600">+{item.co_occurring_entities.length} co-occurring</span>
                                  )}
                                </>
                              )}
                            </div>
                            <span className="text-2xs text-gray-700 whitespace-nowrap">{formatRelativeTime(item.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Past Alerts */}
              {entityProfile.alerts.length > 0 && (
                <div className="bg-intel-panel border border-intel-border rounded-sm">
                  <div className="px-3 py-2 border-b border-intel-border">
                    <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Past Alerts ({entityProfile.alerts.length})</span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {entityProfile.alerts.map((alert) => (
                      <div key={alert.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/30 hover:bg-white/[0.015]">
                        <span className={`text-2xs font-bold uppercase ${sevColor(alert.severity)}`}>{alert.severity}</span>
                        <span className="text-2xs text-gray-600">{alert.alert_type}</span>
                        <span className="text-xs text-gray-300 flex-1 truncate">{alert.title}</span>
                        <span className="text-2xs text-gray-700">{formatRelativeTime(alert.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600">
              <Search className="w-6 h-6 mb-2 opacity-30" />
              <p className="text-xs">Select an entity to investigate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
