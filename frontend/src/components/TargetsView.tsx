'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

  const typeColor = (type: string) => {
    if (type === 'person') return 'bg-purple-500/10 text-purple-400';
    if (type === 'vehicle') return 'bg-blue-500/10 text-blue-400';
    return 'bg-orange-500/10 text-orange-400';
  };

  const priorityColor = (p: string) => {
    if (p === 'critical') return 'text-red-400 bg-red-500/10';
    if (p === 'high') return 'text-orange-400 bg-orange-500/10';
    if (p === 'medium') return 'text-yellow-400 bg-yellow-500/10';
    return 'text-blue-400 bg-blue-500/10';
  };

  const inputCls = 'w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent/40 transition-colors placeholder-zinc-600';

  const filterBtn = (active: boolean) => cn(
    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
    active ? 'text-intel-accent border-intel-accent/20 bg-intel-accent/5' : 'text-zinc-500 border-intel-border hover:text-zinc-300 hover:border-intel-border-light'
  );

  return (
    <div className="p-6 pb-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Intelligence Targets</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Define custom targets to watch across all streams</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
            showCreate ? 'text-zinc-400 border-intel-border' : 'text-intel-accent border-intel-accent/20 hover:bg-intel-accent/5'
          )}
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'New Target'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button onClick={() => setFilterType('')} className={filterBtn(!filterType)}>All</button>
        {['person', 'vehicle', 'object'].map((type) => (
          <button key={type} onClick={() => setFilterType(type)} className={cn(filterBtn(filterType === type), 'flex items-center gap-1.5')}>
            {typeIcon(type)}<span className="capitalize">{type}s</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl bg-intel-card border border-intel-border p-6">
              <h3 className="text-sm font-medium text-white mb-5 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-intel-accent" /> Define New Target
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Target Name</label>
                  <input type="text" value={newTarget.name} onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })} placeholder='"White Toyota Hilux"' className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Target Type</label>
                  <select value={newTarget.target_type} onChange={(e) => setNewTarget({ ...newTarget, target_type: e.target.value as 'person' | 'vehicle' | 'object' })} className={inputCls}>
                    <option value="person">Person</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="object">Object</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5">Text Description (CLIP matching)</label>
                  <input type="text" value={newTarget.text_query} onChange={(e) => setNewTarget({ ...newTarget, text_query: e.target.value })} placeholder='"white pickup truck with roof racks"' className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Priority</label>
                  <select value={newTarget.priority} onChange={(e) => setNewTarget({ ...newTarget, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })} className={inputCls}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Similarity: <span className="text-intel-accent font-mono">{newTarget.similarity_threshold}</span></label>
                  <div className="pt-2"><input type="range" min="0.1" max="1.0" step="0.05" value={newTarget.similarity_threshold} onChange={(e) => setNewTarget({ ...newTarget, similarity_threshold: parseFloat(e.target.value) })} className="w-full" /></div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5">Description (optional)</label>
                  <textarea value={newTarget.description} onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })} placeholder="Additional context..." rows={2} className={cn(inputCls, 'resize-none')} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Webhook URL (optional)</label>
                  <input type="text" value={newTarget.webhook_url} onChange={(e) => setNewTarget({ ...newTarget, webhook_url: e.target.value })} placeholder="https://..." className={inputCls} />
                </div>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={newTarget.alert_enabled} onChange={(e) => setNewTarget({ ...newTarget, alert_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-9 h-5 bg-intel-border rounded-full peer peer-checked:bg-intel-accent/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-500 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-intel-accent" />
                    <span className="ml-2.5 text-sm text-zinc-400">Enable Alerts</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-zinc-500 hover:text-white transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={!newTarget.name || !newTarget.text_query} className="px-5 py-2 bg-intel-accent text-black text-sm font-medium rounded-lg disabled:opacity-40 transition-colors">Create Target</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600">
          <Shield className="w-5 h-5 animate-pulse mr-2" /><span className="text-sm">Loading targets...</span>
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-xl bg-intel-card flex items-center justify-center mx-auto mb-4 border border-intel-border">
            <Shield className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No targets defined</p>
          <p className="text-sm text-zinc-600 mt-1">Create intelligence targets to start matching</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targets.map((target) => (
            <div
              key={target.id}
              className={cn(
                'rounded-xl bg-intel-card border border-intel-border p-5 relative overflow-hidden hover:border-intel-border-light transition-colors',
                !target.is_active && 'opacity-50'
              )}
            >
              <div className={cn(
                'absolute top-0 left-0 right-0 h-[2px]',
                target.priority === 'critical' ? 'bg-red-500' :
                target.priority === 'high' ? 'bg-orange-500' :
                target.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
              )} />

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg', typeColor(target.target_type))}>{typeIcon(target.target_type)}</div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{target.name}</h3>
                    <p className="text-[11px] text-zinc-600 capitalize mt-0.5">{target.target_type}</p>
                  </div>
                </div>
                <span className={cn('text-[10px] font-medium uppercase px-1.5 py-0.5 rounded', priorityColor(target.priority))}>{target.priority}</span>
              </div>

              {target.text_query && (
                <p className="text-xs text-zinc-400 mb-3 bg-intel-bg rounded-lg p-2.5 font-mono border border-intel-border">&ldquo;{target.text_query}&rdquo;</p>
              )}
              {target.description && <p className="text-xs text-zinc-600 mb-3">{target.description}</p>}

              <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
                <span className="font-mono">{target.total_matches} matches</span>
                <span>Threshold: <span className="text-intel-accent font-mono">{target.similarity_threshold}</span></span>
                <span className="flex items-center gap-1">
                  {target.alert_enabled ? <><Bell className="w-3 h-3 text-intel-accent" /> On</> : <><BellOff className="w-3 h-3" /> Off</>}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(target)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    target.is_active ? 'text-intel-accent border-intel-accent/20 hover:bg-intel-accent/5' : 'text-zinc-500 border-intel-border hover:bg-white/[0.02]'
                  )}
                >
                  {target.is_active ? <><ToggleRight className="w-3.5 h-3.5" /> Active</> : <><ToggleLeft className="w-3.5 h-3.5" /> Inactive</>}
                </button>
                <button onClick={() => handleDelete(target.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-600 border border-intel-border rounded-lg text-xs hover:text-red-400 hover:border-red-500/20 transition-colors"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
