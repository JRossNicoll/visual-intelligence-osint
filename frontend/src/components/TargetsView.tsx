'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Bell,
  BellOff,
  Car,
  User,
  Box,
  X,
  Crosshair,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { targetsApi } from '@/lib/api';
import type { Target } from '@/types';
import { cn } from '@/lib/utils';

export default function TargetsView() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [newTarget, setNewTarget] = useState({
    name: '',
    target_type: 'vehicle' as 'person' | 'vehicle' | 'object',
    text_query: '',
    description: '',
    similarity_threshold: 0.75,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    alert_enabled: true,
    webhook_url: '',
  });

  const fetchTargets = async () => {
    try {
      const params: { target_type?: string } = {};
      if (filterType) params.target_type = filterType;
      setTargets(await targetsApi.list(params));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchTargets(); }, [filterType]);

  const handleCreate = async () => {
    try {
      await targetsApi.create(newTarget);
      setShowCreate(false);
      setNewTarget({ name: '', target_type: 'vehicle', text_query: '', description: '', similarity_threshold: 0.75, priority: 'medium', alert_enabled: true, webhook_url: '' });
      await fetchTargets();
    } catch (err) { console.error('Failed to create target:', err); }
  };

  const handleToggleActive = async (target: Target) => {
    try { await targetsApi.update(target.id, { is_active: !target.is_active }); await fetchTargets(); } catch {}
  };

  const handleDelete = async (id: string) => {
    try { await targetsApi.delete(id); await fetchTargets(); } catch {}
  };

  const typeIcon = (type: string) => {
    if (type === 'person') return <User className="w-4 h-4" />;
    if (type === 'vehicle') return <Car className="w-4 h-4" />;
    return <Box className="w-4 h-4" />;
  };

  const priorityColor = (p: string) => {
    if (p === 'critical') return 'text-red-400 bg-red-400/10';
    if (p === 'high') return 'text-orange-400 bg-orange-400/10';
    if (p === 'medium') return 'text-yellow-400 bg-yellow-400/10';
    return 'text-blue-400 bg-blue-400/10';
  };

  const inputCls = 'w-full px-3 py-2 bg-g-bg border border-g-border text-g-text text-sm rounded-md focus:outline-none focus:border-g-accent/40 transition-colors placeholder-g-text-dim';

  return (
    <div className="p-6 pb-14 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Intelligence Targets</h2>
          <p className="text-sm text-g-text-secondary mt-1">Define custom targets to watch across all streams</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all border',
            showCreate ? 'text-g-text-secondary border-g-border' : 'text-g-text border-g-border bg-white/[0.05] hover:bg-white/[0.08]'
          )}
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'New Target'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-g-text-muted mr-1">Type</span>
        <button onClick={() => setFilterType('')} className={cn(
          'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
          !filterType ? 'text-g-accent bg-g-accent/10 border-g-accent/20' : 'text-g-text-muted border-g-border hover:text-g-text hover:border-g-border-light'
        )}>All</button>
        {['person', 'vehicle', 'object'].map((type) => (
          <button key={type} onClick={() => setFilterType(type)} className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all capitalize',
            filterType === type ? 'text-g-accent bg-g-accent/10 border-g-accent/20' : 'text-g-text-muted border-g-border hover:text-g-text hover:border-g-border-light'
          )}>
            {typeIcon(type)}<span>{type}s</span>
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="bg-g-card border border-g-border rounded-lg p-6 animate-fade-in">
          <h3 className="text-sm font-medium text-g-text mb-5 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-g-text-secondary" /> Define New Target
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-g-text-muted mb-1.5">Target Name</label>
              <input type="text" value={newTarget.name} onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })} placeholder='"White Toyota Hilux"' className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-g-text-muted mb-1.5">Target Type</label>
              <select value={newTarget.target_type} onChange={(e) => setNewTarget({ ...newTarget, target_type: e.target.value as 'person' | 'vehicle' | 'object' })} className={inputCls}>
                <option value="person">Person</option>
                <option value="vehicle">Vehicle</option>
                <option value="object">Object</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-g-text-muted mb-1.5">Text Description (CLIP matching)</label>
              <input type="text" value={newTarget.text_query} onChange={(e) => setNewTarget({ ...newTarget, text_query: e.target.value })} placeholder='"white pickup truck with roof racks"' className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-g-text-muted mb-1.5">Priority</label>
              <select value={newTarget.priority} onChange={(e) => setNewTarget({ ...newTarget, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })} className={inputCls}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-g-text-muted mb-1.5">Similarity: <span className="text-g-text">{newTarget.similarity_threshold}</span></label>
              <div className="pt-2"><input type="range" min="0.1" max="1.0" step="0.05" value={newTarget.similarity_threshold} onChange={(e) => setNewTarget({ ...newTarget, similarity_threshold: parseFloat(e.target.value) })} className="w-full" /></div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-g-text-muted mb-1.5">Description (optional)</label>
              <textarea value={newTarget.description} onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })} placeholder="Additional context..." rows={2} className={cn(inputCls, 'resize-none')} />
            </div>
            <div>
              <label className="block text-xs text-g-text-muted mb-1.5">Webhook URL (optional)</label>
              <input type="text" value={newTarget.webhook_url} onChange={(e) => setNewTarget({ ...newTarget, webhook_url: e.target.value })} placeholder="https://..." className={inputCls} />
            </div>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={newTarget.alert_enabled} onChange={(e) => setNewTarget({ ...newTarget, alert_enabled: e.target.checked })} className="sr-only peer" />
                <div className="w-9 h-5 bg-g-border rounded-full peer peer-checked:bg-g-accent/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-g-text-muted after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-g-accent" />
                <span className="ml-2.5 text-sm text-g-text-secondary">Enable Alerts</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-g-text-muted hover:text-g-text transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={!newTarget.name || !newTarget.text_query} className="px-5 py-2 bg-g-accent text-white text-sm font-medium rounded-md disabled:opacity-40 hover:bg-g-accent/90 transition-all">Create Target</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-g-text-muted">
          <Shield className="w-4 h-4 animate-pulse mr-2" /><span className="text-sm">Loading targets...</span>
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-white/[0.04] rounded-xl">
            <Shield className="w-6 h-6 text-g-text-muted" />
          </div>
          <p className="text-g-text-secondary text-sm font-medium">No targets defined</p>
          <p className="text-xs text-g-text-muted mt-1">Create intelligence targets to start matching</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targets.map((target) => (
            <div
              key={target.id}
              className={cn(
                'bg-g-card border border-g-border rounded-lg p-5 hover:border-g-border-light transition-all',
                !target.is_active && 'opacity-50'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 flex items-center justify-center bg-white/[0.04] rounded-md text-g-text-secondary">{typeIcon(target.target_type)}</div>
                  <div>
                    <h3 className="text-sm text-g-text font-medium">{target.name}</h3>
                    <p className="text-xs text-g-text-muted capitalize mt-0.5">{target.target_type}</p>
                  </div>
                </div>
                <span className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                  priorityColor(target.priority)
                )}>{target.priority}</span>
              </div>

              {target.text_query && (
                <p className="text-sm text-g-text-secondary mb-3 bg-white/[0.02] p-2.5 rounded-md border border-g-border italic">&ldquo;{target.text_query}&rdquo;</p>
              )}
              {target.description && <p className="text-xs text-g-text-muted mb-3">{target.description}</p>}

              <div className="flex items-center gap-4 mb-3 text-xs text-g-text-muted">
                <span>{target.total_matches} matches</span>
                <span>Threshold: {target.similarity_threshold}</span>
                <span className="flex items-center gap-1">
                  {target.alert_enabled ? <><Bell className="w-3 h-3 text-g-success" /> On</> : <><BellOff className="w-3 h-3" /> Off</>}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(target)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                    target.is_active ? 'text-g-success bg-g-success/10 border-g-success/20' : 'text-g-text-muted border-g-border hover:bg-white/[0.03]'
                  )}
                >
                  {target.is_active ? <><ToggleRight className="w-4 h-4" /> Active</> : <><ToggleLeft className="w-4 h-4" /> Inactive</>}
                </button>
                <button onClick={() => handleDelete(target.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-g-text-muted border border-g-border text-xs rounded-md hover:text-g-danger hover:border-g-danger/20 transition-all"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
