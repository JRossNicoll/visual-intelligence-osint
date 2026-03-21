'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, Plus, Search, ChevronRight,
  Clock, Users, FileText, Shield, RefreshCw,
  MessageSquare, BarChart3, ScrollText,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { casesApi } from '@/lib/api';
import type {
  CaseSummary, CaseDetail, CaseEvidence, CaseNote,
  CaseTimeline, CaseTimelineItem, CaseIntelSummary, AuditLogEntry,
} from '@/types';

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

const PRIORITY_BG: Record<string, string> = {
  critical: 'bg-sev-critical/20 text-sev-critical',
  high: 'bg-sev-high/20 text-sev-high',
  medium: 'bg-sev-medium/20 text-sev-medium',
  low: 'bg-sev-low/20 text-sev-low',
};


const STATUS_BG: Record<string, string> = {
  open: 'bg-intel-accent/20 text-intel-accent',
  active: 'bg-sky-400/20 text-sky-400',
  escalated: 'bg-sev-critical/20 text-sev-critical',
  pending: 'bg-sev-medium/20 text-sev-medium',
  closed: 'bg-gray-500/20 text-gray-500',
};

export default function CaseManagement({ onViewChange: _onViewChange, onCaseSelect }: CaseManagementProps) {
  void _onViewChange;
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

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
      });
      setCases(data);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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
      setSelectedCaseId(created.id);
      fetchCases();
    } catch {
      // Handle error
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
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    }
    return true;
  });

  const statusTabs = ['All', 'Active', 'Escalated', 'Pending', 'Closed'];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Sidebar — Case List */}
      <div className="w-[320px] min-w-[280px] border-r border-intel-border/60 flex flex-col bg-intel-bg">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-intel-border/40">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Cases</span>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all duration-200"
          >
            <Plus className="w-3 h-3" />
            New Case
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 rounded bg-intel-panel border border-intel-border/40 text-xs text-gray-300 placeholder:text-gray-600 focus:border-intel-accent/40 focus:outline-none transition-colors"
              placeholder="Search cases..."
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-0.5 px-3 pb-2">
          {statusTabs.map((tab) => {
            const filterVal = tab === 'All' ? '' : tab.toLowerCase();
            const isActive = statusFilter === filterVal;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(filterVal)}
                className={`px-2 py-1 text-2xs font-medium rounded transition-all duration-200 ${
                  isActive
                    ? 'bg-intel-card text-gray-200'
                    : 'text-gray-600 hover:text-gray-400 hover:bg-intel-panel/60'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Case List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-600" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Briefcase className="w-5 h-5 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No cases found</p>
              <p className="text-2xs text-gray-600 mt-0.5">Create a case or adjust filters</p>
            </div>
          ) : (
            filteredCases.map((c) => {
              const isSelected = selectedCaseId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-intel-border/20 transition-all duration-150 ${
                    isSelected ? 'bg-intel-card/60 border-l-2 border-l-intel-accent' : 'hover:bg-intel-panel/60 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`px-1.5 py-0.5 text-2xs font-bold rounded uppercase ${STATUS_BG[c.status] || STATUS_BG['open']}`}>
                      {c.status}
                    </span>
                    <span className="text-2xs text-gray-600 font-mono">CS-{c.id.slice(0, 4).toUpperCase()}</span>
                    <span className={`px-1.5 py-0.5 text-2xs font-bold rounded uppercase ${PRIORITY_BG[c.priority]}`}>
                      {c.priority}
                    </span>
                    <span className="text-2xs text-gray-600 ml-auto">{formatTimeAgo(c.opened_at)}</span>
                  </div>
                  <p className="text-xs text-gray-200 font-medium truncate">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-2xs text-gray-600">
                    {c.assigned_to && <span>{c.assigned_to}</span>}
                    <span>{c.entity_count} entities</span>
                    <span>{c.alert_count} alerts</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel — Case Detail */}
      <div className="flex-1 overflow-y-auto bg-intel-bg">
        {selectedCaseId ? (
          <InlineCaseDetail
            caseId={selectedCaseId}
            onEntitySelect={(id) => {
              onCaseSelect(id); // Navigate to entity through parent
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <Briefcase className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-xs text-gray-500">Select a case to view details</p>
            <p className="text-2xs text-gray-600 mt-1">Choose from the list on the left</p>
          </div>
        )}
      </div>

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-intel-surface border border-intel-border/60 rounded-md p-4 w-full max-w-md space-y-3">
            <div className="text-xs font-semibold text-gray-200 uppercase tracking-wider">New Case</div>

            <div>
              <label className="block text-2xs text-gray-500 mb-0.5">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-intel-bg border border-intel-border text-xs text-gray-200 focus:border-intel-accent/40 focus:outline-none transition-colors"
                placeholder="Case title..."
              />
            </div>

            <div>
              <label className="block text-2xs text-gray-500 mb-0.5">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 rounded bg-intel-bg border border-intel-border text-xs text-gray-200 focus:border-intel-accent/40 focus:outline-none resize-none transition-colors"
                placeholder="Description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-2xs text-gray-500 mb-0.5">Priority</label>
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-intel-bg border border-intel-border text-xs text-gray-200 focus:outline-none">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-2xs text-gray-500 mb-0.5">Severity</label>
                <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-intel-bg border border-intel-border text-xs text-gray-200 focus:outline-none">
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
                className="px-3 py-1 text-2xs text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all duration-200 disabled:opacity-40"
              >
                {creating ? 'Creating...' : 'CREATE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ #
// Inline Case Detail Panel (right side of split view)
// ------------------------------------------------------------------ #

type TabId = 'timeline' | 'evidence' | 'entities' | 'notes' | 'summary' | 'audit';

function InlineCaseDetail({
  caseId,
  onEntitySelect,
}: {
  caseId: string;
  onEntitySelect: (id: string) => void;
}) {
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [loading, setLoading] = useState(true);

  // Tab data
  const [timeline, setTimeline] = useState<CaseTimeline | null>(null);
  const [evidence, setEvidence] = useState<CaseEvidence[]>([]);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [summary, setSummary] = useState<CaseIntelSummary | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);

  // Note form
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [addingNote, setAddingNote] = useState(false);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);

  const fetchCase = useCallback(async () => {
    try {
      setLoading(true);
      const data = await casesApi.get(caseId);
      setCaseData(data);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const fetchTabData = useCallback(async () => {
    try {
      switch (activeTab) {
        case 'timeline': {
          const t = await casesApi.getTimeline(caseId);
          setTimeline(t);
          break;
        }
        case 'evidence': {
          const e = await casesApi.getEvidence(caseId);
          setEvidence(e);
          break;
        }
        case 'notes': {
          const n = await casesApi.getNotes(caseId);
          setNotes(n);
          break;
        }
        case 'summary': {
          const s = await casesApi.generateSummary(caseId);
          setSummary(s);
          break;
        }
        case 'audit': {
          const a = await casesApi.getAudit(caseId);
          setAudit(a);
          break;
        }
      }
    } catch {
      // Tab data may not be available
    }
  }, [caseId, activeTab]);

  useEffect(() => {
    fetchCase();
    setActiveTab('summary');
  }, [fetchCase]);

  useEffect(() => {
    if (caseData) fetchTabData();
  }, [fetchTabData, caseData]);

  const handleStatusChange = async (newStatus: string) => {
    if (!caseData) return;
    setUpdatingStatus(true);
    try {
      const updated = await casesApi.update(caseId, { status: newStatus });
      setCaseData(updated);
      setStatusExpanded(false);
    } catch {
      // Handle error
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await casesApi.addNote(caseId, {
        content: newNote,
        note_type: noteType,
      });
      setNewNote('');
      const n = await casesApi.getNotes(caseId);
      setNotes(n);
    } catch {
      // Handle error
    } finally {
      setAddingNote(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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

  if (loading || !caseData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'entities', label: 'Entities' },
    { id: 'notes', label: 'Notes' },
    { id: 'summary', label: 'Summary' },
    { id: 'audit', label: 'Audit' },
  ];

  return (
    <div className="p-5">
      {/* Case Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xs text-gray-600 font-mono">CS-{caseData.id.slice(0, 4).toUpperCase()}</span>
            <div className="relative">
              <button
                onClick={() => setStatusExpanded(!statusExpanded)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${STATUS_BG[caseData.status] || STATUS_BG['open']}`}
                disabled={updatingStatus}
              >
                {caseData.status}
                {statusExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
              {statusExpanded && (
                <div className="absolute top-full mt-0.5 left-0 bg-intel-surface border border-intel-border/60 rounded overflow-hidden z-10 min-w-[80px]">
                  {['open', 'active', 'closed'].map((s) => (
                    <button key={s} onClick={() => handleStatusChange(s)} className="block w-full text-left px-3 py-1 text-2xs text-gray-300 hover:bg-intel-card/60 capitalize transition-colors">{s}</button>
                  ))}
                </div>
              )}
            </div>
            <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${PRIORITY_BG[caseData.priority]}`}>
              {caseData.priority}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-gray-200 mb-1">{caseData.title}</h2>
          {caseData.description && (
            <p className="text-xs text-gray-500 leading-relaxed">{caseData.description}</p>
          )}
        </div>
        <div className="text-right text-2xs text-gray-600 ml-4 flex-shrink-0">
          {caseData.assigned_to && <div className="text-gray-400 font-medium">{caseData.assigned_to}</div>}
          <div>Updated {formatTimeAgo(caseData.updated_at || caseData.opened_at)}</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-6 mb-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-intel-accent/60" />
          <span className="font-bold text-gray-300">{caseData.entity_count}</span>
          <span className="text-gray-600">entities</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-sev-high/60" />
          <span className="font-bold text-gray-300">{caseData.alert_count}</span>
          <span className="text-gray-600">alerts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-gray-500" />
          <span className="font-bold text-gray-300">{caseData.evidence_count}</span>
          <span className="text-gray-600">evidence</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Clock className="w-3.5 h-3.5 text-gray-600" />
          <span className="text-gray-600">Created {formatDate(caseData.opened_at)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-intel-border/40 mb-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'border-b-2 border-intel-accent text-gray-200'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'timeline' && <TimelineContent timeline={timeline} formatDate={formatDate} />}
        {activeTab === 'evidence' && <EvidenceContent evidence={evidence} formatDate={formatDate} />}
        {activeTab === 'entities' && <EntitiesContent entityIds={caseData.linked_entity_ids} onEntitySelect={onEntitySelect} />}
        {activeTab === 'notes' && (
          <NotesContent
            notes={notes}
            formatDate={formatDate}
            newNote={newNote}
            setNewNote={setNewNote}
            noteType={noteType}
            setNoteType={setNoteType}
            onAddNote={handleAddNote}
            addingNote={addingNote}
          />
        )}
        {activeTab === 'summary' && <SummaryContent summary={summary} onRegenerate={fetchTabData} />}
        {activeTab === 'audit' && <AuditContent audit={audit} formatDate={formatDate} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ #
// Tab Content Components
// ------------------------------------------------------------------ #

function TimelineContent({ timeline, formatDate }: { timeline: CaseTimeline | null; formatDate: (s: string) => string }) {
  if (!timeline || timeline.items.length === 0) {
    return <EmptyState icon={Clock} message="No timeline items" />;
  }

  const typeDot: Record<string, string> = {
    event: 'bg-intel-accent',
    alert: 'bg-sev-high',
    evidence: 'bg-sev-medium',
    note: 'bg-gray-500',
  };

  return (
    <div className="space-y-0.5">
      {timeline.items.map((item: CaseTimelineItem) => (
        <div key={item.id} className="flex items-start gap-3 px-3 py-2 rounded hover:bg-intel-panel/40 transition-colors">
          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${typeDot[item.type] || 'bg-gray-600'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-2xs">
              <span className="text-gray-400 capitalize font-medium">{item.type}</span>
              <span className="text-gray-600">{formatDate(item.timestamp)}</span>
              {item.severity && (
                <span className={`font-bold uppercase ${PRIORITY_COLORS[item.severity] || 'text-gray-500'}`}>{item.severity}</span>
              )}
            </div>
            <p className="text-xs text-gray-200 mt-0.5">{item.title}</p>
            {item.description && <p className="text-2xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceContent({ evidence, formatDate }: { evidence: CaseEvidence[]; formatDate: (s: string) => string }) {
  if (evidence.length === 0) {
    return <EmptyState icon={FileText} message="No evidence collected" />;
  }

  return (
    <div className="space-y-0.5">
      {evidence.map((ev) => (
        <div key={ev.id} className="px-3 py-2 rounded hover:bg-intel-panel/40 transition-colors">
          <div className="flex items-center gap-2 text-2xs">
            <span className="text-intel-accent font-medium capitalize">{ev.evidence_type}</span>
            <span className="text-gray-600">{formatDate(ev.created_at)}</span>
            {ev.confidence !== null && ev.confidence !== undefined && (
              <span className="text-gray-500 tabular-nums">{(ev.confidence * 100).toFixed(0)}%</span>
            )}
          </div>
          <p className="text-xs text-gray-200 mt-0.5">{ev.title}</p>
          {ev.description && <p className="text-2xs text-gray-500 mt-0.5 line-clamp-2">{ev.description}</p>}
          <div className="flex items-center gap-2 mt-0.5 text-2xs text-gray-700">
            <span>{ev.source_table}</span>
            <span>{ev.added_by}</span>
            {ev.computation_params && <span className="text-intel-accent">reproducible</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EntitiesContent({ entityIds, onEntitySelect }: { entityIds: string[]; onEntitySelect: (id: string) => void }) {
  if (entityIds.length === 0) {
    return <EmptyState icon={Users} message="No entities linked" />;
  }

  return (
    <div className="space-y-0.5">
      {entityIds.map((eid) => (
        <button
          key={eid}
          onClick={() => onEntitySelect(eid)}
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-intel-panel/40 transition-colors"
        >
          <Shield className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-200 font-mono flex-1">{eid.substring(0, 20)}</span>
          <ChevronRight className="w-3 h-3 text-gray-700" />
        </button>
      ))}
    </div>
  );
}

function NotesContent({
  notes, formatDate, newNote, setNewNote, noteType, setNoteType, onAddNote, addingNote,
}: {
  notes: CaseNote[];
  formatDate: (s: string) => string;
  newNote: string;
  setNewNote: (s: string) => void;
  noteType: string;
  setNoteType: (s: string) => void;
  onAddNote: () => void;
  addingNote: boolean;
}) {
  const noteTypeColors: Record<string, string> = {
    general: 'text-gray-500',
    finding: 'text-intel-accent',
    action: 'text-sev-high',
    decision: 'text-sky-400',
  };

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="bg-intel-panel/40 border border-intel-border/30 rounded p-3 space-y-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 rounded bg-intel-bg border border-intel-border text-xs text-gray-200 focus:border-intel-accent/40 focus:outline-none resize-none transition-colors"
          placeholder="Add a note..."
        />
        <div className="flex items-center justify-between">
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
            className="px-2 py-1 rounded bg-intel-bg border border-intel-border text-2xs text-gray-400 focus:outline-none"
          >
            <option value="general">General</option>
            <option value="finding">Finding</option>
            <option value="action">Action</option>
            <option value="decision">Decision</option>
          </select>
          <button
            onClick={onAddNote}
            disabled={addingNote || !newNote.trim()}
            className="px-3 py-1 text-2xs text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all duration-200 disabled:opacity-40"
          >
            {addingNote ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyState icon={MessageSquare} message="No notes yet" />
      ) : (
        <div className="space-y-0.5">
          {notes.map((note) => (
            <div key={note.id} className="px-3 py-2 rounded hover:bg-intel-panel/40 transition-colors">
              <div className="flex items-center gap-2 text-2xs mb-0.5">
                <span className={`font-bold capitalize ${noteTypeColors[note.note_type] || 'text-gray-500'}`}>{note.note_type}</span>
                <span className="text-gray-600">{formatDate(note.created_at)}</span>
                <span className="text-gray-700">{note.author}</span>
              </div>
              <p className="text-xs text-gray-200">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryContent({ summary, onRegenerate }: { summary: CaseIntelSummary | null; onRegenerate: () => void }) {
  if (!summary) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-5 h-5 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No summary available</p>
        <button onClick={onRegenerate} className="mt-2 text-2xs text-intel-accent hover:underline">Generate summary</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overview */}
      <div className="border-l-2 border-intel-accent/40 pl-4">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Overview</h3>
        <p className="text-xs text-gray-400 leading-relaxed">{summary.title}</p>
      </div>

      {/* Key Findings */}
      {summary.findings && summary.findings.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Key Findings</h3>
          <ul className="space-y-1.5">
            {summary.findings.map((finding: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                <span className="text-intel-accent mt-0.5">&#8226;</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Entities */}
      {summary.key_entities && summary.key_entities.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Key Entities</h3>
          <div className="space-y-1">
            {summary.key_entities.map((entity) => (
              <div key={entity.entity_id} className="flex items-center gap-2 px-3 py-1.5 rounded bg-intel-panel/40">
                <span className="text-xs text-gray-200 font-mono">{entity.entity_id.substring(0, 12)}</span>
                <span className={`text-2xs font-bold uppercase ${PRIORITY_COLORS[entity.risk_level] || 'text-gray-500'}`}>{entity.risk_level}</span>
                <span className="text-2xs text-gray-600">{entity.entity_type} &middot; {entity.visit_count}v</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detected Patterns */}
      {summary.detected_patterns && summary.detected_patterns.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Detected Patterns</h3>
          <div className="space-y-1.5">
            {summary.detected_patterns.map((pattern, i) => (
              <div key={i} className="px-3 py-1.5 rounded bg-intel-panel/40">
                <div className="flex items-center gap-2 text-2xs">
                  <span className="text-intel-accent capitalize">{pattern.type}</span>
                  {pattern.confidence !== undefined && <span className="text-gray-600 tabular-nums">{(pattern.confidence * 100).toFixed(0)}%</span>}
                </div>
                <p className="text-xs text-gray-200">{pattern.title}</p>
                {pattern.description && <p className="text-2xs text-gray-500 mt-0.5">{pattern.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Limitations */}
      {summary.limitations && summary.limitations.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Limitations</h3>
          <ul className="space-y-1">
            {summary.limitations.map((lim: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-2xs text-gray-500">
                <span className="text-sev-medium">!</span>
                <span>{lim}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={onRegenerate} className="text-2xs text-gray-600 hover:text-intel-accent transition-colors">
        Regenerate summary
      </button>
    </div>
  );
}

function AuditContent({ audit, formatDate }: { audit: AuditLogEntry[]; formatDate: (s: string) => string }) {
  if (audit.length === 0) {
    return <EmptyState icon={ScrollText} message="No audit entries" />;
  }

  return (
    <div className="space-y-0.5">
      {audit.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 px-3 py-2 rounded hover:bg-intel-panel/40 transition-colors">
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-gray-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-2xs">
              <span className="text-gray-400 font-medium capitalize">{entry.action.replace(/_/g, ' ')}</span>
              <span className="text-gray-600">{formatDate(entry.performed_at)}</span>
              <span className="text-gray-700">{entry.actor} ({entry.role})</span>
            </div>
            {entry.detail && (
              <p className="text-2xs text-gray-500 mt-0.5">{entry.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Clock; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-600">
      <Icon className="w-5 h-5 mb-2 opacity-30" />
      <p className="text-xs">{message}</p>
    </div>
  );
}
