'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Video, Users, GitMerge, Brain,
  Upload, RefreshCw, AlertCircle, CheckCircle,
  XCircle, Clock, Shield, ChevronRight,
} from 'lucide-react';
import { casesApi, videosApi, matchingApi, caseIntelligenceApi, entitiesApi } from '@/lib/api';
import type {
  CaseDetail, VideoFile, PendingMatch, CaseIntelligenceResult, Entity,
} from '@/types';

interface Sprint1CaseDetailProps {
  caseId: string;
  onBack: () => void;
}

type TabId = 'videos' | 'entities' | 'matches' | 'intelligence';

// ---- Status helpers ----
const VIDEO_STATUS_ICON: Record<string, React.ReactNode> = {
  queued: <Clock className="w-3.5 h-3.5 text-gray-500" />,
  processing: <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />,
  complete: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,
  failed: <XCircle className="w-3.5 h-3.5 text-sev-critical" />,
};

export default function Sprint1CaseDetail({ caseId, onBack }: Sprint1CaseDetailProps) {
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('videos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab data
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [intelligence, setIntelligence] = useState<CaseIntelligenceResult | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCase = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await casesApi.get(caseId);
      setCaseData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const fetchVideos = useCallback(async () => {
    try {
      const data = await videosApi.list(caseId);
      setVideos(data);
    } catch {
      // May not have videos yet
    }
  }, [caseId]);

  const fetchEntities = useCallback(async () => {
    try {
      // Fetch entities linked to this case
      if (caseData?.linked_entity_ids && caseData.linked_entity_ids.length > 0) {
        const entityPromises = caseData.linked_entity_ids.slice(0, 50).map((eid) =>
          entitiesApi.get(eid).catch(() => null)
        );
        const results = await Promise.all(entityPromises);
        setEntities(results.filter((e): e is Entity => e !== null));
      } else {
        setEntities([]);
      }
    } catch {
      setEntities([]);
    }
  }, [caseData]);

  const fetchMatches = useCallback(async () => {
    try {
      const data = await matchingApi.getPending(caseId);
      setPendingMatches(data);
    } catch {
      setPendingMatches([]);
    }
  }, [caseId]);

  const fetchIntelligence = useCallback(async () => {
    try {
      const data = await caseIntelligenceApi.get(caseId);
      setIntelligence(data);
    } catch {
      setIntelligence(null);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  useEffect(() => {
    if (!caseData) return;
    switch (activeTab) {
      case 'videos': fetchVideos(); break;
      case 'entities': fetchEntities(); break;
      case 'matches': fetchMatches(); break;
      case 'intelligence': fetchIntelligence(); break;
    }
  }, [activeTab, caseData, fetchVideos, fetchEntities, fetchMatches, fetchIntelligence]);

  // Auto-refresh videos while processing
  useEffect(() => {
    if (activeTab !== 'videos') return;
    const hasProcessing = videos.some((v) => v.status === 'queued' || v.status === 'processing');
    if (!hasProcessing) return;
    const interval = setInterval(fetchVideos, 5000);
    return () => clearInterval(interval);
  }, [activeTab, videos, fetchVideos]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await videosApi.upload(caseId, files[i]);
      }
      await fetchVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMatchReview = async (matchId: string, decision: 'accepted' | 'rejected') => {
    try {
      await matchingApi.review(matchId, decision);
      await fetchMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    }
  };

  const handleGenerateIntelligence = async () => {
    try {
      const data = await caseIntelligenceApi.generate(caseId);
      setIntelligence(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Intelligence generation failed');
    }
  };

  // --- Drop zone handler ---
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (loading || !caseData) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-600" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof Video; count?: number }[] = [
    { id: 'videos', label: 'Videos', icon: Video, count: videos.length },
    { id: 'entities', label: 'Entities', icon: Users, count: entities.length },
    { id: 'matches', label: 'Matches', icon: GitMerge, count: pendingMatches.length },
    { id: 'intelligence', label: 'Intelligence', icon: Brain },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Case Header */}
      <div className="bg-intel-surface border-b border-intel-border/60 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-2xs text-gray-500 hover:text-intel-accent mb-2 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Cases
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-gray-200">{caseData.title}</h1>
            <span className="px-1.5 py-0.5 text-2xs font-bold rounded uppercase bg-intel-accent/20 text-intel-accent">
              {caseData.status}
            </span>
          </div>
          {caseData.description && (
            <p className="text-2xs text-gray-500 mt-1 max-w-2xl">{caseData.description}</p>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-3 px-3 py-2 rounded bg-sev-critical/10 border border-sev-critical/30 text-xs text-sev-critical flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-sev-critical/60 hover:text-sev-critical">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-intel-surface border-b border-intel-border/40 px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-all ${
                  isActive ? 'text-intel-accent' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 px-1 py-px text-2xs font-bold bg-intel-panel rounded">
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-intel-accent rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'videos' && (
            <VideosTab
              videos={videos}
              uploading={uploading}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            />
          )}
          {activeTab === 'entities' && (
            <EntitiesTab entities={entities} />
          )}
          {activeTab === 'matches' && (
            <MatchesTab
              matches={pendingMatches}
              onReview={handleMatchReview}
            />
          )}
          {activeTab === 'intelligence' && (
            <IntelligenceTab
              intelligence={intelligence}
              onGenerate={handleGenerateIntelligence}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// Videos Tab
// ================================================================
function VideosTab({
  videos, uploading, fileInputRef, onFileUpload, onDrop, onDragOver,
}: {
  videos: VideoFile[];
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (files: FileList | null) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="border-2 border-dashed border-intel-border/40 rounded-lg p-8 text-center hover:border-intel-accent/40 transition-colors"
      >
        <Upload className="w-6 h-6 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-400 mb-1">Drag and drop video files here</p>
        <p className="text-2xs text-gray-600 mb-3">Supports MP4, AVI, MOV, WebM</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={(e) => onFileUpload(e.target.files)}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-1.5 text-xs font-medium text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all disabled:opacity-40"
        >
          {uploading ? 'Uploading...' : 'Browse Files'}
        </button>
      </div>

      {/* Video List */}
      {videos.length === 0 ? (
        <div className="text-center py-8">
          <Video className="w-6 h-6 text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No videos uploaded yet</p>
          <p className="text-2xs text-gray-600 mt-0.5">Upload videos to begin processing</p>
        </div>
      ) : (
        <div className="space-y-1">
          {videos.map((v) => {
            const progress = v.frame_count && v.frame_count > 0
              ? Math.round((v.processed_frames / v.frame_count) * 100)
              : v.status === 'complete' ? 100 : 0;
            return (
              <div
                key={v.id}
                className="flex items-center gap-3 px-4 py-3 bg-intel-surface border border-intel-border/30 rounded"
              >
                {VIDEO_STATUS_ICON[v.status] || VIDEO_STATUS_ICON['queued']}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 font-medium truncate">{v.filename}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-2xs text-gray-600">
                    <span className="uppercase font-bold">{v.status}</span>
                    {v.duration_seconds && <span>{Math.round(v.duration_seconds)}s</span>}
                    <span>{v.entity_count_discovered} entities</span>
                  </div>
                </div>
                {/* Progress Bar */}
                {(v.status === 'processing' || v.status === 'complete') && (
                  <div className="w-32 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-intel-bg rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          v.status === 'complete' ? 'bg-green-400' : 'bg-intel-accent'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-2xs text-gray-500 tabular-nums w-8 text-right">{progress}%</span>
                  </div>
                )}
                {v.status === 'failed' && v.error_message && (
                  <span className="text-2xs text-sev-critical max-w-48 truncate">{v.error_message}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================
// Entities Tab
// ================================================================
function EntitiesTab({ entities }: { entities: Entity[] }) {
  if (entities.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-6 h-6 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No entities discovered yet</p>
        <p className="text-2xs text-gray-600 mt-0.5">Upload and process videos to discover entities</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {entities.map((entity) => (
        <div
          key={entity.id}
          className="bg-intel-surface border border-intel-border/30 rounded p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-intel-panel flex items-center justify-center text-2xs font-bold text-gray-500 uppercase">
              {entity.entity_type.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-200 font-medium truncate">{entity.label}</p>
              <p className="text-2xs text-gray-600">{entity.entity_type}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-2xs text-gray-600">
            <span>{entity.total_sightings} sightings</span>
            <span>Confidence: {Math.round(entity.confidence * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ================================================================
// Matches Tab
// ================================================================
function MatchesTab({
  matches, onReview,
}: {
  matches: PendingMatch[];
  onReview: (matchId: string, decision: 'accepted' | 'rejected') => void;
}) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <GitMerge className="w-6 h-6 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No pending matches</p>
        <p className="text-2xs text-gray-600 mt-0.5">Cross-video identity matches will appear here for review</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <div
          key={match.id}
          className="flex items-center gap-4 px-4 py-3 bg-intel-surface border border-intel-border/30 rounded"
        >
          {/* Entity A */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-200 font-mono truncate">{match.entity_a_id.slice(0, 16)}</p>
            <p className="text-2xs text-gray-600">Entity A</p>
          </div>

          {/* Similarity */}
          <div className="flex flex-col items-center px-4">
            <ChevronRight className="w-4 h-4 text-intel-accent rotate-0" />
            <span className={`text-xs font-bold tabular-nums ${
              match.similarity_score >= 0.85 ? 'text-green-400' :
              match.similarity_score >= 0.70 ? 'text-sev-medium' : 'text-gray-500'
            }`}>
              {(match.similarity_score * 100).toFixed(1)}%
            </span>
            <span className="text-2xs text-gray-600">similarity</span>
          </div>

          {/* Entity B */}
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs text-gray-200 font-mono truncate">{match.entity_b_id.slice(0, 16)}</p>
            <p className="text-2xs text-gray-600">Entity B</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => onReview(match.id, 'accepted')}
              className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-green-400 border border-green-400/30 rounded hover:bg-green-400/10 transition-all"
            >
              <CheckCircle className="w-3 h-3" />
              Merge
            </button>
            <button
              onClick={() => onReview(match.id, 'rejected')}
              className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-sev-critical border border-sev-critical/30 rounded hover:bg-sev-critical/10 transition-all"
            >
              <XCircle className="w-3 h-3" />
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ================================================================
// Intelligence Tab
// ================================================================
function IntelligenceTab({
  intelligence, onGenerate,
}: {
  intelligence: CaseIntelligenceResult | null;
  onGenerate: () => void;
}) {
  if (!intelligence) {
    return (
      <div className="text-center py-12">
        <Brain className="w-6 h-6 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No intelligence generated yet</p>
        <p className="text-2xs text-gray-600 mt-1 max-w-md mx-auto">
          Intelligence is auto-generated when all videos are processed and matching is complete.
          You can also trigger it manually.
        </p>
        <button
          onClick={onGenerate}
          className="mt-4 px-4 py-1.5 text-xs font-medium text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all"
        >
          Generate Intelligence
        </button>
      </div>
    );
  }

  const sections = [
    { key: 'coordination_patterns', label: 'Coordination Patterns', icon: Users, data: intelligence.coordination_patterns },
    { key: 'temporal_anomalies', label: 'Temporal Anomalies', icon: Clock, data: intelligence.temporal_anomalies },
    { key: 'risk_scores', label: 'Risk Scores', icon: Shield, data: intelligence.risk_scores },
    { key: 'sequences', label: 'Sequences', icon: ChevronRight, data: intelligence.sequences },
    { key: 'group_anomalies', label: 'Group Anomalies', icon: AlertCircle, data: intelligence.group_anomalies },
    { key: 'cross_video_timeline', label: 'Cross-Video Timeline', icon: Video, data: intelligence.cross_video_timeline },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Intelligence Analysis</h3>
          <p className="text-2xs text-gray-600 mt-0.5">
            Generated {new Date(intelligence.generated_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={onGenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-2xs font-medium text-gray-500 border border-intel-border/40 rounded hover:text-intel-accent hover:border-intel-accent/30 transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          Re-run
        </button>
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        const items = section.data || [];
        return (
          <div key={section.key} className="bg-intel-surface border border-intel-border/30 rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-3.5 h-3.5 text-intel-accent" />
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{section.label}</h4>
              <span className="text-2xs text-gray-600 ml-auto">{items.length} findings</span>
            </div>
            {items.length === 0 ? (
              <p className="text-2xs text-gray-600">No {section.label.toLowerCase()} detected</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="px-3 py-2 bg-intel-bg/50 rounded text-xs text-gray-400">
                    {renderIntelItem(item)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderIntelItem(item: Record<string, unknown>): React.ReactNode {
  // Render key fields from intelligence item as plain English
  const entries = Object.entries(item).filter(([k]) => !k.startsWith('_'));
  if (entries.length === 0) return <span className="text-gray-600">Empty result</span>;

  return (
    <div className="space-y-0.5">
      {entries.slice(0, 6).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-2xs text-gray-600 w-32 flex-shrink-0 capitalize">{key.replace(/_/g, ' ')}:</span>
          <span className="text-2xs text-gray-300">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
