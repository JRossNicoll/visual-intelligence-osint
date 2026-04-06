'use client';

import { useState, useEffect, useCallback } from 'react';
import { ontologyApi } from '@/lib/api';
import type {
  OntologyEntityType, OntologyRelationType,
  InferenceRule, ActionDefinition,
} from '@/types';

type Tab = 'entity-types' | 'relation-types' | 'rules' | 'actions';

export default function OntologyManager() {
  const [tab, setTab] = useState<Tab>('entity-types');
  const [entityTypes, setEntityTypes] = useState<OntologyEntityType[]>([]);
  const [relationTypes, setRelationTypes] = useState<OntologyRelationType[]>([]);
  const [rules, setRules] = useState<InferenceRule[]>([]);
  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [et, rt, ru, ac] = await Promise.all([
        ontologyApi.listEntityTypes(),
        ontologyApi.listRelationTypes(),
        ontologyApi.listRules(false),
        ontologyApi.listActions(),
      ]);
      setEntityTypes(et);
      setRelationTypes(rt);
      setRules(ru);
      setActions(ac);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ontology data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'entity-types', label: 'ENTITY TYPES', count: entityTypes.length },
    { id: 'relation-types', label: 'RELATION TYPES', count: relationTypes.length },
    { id: 'rules', label: 'INFERENCE RULES', count: rules.length },
    { id: 'actions', label: 'ACTIONS', count: actions.length },
  ];

  const sevColor = (cat: string) => {
    switch (cat) {
      case 'alerting': return 'text-sev-critical';
      case 'case_management': return 'text-sev-high';
      case 'enrichment': return 'text-intel-accent';
      case 'notification': return 'text-sev-medium';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-gray-200 tracking-wide">ONTOLOGY MANAGER</h1>
          <p className="text-2xs text-gray-500 mt-0.5">Entity types, relationships, inference rules, and actions</p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-2xs font-semibold bg-intel-surface border border-intel-border/60 text-gray-400 hover:text-intel-accent hover:border-intel-accent/40 rounded transition-colors"
        >
          REFRESH
        </button>
      </div>

      {error && (
        <div className="bg-sev-critical/10 border border-sev-critical/30 text-sev-critical text-xs px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-intel-border/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedItem(null); }}
            className={`px-4 py-2 text-2xs font-semibold tracking-wide transition-colors border-b-2 ${
              tab === t.id
                ? 'text-intel-accent border-intel-accent'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-gray-600">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-xs">Loading ontology...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* List */}
          <div className="col-span-1 space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {tab === 'entity-types' && entityTypes.map((et) => (
              <button
                key={et.id}
                onClick={() => setSelectedItem(et.id)}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  selectedItem === et.id
                    ? 'bg-intel-accent/10 border-intel-accent/40 text-gray-200'
                    : 'bg-intel-surface border-intel-border/40 text-gray-400 hover:border-intel-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  {et.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: et.color }} />}
                  <span className="text-xs font-medium">{et.display_name}</span>
                  {et.is_builtin && <span className="text-2xs text-gray-600 ml-auto">BUILTIN</span>}
                  {et.is_abstract && <span className="text-2xs text-gray-600 italic">abstract</span>}
                </div>
                <div className="text-2xs text-gray-600 mt-0.5 truncate">{et.name}</div>
              </button>
            ))}

            {tab === 'relation-types' && relationTypes.map((rt) => (
              <button
                key={rt.id}
                onClick={() => setSelectedItem(rt.id)}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  selectedItem === rt.id
                    ? 'bg-intel-accent/10 border-intel-accent/40 text-gray-200'
                    : 'bg-intel-surface border-intel-border/40 text-gray-400 hover:border-intel-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{rt.display_name}</span>
                  {rt.is_directed && <span className="text-2xs text-gray-600">→</span>}
                  {rt.is_symmetric && <span className="text-2xs text-gray-600">↔</span>}
                  {rt.is_builtin && <span className="text-2xs text-gray-600 ml-auto">BUILTIN</span>}
                </div>
                <div className="text-2xs text-gray-600 mt-0.5">{rt.name} · weight {rt.propagation_weight}</div>
              </button>
            ))}

            {tab === 'rules' && rules.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedItem(r.id)}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  selectedItem === r.id
                    ? 'bg-intel-accent/10 border-intel-accent/40 text-gray-200'
                    : 'bg-intel-surface border-intel-border/40 text-gray-400 hover:border-intel-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? 'bg-intel-accent' : 'bg-gray-600'}`} />
                  <span className="text-xs font-medium">{r.name}</span>
                  <span className="text-2xs text-gray-600 ml-auto">P{r.priority}</span>
                </div>
                <div className="text-2xs text-gray-600 mt-0.5">fired {r.times_fired}x · cooldown {r.cooldown_seconds}s</div>
              </button>
            ))}

            {tab === 'actions' && actions.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedItem(a.id)}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  selectedItem === a.id
                    ? 'bg-intel-accent/10 border-intel-accent/40 text-gray-200'
                    : 'bg-intel-surface border-intel-border/40 text-gray-400 hover:border-intel-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${sevColor(a.category)}`}>{a.display_name}</span>
                  {a.is_builtin && <span className="text-2xs text-gray-600 ml-auto">BUILTIN</span>}
                </div>
                <div className="text-2xs text-gray-600 mt-0.5">{a.category} · {a.execution_type}</div>
              </button>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="col-span-2 bg-intel-surface border border-intel-border/40 rounded p-4 max-h-[calc(100vh-220px)] overflow-y-auto">
            {!selectedItem ? (
              <div className="text-center py-16 text-gray-600 text-xs">Select an item to view details</div>
            ) : tab === 'entity-types' ? (
              <EntityTypeDetail item={entityTypes.find((e) => e.id === selectedItem)} />
            ) : tab === 'relation-types' ? (
              <RelationTypeDetail item={relationTypes.find((r) => r.id === selectedItem)} />
            ) : tab === 'rules' ? (
              <RuleDetail item={rules.find((r) => r.id === selectedItem)} />
            ) : (
              <ActionDetail item={actions.find((a) => a.id === selectedItem)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EntityTypeDetail({ item }: { item?: OntologyEntityType }) {
  if (!item) return <div className="text-gray-600 text-xs">Not found</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {item.color && <span className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />}
        <div>
          <h2 className="text-sm font-bold text-gray-200">{item.display_name}</h2>
          <span className="text-2xs text-gray-500">{item.name}</span>
        </div>
        {item.is_builtin && <span className="px-2 py-0.5 text-2xs bg-intel-accent/10 text-intel-accent rounded ml-auto">BUILTIN</span>}
      </div>
      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Abstract" value={item.is_abstract ? 'Yes' : 'No'} />
        <Field label="Parent Type" value={item.parent_type_id || 'None (root)'} />
        <Field label="Icon" value={item.icon || '—'} />
        <Field label="Created" value={new Date(item.created_at).toLocaleString()} />
      </div>
      {item.property_schema && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Property Schema</h3>
          <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-64">
            {JSON.stringify(item.property_schema, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function RelationTypeDetail({ item }: { item?: OntologyRelationType }) {
  if (!item) return <div className="text-gray-600 text-xs">Not found</div>;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-200">{item.display_name}</h2>
        <span className="text-2xs text-gray-500">{item.name}</span>
      </div>
      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Directed" value={item.is_directed ? 'Yes' : 'No'} />
        <Field label="Symmetric" value={item.is_symmetric ? 'Yes' : 'No'} />
        <Field label="Propagation Weight" value={item.propagation_weight.toFixed(2)} />
        <Field label="Builtin" value={item.is_builtin ? 'Yes' : 'No'} />
        <Field label="Source Type Constraint" value={item.source_type_id || 'Any'} />
        <Field label="Target Type Constraint" value={item.target_type_id || 'Any'} />
      </div>
      {item.property_schema && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Property Schema</h3>
          <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-64">
            {JSON.stringify(item.property_schema, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function RuleDetail({ item }: { item?: InferenceRule }) {
  if (!item) return <div className="text-gray-600 text-xs">Not found</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-intel-accent' : 'bg-gray-600'}`} />
        <div>
          <h2 className="text-sm font-bold text-gray-200">{item.name}</h2>
          <span className="text-2xs text-gray-500">{item.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <Field label="Priority" value={String(item.priority)} />
        <Field label="Cooldown" value={`${item.cooldown_seconds}s`} />
        <Field label="Times Fired" value={String(item.times_fired)} />
      </div>
      {item.applicable_entity_types && item.applicable_entity_types.length > 0 && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Applicable Types</h3>
          <div className="flex gap-1 flex-wrap">
            {item.applicable_entity_types.map((t) => (
              <span key={t} className="px-2 py-0.5 text-2xs bg-intel-surface border border-intel-border/40 rounded text-gray-400">{t}</span>
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Conditions</h3>
        <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-48">
          {JSON.stringify(item.conditions, null, 2)}
        </pre>
      </div>
      <div>
        <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Actions</h3>
        <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-48">
          {JSON.stringify(item.actions, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ActionDetail({ item }: { item?: ActionDefinition }) {
  if (!item) return <div className="text-gray-600 text-xs">Not found</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-200">{item.display_name}</h2>
          <span className="text-2xs text-gray-500">{item.name}</span>
        </div>
        {item.is_builtin && <span className="px-2 py-0.5 text-2xs bg-intel-accent/10 text-intel-accent rounded ml-auto">BUILTIN</span>}
      </div>
      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Category" value={item.category} />
        <Field label="Execution Type" value={item.execution_type} />
        <Field label="Active" value={item.is_active ? 'Yes' : 'No'} />
        <Field label="Created" value={new Date(item.created_at).toLocaleString()} />
        {item.webhook_url && <Field label="Webhook URL" value={item.webhook_url} />}
        {item.webhook_method && <Field label="Webhook Method" value={item.webhook_method} />}
      </div>
      {item.parameter_schema && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Parameter Schema</h3>
          <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-64">
            {JSON.stringify(item.parameter_schema, null, 2)}
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
      <div className="text-xs text-gray-300 mt-0.5 truncate">{value}</div>
    </div>
  );
}
