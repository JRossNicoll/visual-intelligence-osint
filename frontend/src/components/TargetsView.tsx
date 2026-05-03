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
    if (type === 'person') return <User className="w-3.5 h-3.5" />;
    if (type === 'vehicle') return <Car className="w-3.5 h-3.5" />;
    return <Box className="w-3.5 h-3.5" />;
  };

  const priorityBorder = (p: string) => {
    if (p === 'critical') return 'border-t-red-500';
    if (p === 'high') return 'border-t-orange-500';
    if (p === 'medium') return 'border-t-yellow-500';
    return 'border-t-blue-500';
  };

  const inputCls = 'w-full px-3 py-1.5 bg-intel-bg border border-intel-border text-zinc-200 text-[12px] font-mono focus:outline-none focus:border-intel-border-light transition-colors placeholder-zinc-600';

  const filterBtn = (active: boolean) => cn(
    'px-3 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors',
    active ? 'text-white border-intel-border-light bg-white/[0.04]' : 'text-zinc-600 border-intel-border hover:text-zinc-300 hover:border-intel-border-light'
  );

  return (
    <div className="p-6 pb-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-white">Intelligence Targets</h2>
          <p className="text-[11px] font-mono text-zinc-600 mt-1 uppercase tracking-wider">
            Define custom targets to watch across all streams
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-colors border',
            showCreate ? 'text-zinc-400 border-intel-border' : 'text-zinc-300 border-intel-border hover:border-intel-border-light hover:text-white'
          )}
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'New Target'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="mono-label mr-2">Type</span>
        <button onClick={() => setFilterType('')} className={filterBtn(!filterType)}>all</button>
        {['person', 'vehicle', 'object'].map((type) => (
          <button key={type} onClick={() => setFilterType(type)} className={cn(filterBtn(filterType === type), 'flex items-center gap-1.5')}>
            {typeIcon(type)}<span>{type}s</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-intel-card border border-intel-border p-5">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 mb-4 flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-zinc-500" /> Define New Target
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mono-label mb-1.5">Target Name</label>
                  <input type="text" value={newTarget.name} onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })} placeholder='"White Toyota Hilux"' className={inputCls} />
                </div>
                <div>
                  <label className="block mono-label mb-1.5">Target Type</label>
                  <select value={newTarget.target_type} onChange={(e) => setNewTarget({ ...newTarget, target_type: e.target.value as 'person' | 'vehicle' | 'object' })} className={inputCls}>
                    <option value="person">Person</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="object">Object</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block mono-label mb-1.5">Text Description (CLIP matching)</label>
                  <input type="text" value={newTarget.text_query} onChange={(e) => setNewTarget({ ...newTarget, text_query: e.target.value })} placeholder='"white pickup truck with roof racks"' className={inputCls} />
                </div>
                <div>
                  <label className="block mono-label mb-1.5">Priority</label>
                  <select value={newTarget.priority} onChange={(e) => setNewTarget({ ...newTarget, priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })} className={inputCls}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block mono-label mb-1.5">Similarity: <span className="text-zinc-300">{newTarget.similarity_threshold}</span></label>
                  <div className="pt-2"><input type="range" min="0.1" max="1.0" step="0.05" value={newTarget.similarity_threshold} onChange={(e) => setNewTarget({ ...newTarget, similarity_threshold: parseFloat(e.target.value) })} className="w-full" /></div>
                </div>
                <div className="md:col-span-2">
                  <label className="block mono-label mb-1.5">Description (optional)</label>
                  <textarea value={newTarget.description} onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })} placeholder="Additional context..." rows={2} className={cn(inputCls, 'resize-none')} />
                </div>
                <div>
                  <label className="block mono-label mb-1.5">Webhook URL (optional)</label>
                  <input type="text" value={newTarget.webhook_url} onChange={(e) => setNewTarget({ ...newTarget, webhook_url: e.target.value })} placeholder="https://..." className={inputCls} />
                </div>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={newTarget.alert_enabled} onChange={(e) => setNewTarget({ ...newTarget, alert_enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-8 h-4 bg-intel-border peer peer-checked:bg-green-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-500 after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-green-400" />
                    <span className="ml-2 text-[11px] font-mono text-zinc-400 uppercase">Enable Alerts</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setShowCreate(false)} className="px-4 py-1.5 text-[11px] font-mono text-zinc-500 hover:text-white uppercase tracking-wider transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={!newTarget.name || !newTarget.text_query} className="px-5 py-1.5 bg-zinc-200 text-black text-[11px] font-mono uppercase tracking-wider disabled:opacity-40 hover:bg-white transition-colors">Create Target</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600">
          <Shield className="w-4 h-4 animate-pulse mr-2" /><span className="text-[11px] font-mono uppercase">Loading targets...</span>
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 border border-intel-border">
            <Shield className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-zinc-400 text-sm">No targets defined</p>
          <p className="text-[11px] font-mono text-zinc-600 mt-1">Create intelligence targets to start matching</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-intel-border">
          {targets.map((target) => (
            <div
              key={target.id}
              className={cn(
                'bg-intel-card p-5 relative border-t-2 hover:bg-intel-card-hover transition-colors',
                priorityBorder(target.priority),
                !target.is_active && 'opacity-50'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 flex items-center justify-center border border-intel-border text-zinc-500">{typeIcon(target.target_type)}</div>
                  <div>
                    <h3 className="text-xs text-zinc-200">{target.name}</h3>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase mt-0.5">{target.target_type}</p>
                  </div>
                </div>
                <span className={cn(
                  'text-[9px] font-mono uppercase px-1.5 py-0.5 border',
                  target.priority === 'critical' ? 'text-red-400 border-red-500/20' :
                  target.priority === 'high' ? 'text-orange-400 border-orange-500/20' :
                  target.priority === 'medium' ? 'text-yellow-400 border-yellow-500/20' :
                  'text-blue-400 border-blue-500/20'
                )}>{target.priority}</span>
              </div>

              {target.text_query && (
                <p className="text-[11px] text-zinc-400 mb-3 bg-intel-bg p-2 font-mono border border-intel-border">&ldquo;{target.text_query}&rdquo;</p>
              )}
              {target.description && <p className="text-[11px] text-zinc-600 mb-3">{target.description}</p>}

              <div className="flex items-center gap-4 mb-3 text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                <span>{target.total_matches} matches</span>
                <span>thresh:{target.similarity_threshold}</span>
                <span className="flex items-center gap-1">
                  {target.alert_enabled ? <><Bell className="w-3 h-3 text-green-500" /> on</> : <><BellOff className="w-3 h-3" /> off</>}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(target)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono uppercase border transition-colors',
                    target.is_active ? 'text-green-400 border-green-500/20 hover:bg-green-500/5' : 'text-zinc-600 border-intel-border hover:bg-white/[0.02]'
                  )}
                >
                  {target.is_active ? <><ToggleRight className="w-3.5 h-3.5" /> Active</> : <><ToggleLeft className="w-3.5 h-3.5" /> Inactive</>}
                </button>
                <button onClick={() => handleDelete(target.id)} className="flex items-center gap-1.5 px-3 py-1 text-zinc-600 border border-intel-border text-[10px] font-mono hover:text-red-400 hover:border-red-500/20 transition-colors"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
