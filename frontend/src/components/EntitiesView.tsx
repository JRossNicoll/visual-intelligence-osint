'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Box,
  Car,
  ChevronRight,
  Clock,
  Eye,
  GitBranch,
  Search,
  User,
  X,
  Layers,
  Fingerprint,
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
    <User className="w-4 h-4" />
  ) : entity.entity_type === 'vehicle' ? (
    <Car className="w-4 h-4" />
  ) : (
    <Box className="w-4 h-4" />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg h-full bg-g-surface border-l border-g-border overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-g-surface border-b border-g-border p-5 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-white/[0.04] rounded-lg text-g-text-secondary">
                {typeIcon}
              </div>
              <div>
                <h3 className="text-base font-medium text-g-text">{entity.label}</h3>
                <p className="text-xs text-g-text-muted capitalize">{entity.entity_type}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/[0.05] transition-colors rounded-md"
            >
              <X className="w-4 h-4 text-g-text-muted" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/[0.03] rounded-md p-0.5">
            {(['overview', 'graph', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 px-3 py-1.5 text-xs font-medium rounded capitalize transition-all',
                  activeTab === tab
                    ? 'bg-g-card text-g-text shadow-sm'
                    : 'text-g-text-muted hover:text-g-text'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-g-card border border-g-border rounded-lg p-4">
                  <div className="text-xs text-g-text-muted mb-1.5">Confidence</div>
                  <div className="text-xl font-semibold text-white">{Math.round(entity.confidence * 100)}%</div>
                  <div className="mt-2 h-1.5 bg-g-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-g-accent rounded-full transition-all duration-500"
                      style={{ width: `${entity.confidence * 100}%` }}
                    />
                  </div>
                </div>
                <div className="bg-g-card border border-g-border rounded-lg p-4">
                  <div className="text-xs text-g-text-muted mb-1.5">Total Sightings</div>
                  <div className="text-xl font-semibold text-white">{entity.total_sightings}</div>
                  <div className="text-xs text-g-text-dim mt-1">across sessions</div>
                </div>
              </div>

              <div className="bg-g-card border border-g-border rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-medium text-g-text-secondary">Temporal Data</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-g-text-muted flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> First Seen
                    </span>
                    <span className="text-xs text-g-text font-mono">{formatTimestamp(entity.first_seen)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-g-text-muted flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Last Seen
                    </span>
                    <span className="text-xs text-g-text font-mono">{formatTimestamp(entity.last_seen)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-g-text-muted flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" /> Duration
                    </span>
                    <span className="text-xs text-g-text">{formatRelativeTime(entity.first_seen)}</span>
                  </div>
                </div>
              </div>

              {entity.attributes && Object.keys(entity.attributes).length > 0 && (
                <div className="bg-g-card border border-g-border rounded-lg p-4">
                  <h4 className="text-xs font-medium text-g-text-secondary mb-3">Extracted Attributes</h4>
                  <div className="space-y-2">
                    {Object.entries(entity.attributes).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-g-text-muted capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-g-text font-mono capitalize">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-g-card border border-g-border rounded-lg p-4">
                <h4 className="text-xs font-medium text-g-text-secondary mb-3">Identity Information</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-g-text-muted flex items-center gap-2">
                      <Fingerprint className="w-3.5 h-3.5" /> Entity ID
                    </span>
                    <span className="text-[11px] font-mono text-g-text-secondary bg-white/[0.03] px-2 py-0.5 rounded">{entity.id.slice(0, 12)}...</span>
                  </div>
                  {entity.match_cluster_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-g-text-muted flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" /> Cluster
                      </span>
                      <span className="text-[11px] font-mono text-g-text-secondary bg-white/[0.03] px-2 py-0.5 rounded">
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
              <div className="bg-g-card border border-g-border rounded-lg p-4">
                <h4 className="text-xs font-medium text-g-text-secondary mb-3">Relationship Graph</h4>
                {graph && graph.nodes.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-xs text-g-text-muted">
                      <span>{graph.nodes.length} nodes</span>
                      <span>{graph.edges.length} relationships</span>
                    </div>
                    <div className="space-y-1.5">
                      {graph.nodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-3 p-2.5 bg-white/[0.02] rounded-md hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="w-7 h-7 flex items-center justify-center bg-white/[0.04] rounded-md text-g-text-muted">
                            {node.labels.includes('Entity') ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <GitBranch className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-g-text truncate">
                              {String(node.properties.label || node.properties.name || node.id).slice(0, 30)}
                            </p>
                            <p className="text-[10px] text-g-text-dim capitalize">{node.labels.join(', ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {graph.edges.length > 0 && (
                      <>
                        <h5 className="text-xs font-medium text-g-text-secondary mt-4 mb-2">Relationships</h5>
                        <div className="space-y-1.5">
                          {graph.edges.map((edge, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-g-text-muted p-2.5 bg-white/[0.02] rounded-md font-mono">
                              <span>{edge.source.slice(0, 8)}</span>
                              <ChevronRight className="w-3 h-3 text-g-text-dim" />
                              <span className="text-g-text">{edge.type}</span>
                              <ChevronRight className="w-3 h-3 text-g-text-dim" />
                              <span>{edge.target.slice(0, 8)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-g-text-muted text-center py-8">No graph data available</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="bg-g-card border border-g-border rounded-lg p-4">
                <h4 className="text-xs font-medium text-g-text-secondary mb-3">Sighting Timeline</h4>
                {timeline.length > 0 ? (
                  <div className="space-y-1.5">
                    {timeline.map((entry, i) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-2.5 bg-white/[0.02] rounded-md hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="relative flex flex-col items-center">
                          <div className="w-2 h-2 bg-g-accent rounded-full mt-1.5" />
                          {i < timeline.length - 1 && (
                            <div className="w-px h-full bg-g-border absolute top-4" />
                          )}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-g-text">
                              Stream: <span className="font-mono text-[11px] text-g-text-muted">{entry.stream_id.slice(0, 12)}...</span>
                            </p>
                            <span className="text-[11px] font-mono text-g-text-secondary">
                              {Math.round(entry.avg_confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-g-text-muted mt-0.5">
                            {entry.detection_count} detections
                          </p>
                          <p className="text-[10px] font-mono text-g-text-dim mt-0.5">
                            {formatTimestamp(entry.first_timestamp)} — {formatTimestamp(entry.last_timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-g-text-muted text-center py-8">No timeline data available</p>
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
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchEntities = useCallback(async () => {
    try {
      const params: {
        entity_type?: string;
        label?: string;
        limit: number;
        offset: number;
      } = { limit: pageSize, offset: page * pageSize };
      if (filterType) params.entity_type = filterType;
      if (searchQuery) params.label = searchQuery;
      const data = await entitiesApi.list(params);
      setEntities(data);
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  }, [filterType, searchQuery, page]);

  useEffect(() => {
    fetchEntities();
    const interval = setInterval(fetchEntities, 15000);
    return () => clearInterval(interval);
  }, [fetchEntities]);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-4 h-4" />;
      case 'vehicle': return <Car className="w-4 h-4" />;
      default: return <Box className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 pb-14 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Tracked Entities</h2>
          <p className="text-sm text-g-text-secondary mt-1">Browse and analyze detected objects across all streams</p>
        </div>
        <span className="text-xs text-g-text-muted">{entities.length} results</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-g-text-dim" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2 bg-g-bg border border-g-border text-g-text text-sm rounded-md focus:outline-none focus:border-g-accent/40 transition-colors placeholder-g-text-dim"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-g-text-muted mr-1">Type</span>
          <button
            onClick={() => { setFilterType(''); setPage(0); }}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
              !filterType ? 'text-g-accent bg-g-accent/10 border-g-accent/20' : 'text-g-text-muted border-g-border hover:text-g-text'
            )}
          >All</button>
          {['person', 'vehicle', 'object'].map((type) => (
            <button
              key={type}
              onClick={() => { setFilterType(type); setPage(0); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all capitalize',
                filterType === type ? 'text-g-accent bg-g-accent/10 border-g-accent/20' : 'text-g-text-muted border-g-border hover:text-g-text'
              )}
            >
              {typeIcon(type)}<span>{type}s</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-g-text-muted">
          <Eye className="w-4 h-4 animate-pulse mr-2" />
          <span className="text-sm">Loading entities...</span>
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-white/[0.04] rounded-xl">
            <Eye className="w-6 h-6 text-g-text-muted" />
          </div>
          <p className="text-g-text-secondary text-sm font-medium">No entities found</p>
          <p className="text-xs text-g-text-muted mt-1">Entities will appear once detection begins</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {entities.map((entity) => (
            <button
              key={entity.id}
              onClick={() => setSelectedEntity(entity)}
              className="bg-g-card border border-g-border rounded-lg p-4 text-left w-full hover:border-g-border-light transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center bg-white/[0.04] rounded-md text-g-text-secondary flex-shrink-0">
                  {typeIcon(entity.entity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm text-g-text truncate font-medium group-hover:text-white transition-colors">
                    {entity.label}
                  </h3>
                  <p className="text-xs text-g-text-muted capitalize mt-0.5">{entity.entity_type}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-g-text-dim group-hover:text-g-text-secondary transition-colors flex-shrink-0 mt-0.5" />
              </div>

              <div className="flex items-center gap-3 mt-3 text-xs text-g-text-muted">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {entity.total_sightings}
                </span>
                <span className="font-mono text-g-text-secondary">
                  {Math.round(entity.confidence * 100)}%
                </span>
                <span className="ml-auto text-[11px]">
                  {formatRelativeTime(entity.last_seen)}
                </span>
              </div>

              <div className="mt-2.5 h-1 bg-g-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-g-accent/50 rounded-full transition-all"
                  style={{ width: `${entity.confidence * 100}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(page > 0 || entities.length >= pageSize) && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-1.5 text-xs font-medium text-g-text-secondary border border-g-border rounded-md hover:bg-white/[0.04] disabled:opacity-30 transition-all"
          >
            Previous
          </button>
          <span className="text-xs text-g-text-muted px-3">Page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={entities.length < pageSize}
            className="px-4 py-1.5 text-xs font-medium text-g-text-secondary border border-g-border rounded-md hover:bg-white/[0.04] disabled:opacity-30 transition-all"
          >
            Next
          </button>
        </div>
      )}

      {selectedEntity && (
        <EntityDetail
          entity={selectedEntity}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </div>
  );
}
