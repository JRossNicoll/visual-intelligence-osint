'use client';

import { useState, useEffect, useCallback } from 'react';
import { fusionApi } from '@/lib/api';
import type { DataSource, CorrelationRecord, FusionSummaryItem } from '@/types';

type Tab = 'sources' | 'correlations' | 'summaries';

const RELIABILITY_LABELS: Record<string, string> = {
  A: 'Completely Reliable',
  B: 'Usually Reliable',
  C: 'Fairly Reliable',
  D: 'Not Usually Reliable',
  E: 'Unreliable',
  F: 'Cannot Be Judged',
};
const CREDIBILITY_LABELS: Record<string, string> = {
  '1': 'Confirmed',
  '2': 'Probably True',
  '3': 'Possibly True',
  '4': 'Doubtfully True',
  '5': 'Improbable',
  '6': 'Cannot Be Judged',
};

const statusColor = (s: string) => {
  switch (s) {
    case 'active': return 'text-intel-accent';
    case 'inactive': return 'text-gray-500';
    case 'error': return 'text-sev-critical';
    case 'syncing': return 'text-sev-medium';
    default: return 'text-gray-400';
  }
};

const corrStatusColor = (s: string) => {
  switch (s) {
    case 'accepted': return 'bg-intel-accent/15 text-intel-accent';
    case 'auto_accepted': return 'bg-intel-accent/10 text-intel-accent';
    case 'rejected': return 'bg-sev-critical/15 text-sev-critical';
    case 'pending_review': return 'bg-sev-medium/15 text-sev-medium';
    default: return 'bg-intel-surface text-gray-400';
  }
};

