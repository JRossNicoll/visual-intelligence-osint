'use client';

import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Code,
  HelpCircle,
  MessageSquare,
  Search,
  Sparkles,
} from 'lucide-react';
import { intelligenceApi } from '@/lib/api';
import type { NLQueryResult } from '@/types';

const EXAMPLE_QUERIES = [
  'show all vehicles seen more than 5 times',
  'find entities seen in the last 24 hours',
  'show high risk entities',
  'find suspicious behavior',
  'who is associated with Vehicle_123',
  'show all entities at Location_A',
  'find anomalous activity',
  'predict next appearance of Entity_1',
];

export default function NLQueryView() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<NLQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSQL, setShowSQL] = useState(false);
  const [history, setHistory] = useState<Array<{ query: string; timestamp: string }>>([]);

  const executeQuery = async (q?: string) => {
    const queryText = q || query;
    if (!queryText.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await intelligenceApi.query(queryText);
      setResult(res);
      setHistory((prev) => [
        { query: queryText, timestamp: new Date().toISOString() },
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-intel-accent" />
          Intelligence Query
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Ask questions in natural language — translated to verified database queries
        </p>
      </div>

      {/* Query Input */}
      <div className="bg-intel-card border border-intel-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeQuery()}
            placeholder="Ask a question about your intelligence data..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
          />
          <button
            onClick={() => executeQuery()}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-intel-accent/20 border border-intel-accent/30 rounded-lg text-sm text-intel-accent hover:bg-intel-accent/30 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-intel-accent border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Query
          </button>
        </div>
      </div>

      {/* Example Queries */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((eq) => (
          <button
            key={eq}
            onClick={() => { setQuery(eq); executeQuery(eq); }}
            className="text-xs px-3 py-1.5 bg-intel-card border border-intel-border rounded-full text-gray-400 hover:text-white hover:border-intel-accent/30 transition-colors"
          >
            {eq}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium">Query Failed</p>
            <p className="text-xs text-red-400/70 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Query Explanation */}
          <div className="bg-intel-card border border-intel-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-intel-accent" />
                Query Interpretation
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  Confidence: {Math.round(result.confidence * 100)}%
                </span>
                <button
                  onClick={() => setShowSQL(!showSQL)}
                  className="text-xs px-2 py-1 bg-intel-bg border border-intel-border rounded text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <Code className="w-3 h-3" />
                  {showSQL ? 'Hide' : 'Show'} Query
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-300">{result.query_explanation}</p>

            {showSQL && (
              <div className="mt-3 space-y-2">
                {result.generated_sql && (
                  <div className="bg-intel-bg rounded-lg p-3">
                    <span className="text-xs text-gray-500 block mb-1">Generated SQL:</span>
                    <code className="text-xs text-intel-accent font-mono whitespace-pre-wrap">
                      {result.generated_sql}
                    </code>
                  </div>
                )}
                {result.generated_cypher && (
                  <div className="bg-intel-bg rounded-lg p-3">
                    <span className="text-xs text-gray-500 block mb-1">Generated Cypher:</span>
                    <code className="text-xs text-purple-400 font-mono whitespace-pre-wrap">
                      {result.generated_cypher}
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Table */}
          <div className="bg-intel-card border border-intel-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                Results ({result.result_count})
              </h3>
            </div>

            {result.results.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No results found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-intel-border">
                      {Object.keys(result.results[0]).map((key) => (
                        <th key={key} className="text-left py-2 px-3 text-gray-500 font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((row, idx) => (
                      <tr key={idx} className="border-b border-intel-border/30 hover:bg-white/5">
                        {Object.values(row).map((val, vidx) => (
                          <td key={vidx} className="py-2 px-3 text-gray-300">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Query History */}
      {history.length > 0 && (
        <div className="bg-intel-card border border-intel-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Recent Queries</h3>
          <div className="space-y-2">
            {history.map((h, idx) => (
              <button
                key={idx}
                onClick={() => { setQuery(h.query); executeQuery(h.query); }}
                className="w-full text-left p-2 rounded-lg bg-intel-bg/50 hover:bg-white/5 transition-colors"
              >
                <p className="text-xs text-gray-300">{h.query}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {new Date(h.timestamp).toLocaleTimeString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help */}
      <div className="bg-intel-card border border-intel-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-gray-400" />
          Query Capabilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
          <div>
            <span className="text-white font-medium">Entity Frequency</span>
            <p>Find entities by sighting count</p>
          </div>
          <div>
            <span className="text-white font-medium">Temporal Search</span>
            <p>Find recent or time-based activity</p>
          </div>
          <div>
            <span className="text-white font-medium">Location Search</span>
            <p>Find entities at specific locations</p>
          </div>
          <div>
            <span className="text-white font-medium">Association Search</span>
            <p>Find related or co-occurring entities</p>
          </div>
          <div>
            <span className="text-white font-medium">Behavior Search</span>
            <p>Find suspicious or anomalous behavior</p>
          </div>
          <div>
            <span className="text-white font-medium">Risk Assessment</span>
            <p>Find high-risk or flagged entities</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          All queries are translated to verified SQL/Cypher — no LLM hallucination.
          Results include query explanation and confidence scores.
        </p>
      </div>
    </div>
  );
}
