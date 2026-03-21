'use client';

import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Filter, ChevronRight, Clock, Users, AlertTriangle, FileText } from 'lucide-react';
import { casesApi } from '@/lib/api';
import type { CaseSummary } from '@/types';

interface CaseManagementProps {
  onViewChange: (view: string) => void;
  onCaseSelect: (caseId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'text-green-400 bg-green-500/10 border-green-500/30',
  active: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  closed: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

export default function CaseManagement({ onViewChange, onCaseSelect }: CaseManagementProps) {
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Case Management</h2>
            <p className="text-sm text-gray-400">Structured intelligence cases</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Case
        </button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['open', 'active', 'closed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
            className={`p-4 rounded-xl border transition-all ${
              statusFilter === status
                ? STATUS_COLORS[status]
                : 'bg-intel-surface border-intel-border hover:border-gray-600'
            }`}
          >
            <p className="text-2xl font-bold text-white">{statusCounts[status]}</p>
            <p className="text-sm text-gray-400 capitalize">{status} cases</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="flex gap-2">
          {['critical', 'high', 'medium', 'low'].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(priorityFilter === p ? '' : p)}
              className={`px-3 py-1 text-xs rounded-full border capitalize transition-colors ${
                priorityFilter === p
                  ? PRIORITY_COLORS[p]
                  : 'text-gray-500 border-intel-border hover:border-gray-500'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {(statusFilter || priorityFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-intel-surface border border-intel-border rounded-xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Case</h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-intel-bg border border-intel-border text-white focus:border-purple-500 focus:outline-none"
                placeholder="Case title..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-intel-bg border border-intel-border text-white focus:border-purple-500 focus:outline-none resize-none"
                placeholder="Case description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-intel-bg border border-intel-border text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Severity</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-intel-bg border border-intel-border text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No cases found</p>
          <p className="text-sm text-gray-600 mt-1">
            Create a case manually or from an alert/entity
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => onCaseSelect(c.id)}
              className="w-full text-left p-4 rounded-xl bg-intel-surface border border-intel-border hover:border-gray-600 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs rounded-full border capitalize ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full border capitalize ${PRIORITY_COLORS[c.priority]}`}>
                      {c.priority}
                    </span>
                    {c.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-gray-700/50 text-gray-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-white font-medium truncate">{c.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(c.opened_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {c.entity_count} entities
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {c.alert_count} alerts
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {c.evidence_count} evidence
                    </span>
                    {c.assigned_to && (
                      <span className="text-gray-400">Assigned: {c.assigned_to}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
