'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Clock, Users, FileText,
  Plus, RefreshCw, ScrollText, Shield, ChevronDown, ChevronUp,
  MessageSquare, BarChart3,
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
  critical: 'text-sev-critical',
  high: 'text-sev-high',
  medium: 'text-sev-medium',
  low: 'text-sev-low',
};


const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-sev-critical',
  high: 'bg-sev-high',
  medium: 'bg-sev-medium',
  low: 'bg-sev-low',
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
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-4 h-4 animate-spin text-gray-600" /></div>;
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
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button onClick={() => onViewChange('cases')} className="p-1 mt-0.5 text-gray-600 hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xs text-gray-600 font-mono">CS-{caseData.id.slice(0, 4).toUpperCase()}</span>
              <div className="relative">
                <button
                  onClick={() => setStatusExpanded(!statusExpanded)}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${
                    caseData.status === 'open' ? 'bg-intel-accent/20 text-intel-accent' :
                    caseData.status === 'active' ? 'bg-sky-400/20 text-sky-400' :
                    'bg-gray-500/20 text-gray-500'
                  }`}
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
              <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${
                caseData.priority === 'critical' ? 'bg-sev-critical/20 text-sev-critical' :
                caseData.priority === 'high' ? 'bg-sev-high/20 text-sev-high' :
                caseData.priority === 'medium' ? 'bg-sev-medium/20 text-sev-medium' :
                'bg-sev-low/20 text-sev-low'
              }`}>{caseData.priority}</span>
            </div>
            <h2 className="text-sm font-semibold text-gray-200">{caseData.title}</h2>
            {caseData.description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{caseData.description}</p>
            )}
          </div>
        </div>
        <div className="text-right text-2xs text-gray-600 ml-4 flex-shrink-0">
          {caseData.assigned_to && <div className="text-gray-400 font-medium">{caseData.assigned_to}</div>}
          <div>{formatDate(caseData.opened_at)}</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-6 text-xs text-gray-400">
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
        {caseData.tags.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {caseData.tags.map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 text-2xs text-gray-500 bg-intel-bg border border-intel-border/40 rounded">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-intel-border/40">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium transition-all duration-200 ${
                isActive ? 'border-b-2 border-intel-accent text-gray-200' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 text-gray-600">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
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
    return <EmptyState icon={Clock} message="No timeline items" />;
  }

  const typeDot: Record<string, string> = {
    event: 'bg-intel-accent',
    alert: 'bg-sev-high',
    evidence: 'bg-sev-medium',
    note: 'bg-gray-500',
  };

  return (
    <div className="bg-intel-panel border border-intel-border/60 rounded">
      {timeline.items.map((item: CaseTimelineItem) => (
        <div key={item.id} className="flex items-start gap-2 px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150">
          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${typeDot[item.type] || 'bg-gray-600'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-2xs">
              <span className="text-gray-400 capitalize font-medium">{item.type}</span>
              <span className="text-gray-600">{formatDate(item.timestamp)}</span>
              {item.severity && (
                <span className={`font-bold uppercase ${PRIORITY_COLORS[item.severity] || 'text-gray-500'}`}>{item.severity}</span>
              )}
              {item.confidence !== null && item.confidence !== undefined && (
                <span className="text-gray-700 tabular-nums">{(item.confidence * 100).toFixed(0)}%</span>
              )}
            </div>
            <p className="text-xs text-gray-200">{item.title}</p>
            {item.description && <p className="text-2xs text-gray-600 mt-0.5 line-clamp-1">{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceTab({ evidence, formatDate }: { evidence: CaseEvidence[]; formatDate: (s: string) => string }) {
  if (evidence.length === 0) {
    return <EmptyState icon={FileText} message="No evidence" />;
  }

  return (
    <div className="bg-intel-panel border border-intel-border/60 rounded">
      {evidence.map((ev) => (
        <div key={ev.id} className="px-3 py-2 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150">
          <div className="flex items-center gap-1.5 text-2xs">
            <span className="text-intel-accent font-medium capitalize">{ev.evidence_type}</span>
            <span className="text-gray-600">{formatDate(ev.created_at)}</span>
            {ev.confidence !== null && ev.confidence !== undefined && (
              <span className="text-gray-700 tabular-nums">{(ev.confidence * 100).toFixed(0)}%</span>
            )}
          </div>
          <p className="text-xs text-gray-200 mt-0.5">{ev.title}</p>
          {ev.description && <p className="text-2xs text-gray-500 mt-0.5 line-clamp-1">{ev.description}</p>}
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

function EntitiesTab({ entityIds, onEntitySelect }: { entityIds: string[]; onEntitySelect: (id: string) => void }) {
  if (entityIds.length === 0) {
    return <EmptyState icon={Users} message="No entities linked" />;
  }

  return (
    <div className="bg-intel-panel border border-intel-border/60 rounded">
      {entityIds.map((eid) => (
        <button
          key={eid}
          onClick={() => onEntitySelect(eid)}
          className="w-full text-left flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150"
        >
          <Shield className="w-3 h-3 text-gray-500" />
          <span className="text-xs text-gray-200 font-mono flex-1">{eid.substring(0, 16)}</span>
          <ArrowLeft className="w-3 h-3 text-gray-700 rotate-180" />
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
    general: 'text-gray-500',
    finding: 'text-intel-accent',
    action: 'text-sev-high',
    decision: 'text-blue-400',
  };

  return (
    <div className="space-y-3">
      {/* Add note form */}
      <div className="bg-intel-panel border border-intel-border/60 rounded p-3 space-y-2">
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
            className="flex items-center gap-1 px-2 py-1 text-2xs text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 disabled:opacity-40 transition-all duration-200"
          >
            <Plus className="w-3 h-3" />
            {addingNote ? 'Adding...' : 'ADD'}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={MessageSquare} message="No notes" />
      ) : (
        <div className="bg-intel-panel border border-intel-border/60 rounded">
          {notes.map((note) => (
            <div key={note.id} className="px-3 py-2 border-b border-intel-border/20">
              <div className="flex items-center gap-1.5 text-2xs">
                <span className={`font-medium capitalize ${noteTypeColors[note.note_type] || noteTypeColors.general}`}>{note.note_type}</span>
                <span className="text-gray-600">{note.author}</span>
                <span className="text-gray-700">{formatDate(note.created_at)}</span>
              </div>
              <p className="text-xs text-gray-300 whitespace-pre-wrap mt-0.5">{note.content}</p>
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
        <BarChart3 className="w-5 h-5 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-500 mb-2">No summary generated</p>
        <button onClick={onRegenerate} className="px-3 py-1 text-2xs text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all duration-200">GENERATE</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">Intelligence Summary</span>
        <button onClick={onRegenerate} className="flex items-center gap-1 text-2xs text-gray-600 hover:text-gray-400 transition-colors">
          <RefreshCw className="w-3 h-3" /> Regenerate
        </button>
      </div>

      {/* Key Entities */}
      {summary.key_entities.length > 0 && (
        <div className="bg-intel-panel border border-intel-border/60 rounded">
          <div className="px-3 py-1.5 border-b border-intel-border/60 text-2xs text-gray-500 font-medium">Key Entities</div>
          {summary.key_entities.map((entity) => (
            <div key={entity.entity_id} className="flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/20">
              <span className="text-xs text-gray-200 font-mono">{entity.entity_id.substring(0, 12)}</span>
              <span className={`text-2xs font-bold uppercase ${PRIORITY_COLORS[entity.risk_level] || 'text-gray-500'}`}>{entity.risk_level}</span>
              <span className="text-2xs text-gray-600">{entity.entity_type} &middot; {entity.visit_count}v</span>
            </div>
          ))}
        </div>
      )}

      {/* Findings */}
      {summary.findings.length > 0 && (
        <div className="bg-intel-panel border border-intel-border/60 rounded">
          <div className="px-3 py-1.5 border-b border-intel-border/60 text-2xs text-gray-500 font-medium">Findings</div>
          {summary.findings.map((finding, idx) => (
            <div key={idx} className="px-3 py-1.5 border-b border-intel-border/20 text-xs text-gray-300">{finding}</div>
          ))}
        </div>
      )}

      {/* Risk Distribution */}
      {Object.keys(summary.risk_levels).length > 0 && (
        <div className="flex items-center gap-3 text-2xs">
          <span className="text-gray-500">Risk:</span>
          {Object.entries(summary.risk_levels).map(([level, count]) => (
            <div key={level} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${SEVERITY_DOT[level] || 'bg-gray-600'}`} />
              <span className="text-gray-400 capitalize">{level}: {count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Confidence */}
      {summary.confidence_levels && Object.keys(summary.confidence_levels).length > 0 && (
        <div className="flex items-center gap-3 text-2xs text-gray-500">
          <span>Confidence:</span>
          {summary.confidence_levels.mean !== undefined && <span>mean {((summary.confidence_levels.mean as number) * 100).toFixed(0)}%</span>}
          {summary.confidence_levels.min !== undefined && <span>min {((summary.confidence_levels.min as number) * 100).toFixed(0)}%</span>}
          {summary.confidence_levels.max !== undefined && <span>max {((summary.confidence_levels.max as number) * 100).toFixed(0)}%</span>}
        </div>
      )}

      {/* Detected Patterns */}
      {summary.detected_patterns.length > 0 && (
        <div className="bg-intel-panel border border-intel-border/60 rounded">
          <div className="px-3 py-1.5 border-b border-intel-border/60 text-2xs text-gray-500 font-medium">Patterns</div>
          {summary.detected_patterns.map((pattern, idx) => (
            <div key={idx} className="px-3 py-1.5 border-b border-intel-border/20">
              <div className="flex items-center gap-1.5 text-2xs">
                <span className="text-intel-accent capitalize">{pattern.type}</span>
                {pattern.confidence !== undefined && <span className="text-gray-700 tabular-nums">{(pattern.confidence * 100).toFixed(0)}%</span>}
              </div>
              <p className="text-xs text-gray-200">{pattern.title}</p>
              {pattern.description && <p className="text-2xs text-gray-600 mt-0.5">{pattern.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Limitations */}
      {summary.limitations.length > 0 && (
        <div className="bg-intel-panel border border-intel-border/60 rounded">
          <div className="px-3 py-1.5 border-b border-intel-border/60 text-2xs text-gray-500 font-medium">Limitations</div>
          {summary.limitations.map((lim, idx) => (
            <div key={idx} className="px-3 py-1 border-b border-intel-border/20 text-2xs text-gray-500 flex items-start gap-1">
              <span className="text-sev-medium">!</span> {lim}
            </div>
          ))}
        </div>
      )}

      <p className="text-2xs text-gray-700">Generated: {summary.generated_at ? new Date(summary.generated_at).toLocaleString() : 'N/A'}</p>
    </div>
  );
}

function AuditTab({ audit, formatDate }: { audit: AuditLogEntry[]; formatDate: (s: string) => string }) {
  if (audit.length === 0) {
    return <EmptyState icon={ScrollText} message="No audit entries" />;
  }

  return (
    <div className="bg-intel-panel border border-intel-border/60 rounded">
      {audit.map((entry) => (
        <div key={entry.id} className="px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150">
          <div className="flex items-center gap-1.5 text-2xs">
            <span className="text-gray-300 font-medium">{entry.action.replace(/_/g, ' ')}</span>
            <span className="text-gray-600">{formatDate(entry.performed_at)}</span>
            <span className="text-gray-700">{entry.actor} ({entry.role})</span>
          </div>
          {entry.detail && <p className="text-2xs text-gray-500 mt-0.5">{entry.detail}</p>}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Clock; message: string }) {
  return (
    <div className="text-center py-8">
      <Icon className="w-4 h-4 text-gray-700 mx-auto mb-1" />
      <p className="text-2xs text-gray-600">{message}</p>
    </div>
  );
}
