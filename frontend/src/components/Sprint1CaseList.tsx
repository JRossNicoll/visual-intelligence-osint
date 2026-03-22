'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, Plus, Search, RefreshCw,
  Video, Users, Clock,
} from 'lucide-react';
import { casesApi } from '@/lib/api';
import type { CaseSummary } from '@/types';

interface Sprint1CaseListProps {
  onCaseSelect: (caseId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-intel-accent/20 text-intel-accent',
  active: 'bg-sky-400/20 text-sky-400',
  closed: 'bg-gray-500/20 text-gray-500',
};

export default function Sprint1CaseList({ onCaseSelect }: Sprint1CaseListProps) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await casesApi.list();
      setCases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await casesApi.create({
        title: newTitle,
        description: newDescription,
        priority: 'medium',
        severity: 'medium',
        source_type: 'manual',
      });
      setShowCreate(false);
      setNewTitle('');
      setNewDescription('');
      onCaseSelect(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const filteredCases = cases.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Cases</h1>
            <p className="text-2xs text-gray-600 mt-0.5">{cases.length} total cases</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchCases}
              className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              New Case
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded bg-intel-surface border border-intel-border/40 text-xs text-gray-300 placeholder:text-gray-600 focus:border-intel-accent/40 focus:outline-none"
            placeholder="Search cases by title or ID..."
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded bg-sev-critical/10 border border-sev-critical/30 text-xs text-sev-critical">
            {error}
          </div>
        )}

        {/* Cases Table */}
        {loading && cases.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-600" />
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <Briefcase className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-xs text-gray-500">No cases found</p>
            <p className="text-2xs text-gray-600 mt-1">Create a case to get started</p>
          </div>
        ) : (
          <div className="bg-intel-surface border border-intel-border/40 rounded-md overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-2xs font-semibold text-gray-500 uppercase tracking-wider border-b border-intel-border/30 bg-intel-panel/30">
              <div className="col-span-1">Status</div>
              <div className="col-span-4">Title</div>
              <div className="col-span-2 text-center">Videos</div>
              <div className="col-span-2 text-center">Entities</div>
              <div className="col-span-1 text-center">Priority</div>
              <div className="col-span-2 text-right">Updated</div>
            </div>

            {/* Table Rows */}
            {filteredCases.map((c) => (
              <button
                key={c.id}
                onClick={() => onCaseSelect(c.id)}
                className="w-full grid grid-cols-12 gap-2 px-4 py-3 text-left border-b border-intel-border/20 hover:bg-intel-panel/30 transition-colors"
              >
                <div className="col-span-1 flex items-center">
                  <span className={`px-1.5 py-0.5 text-2xs font-bold rounded uppercase ${STATUS_COLORS[c.status] || STATUS_COLORS['open']}`}>
                    {c.status}
                  </span>
                </div>
                <div className="col-span-4">
                  <p className="text-xs text-gray-200 font-medium truncate">{c.title}</p>
                  <p className="text-2xs text-gray-600 font-mono mt-0.5">CS-{c.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="col-span-2 flex items-center justify-center gap-1 text-xs text-gray-400">
                  <Video className="w-3 h-3 text-gray-600" />
                  <span>{c.evidence_count || 0}</span>
                </div>
                <div className="col-span-2 flex items-center justify-center gap-1 text-xs text-gray-400">
                  <Users className="w-3 h-3 text-gray-600" />
                  <span>{c.entity_count || 0}</span>
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <span className={`text-2xs font-bold uppercase ${
                    c.priority === 'critical' ? 'text-sev-critical' :
                    c.priority === 'high' ? 'text-sev-high' :
                    c.priority === 'medium' ? 'text-sev-medium' : 'text-gray-500'
                  }`}>
                    {c.priority}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1 text-2xs text-gray-600">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(c.updated_at)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-intel-surface border border-intel-border/60 rounded-md p-5 w-full max-w-md space-y-4">
            <div className="text-xs font-semibold text-gray-200 uppercase tracking-wider">New Case</div>

            <div>
              <label className="block text-2xs text-gray-500 mb-1">Case Name</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded bg-intel-bg border border-intel-border text-xs text-gray-200 focus:border-intel-accent/40 focus:outline-none"
                placeholder="e.g. Surveillance Operation Alpha"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-2xs text-gray-500 mb-1">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded bg-intel-bg border border-intel-border text-xs text-gray-200 focus:border-intel-accent/40 focus:outline-none resize-none"
                placeholder="Brief description of the case..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowCreate(false); setNewTitle(''); setNewDescription(''); }}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                className="px-4 py-1.5 text-xs font-medium text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all disabled:opacity-40"
              >
                {creating ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