export default function DataSourcesManager() {
  const [tab, setTab] = useState<Tab>('sources');
  const [sources, setSources] = useState<DataSource[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationRecord[]>([]);
  const [summaries, setSummaries] = useState<FusionSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c, f] = await Promise.all([
        fusionApi.listSources(),
        fusionApi.listCorrelations({ limit: 100 }),
        fusionApi.listFusionSummaries(),
      ]);
      setSources(s);
      setCorrelations(c);
      setSummaries(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fusion data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'sources', label: 'DATA SOURCES', count: sources.length },
    { id: 'correlations', label: 'CORRELATIONS', count: correlations.length },
    { id: 'summaries', label: 'FUSION SUMMARIES', count: summaries.length },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-gray-200 tracking-wide">DATA FUSION</h1>
          <p className="text-2xs text-gray-500 mt-0.5">Multi-source ingestion, correlation, and entity resolution</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 text-2xs font-semibold bg-intel-accent/10 border border-intel-accent/40 text-intel-accent hover:bg-intel-accent/20 rounded transition-colors"
          >
            + ADD SOURCE
          </button>
          <button
            onClick={load}
            className="px-3 py-1.5 text-2xs font-semibold bg-intel-surface border border-intel-border/60 text-gray-400 hover:text-intel-accent rounded transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-sev-critical/10 border border-sev-critical/30 text-sev-critical text-xs px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'SOURCES', value: sources.length, sub: `${sources.filter((s) => s.status === 'active').length} active` },
          { label: 'RECORDS', value: sources.reduce((a, s) => a + s.total_records_ingested, 0), sub: 'total ingested' },
          { label: 'CORRELATIONS', value: correlations.length, sub: `${correlations.filter((c) => c.status === 'pending_review').length} pending` },
          { label: 'FUSED ENTITIES', value: summaries.length, sub: `avg ${summaries.length ? (summaries.reduce((a, s) => a + s.source_count, 0) / summaries.length).toFixed(1) : '0'} sources` },
        ].map((s) => (
          <div key={s.label} className="bg-intel-surface border border-intel-border/40 rounded px-3 py-2">
            <div className="text-2xs text-gray-600 uppercase tracking-wide">{s.label}</div>
            <div className="text-lg font-bold text-gray-200">{s.value}</div>
            <div className="text-2xs text-gray-500">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Create source form */}
      {showCreate && <CreateSourceForm onCreated={() => { setShowCreate(false); load(); }} onCancel={() => setShowCreate(false)} />}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-intel-border/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-2xs font-semibold tracking-wide transition-colors border-b-2 ${
              tab === t.id
                ? 'text-intel-accent border-intel-accent'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {t.label} <span className="text-gray-600">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-xs">Loading fusion data...</div>
      ) : tab === 'sources' ? (
        <div className="grid grid-cols-3 gap-4">
          {/* Source list */}
          <div className="col-span-1 space-y-1 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
            {sources.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-xs">No data sources configured</div>
            ) : sources.map((src) => (
              <button
                key={src.id}
                onClick={() => setSelectedSource(src.id)}
                className={`w-full text-left px-3 py-2.5 rounded border transition-colors ${
                  selectedSource === src.id
                    ? 'bg-intel-accent/10 border-intel-accent/40 text-gray-200'
                    : 'bg-intel-surface border-intel-border/40 text-gray-400 hover:border-intel-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${src.status === 'active' ? 'bg-intel-accent' : 'bg-gray-600'}`} />
                  <span className="text-xs font-medium">{src.display_name}</span>
                  <span className={`text-2xs ml-auto ${statusColor(src.status)}`}>{src.status.toUpperCase()}</span>
                </div>
                <div className="text-2xs text-gray-600 mt-0.5">{src.source_type} · {src.adapter_type}</div>
                <div className="text-2xs text-gray-600">{src.total_records_ingested} records · {src.total_correlations_found} correlations</div>
              </button>
            ))}
          </div>

          {/* Source detail */}
          <div className="col-span-2 bg-intel-surface border border-intel-border/40 rounded p-4 max-h-[calc(100vh-340px)] overflow-y-auto">
            {!selectedSource ? (
              <div className="text-center py-16 text-gray-600 text-xs">Select a data source to view details</div>
            ) : (
              <SourceDetail source={sources.find((s) => s.id === selectedSource)} />
            )}
          </div>
        </div>
      ) : tab === 'correlations' ? (
        <div className="space-y-1 max-h-[calc(100vh-340px)] overflow-y-auto">
          {correlations.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-xs">No correlations found</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-2xs text-gray-600 uppercase tracking-wide border-b border-intel-border/40">
                  <th className="text-left py-2 px-2">Entity</th>
                  <th className="text-left py-2 px-2">Source</th>
                  <th className="text-left py-2 px-2">Method</th>
                  <th className="text-right py-2 px-2">Confidence</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {correlations.map((c) => (
                  <tr key={c.id} className="border-b border-intel-border/20 hover:bg-intel-surface/50">
                    <td className="py-1.5 px-2 text-gray-300 font-mono text-2xs">{c.matched_entity_id.slice(0, 8)}...</td>
                    <td className="py-1.5 px-2 text-gray-400">{c.data_source_id.slice(0, 8)}...</td>
                    <td className="py-1.5 px-2 text-gray-400">{c.correlation_method}</td>
                    <td className="py-1.5 px-2 text-right text-gray-300 font-medium">{(c.confidence_score * 100).toFixed(1)}%</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 text-2xs rounded ${corrStatusColor(c.status)}`}>
                        {c.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-gray-500 text-2xs">{new Date(c.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="space-y-1 max-h-[calc(100vh-340px)] overflow-y-auto">
          {summaries.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-xs">No fusion summaries computed</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-2xs text-gray-600 uppercase tracking-wide border-b border-intel-border/40">
                  <th className="text-left py-2 px-2">Entity</th>
                  <th className="text-right py-2 px-2">Sources</th>
                  <th className="text-right py-2 px-2">Records</th>
                  <th className="text-right py-2 px-2">Fused Confidence</th>
                  <th className="text-left py-2 px-2">Last Computed</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id} className="border-b border-intel-border/20 hover:bg-intel-surface/50">
                    <td className="py-1.5 px-2 text-gray-300 font-mono text-2xs">{s.entity_id.slice(0, 8)}...</td>
                    <td className="py-1.5 px-2 text-right text-intel-accent font-medium">{s.source_count}</td>
                    <td className="py-1.5 px-2 text-right text-gray-300">{s.total_records}</td>
                    <td className="py-1.5 px-2 text-right text-gray-300 font-medium">{(s.fused_confidence * 100).toFixed(1)}%</td>
                    <td className="py-1.5 px-2 text-gray-500 text-2xs">{new Date(s.last_computed_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function SourceDetail({ source }: { source?: DataSource }) {
  if (!source) return <div className="text-gray-600 text-xs">Not found</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${source.status === 'active' ? 'bg-intel-accent' : 'bg-gray-600'}`} />
        <div>
          <h2 className="text-sm font-bold text-gray-200">{source.display_name}</h2>
          <span className="text-2xs text-gray-500">{source.name}</span>
        </div>
        <span className={`text-2xs ml-auto ${statusColor(source.status)}`}>{source.status.toUpperCase()}</span>
      </div>
      {source.description && <p className="text-xs text-gray-400">{source.description}</p>}

      <div className="grid grid-cols-3 gap-3 text-xs">
        <Field label="Source Type" value={source.source_type} />
        <Field label="Adapter" value={source.adapter_type} />
        <Field label="Status" value={source.status} />
        <Field label="Reliability" value={`${source.reliability_rating} — ${RELIABILITY_LABELS[source.reliability_rating] || source.reliability_rating}`} />
        <Field label="Credibility" value={`${source.credibility_rating} — ${CREDIBILITY_LABELS[source.credibility_rating] || source.credibility_rating}`} />
        <Field label="Records Ingested" value={String(source.total_records_ingested)} />
        <Field label="Correlations Found" value={String(source.total_correlations_found)} />
        <Field label="Last Sync" value={source.last_sync_at ? new Date(source.last_sync_at).toLocaleString() : 'Never'} />
        <Field label="Created" value={new Date(source.created_at).toLocaleString()} />
      </div>

      {source.field_mapping && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Field Mapping</h3>
          <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-48">
            {JSON.stringify(source.field_mapping, null, 2)}
          </pre>
        </div>
      )}
      {source.connection_config && (
        <div>
          <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Connection Config</h3>
          <pre className="text-2xs text-gray-400 bg-intel-bg p-3 rounded overflow-auto max-h-48">
            {JSON.stringify(source.connection_config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function CreateSourceForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sourceType, setSourceType] = useState('siem');
  const [description, setDescription] = useState('');
  const [reliability, setReliability] = useState('C');
  const [credibility, setCredibility] = useState('3');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name || !displayName) return;
    setSaving(true);
    try {
      await fusionApi.createSource({
        name,
        display_name: displayName,
        description,
        source_type: sourceType,
        reliability_rating: reliability,
        credibility_rating: credibility,
      });
      onCreated();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="bg-intel-surface border border-intel-border/60 rounded p-4 space-y-3">
      <h3 className="text-xs font-bold text-gray-200">Register New Data Source</h3>
      <div className="grid grid-cols-2 gap-3">
        <input
          className="bg-intel-bg border border-intel-border/40 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-intel-accent/60 outline-none"
          placeholder="System name (e.g. splunk_siem)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="bg-intel-bg border border-intel-border/40 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-intel-accent/60 outline-none"
          placeholder="Display name (e.g. Splunk SIEM)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <select
          className="bg-intel-bg border border-intel-border/40 rounded px-2 py-1.5 text-xs text-gray-200 focus:border-intel-accent/60 outline-none"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
        >
          {['siem', 'threat_intel', 'hr_system', 'asset_management', 'access_control', 'network_monitor', 'endpoint_detection', 'custom'].map((t) => (
            <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
          ))}
        </select>
        <input
          className="bg-intel-bg border border-intel-border/40 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-intel-accent/60 outline-none"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select
          className="bg-intel-bg border border-intel-border/40 rounded px-2 py-1.5 text-xs text-gray-200 focus:border-intel-accent/60 outline-none"
          value={reliability}
          onChange={(e) => setReliability(e.target.value)}
        >
          {Object.entries(RELIABILITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{k} — {v}</option>
          ))}
        </select>
        <select
          className="bg-intel-bg border border-intel-border/40 rounded px-2 py-1.5 text-xs text-gray-200 focus:border-intel-accent/60 outline-none"
          value={credibility}
          onChange={(e) => setCredibility(e.target.value)}
        >
          {Object.entries(CREDIBILITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{k} — {v}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-2xs text-gray-500 hover:text-gray-300 transition-colors">CANCEL</button>
        <button
          onClick={handleSubmit}
          disabled={saving || !name || !displayName}
          className="px-3 py-1.5 text-2xs font-semibold bg-intel-accent/15 text-intel-accent border border-intel-accent/40 rounded hover:bg-intel-accent/25 disabled:opacity-50 transition-colors"
        >
          {saving ? 'SAVING...' : 'CREATE SOURCE'}
        </button>
      </div>
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
