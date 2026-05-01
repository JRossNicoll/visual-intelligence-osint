'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  Trash2,
  Bell,
  BellOff,
  Search,
  Car,
  User,
  Box,
  Edit,
  X,
  Crosshair,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { targetsApi } from '@/lib/api';
import type { Target } from '@/types';
import { formatRelativeTime, cn } from '@/lib/utils';

export default function TargetsView() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [newTarget, setNewTarget] = useState<{
    name: string;
    target_type: 'person' | 'vehicle' | 'object';
    text_query: string;
    description: string;
    similarity_threshold: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    alert_enabled: boolean;
    webhook_url: string;
  }>({
    name: '',
    target_type: 'vehicle',
    text_query: '',
    description: '',
    similarity_threshold: 0.75,
    priority: 'medium',
    alert_enabled: true,
    webhook_url: '',
  });

  const fetchTargets = async () => {
    try {
      const params: { target_type?: string } = {};
      if (filterType) params.target_type = filterType;
      const data = await targetsApi.list(params);
      setTargets(data);
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, [filterType]);

  const handleCreate = async () => {
    try {
      await targetsApi.create(newTarget);
      setShowCreate(false);
      setNewTarget({
        name: '',
        target_type: 'vehicle',
        text_query: '',
        description: '',
        similarity_threshold: 0.75,
        priority: 'medium',
        alert_enabled: true,
        webhook_url: '',
      });
      await fetchTargets();
    } catch (err) {
      console.error('Failed to create target:', err);
    }
  };

  const handleToggleActive = async (target: Target) => {
    try {
      await targetsApi.update(target.id, { is_active: !target.is_active });
      await fetchTargets();
    } catch (err) {
      console.error('Failed to toggle target:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await targetsApi.delete(id);
      await fetchTargets();
    } catch (err) {
      console.error('Failed to delete target:', err);
    }
  };

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

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/20',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    low: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  };

  const inputClasses = 'w-full px-3.5 py-2.5 bg-intel-bg/80 border border-intel-border/50 rounded-xl text-white text-sm focus:outline-none focus:border-intel-accent/50 focus:shadow-glow-sm transition-all placeholder-gray-600';
  const labelClasses = 'block text-xs text-gray-400 mb-1.5 font-medium';

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Intelligence Targets</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Define custom targets to watch for across all streams
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
            showCreate
              ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
              : 'bg-intel-accent/10 text-intel-accent border border-intel-accent/20 hover:bg-intel-accent/20 hover:shadow-glow-sm'
          )}
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'New Target'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterType('')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            !filterType
              ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/20 shadow-glow-sm'
              : 'text-gray-400 border-intel-border/30 hover:text-white hover:border-intel-border/60'
          )}
        >
          All
        </button>
        {['person', 'vehicle', 'object'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              filterType === type
                ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/20 shadow-glow-sm'
                : 'text-gray-400 border-intel-border/30 hover:text-white hover:border-intel-border/60'
            )}
          >
            {typeIcon(type)}
            <span className="capitalize">{type}s</span>
          </button>
        ))}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-intel-accent" />
                Define New Target
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Target Name</label>
                  <input
                    type="text"
                    value={newTarget.name}
                    onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                    placeholder='e.g., "White Toyota Hilux"'
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Target Type</label>
                  <select
                    value={newTarget.target_type}
                    onChange={(e) => setNewTarget({ ...newTarget, target_type: e.target.value as 'person' | 'vehicle' | 'object' })}
                    className={inputClasses}
                  >
                    <option value="person">Person</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="object">Object</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClasses}>Text Description (for CLIP matching)</label>
                  <input
                    type="text"
                    value={newTarget.text_query}
                    onChange={(e) => setNewTarget({ ...newTarget, text_query: e.target.value })}
                    placeholder='e.g., "white pickup truck with roof racks" or "person wearing red hoodie"'
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Priority</label>
                  <select
                    value={newTarget.priority}
                    onChange={(e) => setNewTarget({ ...newTarget, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })}
                    className={inputClasses}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>
                    Similarity Threshold: <span className="text-intel-accent font-mono">{newTarget.similarity_threshold}</span>
                  </label>
                  <div className="pt-2">
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={newTarget.similarity_threshold}
                      onChange={(e) => setNewTarget({ ...newTarget, similarity_threshold: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClasses}>Description (optional)</label>
                  <textarea
                    value={newTarget.description}
                    onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })}
                    placeholder="Additional context about this target..."
                    rows={2}
                    className={cn(inputClasses, 'resize-none')}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Webhook URL (optional)</label>
                  <input
                    type="text"
                    value={newTarget.webhook_url}
                    onChange={(e) => setNewTarget({ ...newTarget, webhook_url: e.target.value })}
                    placeholder="https://..."
                    className={inputClasses}
                  />
                </div>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTarget.alert_enabled}
                      onChange={(e) => setNewTarget({ ...newTarget, alert_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-intel-border rounded-full peer peer-checked:bg-intel-accent/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-intel-accent" />
                    <span className="ml-2.5 text-sm text-gray-300">Enable Alerts</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newTarget.name || !newTarget.text_query}
                  className="px-5 py-2.5 bg-intel-accent text-intel-bg text-sm font-semibold rounded-xl hover:shadow-glow-md disabled:opacity-40 transition-all"
                >
                  Create Target
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Target Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Shield className="w-5 h-5 animate-pulse mr-2" />
          <span className="text-sm">Loading targets...</span>
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-intel-card flex items-center justify-center mx-auto mb-4 border border-intel-border/30">
            <Shield className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No targets defined</p>
          <p className="text-sm text-gray-600 mt-1">Create intelligence targets to start matching</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {targets.map((target, i) => (
            <motion.div
              key={target.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'glass-card glass-card-hover rounded-xl p-5 relative overflow-hidden',
                !target.is_active && 'opacity-60'
              )}
            >
              {/* Priority indicator */}
              <div className={cn(
                'absolute top-0 left-0 right-0 h-0.5',
                target.priority === 'critical' ? 'bg-red-500' :
                target.priority === 'high' ? 'bg-orange-500' :
                target.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
              )} />

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg border', typeColor(target.target_type))}>
                    {typeIcon(target.target_type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{target.name}</h3>
                    <p className="text-[11px] text-gray-500 capitalize mt-0.5">{target.target_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border',
                    priorityColors[target.priority]
                  )}>
                    {target.priority}
                  </span>
                </div>
              </div>

              {target.text_query && (
                <p className="text-xs text-gray-400 mb-3 bg-intel-bg/50 rounded-lg p-2.5 font-mono border border-intel-border/20">
                  &ldquo;{target.text_query}&rdquo;
                </p>
              )}

              {target.description && (
                <p className="text-xs text-gray-500 mb-3">{target.description}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                <span className="font-mono">{target.total_matches} matches</span>
                <span>Threshold: <span className="text-intel-accent font-mono">{target.similarity_threshold}</span></span>
                <span className="flex items-center gap-1">
                  {target.alert_enabled ? (
                    <><Bell className="w-3 h-3 text-intel-accent" /> Alerts on</>
                  ) : (
                    <><BellOff className="w-3 h-3" /> Alerts off</>
                  )}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(target)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    target.is_active
                      ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/20 hover:bg-intel-accent/20'
                      : 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20'
                  )}
                >
                  {target.is_active ? (
                    <><ToggleRight className="w-3.5 h-3.5" /> Active</>
                  ) : (
                    <><ToggleLeft className="w-3.5 h-3.5" /> Inactive</>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(target.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-intel-border/30 rounded-lg text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
