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
    <User className="w-5 h-5" />
  ) : entity.entity_type === 'vehicle' ? (
    <Car className="w-5 h-5" />
  ) : (
    <Box className="w-5 h-5" />
  );

  const typeColor = entity.entity_type === 'person'
    ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    : entity.entity_type === 'vehicle'
    ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    : 'text-orange-400 bg-orange-500/10 border-orange-500/20';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full max-w-lg h-full bg-intel-surface/95 backdrop-blur-xl border-l border-intel-border/50 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-intel-surface/90 backdrop-blur-lg border-b border-intel-border/30 p-5 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl border', typeColor)}>
                {typeIcon}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{entity.label}</h3>
                <p className="text-xs text-gray-500 capitalize">{entity.entity_type}</p>
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
          <div className="flex gap-1 p-1 bg-intel-bg/60 rounded-xl">
            {(['overview', 'graph', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize',
                  activeTab === tab
                    ? 'bg-intel-card text-white shadow-card'
                    : 'text-gray-500 hover:text-gray-300'
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
              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card rounded-xl p-4">
                  <div className="text-[11px] text-gray-500 mb-1.5 font-medium">Confidence</div>
                  <div className="text-xl font-bold text-white">
                    {Math.round(entity.confidence * 100)}%
                  </div>
                  <div className="mt-2.5 h-1.5 bg-intel-bg rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${entity.confidence * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-intel-accent to-intel-cyan rounded-full"
                    />
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4">
                  <div className="text-[11px] text-gray-500 mb-1.5 font-medium">Total Sightings</div>
                  <div className="text-xl font-bold text-white">{entity.total_sightings}</div>
                  <div className="text-[11px] text-gray-600 mt-1">across sessions</div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="glass-card rounded-xl p-4 space-y-3">
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Temporal Data</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> First Seen
                    </span>
                    <span className="text-white font-mono text-xs">{formatTimestamp(entity.first_seen)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Last Seen
                    </span>
                    <span className="text-white font-mono text-xs">{formatTimestamp(entity.last_seen)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" /> Duration
                    </span>
                    <span className="text-white text-xs">{formatRelativeTime(entity.first_seen)}</span>
                  </div>
                </div>
              </div>

              {/* Attributes */}
              {entity.attributes && Object.keys(entity.attributes).length > 0 && (
                <div className="glass-card rounded-xl p-4">
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
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
              <div className="glass-card rounded-xl p-4">
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                  Identity Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Fingerprint className="w-3.5 h-3.5" /> Entity ID
                    </span>
                    <span className="text-white font-mono text-[11px] bg-intel-bg/60 px-2 py-0.5 rounded">{entity.id.slice(0, 12)}...</span>
                  </div>
                  {entity.match_cluster_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" /> Cluster
                      </span>
                      <span className="text-white font-mono text-[11px] bg-intel-bg/60 px-2 py-0.5 rounded">
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
              <div className="glass-card rounded-xl p-4">
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                  Relationship Graph
                </h4>
                {graph && graph.nodes.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="font-mono">{graph.nodes.length} nodes</span>
                      <span className="font-mono">{graph.edges.length} relationships</span>
                    </div>
                    <div className="space-y-2">
                      {graph.nodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-intel-border/20"
                        >
                          <div className="w-8 h-8 rounded-full bg-intel-accent/10 flex items-center justify-center">
                            {node.labels.includes('Entity') ? (
                              <Eye className="w-4 h-4 text-intel-accent" />
                            ) : (
                              <GitBranch className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">
                              {String(node.properties.label || node.properties.name || node.id).slice(0, 30)}
                            </p>
                            <p className="text-[10px] text-gray-500">{node.labels.join(', ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {graph.edges.length > 0 && (
                      <>
                        <h5 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mt-4 mb-2">
                          Relationships
                        </h5>
                        <div className="space-y-1.5">
                          {graph.edges.map((edge, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-400 p-2 bg-white/[0.01] rounded-lg">
                              <span className="font-mono text-[10px]">{edge.source.slice(0, 8)}</span>
                              <ChevronRight className="w-3 h-3 text-intel-accent" />
                              <span className="text-intel-accent font-medium">{edge.type}</span>
                              <ChevronRight className="w-3 h-3 text-intel-accent" />
                              <span className="font-mono text-[10px]">{edge.target.slice(0, 8)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-6">No graph data available</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-4">
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                  Sighting Timeline
                </h4>
                {timeline.length > 0 ? (
                  <div className="space-y-2">
                    {timeline.map((entry, i) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-intel-border/20"
                      >
                        <div className="relative flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-intel-accent/60" />
                          {i < timeline.length - 1 && (
                            <div className="w-px h-full bg-intel-border/30 absolute top-3" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-white">
                              Stream: <span className="font-mono text-[10px]">{entry.stream_id.slice(0, 12)}...</span>
                            </p>
                            <span className="text-[10px] text-intel-accent font-mono">
                              {Math.round(entry.avg_confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {entry.detection_count} detections
                          </p>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {formatTimestamp(entry.first_timestamp)} &mdash; {formatTimestamp(entry.last_timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-6">No timeline data available</p>
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
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 24;

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
      case 'person': return <User className="w-4 h-4" />;
      case 'vehicle': return <Car className="w-4 h-4" />;
      default: return <Box className="w-4 h-4" />;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'person': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'vehicle': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    }
  };

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Tracked Entities</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Browse and analyze detected objects across all streams
          </p>
        </div>
        <span className="text-sm text-gray-500 font-mono">{entities.length} results</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2 bg-intel-bg/80 border border-intel-border/50 rounded-xl text-white text-sm focus:outline-none focus:border-intel-accent/50 focus:shadow-glow-sm transition-all placeholder-gray-600"
          />
        </div>

        {/* Type Filters */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setFilterType(''); setPage(0); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              !filterType
                ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/20'
                : 'text-gray-400 border-intel-border/30 hover:text-white'
            )}
          >
            All
          </button>
          {['person', 'vehicle', 'object'].map((type) => (
            <button
              key={type}
              onClick={() => { setFilterType(type); setPage(0); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                filterType === type
                  ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/20'
                  : 'text-gray-400 border-intel-border/30 hover:text-white'
              )}
            >
              {typeIcon(type)}
              <span className="capitalize">{type}s</span>
            </button>
          ))}
        </div>
      </div>

      {/* Entity Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Eye className="w-5 h-5 animate-pulse mr-2" />
          <span className="text-sm">Loading entities...</span>
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-intel-card flex items-center justify-center mx-auto mb-4 border border-intel-border/30">
            <Eye className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No entities found</p>
          <p className="text-sm text-gray-600 mt-1">Entities will appear once detection begins</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
        >
          {entities.map((entity, i) => (
            <motion.button
              key={entity.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelectedEntity(entity)}
              className="glass-card glass-card-hover rounded-xl p-4 text-left w-full group"
            >
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg border flex-shrink-0', typeColor(entity.entity_type))}>
                  {typeIcon(entity.entity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-intel-accent transition-colors">
                    {entity.label}
                  </h3>
                  <p className="text-[11px] text-gray-500 capitalize mt-0.5">{entity.entity_type}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-intel-accent transition-colors flex-shrink-0 mt-0.5" />
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {entity.total_sightings}
                </span>
                <span className="font-mono text-intel-accent">
                  {Math.round(entity.confidence * 100)}%
                </span>
                <span className="ml-auto">
                  {formatRelativeTime(entity.last_seen)}
                </span>
              </div>

              {/* Confidence Bar */}
              <div className="mt-2.5 h-1 bg-intel-bg/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-intel-accent to-intel-cyan rounded-full transition-all"
                  style={{ width: `${entity.confidence * 100}%` }}
                />
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {entities.length >= pageSize && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-intel-border/30 rounded-lg hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 font-mono px-3">Page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-intel-border/30 rounded-lg hover:text-white transition-colors"
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
