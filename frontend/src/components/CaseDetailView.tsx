'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Briefcase, Clock, Users, AlertTriangle, FileText,
  Plus, RefreshCw, ScrollText, Shield, ChevronDown, ChevronUp,
  MessageSquare, Layers, BarChart3,
} from 'lucide-react';
import { casesApi } from '@/lib/api';
import type {
  CaseDetail, CaseEvidence, CaseNote, CaseTimeline,
  CaseTimelineItem, CaseIntelSummary, AuditLogEntry,
} from '@/types';

interface CaseDetailViewProps {
  caseId: string;
  onViewChange: (view: string) => void;
  onEntitySelect: (entityId: string) => void;
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

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

type TabId = 'timeline' | 'evidence' | 'entities' | 'notes' | 'summary' | 'audit';

export default function CaseDetailView({ caseId, onViewChange, onEntitySelect }: CaseDetailViewProps) {
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
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
  }, [fetchCase]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

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
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading || !caseData) {
    return <div className="p-6 text-center text-gray-500">Loading case...</div>;
  }

  const tabs: { id: TabId; label: string; icon: typeof Clock; count?: number }[] = [
    { id: 'timeline', label: 'Timeline', icon: Clock, count: timeline?.total_items },
    { id: 'evidence', label: 'Evidence', icon: FileText, count: caseData.evidence_count },
    { id: 'entities', label: 'Entities', icon: Users, count: caseData.entity_count },
    { id: 'notes', label: 'Notes', icon: MessageSquare, count: notes.length },
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'audit', label: 'Audit', icon: ScrollText },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Back button + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onViewChange('cases')}
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">{caseData.title}</h2>
          </div>
          {caseData.description && (
            <p className="text-sm text-gray-400">{caseData.description}</p>
          )}
        </div>
      </div>

      {/* Case Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusExpanded(!statusExpanded)}
            className={`px-3 py-1.5 text-sm rounded-lg border capitalize flex items-center gap-1 ${STATUS_COLORS[caseData.status]}`}
            disabled={updatingStatus}
          >
            {caseData.status}
            {statusExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {statusExpanded && (
            <div className="absolute top-full mt-1 left-0 bg-intel-surface border border-intel-border rounded-lg overflow-hidden z-10 shadow-xl">
              {['open', 'active', 'closed'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 capitalize"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className={`px-3 py-1.5 text-sm rounded-lg border capitalize ${PRIORITY_COLORS[caseData.priority]}`}>
          {caseData.priority} priority
        </span>
        <span className={`px-3 py-1.5 text-sm rounded-lg border capitalize ${PRIORITY_COLORS[caseData.severity]}`}>
          {caseData.severity} severity
        </span>

        {caseData.assigned_to && (
          <span className="px-3 py-1.5 text-sm rounded-lg bg-gray-700/30 text-gray-300 border border-gray-600/30">
            Assigned: {caseData.assigned_to}
          </span>
        )}

        <span className="text-xs text-gray-500 ml-auto">
          Opened: {formatDate(caseData.opened_at)}
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Entities', value: caseData.entity_count, color: 'text-cyan-400' },
          { icon: AlertTriangle, label: 'Alerts', value: caseData.alert_count, color: 'text-orange-400' },
          { icon: FileText, label: 'Evidence', value: caseData.evidence_count, color: 'text-green-400' },
          { icon: Layers, label: 'Tags', value: caseData.tags.length, color: 'text-purple-400' },
        ].map((stat) => (
          <div key={stat.label} className="p-3 rounded-xl bg-intel-surface border border-intel-border">
            <div className="flex items-center gap-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-lg font-bold text-white">{stat.value}</span>
            </div>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tags */}
      {caseData.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {caseData.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 text-xs rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-intel-border pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-purple-400 text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-700 rounded-full">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-64">
        {activeTab === 'timeline' && (
          <TimelineTab timeline={timeline} formatDate={formatDate} />
        )}

        {activeTab === 'evidence' && (
          <EvidenceTab evidence={evidence} formatDate={formatDate} />
        )}

        {activeTab === 'entities' && (
          <EntitiesTab entityIds={caseData.linked_entity_ids} onEntitySelect={onEntitySelect} />
        )}

        {activeTab === 'notes' && (
          <NotesTab
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

        {activeTab === 'summary' && (
          <SummaryTab
            summary={summary}
            onRegenerate={() => fetchTabData()}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTab audit={audit} formatDate={formatDate} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ #
// Tab Components
// ------------------------------------------------------------------ #

function TimelineTab({ timeline, formatDate }: { timeline: CaseTimeline | null; formatDate: (s: string) => string }) {
  if (!timeline || timeline.items.length === 0) {
    return <EmptyState icon={Clock} message="No timeline items yet" />;
  }

  const typeIcons: Record<string, string> = {
    event: 'bg-cyan-500',
    alert: 'bg-orange-500',
    evidence: 'bg-green-500',
    note: 'bg-purple-500',
  };

  return (
    <div className="space-y-0">
      {timeline.items.map((item: CaseTimelineItem, idx: number) => (
        <div key={item.id} className="flex gap-4 group">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full ${typeIcons[item.type] || 'bg-gray-500'} mt-1.5`} />
            {idx < timeline.items.length - 1 && (
              <div className="w-px flex-1 bg-intel-border" />
            )}
          </div>

          {/* Content */}
          <div className="pb-6 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className="capitalize font-medium">{item.type}</span>
              <span>{formatDate(item.timestamp)}</span>
              {item.severity && (
                <span className={`px-1.5 py-0.5 rounded text-xs capitalize ${
                  SEVERITY_COLORS[item.severity] ? `${SEVERITY_COLORS[item.severity]} text-white` : 'bg-gray-600 text-gray-300'
                }`}>
                  {item.severity}
                </span>
              )}
              {item.confidence !== null && item.confidence !== undefined && (
                <span className="text-gray-600">{(item.confidence * 100).toFixed(0)}% conf</span>
              )}
            </div>
            <p className="text-sm text-white">{item.title}</p>
            {item.description && (
              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceTab({ evidence, formatDate }: { evidence: CaseEvidence[]; formatDate: (s: string) => string }) {
  if (evidence.length === 0) {
    return <EmptyState icon={FileText} message="No evidence attached" />;
  }

  return (
    <div className="space-y-3">
      {evidence.map((ev) => (
        <div key={ev.id} className="p-4 rounded-xl bg-intel-surface border border-intel-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs rounded bg-green-500/10 text-green-400 border border-green-500/30 capitalize">
              {ev.evidence_type}
            </span>
            <span className="text-xs text-gray-500">{formatDate(ev.created_at)}</span>
            {ev.confidence !== null && ev.confidence !== undefined && (
              <span className="text-xs text-gray-600">{(ev.confidence * 100).toFixed(0)}% confidence</span>
            )}
          </div>
          <h4 className="text-sm font-medium text-white">{ev.title}</h4>
          {ev.description && <p className="text-xs text-gray-400 mt-1">{ev.description}</p>}
          {ev.relevance_note && (
            <p className="text-xs text-purple-400 mt-1 italic">Note: {ev.relevance_note}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
            <span>Source: {ev.source_table}</span>
            <span>Added by: {ev.added_by}</span>
            {ev.computation_params && (
              <span className="text-cyan-600">Reproducible</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EntitiesTab({ entityIds, onEntitySelect }: { entityIds: string[]; onEntitySelect: (id: string) => void }) {
  if (entityIds.length === 0) {
    return <EmptyState icon={Users} message="No entities linked" />;
  }

  return (
    <div className="space-y-2">
      {entityIds.map((eid) => (
        <button
          key={eid}
          onClick={() => onEntitySelect(eid)}
          className="w-full text-left p-3 rounded-xl bg-intel-surface border border-intel-border hover:border-cyan-500/30 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-white font-mono">{eid.substring(0, 12)}...</p>
              <p className="text-xs text-gray-500">Click to view profile</p>
            </div>
          </div>
          <ArrowLeft className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 rotate-180 transition-colors" />
        </button>
      ))}
    </div>
  );
}

function NotesTab({
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
    general: 'text-gray-400 bg-gray-500/10',
    finding: 'text-green-400 bg-green-500/10',
    action: 'text-orange-400 bg-orange-500/10',
    decision: 'text-purple-400 bg-purple-500/10',
  };

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="p-4 rounded-xl bg-intel-surface border border-intel-border space-y-3">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-intel-bg border border-intel-border text-white text-sm focus:border-purple-500 focus:outline-none resize-none"
          placeholder="Add a note..."
        />
        <div className="flex items-center justify-between">
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-intel-bg border border-intel-border text-gray-300 text-sm focus:border-purple-500 focus:outline-none"
          >
            <option value="general">General</option>
            <option value="finding">Finding</option>
            <option value="action">Action</option>
            <option value="decision">Decision</option>
          </select>
          <button
            onClick={onAddNote}
            disabled={addingNote || !newNote.trim()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 text-sm disabled:opacity-50 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {addingNote ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyState icon={MessageSquare} message="No notes yet" />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="p-4 rounded-xl bg-intel-surface border border-intel-border">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs rounded capitalize ${noteTypeColors[note.note_type] || noteTypeColors.general}`}>
                  {note.note_type}
                </span>
                <span className="text-xs text-gray-500">{note.author}</span>
                <span className="text-xs text-gray-600">{formatDate(note.created_at)}</span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTab({ summary, onRegenerate }: { summary: CaseIntelSummary | null; onRegenerate: () => void }) {
  if (!summary) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 mb-3">Generate intelligence summary</p>
        <button
          onClick={onRegenerate}
          className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
        >
          Generate Summary
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Intelligence Summary</h3>
        <button
          onClick={onRegenerate}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Regenerate
        </button>
      </div>

      {/* Key Entities */}
      {summary.key_entities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Key Entities</h4>
          <div className="grid grid-cols-2 gap-3">
            {summary.key_entities.map((entity) => (
              <div key={entity.entity_id} className="p-3 rounded-lg bg-intel-surface border border-intel-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-mono">{entity.entity_id.substring(0, 10)}...</span>
                  <span className={`px-2 py-0.5 text-xs rounded capitalize ${PRIORITY_COLORS[entity.risk_level] || 'text-gray-400'}`}>
                    {entity.risk_level}
                  </span>
                </div>
                <p className="text-xs text-gray-500 capitalize">{entity.entity_type} - {entity.visit_count} visits</p>
                {entity.behavior_tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {entity.behavior_tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-700/50 text-gray-400 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {summary.findings.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Findings</h4>
          <div className="space-y-2">
            {summary.findings.map((finding, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-intel-surface border border-intel-border">
                <p className="text-sm text-gray-300">{finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Distribution */}
      {Object.keys(summary.risk_levels).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Risk Distribution</h4>
          <div className="flex gap-4">
            {Object.entries(summary.risk_levels).map(([level, count]) => (
              <div key={level} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${SEVERITY_COLORS[level] || 'bg-gray-500'}`} />
                <span className="text-sm text-gray-400 capitalize">{level}: {count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence */}
      {summary.confidence_levels && Object.keys(summary.confidence_levels).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Evidence Confidence</h4>
          <div className="flex gap-6 text-sm text-gray-400">
            {summary.confidence_levels.mean !== undefined && (
              <span>Mean: {((summary.confidence_levels.mean as number) * 100).toFixed(1)}%</span>
            )}
            {summary.confidence_levels.min !== undefined && (
              <span>Min: {((summary.confidence_levels.min as number) * 100).toFixed(1)}%</span>
            )}
            {summary.confidence_levels.max !== undefined && (
              <span>Max: {((summary.confidence_levels.max as number) * 100).toFixed(1)}%</span>
            )}
          </div>
        </div>
      )}

      {/* Detected Patterns */}
      {summary.detected_patterns.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Detected Patterns</h4>
          <div className="space-y-2">
            {summary.detected_patterns.map((pattern, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-intel-surface border border-intel-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-cyan-400 capitalize">{pattern.type}</span>
                  {pattern.confidence !== undefined && (
                    <span className="text-xs text-gray-600">{(pattern.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
                <p className="text-sm text-white">{pattern.title}</p>
                {pattern.description && <p className="text-xs text-gray-500 mt-0.5">{pattern.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Limitations */}
      {summary.limitations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Limitations</h4>
          <ul className="space-y-1">
            {summary.limitations.map((lim, idx) => (
              <li key={idx} className="text-sm text-gray-500 flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">!</span>
                {lim}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-600">Generated: {summary.generated_at ? new Date(summary.generated_at).toLocaleString() : 'N/A'}</p>
    </div>
  );
}

function AuditTab({ audit, formatDate }: { audit: AuditLogEntry[]; formatDate: (s: string) => string }) {
  if (audit.length === 0) {
    return <EmptyState icon={ScrollText} message="No audit entries" />;
  }

  return (
    <div className="space-y-2">
      {audit.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-intel-surface border border-intel-border">
          <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center flex-shrink-0">
            <ScrollText className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-medium">{entry.action.replace(/_/g, ' ')}</span>
              <span className="text-xs text-gray-600">{formatDate(entry.performed_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{entry.actor} ({entry.role})</span>
            </div>
            {entry.detail && <p className="text-xs text-gray-400 mt-1">{entry.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Clock; message: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
      <p className="text-gray-500">{message}</p>
    </div>
  );
}
