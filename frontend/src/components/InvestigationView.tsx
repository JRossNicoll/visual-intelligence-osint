'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  MapPin,
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
import { formatRelativeTime, severityColor } from '@/lib/utils';

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
      case 'critical': return 'text-red-400 bg-red-500/10';
      case 'high': return 'text-orange-400 bg-orange-500/10';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10';
      default: return 'text-green-400 bg-green-500/10';
    }
  };

  const riskBarWidth = (score: number) => `${Math.min(Math.max(score * 100, 2), 100)}%`;

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
            <h2 className="text-lg font-bold text-white tracking-wide">Investigation Mode</h2>
            <p className="text-xs text-gray-500">Search entities, explore timelines, analyze relationships</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewChange('operator')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-intel-surface border border-intel-border rounded-lg hover:bg-intel-card transition-colors"
          >
            Operator Mode
          </button>
          <button
            onClick={() => onViewChange('intel-summary')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-intel-surface border border-intel-border rounded-lg hover:bg-intel-card transition-colors"
          >
            Intelligence Mode
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-intel-card border border-intel-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search entities by ID, type, or behavior..."
              className="w-full pl-10 pr-4 py-2.5 bg-intel-bg border border-intel-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-intel-accent"
            />
          </div>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-intel-bg border border-intel-border text-xs text-gray-300 rounded-lg px-3 py-2.5"
          >
            <option value="all">All Risk</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-intel-bg border border-intel-border text-xs text-gray-300 rounded-lg px-3 py-2.5"
          >
            <option value="all">All Types</option>
            <option value="person">Person</option>
            <option value="vehicle">Vehicle</option>
            <option value="object">Object</option>
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 bg-intel-accent/20 text-intel-accent text-sm font-medium rounded-lg hover:bg-intel-accent/30 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Results / Entity List */}
        <div className="bg-intel-card border border-intel-border rounded-xl">
          <div className="p-4 border-b border-intel-border">
            <h3 className="text-sm font-semibold text-white">
              {searchResults.length > 0 ? `Results (${searchResults.length})` : 'Entity Search'}
            </h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {searchLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Search for entities to investigate</p>
              </div>
            ) : (
              <div className="divide-y divide-intel-border/50">
                {searchResults.map((entity) => (
                  <div
                    key={entity.entity_id}
                    onClick={() => setSelectedEntity(entity.entity_id)}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedEntity === entity.entity_id
                        ? 'bg-intel-accent/5 border-l-2 border-l-intel-accent'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{entity.entity_id}</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${riskLevelColor(entity.risk_level)}`}>
                            {entity.risk_level}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{entity.entity_type}</span>
                          <span className="text-xs text-gray-600">{entity.visit_count} visits</span>
                          {entity.last_location && (
                            <span className="text-xs text-gray-600">
                              <MapPin className="w-3 h-3 inline" /> {entity.last_location}
                            </span>
                          )}
                        </div>
                        {entity.behavior_tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {entity.behavior_tags.slice(0, 3).map((tag, i) => (
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

        {/* Entity Profile + Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
            </div>
          ) : selectedEntity && entityProfile ? (
            <>
              {/* Entity Profile Card */}
              <div className="bg-intel-card border border-intel-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{entityProfile.entity_id}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${riskLevelColor(entityProfile.risk_level)}`}>
                        {entityProfile.risk_level.toUpperCase()}
                      </span>
                      {entityProfile.is_on_watchlist && (
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{entityProfile.entity_type} &middot; {entityProfile.risk_summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!entityProfile.is_on_watchlist && (
                      <button
                        onClick={() => handleAddToWatchlist(entityProfile.entity_id)}
                        className="px-3 py-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-colors"
                      >
                        <Star className="w-3 h-3 inline mr-1" /> Watch
                      </button>
                    )}
                  </div>
                </div>

                {/* Risk Score Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">Risk Score</span>
                    <span className="text-white font-bold">{(entityProfile.risk_score * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-intel-bg rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        entityProfile.risk_score > 0.7 ? 'bg-red-500' :
                        entityProfile.risk_score > 0.4 ? 'bg-orange-500' :
                        entityProfile.risk_score > 0.2 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: riskBarWidth(entityProfile.risk_score) }}
                    />
                  </div>
                </div>

                {/* Key Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-intel-bg/50 rounded-lg p-2.5">
                    <div className="text-xs text-gray-500">First Seen</div>
                    <div className="text-sm text-white mt-0.5">
                      {entityProfile.first_seen ? formatRelativeTime(entityProfile.first_seen) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-intel-bg/50 rounded-lg p-2.5">
                    <div className="text-xs text-gray-500">Last Seen</div>
                    <div className="text-sm text-white mt-0.5">
                      {entityProfile.last_seen ? formatRelativeTime(entityProfile.last_seen) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-intel-bg/50 rounded-lg p-2.5">
                    <div className="text-xs text-gray-500">Visits</div>
                    <div className="text-sm text-white mt-0.5">{entityProfile.visit_count}</div>
                  </div>
                  <div className="bg-intel-bg/50 rounded-lg p-2.5">
                    <div className="text-xs text-gray-500">Last Location</div>
                    <div className="text-sm text-white mt-0.5 truncate">
                      {entityProfile.last_location || 'Unknown'}
                    </div>
                  </div>
                </div>

                {/* Associated Entities */}
                {entityProfile.associated_entities.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Associated Entities
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {entityProfile.associated_entities.map((assoc) => (
                        <button
                          key={assoc.entity_id}
                          onClick={() => setSelectedEntity(assoc.entity_id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-intel-bg/50 border border-intel-border rounded-lg text-xs hover:border-intel-accent/30 transition-colors"
                        >
                          <Users className="w-3 h-3 text-gray-500" />
                          <span className="text-white">{assoc.entity_id}</span>
                          <span className="text-gray-500">({(assoc.strength * 100).toFixed(0)}%)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Behavior Tags */}
                {entityProfile.behavior_tags.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Behaviors
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {entityProfile.behavior_tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Insights */}
                {entityProfile.insights.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Intelligence Insights
                    </h4>
                    <div className="space-y-2">
                      {entityProfile.insights.slice(0, 5).map((insight) => (
                        <div key={insight.id} className="p-2.5 bg-intel-bg/50 rounded-lg border border-intel-border/50">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${severityColor(insight.severity)}`}>
                              {insight.severity}
                            </span>
                            <span className="text-xs text-gray-500">{insight.type}</span>
                          </div>
                          <p className="text-sm text-white">{insight.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{insight.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline */}
              {timeline && (
                <div className="bg-intel-card border border-intel-border rounded-xl">
                  <div className="p-4 border-b border-intel-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-intel-accent" />
                        <h3 className="text-sm font-semibold text-white">Event Timeline</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{timeline.total_events} events</span>
                        <span>{timeline.total_alerts} alerts</span>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {timeline.items.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No timeline events</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-6 top-0 bottom-0 w-px bg-intel-border" />
                        <div className="space-y-0">
                          {timeline.items.map((item: TimelineItem) => (
                            <div key={item.id} className="relative pl-12 pr-4 py-3 hover:bg-white/[0.02] transition-colors">
                              <div className={`absolute left-[19px] w-3 h-3 rounded-full border-2 ${
                                item.type === 'alert'
                                  ? 'bg-red-500 border-red-400'
                                  : 'bg-intel-accent border-intel-accent/70'
                              }`} />
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  {item.type === 'alert' ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${severityColor(item.severity || '')}`}>
                                          {item.severity}
                                        </span>
                                        <span className="text-xs text-gray-500">{item.alert_type}</span>
                                      </div>
                                      <p className="text-sm text-white mt-0.5">{item.title}</p>
                                      {item.description && (
                                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-intel-accent font-medium">{item.event_type}</span>
                                        {item.entity_id && (
                                          <span className="text-xs text-gray-500">{item.entity_id}</span>
                                        )}
                                      </div>
                                      {item.location_name && (
                                        <p className="text-xs text-gray-400 mt-0.5">
                                          <MapPin className="w-3 h-3 inline mr-1" />
                                          {item.location_name}
                                        </p>
                                      )}
                                      {item.co_occurring_entities && item.co_occurring_entities.length > 0 && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Co-occurring: {item.co_occurring_entities.join(', ')}
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                                <span className="text-xs text-gray-600 whitespace-nowrap ml-3">
                                  {formatRelativeTime(item.timestamp)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Alerts */}
              {entityProfile.alerts.length > 0 && (
                <div className="bg-intel-card border border-intel-border rounded-xl">
                  <div className="p-4 border-b border-intel-border">
                    <h3 className="text-sm font-semibold text-white">Past Alerts ({entityProfile.alerts.length})</h3>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto divide-y divide-intel-border/50">
                    {entityProfile.alerts.map((alert) => (
                      <div key={alert.id} className="p-3 hover:bg-white/[0.02]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${severityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs text-gray-500">{alert.alert_type}</span>
                          <span className="text-xs text-gray-600 ml-auto">
                            {formatRelativeTime(alert.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-white">{alert.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <Search className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Select an entity to view its profile and timeline</p>
              <p className="text-xs mt-1 opacity-50">Search above or select from results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
