'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full max-w-lg h-full bg-intel-surface border-l border-intel-border overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-intel-surface border-b border-intel-border p-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center border border-intel-border text-zinc-400">
                {typeIcon}
              </div>
              <div>
                <h3 className="text-sm text-zinc-200">{entity.label}</h3>
                <p className="text-[10px] font-mono text-zinc-600 uppercase">{entity.entity_type}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border border-intel-border">
            {(['overview', 'graph', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors',
                  activeTab === tab
                    ? 'bg-white/[0.04] text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-400'
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
              <div className="grid grid-cols-2 gap-px bg-intel-border">
                <div className="bg-intel-card p-4">
                  <div className="mono-label mb-1.5">Confidence</div>
                  <div className="text-xl font-light text-white font-mono">
                    {Math.round(entity.confidence * 100)}%
                  </div>
                  <div className="mt-2 h-1 bg-intel-bg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${entity.confidence * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-zinc-400"
                    />
                  </div>
                </div>
                <div className="bg-intel-card p-4">
                  <div className="mono-label mb-1.5">Total Sightings</div>
                  <div className="text-xl font-light text-white font-mono">{entity.total_sightings}</div>
                  <div className="text-[10px] font-mono text-zinc-600 mt-1">across sessions</div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="bg-intel-card border border-intel-border p-4 space-y-3">
                <h4 className="mono-label">Temporal Data</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> First Seen
                    </span>
                    <span className="text-[11px] text-zinc-300 font-mono">{formatTimestamp(entity.first_seen)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Last Seen
                    </span>
                    <span className="text-[11px] text-zinc-300 font-mono">{formatTimestamp(entity.last_seen)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 flex items-center gap-2">
                      <Activity className="w-3 h-3" /> Duration
                    </span>
                    <span className="text-[11px] text-zinc-300">{formatRelativeTime(entity.first_seen)}</span>
                  </div>
                </div>
              </div>

              {/* Attributes */}
              {entity.attributes && Object.keys(entity.attributes).length > 0 && (
                <div className="bg-intel-card border border-intel-border p-4">
                  <h4 className="mono-label mb-3">Extracted Attributes</h4>
                  <div className="space-y-2">
                    {Object.entries(entity.attributes).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-[11px] text-zinc-300 font-mono capitalize">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Identity */}
              <div className="bg-intel-card border border-intel-border p-4">
                <h4 className="mono-label mb-3">Identity Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 flex items-center gap-2">
                      <Fingerprint className="w-3 h-3" /> Entity ID
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-intel-bg px-2 py-0.5 border border-intel-border">{entity.id.slice(0, 12)}...</span>
                  </div>
                  {entity.match_cluster_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500 flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Cluster
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 bg-intel-bg px-2 py-0.5 border border-intel-border">
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
              <div className="bg-intel-card border border-intel-border p-4">
                <h4 className="mono-label mb-3">Relationship Graph</h4>
                {graph && graph.nodes.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600 uppercase">
                      <span>{graph.nodes.length} nodes</span>
                      <span>{graph.edges.length} relationships</span>
                    </div>
                    <div className="space-y-1">
                      {graph.nodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-3 p-2 border border-intel-border hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="w-6 h-6 flex items-center justify-center border border-intel-border">
                            {node.labels.includes('Entity') ? (
                              <Eye className="w-3 h-3 text-zinc-500" />
                            ) : (
                              <GitBranch className="w-3 h-3 text-zinc-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-zinc-300 truncate">
                              {String(node.properties.label || node.properties.name || node.id).slice(0, 30)}
                            </p>
                            <p className="text-[9px] font-mono text-zinc-600 uppercase">{node.labels.join(', ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {graph.edges.length > 0 && (
                      <>
                        <h5 className="mono-label mt-4 mb-2">Relationships</h5>
                        <div className="space-y-1">
                          {graph.edges.map((edge, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-500 p-2 border border-intel-border font-mono">
                              <span>{edge.source.slice(0, 8)}</span>
                              <ChevronRight className="w-3 h-3 text-zinc-600" />
                              <span className="text-zinc-300">{edge.type}</span>
                              <ChevronRight className="w-3 h-3 text-zinc-600" />
                              <span>{edge.target.slice(0, 8)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] font-mono text-zinc-600 text-center py-6">No graph data available</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="bg-intel-card border border-intel-border p-4">
                <h4 className="mono-label mb-3">Sighting Timeline</h4>
                {timeline.length > 0 ? (
                  <div className="space-y-1">
                    {timeline.map((entry, i) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-2 border border-intel-border hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="relative flex flex-col items-center">
                          <div className="w-2 h-2 bg-zinc-500 mt-1" />
                          {i < timeline.length - 1 && (
                            <div className="w-px h-full bg-intel-border absolute top-3" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-zinc-300">
                              Stream: <span className="font-mono text-[10px] text-zinc-500">{entry.stream_id.slice(0, 12)}...</span>
                            </p>
                            <span className="text-[10px] font-mono text-zinc-400">
                              {Math.round(entry.avg_confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-zinc-600 mt-0.5">
                            {entry.detection_count} detections
                          </p>
                          <p className="text-[9px] font-mono text-zinc-600 mt-0.5">
                            {formatTimestamp(entry.first_timestamp)} — {formatTimestamp(entry.last_timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-mono text-zinc-600 text-center py-6">No timeline data available</p>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
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
    const interval = setInterval(fetchEntities, 10000);
    return () => clearInterval(interval);
  }, [fetchEntities]);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-3.5 h-3.5" />;
      case 'vehicle': return <Car className="w-3.5 h-3.5" />;
      default: return <Box className="w-3.5 h-3.5" />;
    }
  };

  const filterBtn = (active: boolean) => cn(
    'px-3 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors',
    active ? 'text-white border-intel-border-light bg-white/[0.04]' : 'text-zinc-600 border-intel-border hover:text-zinc-300 hover:border-intel-border-light'
  );

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-white">Tracked Entities</h2>
          <p className="text-[11px] font-mono text-zinc-600 mt-1 uppercase tracking-wider">
            Browse and analyze detected objects across all streams
          </p>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 uppercase">{entities.length} results</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            type="text"
            placeholder="search --entities"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-1.5 bg-intel-bg border border-intel-border text-zinc-200 text-[12px] font-mono focus:outline-none focus:border-intel-border-light transition-colors placeholder-zinc-600"
          />
        </div>

        {/* Type Filters */}
        <div className="flex items-center gap-1.5">
          <span className="mono-label mr-1">Type</span>
          <button
            onClick={() => { setFilterType(''); setPage(0); }}
            className={filterBtn(!filterType)}
          >
            all
          </button>
          {['person', 'vehicle', 'object'].map((type) => (
            <button
              key={type}
              onClick={() => { setFilterType(type); setPage(0); }}
              className={cn(filterBtn(filterType === type), 'flex items-center gap-1.5')}
            >
              {typeIcon(type)}
              <span>{type}s</span>
            </button>
          ))}
        </div>
      </div>

      {/* Entity Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600">
          <Eye className="w-4 h-4 animate-pulse mr-2" />
          <span className="text-[11px] font-mono uppercase">Loading entities...</span>
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 border border-intel-border">
            <Eye className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-zinc-400 text-sm">No entities found</p>
          <p className="text-[11px] font-mono text-zinc-600 mt-1">Entities will appear once detection begins</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-intel-border"
        >
          {entities.map((entity, i) => (
            <motion.button
              key={entity.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelectedEntity(entity)}
              className="bg-intel-card p-4 text-left w-full hover:bg-intel-card-hover transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 flex items-center justify-center border border-intel-border text-zinc-500 flex-shrink-0">
                  {typeIcon(entity.entity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs text-zinc-200 truncate group-hover:text-white transition-colors">
                    {entity.label}
                  </h3>
                  <p className="text-[10px] font-mono text-zinc-600 uppercase mt-0.5">{entity.entity_type}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0 mt-0.5" />
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-zinc-600">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {entity.total_sightings}
                </span>
                <span className="text-zinc-400">
                  {Math.round(entity.confidence * 100)}%
                </span>
                <span className="ml-auto text-[9px]">
                  {formatRelativeTime(entity.last_seen)}
                </span>
              </div>

              {/* Confidence Bar */}
              <div className="mt-2 h-px bg-intel-bg overflow-hidden">
                <div
                  className="h-full bg-zinc-500 transition-all"
                  style={{ width: `${entity.confidence * 100}%` }}
                />
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {(page > 0 || entities.length >= pageSize) && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-[10px] font-mono uppercase text-zinc-500 border border-intel-border hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-[10px] font-mono text-zinc-600 px-3">Page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={entities.length < pageSize}
            className="px-3 py-1 text-[10px] font-mono uppercase text-zinc-500 border border-intel-border hover:text-white disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Entity Detail Panel */}
      <AnimatePresence>
        {selectedEntity && (
          <EntityDetail
            entity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
