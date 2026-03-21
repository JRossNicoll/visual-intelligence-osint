'use client';

import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Filter, ChevronRight } from 'lucide-react';
import { casesApi } from '@/lib/api';
import type { CaseSummary } from '@/types';

interface CaseManagementProps {
  onViewChange: (view: string) => void;
  onCaseSelect: (caseId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-sev-critical',
  high: 'text-sev-high',
  medium: 'text-sev-medium',
  low: 'text-sev-low',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'text-intel-accent',
  active: 'text-blue-400',
  closed: 'text-gray-500',
};

export default function CaseManagement({ onCaseSelect }: CaseManagementProps) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newSeverity, setNewSeverity] = useState('medium');
  const [creating, setCreating] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const data = await casesApi.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setCases(data);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchCases();
    const interval = setInterval(fetchCases, 15000);
    return () => clearInterval(interval);
  }, [fetchCases]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await casesApi.create({
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        severity: newSeverity,
        source_type: 'manual',
      });
      setShowCreate(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewSeverity('medium');
      onCaseSelect(created.id);
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const statusCounts = {
    open: cases.filter(c => c.status === 'open').length,
    active: cases.filter(c => c.status === 'active').length,
    closed: cases.filter(c => c.status === 'closed').length,
  };

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-2xs font-semibold text-gray-400 uppercase tracking-widest">Cases</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-2 py-1 text-2xs text-intel-accent border border-intel-accent/30 rounded-sm hover:bg-intel-accent/10 transition-colors"
        >
          <Plus className="w-3 h-3" />
          NEW
        </button>
      </div>

      {/* Status strip */}
      <div className="flex items-center gap-px bg-intel-border rounded-sm overflow-hidden">
        {(['open', 'active', 'closed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
            className={`flex-1 px-3 py-2 text-center transition-colors ${
              statusFilter === status ? 'bg-intel-card' : 'bg-intel-panel hover:bg-intel-card/50'
            }`}
          >
            <div className={`text-sm font-bold tabular-nums ${STATUS_COLORS[status]}`}>{statusCounts[status]}</div>
            <div className="text-2xs text-gray-600 uppercase mt-0.5">{status}</div>
          </button>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-3 h-3 text-gray-600" />
        <div className="flex gap-1">
          {['critical', 'high', 'medium', 'low'].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(priorityFilter === p ? '' : p)}
              className={`px-2 py-0.5 text-2xs rounded-sm border capitalize transition-colors ${
                priorityFilter === p
                  ? `${PRIORITY_COLORS[p]} border-current bg-current/10`
                  : 'text-gray-600 border-intel-border hover:border-intel-border-light'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {(statusFilter || priorityFilter) && (
          <button onClick={() => { setStatusFilter(''); setPriorityFilter(''); }} className="text-2xs text-gray-600 hover:text-gray-400">
            clear
          </button>
        )}
      </div>

      {/* Create Case Modal — compact */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-intel-surface border border-intel-border rounded-sm p-4 w-full max-w-md space-y-3">
            <div className="text-xs font-semibold text-gray-200 uppercase tracking-wider">New Case</div>

            <div>
              <label className="block text-2xs text-gray-500 mb-0.5">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-2 py-1.5 rounded-sm bg-intel-bg border border-intel-border text-xs text-gray-200 focus:border-intel-border-light focus:outline-none"
                placeholder="Case title..."
              />
            </div>

            <div>
              <label className="block text-2xs text-gray-500 mb-0.5">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 rounded-sm bg-intel-bg border border-intel-border text-xs text-gray-200 focus:border-intel-border-light focus:outline-none resize-none"
                placeholder="Description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-2xs text-gray-500 mb-0.5">Priority</label>
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-sm bg-intel-bg border border-intel-border text-xs text-gray-200 focus:outline-none">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-2xs text-gray-500 mb-0.5">Severity</label>
                <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-sm bg-intel-bg border border-intel-border text-xs text-gray-200 focus:outline-none">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCreate(false)} className="px-2 py-1 text-2xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                className="px-3 py-1 text-2xs text-intel-accent border border-intel-accent/30 rounded-sm hover:bg-intel-accent/10 transition-colors disabled:opacity-40"
              >
                {creating ? 'Creating...' : 'CREATE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case table */}
      {loading ? (
        <div className="text-center py-8 text-gray-600 text-2xs">Loading...</div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="w-5 h-5 text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No cases found</p>
          <p className="text-2xs text-gray-600 mt-0.5">Create manually or from an alert</p>
        </div>
      ) : (
        <div className="bg-intel-panel border border-intel-border rounded-sm">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => onCaseSelect(c.id)}
              className="w-full text-left flex items-center gap-2 px-3 py-2 border-b border-intel-border/50 hover:bg-white/[0.015] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-2xs font-bold uppercase ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  <span className={`text-2xs font-bold uppercase ${PRIORITY_COLORS[c.priority]}`}>{c.priority}</span>
                  {c.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-2xs text-gray-600">{tag}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-200 truncate mt-0.5">{c.title}</p>
                <div className="flex items-center gap-3 mt-0.5 text-2xs text-gray-600">
                  <span>{formatDate(c.opened_at)}</span>
                  <span>{c.entity_count} ent</span>
                  <span>{c.alert_count} alerts</span>
                  <span>{c.evidence_count} ev</span>
                  {c.assigned_to && <span className="text-gray-500">{c.assigned_to}</span>}
                </div>
              </div>
              <ChevronRight className="w-3 h-3 text-gray-700 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
