'use client';

import { useState, useEffect, useCallback } from 'react';
import { workflowApi } from '@/lib/api';
import type { WorkflowDefinition, WorkflowExecution, ApprovalRequest } from '@/types';

type Tab = 'definitions' | 'executions' | 'approvals';

const statusColor = (s: string) => {
  switch (s) {
    case 'running': case 'in_progress': return 'bg-intel-accent/15 text-intel-accent';
    case 'completed': case 'approved': return 'bg-intel-accent/10 text-intel-accent';
    case 'failed': case 'rejected': return 'bg-sev-critical/15 text-sev-critical';
    case 'pending': case 'waiting_approval': return 'bg-sev-medium/15 text-sev-medium';
    case 'cancelled': return 'bg-gray-600/15 text-gray-500';
    case 'sla_breached': return 'bg-sev-high/15 text-sev-high';
    default: return 'bg-intel-surface text-gray-400';
  }
};

const catColor = (c: string) => {
  switch (c) {
    case 'investigation': return 'text-sev-critical';
    case 'response': return 'text-sev-high';
    case 'enrichment': return 'text-intel-accent';
    case 'triage': return 'text-sev-medium';
    case 'monitoring': return 'text-gray-400';
    default: return 'text-gray-400';
  }
};

export default function WorkflowBuilder() {
  const [tab, setTab] = useState<Tab>('definitions');
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDef, setSelectedDef] = useState<string | null>(null);
  const [selectedExec, setSelectedExec] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, e, a] = await Promise.all([
        workflowApi.listDefinitions({ active_only: false }),
        workflowApi.listExecutions({ limit: 100 }),
        workflowApi.listPendingApprovals(),
      ]);
      setDefinitions(d);
      setExecutions(e);
      setApprovals(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStartExecution = async (defId: string) => {
    try {
      await workflowApi.startExecution({ workflow_definition_id: defId, trigger_type: 'manual' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start workflow');
    }
  };

  const handleApproval = async (id: string, decision: string) => {
    try {
      await workflowApi.decideApproval(id, decision);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process approval');
    }
  };

  const tabs: { id: Tab; label: string; count: number; badge?: number }[] = [
    { id: 'definitions', label: 'WORKFLOWS', count: definitions.length },
    { id: 'executions', label: 'EXECUTIONS', count: executions.length },
    { id: 'approvals', label: 'APPROVALS', count: approvals.length, badge: approvals.filter((a) => a.status === 'pending').length },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-gray-200 tracking-wide">WORKFLOW ORCHESTRATION</h1>
          <p className="text-2xs text-gray-500 mt-0.5">Triggers, conditions, actions, SLAs, and approval workflows</p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-2xs font-semibold bg-intel-surface border border-intel-border/60 text-gray-400 hover:text-intel-accent rounded transition-colors"
        >
          REFRESH
        </button>
      </div>

      {error && (
        <div className="bg-sev-critical/10 border border-sev-critical/30 text-sev-critical text-xs px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'WORKFLOWS', value: definitions.length, sub: `${definitions.filter((d) => d.is_active).length} active` },
          { label: 'RUNNING', value: executions.filter((e) => e.status === 'running' || e.status === 'in_progress').length, sub: 'executions' },
          { label: 'COMPLETED', value: executions.filter((e) => e.status === 'completed').length, sub: 'total' },
          { label: 'PENDING', value: approvals.filter((a) => a.status === 'pending').length, sub: 'approvals' },
          { label: 'SLA BREACHED', value: executions.filter((e) => e.sla_breached).length, sub: 'executions' },
        ].map((s) => (
          <div key={s.label} className="bg-intel-surface border border-intel-border/40 rounded px-3 py-2">
            <div className="text-2xs text-gray-600 uppercase tracking-wide">{s.label}</div>
            <div className={`text-lg font-bold ${s.label === 'SLA BREACHED' && s.value > 0 ? 'text-sev-critical' : 'text-gray-200'}`}>{s.value}</div>
            <div className="text-2xs text-gray-500">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-intel-border/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2 text-2xs font-semibold tracking-wide transition-colors border-b-2 ${
              tab === t.id
                ? 'text-intel-accent border-intel-accent'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {t.label} <span className="text-gray-600">({t.count})</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className="ml-1.5 px-1 py-px text-2xs font-bold bg-sev-critical/90 text-white rounded leading-none">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-xs">Loading workflows...</div>
      ) : tab === 'definitions' ? (
        <div className="grid grid-cols-3 gap-4">
          {/* Definition list */}
          <div className="col-span-1 space-y-1 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
            {definitions.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-xs">No workflow definitions</div>
            ) : definitions.map((def) => (
              <button
                key={def.id}
                onClick={() => setSelectedDef(def.id)}
                className={`w-full text-left px-3 py-2.5 rounded border transition-colors ${
                  selectedDef === def.id
                    ? 'bg-intel-accent/10 border-intel-accent/40 text-gray-200'
                    : 'bg-intel-surface border-intel-border/40 text-gray-400 hover:border-intel-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${def.is_active ? 'bg-intel-accent' : 'bg-gray-600'}`} />
                  <span className="text-xs font-medium">{def.display_name}</span>
                  {def.is_builtin && <span className="text-2xs text-gray-600 ml-auto">BUILTIN</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-2xs ${catColor(def.category)}`}>{def.category}</span>
                  <span className="text-2xs text-gray-600">· {def.steps.length} steps</span>
                  <span className="text-2xs text-gray-600">· {def.total_executions} runs</span>
                </div>
              </button>
            ))}
          </div>

          {/* Definition detail */}
          <div className="col-span-2 bg-intel-surface border border-intel-border/40 rounded p-4 max-h-[calc(100vh-340px)] overflow-y-auto">
            {!selectedDef ? (
              <div className="text-center py-16 text-gray-600 text-xs">Select a workflow to view details</div>
            ) : (
              <DefinitionDetail
                def={definitions.find((d) => d.id === selectedDef)}
                onStart={() => selectedDef && handleStartExecution(selectedDef)}
              />
            )}
          </div>
        </div>
      ) : tab === 'executions' ? (
        <div className="grid grid-cols-3 gap-4">
          {/* Execution list */}
          <div className="col-span-1 space-y-1 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
            {executions.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-xs">No workflow executions</div>
            ) : executions.map((exec) => (
              <button
                key={exec.id}
                onClick={() => setSelectedExec(exec.id)}
                className={`w-full text-left px-3 py-2.5 rounded border transition-colors ${
                  selectedExec === exec.id
                    ? 'bg-intel-accent/10 border-intel-accent/40 text-gray-200'
                    : 'bg-intel-surface border-intel-border/40 text-gray-400 hover:border-intel-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{exec.workflow_name || exec.workflow_definition_id.slice(0, 8)}</span>
                  <span className={`px-1.5 py-0.5 text-2xs rounded ml-auto ${statusColor(exec.status)}`}>
                    {exec.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-2xs text-gray-600 mt-0.5">
                  {exec.trigger_type} · step {exec.current_step_index} · by {exec.initiated_by}
                </div>
                {exec.sla_breached && (
                  <div className="text-2xs text-sev-critical mt-0.5">SLA BREACHED</div>
                )}
              </button>
            ))}
          </div>

          {/* Execution detail */}
          <div className="col-span-2 bg-intel-surface border border-intel-border/40 rounded p-4 max-h-[calc(100vh-340px)] overflow-y-auto">
            {!selectedExec ? (
              <div className="text-center py-16 text-gray-600 text-xs">Select an execution to view details</div>
            ) : (
              <ExecutionDetail exec={executions.find((e) => e.id === selectedExec)} />
            )}
          </div>
        </div>
      ) : (
        /* Approvals */
        <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto">
          {approvals.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-xs">No pending approvals</div>
          ) : approvals.map((a) => (
            <div key={a.id} className="bg-intel-surface border border-intel-border/40 rounded p-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-200">{a.workflow_name || 'Workflow'}</span>
                  <span className="text-2xs text-gray-500">· {a.step_name || 'Step'}</span>
                  <span className={`px-1.5 py-0.5 text-2xs rounded ml-auto ${statusColor(a.status)}`}>
                    {a.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{a.reason}</p>
                <div className="flex items-center gap-3 mt-1 text-2xs text-gray-600">
                  {a.required_role && <span>Role: {a.required_role}</span>}
                  <span>Created: {new Date(a.created_at).toLocaleString()}</span>
                  {a.expires_at && <span>Expires: {new Date(a.expires_at).toLocaleString()}</span>}
                  {a.decided_by && <span>By: {a.decided_by}</span>}
                </div>
              </div>
              {a.status === 'pending' && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleApproval(a.id, 'approved')}
                    className="px-3 py-1.5 text-2xs font-semibold bg-intel-accent/15 text-intel-accent border border-intel-accent/40 rounded hover:bg-intel-accent/25 transition-colors"
                  >
                    APPROVE
                  </button>
                  <button
                    onClick={() => handleApproval(a.id, 'rejected')}
                    className="px-3 py-1.5 text-2xs font-semibold bg-sev-critical/15 text-sev-critical border border-sev-critical/40 rounded hover:bg-sev-critical/25 transition-colors"
                  >
                    REJECT
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DefinitionDetail({ def, onStart }: { def?: WorkflowDefinition; onStart: () => void }) {
  if (!def) return <div className="text-gray-600 text-xs">Not found</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-200">{def.display_name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xs text-gray-500">{def.name}</span>
            <span className={`text-2xs ${catColor(def.category)}`}>{def.category}</span>
            {def.is_builtin && <span className="px-2 py-0.5 text-2xs bg-intel-accent/10 text-intel-accent rounded">BUILTIN</span>}
          </div>
        </div>
        <button
          onClick={onStart}
          disabled={!def.is_active}
          className="px-3 py-1.5 text-2xs font-semibold bg-intel-accent/15 text-intel-accent border border-intel-accent/40 rounded hover:bg-intel-accent/25 disabled:opacity-40 transition-colors"
        >
          START EXECUTION
        </button>
      </div>
      {def.description && <p className="text-xs text-gray-400">{def.description}</p>}

      <div className="grid grid-cols-3 gap-3 text-xs">
        <Field label="Active" value={def.is_active ? 'Yes' : 'No'} />
        <Field label="Total Executions" value={String(def.total_executions)} />
        <Field label="SLA" value={def.sla_seconds ? `${(def.sla_seconds / 60).toFixed(0)} min` : 'None'} />
      </div>

      {/* Steps visualization */}
      <div>
        <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Workflow Steps ({def.steps.length})</h3>
        <div className="space-y-1">
          {def.steps.map((step, i) => {
            const s = step as Record<string, unknown>;
            return (
              <div key={i} className="flex items-center gap-2 bg-intel-bg rounded px-3 py-2 border border-intel-border/20">
                <span className="text-2xs text-gray-600 font-mono w-6">{i + 1}.</span>
                <span className="text-xs text-gray-300 font-medium">{String(s.name || s.step_name || `Step ${i + 1}`)}</span>
                <span className={`text-2xs px-1.5 py-0.5 rounded ${
                  s.type === 'action' || s.step_type === 'action' ? 'bg-intel-accent/10 text-intel-accent' :
                  s.type === 'condition' || s.step_type === 'condition' ? 'bg-sev-medium/10 text-sev-medium' :
                  s.type === 'approval' || s.step_type === 'approval' ? 'bg-sev-high/10 text-sev-high' :
                  'bg-intel-surface text-gray-500'
                }`}>
                  {String(s.type || s.step_type || 'action')}
                </span>
                {s.sla_seconds && (
                  <span className="text-2xs text-gray-600 ml-auto">SLA: {Number(s.sla_seconds) / 60}m</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Trigger config */}
      <div>
        <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trigger Configuration</h3>
        <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-48">
          {JSON.stringify(def.trigger_config, null, 2)}
        </pre>
      </div>

      {def.escalation_policy && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Escalation Policy</h3>
          <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-32">
            {JSON.stringify(def.escalation_policy, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ExecutionDetail({ exec }: { exec?: WorkflowExecution }) {
  if (!exec) return <div className="text-gray-600 text-xs">Not found</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-200">{exec.workflow_name || 'Execution'}</h2>
          <span className="text-2xs text-gray-500 font-mono">{exec.id.slice(0, 12)}...</span>
        </div>
        <span className={`px-2 py-0.5 text-2xs rounded ml-auto ${statusColor(exec.status)}`}>
          {exec.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <Field label="Trigger" value={exec.trigger_type} />
        <Field label="Current Step" value={String(exec.current_step_index)} />
        <Field label="Initiated By" value={exec.initiated_by} />
        <Field label="Started" value={new Date(exec.started_at).toLocaleString()} />
        <Field label="Completed" value={exec.completed_at ? new Date(exec.completed_at).toLocaleString() : 'In progress'} />
        <Field label="SLA Breached" value={exec.sla_breached ? 'YES' : 'No'} />
        {exec.entity_id && <Field label="Entity" value={exec.entity_id.slice(0, 12) + '...'} />}
        {exec.case_id && <Field label="Case" value={exec.case_id.slice(0, 12) + '...'} />}
        {exec.alert_id && <Field label="Alert" value={exec.alert_id.slice(0, 12) + '...'} />}
      </div>

      {exec.sla_deadline && (
        <div className={`text-xs px-3 py-2 rounded border ${
          exec.sla_breached
            ? 'bg-sev-critical/10 border-sev-critical/30 text-sev-critical'
            : 'bg-intel-surface border-intel-border/40 text-gray-400'
        }`}>
          SLA Deadline: {new Date(exec.sla_deadline).toLocaleString()}
          {exec.sla_breached && ' — BREACHED'}
        </div>
      )}

      {exec.trigger_data && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trigger Data</h3>
          <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-48">
            {JSON.stringify(exec.trigger_data, null, 2)}
          </pre>
        </div>
      )}
      {exec.context && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Context</h3>
          <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-48">
            {JSON.stringify(exec.context, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-2xs text-gray-600 uppercase tracking-wide">{label}</span>
      <div className="text-xs text-gray-300 mt-0.5">{value}</div>
    </div>
  );
}
