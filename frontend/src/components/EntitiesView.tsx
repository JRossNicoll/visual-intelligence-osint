'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Box,
  Car,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  GitBranch,
  Search,
  User,
  X,
  Layers,
  Fingerprint,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { entitiesApi } from '@/lib/api';
import type { Entity, EntityGraph } from '@/types';
import { formatRelativeTime, formatTimestamp, cn } from '@/lib/utils';

interface EntityDetailProps {
  entity: Entity;
  onClose: () => void;
}

function EntityDetail({ entity, onClose }: EntityDetailProps) {
  const [graph, setGraph] = useState<EntityGraph | null>(null);
  const [timeline, setTimeline] = useState<Array<{
    id: string;
    stream_id: string;
    first_timestamp: string;
    last_timestamp: string;
    detection_count: number;
    avg_confidence: number;
  }>>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'timeline'>('overview');
  const [loadingGraph, setLoadingGraph] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [g, t] = await Promise.all([
          entitiesApi.getGraph(entity.id, 2).catch(() => null),
          entitiesApi.getTimeline(entity.id).catch(() => []),
        ]);
        setGraph(g);
        setTimeline(t);
      } catch {
        // Handle gracefully
      }
    };
    fetchDetails();
  }, [entity.id]);

  const typeIcon = entity.entity_type === 'person' ? (
    <User className="w-5 h-5" />
  ) : entity.entity_type === 'vehicle' ? (
    <Car className="w-5 h-5" />
  ) : (
    <Box className="w-5 h-5" />
  );

  const typeColor = entity.entity_type === 'person'
    ? 'text-purple-400 bg-purple-500/10'
    : entity.entity_type === 'vehicle'
    ? 'text-blue-400 bg-blue-500/10'
    : 'text-orange-400 bg-orange-500/10';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-intel-surface border-l border-intel-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-intel-surface border-b border-intel-border p-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${typeColor}`}>
                {typeIcon}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{entity.label}</h3>
                <p className="text-xs text-gray-400 capitalize">{entity.entity_type}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {(['overview', 'graph', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                  activeTab === tab
                    ? 'bg-intel-accent/10 text-intel-accent border border-intel-accent/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-intel-card border border-intel-border rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Confidence</div>
                  <div className="text-lg font-bold text-white">
                    {Math.round(entity.confidence * 100)}%
                  </div>
                  <div className="mt-2 h-1.5 bg-intel-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-intel-accent rounded-full"
                      style={{ width: `${entity.confidence * 100}%` }}
                    />
                  </div>
                </div>
                <div className="bg-intel-card border border-intel-border rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Total Sightings</div>
                  <div className="text-lg font-bold text-white">{entity.total_sightings}</div>
                  <div className="text-xs text-gray-500 mt-1">across sessions</div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="bg-intel-card border border-intel-border rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Temporal Data</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> First Seen
                    </span>
                    <span className="text-white">{formatTimestamp(entity.first_seen)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Last Seen
                    </span>
                    <span className="text-white">{formatTimestamp(entity.last_seen)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" /> Duration
                    </span>
                    <span className="text-white">
                      {formatRelativeTime(entity.first_seen)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attributes */}
              {entity.attributes && Object.keys(entity.attributes).length > 0 && (
                <div className="bg-intel-card border border-intel-border rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Extracted Attributes
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(entity.attributes).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-gray-400 capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-intel-accent font-medium capitalize">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Identity */}
              <div className="bg-intel-card border border-intel-border rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Identity Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Fingerprint className="w-3.5 h-3.5" /> Entity ID
                    </span>
                    <span className="text-white font-mono text-xs">{entity.id.slice(0, 12)}...</span>
                  </div>
                  {entity.match_cluster_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" /> Cluster
                      </span>
                      <span className="text-white font-mono text-xs">
                        {entity.match_cluster_id.slice(0, 12)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'graph' && (
            <div className="space-y-4">
              <div className="bg-intel-card border border-intel-border rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Relationship Graph
                </h4>
                {graph && graph.nodes.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{graph.nodes.length} nodes</span>
                      <span>{graph.edges.length} relationships</span>
                    </div>
                    {/* Node list */}
                    <div className="space-y-2">
                      {graph.nodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-intel-bg border border-intel-border/50"
                        >
                          <div className="w-8 h-8 rounded-full bg-intel-accent/10 flex items-center justify-center">
                            {node.labels.includes('Entity') ? (
                              <Eye className="w-4 h-4 text-intel-accent" />
                            ) : node.labels.includes('Location') ? (
                              <MapPin className="w-4 h-4 text-blue-400" />
                            ) : (
                              <GitBranch className="w-4 h-4 text-purple-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {String(node.properties.label || node.properties.name || node.id)}
                            </p>
                            <p className="text-xs text-gray-500">{node.labels.join(', ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Edge list */}
                    <div className="space-y-1">
                      {graph.edges.map((edge, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs text-gray-400 p-2"
                        >
                          <span className="font-mono">{edge.source.slice(0, 8)}</span>
                          <ChevronRight className="w-3 h-3 text-intel-accent" />
                          <span className="text-intel-accent font-medium">
                            {edge.type.replace(/_/g, ' ')}
                          </span>
                          <ChevronRight className="w-3 h-3 text-intel-accent" />
                          <span className="font-mono">{edge.target.slice(0, 8)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <GitBranch className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No relationships found yet</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Relationships are built as entities co-occur across streams
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="bg-intel-card border border-intel-border rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Sighting Timeline
                </h4>
                {timeline.length > 0 ? (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-intel-border" />
                    <div className="space-y-4">
                      {timeline.map((entry) => (
                        <div key={entry.id} className="relative flex items-start gap-4 pl-8">
                          <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-intel-accent border-2 border-intel-surface" />
                          <div className="flex-1 bg-intel-bg rounded-lg p-3 border border-intel-border/50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-400">
                                Stream: {entry.stream_id.slice(0, 8)}...
                              </span>
                              <span className="text-xs text-intel-accent font-medium">
                                {entry.detection_count} detections
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <p>From: {formatTimestamp(entry.first_timestamp)}</p>
                              <p>To: {formatTimestamp(entry.last_timestamp)}</p>
                              <p>Avg Confidence: {Math.round(entry.avg_confidence * 100)}%</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No timeline data yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EntitiesView() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [searchLabel, setSearchLabel] = useState('');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'last_seen' | 'confidence' | 'sightings'>('last_seen');

  const fetchEntities = useCallback(async () => {
    try {
      const params: {
        entity_type?: string;
        label?: string;
        min_confidence?: number;
        limit: number;
      } = { limit: 100 };
      if (filterType) params.entity_type = filterType;
      if (searchLabel) params.label = searchLabel;
      if (minConfidence > 0) params.min_confidence = minConfidence;
      const data = await entitiesApi.list(params);

      // Client-side sort
      const sorted = [...data].sort((a, b) => {
        switch (sortBy) {
          case 'confidence': return b.confidence - a.confidence;
          case 'sightings': return b.total_sightings - a.total_sightings;
          default: return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
        }
      });

      setEntities(sorted);
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  }, [filterType, searchLabel, minConfidence, sortBy]);

  useEffect(() => {
    fetchEntities();
    const interval = setInterval(fetchEntities, 10000);
    return () => clearInterval(interval);
  }, [fetchEntities]);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-4 h-4 text-purple-400" />;
      case 'vehicle': return <Car className="w-4 h-4 text-blue-400" />;
      default: return <Box className="w-4 h-4 text-orange-400" />;
    }
  };

  const entityCounts = {
    all: entities.length,
    person: entities.filter(e => e.entity_type === 'person').length,
    vehicle: entities.filter(e => e.entity_type === 'vehicle').length,
    object: entities.filter(e => e.entity_type === 'object').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Tracked Entities</h2>
        <p className="text-sm text-gray-400 mt-1">
          All objects tracked across streams with persistent identity matching
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchLabel}
            onChange={(e) => setSearchLabel(e.target.value)}
            placeholder="Search by label..."
            className="w-full pl-10 pr-4 py-2 bg-intel-card border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1">
          {[
            { key: '', label: 'All', count: entityCounts.all },
            { key: 'person', label: 'People', count: entityCounts.person },
            { key: 'vehicle', label: 'Vehicles', count: entityCounts.vehicle },
            { key: 'object', label: 'Objects', count: entityCounts.object },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFilterType(filter.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                filterType === filter.key
                  ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/30'
                  : 'text-gray-400 border-intel-border hover:text-white'
              )}
            >
              {filter.label}
              <span className="text-gray-500">({filter.count})</span>
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 bg-intel-card border border-intel-border rounded-lg text-sm text-gray-300 focus:outline-none focus:border-intel-accent"
        >
          <option value="last_seen">Last Seen</option>
          <option value="confidence">Confidence</option>
          <option value="sightings">Sightings</option>
        </select>

        {/* Confidence filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-400">Min:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-20"
          />
          <span className="text-xs text-gray-400 w-8">
            {Math.round(minConfidence * 100)}%
          </span>
        </div>
      </div>

      {/* Entity Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Activity className="w-6 h-6 text-intel-accent animate-spin" />
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-20">
          <Eye className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No entities tracked yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Start a stream to begin detecting and tracking objects
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {entities.map((entity) => (
            <div
              key={entity.id}
              onClick={() => setSelectedEntity(entity)}
              className="bg-intel-card border border-intel-border rounded-xl p-4 cursor-pointer hover:border-intel-accent/30 hover:shadow-lg hover:shadow-intel-accent/5 transition-all group"
            >
              {/* Entity Icon & Type */}
              <div className="flex items-center justify-between mb-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  entity.entity_type === 'person' ? 'bg-purple-500/10' :
                  entity.entity_type === 'vehicle' ? 'bg-blue-500/10' : 'bg-orange-500/10'
                )}>
                  {typeIcon(entity.entity_type)}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 capitalize">{entity.entity_type}</span>
                  <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-intel-accent transition-colors" />
                </div>
              </div>

              {/* Label */}
              <h3 className="text-sm font-semibold text-white mb-1 truncate">{entity.label}</h3>

              {/* Confidence bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-400">Confidence</span>
                  <span className="text-white font-medium">
                    {Math.round(entity.confidence * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-intel-bg rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      entity.confidence > 0.8 ? 'bg-intel-accent' :
                      entity.confidence > 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                    )}
                    style={{ width: `${entity.confidence * 100}%` }}
                  />
                </div>
              </div>

              {/* Attributes */}
              {entity.attributes && Object.keys(entity.attributes).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(entity.attributes).slice(0, 3).map(([key, value]) => (
                    <span
                      key={key}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-intel-bg text-gray-300 border border-intel-border/50"
                    >
                      {String(value)}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-intel-border/50">
                <span>{entity.total_sightings} sighting{entity.total_sightings !== 1 ? 's' : ''}</span>
                <span>{formatRelativeTime(entity.last_seen)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entity Detail Panel */}
      {selectedEntity && (
        <EntityDetail
          entity={selectedEntity}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </div>
  );
}
