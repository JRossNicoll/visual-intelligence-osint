'use client';

import { useState, useEffect } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import { targetsApi } from '@/lib/api';
import type { Target } from '@/types';
import { formatRelativeTime, severityColor } from '@/lib/utils';

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

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Intelligence Targets</h2>
          <p className="text-sm text-gray-400 mt-1">
            Define custom targets to watch for across all streams
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-intel-accent/10 text-intel-accent border border-intel-accent/30 rounded-lg hover:bg-intel-accent/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Target
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            !filterType ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/30' : 'text-gray-400 border-intel-border hover:text-white'
          }`}
        >
          All
        </button>
        {['person', 'vehicle', 'object'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterType === type ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/30' : 'text-gray-400 border-intel-border hover:text-white'
            }`}
          >
            {typeIcon(type)}
            <span className="capitalize">{type}s</span>
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-intel-card border border-intel-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Define New Target</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Name</label>
              <input
                type="text"
                value={newTarget.name}
                onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                placeholder='e.g., "White Toyota Hilux"'
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Type</label>
              <select
                value={newTarget.target_type}
                onChange={(e) => setNewTarget({ ...newTarget, target_type: e.target.value as 'person' | 'vehicle' | 'object' })}
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              >
                <option value="person">Person</option>
                <option value="vehicle">Vehicle</option>
                <option value="object">Object</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Text Description (for CLIP matching)</label>
              <input
                type="text"
                value={newTarget.text_query}
                onChange={(e) => setNewTarget({ ...newTarget, text_query: e.target.value })}
                placeholder='e.g., "white pickup truck with roof racks" or "person wearing red hoodie"'
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <select
                value={newTarget.priority}
                onChange={(e) => setNewTarget({ ...newTarget, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })}
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Similarity Threshold: {newTarget.similarity_threshold}
              </label>
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
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
              <textarea
                value={newTarget.description}
                onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })}
                placeholder="Additional context about this target..."
                rows={2}
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Webhook URL (optional)</label>
              <input
                type="text"
                value={newTarget.webhook_url}
                onChange={(e) => setNewTarget({ ...newTarget, webhook_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={newTarget.alert_enabled}
                  onChange={(e) => setNewTarget({ ...newTarget, alert_enabled: e.target.checked })}
                  className="rounded border-intel-border"
                />
                Enable Alerts
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newTarget.name || !newTarget.target_type}
              className="px-4 py-2 bg-intel-accent text-black text-sm font-medium rounded-lg hover:bg-intel-accent/90 disabled:opacity-50"
            >
              Create Target
            </button>
          </div>
        </div>
      )}

      {/* Target Cards */}
      {targets.length === 0 && !loading ? (
        <div className="text-center py-20">
          <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No targets defined</p>
          <p className="text-sm text-gray-500 mt-1">
            Create a target like &ldquo;white Toyota Hilux&rdquo; to start matching
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((target) => (
            <div
              key={target.id}
              className={`bg-intel-card border rounded-xl p-4 transition-colors ${
                target.is_active ? 'border-intel-border hover:border-intel-accent/30' : 'border-intel-border/50 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-intel-bg">
                  {typeIcon(target.target_type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-white">{target.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[target.priority] || ''}`}>
                      {target.priority}
                    </span>
                    {!target.is_active && (
                      <span className="px-2 py-0.5 rounded text-xs text-gray-500 bg-gray-500/10 border border-gray-500/20">
                        Inactive
                      </span>
                    )}
                  </div>

                  {target.text_query && (
                    <p className="text-sm text-intel-accent/80 mb-1">
                      <Search className="w-3 h-3 inline mr-1" />
                      &ldquo;{target.text_query}&rdquo;
                    </p>
                  )}

                  {target.description && (
                    <p className="text-xs text-gray-400 mb-2">{target.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="capitalize">{target.target_type}</span>
                    <span>Threshold: {target.similarity_threshold}</span>
                    <span>{target.total_matches} matches</span>
                    <span>Created {formatRelativeTime(target.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(target)}
                    className={`p-2 rounded-lg border transition-colors ${
                      target.is_active
                        ? 'bg-intel-accent/10 text-intel-accent border-intel-accent/30 hover:bg-intel-accent/20'
                        : 'bg-gray-500/10 text-gray-500 border-gray-500/30 hover:bg-gray-500/20'
                    }`}
                    title={target.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {target.alert_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(target.id)}
                    className="p-2 rounded-lg bg-gray-500/10 text-gray-400 border border-gray-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
