'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Brain,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import { intelligenceApi } from '@/lib/api';
import type { EntityProfile, TemporalEvent, BehaviorRecord, Prediction } from '@/types';
import { formatTimestamp, formatRelativeTime, severityColor } from '@/lib/utils';

export default function StoryModeView() {
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [profile, setProfile] = useState<EntityProfile | null>(null);
  const [events, setEvents] = useState<TemporalEvent[]>([]);
  const [behaviors, setBehaviors] = useState<BehaviorRecord[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    intelligenceApi.listProfiles({ limit: 50 }).then(setProfiles).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedEntity) {
      setProfile(null);
      setEvents([]);
      setBehaviors([]);
      setPrediction(null);
      return;
    }

    const fetchEntityData = async () => {
      setLoading(true);
      try {
        const [prof, evts, behs, pred] = await Promise.all([
          intelligenceApi.getProfile(selectedEntity).catch(() => null),
          intelligenceApi.listEvents({ entity_id: selectedEntity, limit: 100 }).catch(() => []),
          intelligenceApi.listBehaviors({ entity_id: selectedEntity }).catch(() => []),
          intelligenceApi.getPrediction(selectedEntity).catch(() => null),
        ]);
        setProfile(prof);
        setEvents(evts);
        setBehaviors(behs);
        setPrediction(pred);
      } catch {
        // API error
      } finally {
        setLoading(false);
      }
    };
    fetchEntityData();
  }, [selectedEntity]);

  const runAnalysis = async () => {
    if (!selectedEntity) return;
    setAnalyzing(true);
    try {
      await intelligenceApi.analyzeEntity(selectedEntity);
      // Refresh data
      const [prof, behs, pred] = await Promise.all([
        intelligenceApi.getProfile(selectedEntity).catch(() => null),
        intelligenceApi.listBehaviors({ entity_id: selectedEntity }).catch(() => []),
        intelligenceApi.getPrediction(selectedEntity).catch(() => null),
      ]);
      setProfile(prof);
      setBehaviors(behs);
      setPrediction(pred);
    } catch {
      // Handle error
    } finally {
      setAnalyzing(false);
    }
  };

  const riskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-intel-accent" />
            Entity Story Mode
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Complete intelligence narrative for a tracked entity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="px-4 py-2 bg-intel-card border border-intel-border rounded-lg text-sm text-white focus:outline-none focus:border-intel-accent"
          >
            <option value="">Select Entity...</option>
            {profiles.map((p) => (
              <option key={p.entity_id} value={p.entity_id}>
                {p.entity_id} ({p.entity_type}) - Risk: {p.risk_level}
              </option>
            ))}
          </select>
          {selectedEntity && (
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 bg-intel-accent/20 border border-intel-accent/30 rounded-lg text-sm text-intel-accent hover:bg-intel-accent/30 transition-colors disabled:opacity-50"
            >
              <Brain className={`w-4 h-4 ${analyzing ? 'animate-pulse' : ''}`} />
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          )}
        </div>
      </div>

      {!selectedEntity ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Select an entity to view its intelligence story</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-intel-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Entity Summary Card */}
          {profile && (
            <div className="bg-intel-card border border-intel-border rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{profile.entity_id}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {profile.entity_type} &middot; First seen {formatTimestamp(profile.first_seen)}
                  </p>
                </div>
                <div className={`text-right ${riskColor(profile.risk_level)}`}>
                  <div className="text-2xl font-bold">
                    {(profile.risk_score * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs uppercase font-semibold">{profile.risk_level} risk</div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{profile.visit_count}</div>
                  <div className="text-xs text-gray-500">Total Visits</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {profile.common_locations?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">Locations</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{profile.association_count}</div>
                  <div className="text-xs text-gray-500">Associations</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {profile.behavior_tags?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">Behaviors</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {Math.round(profile.profile_completeness * 100)}%
                  </div>
                  <div className="text-xs text-gray-500">Completeness</div>
                </div>
              </div>

              {/* Profile Completeness Bar */}
              <div className="mt-4">
                <div className="w-full bg-intel-bg rounded-full h-1.5">
                  <div
                    className="bg-intel-accent h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${profile.profile_completeness * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Temporal Pattern */}
            {profile?.temporal_pattern && (
              <div className="bg-intel-card border border-intel-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-intel-accent" />
                  Temporal Pattern
                </h3>
                <div className="space-y-3">
                  {profile.temporal_pattern.has_periodicity ? (
                    <div className="p-3 rounded-lg bg-intel-accent/10 border border-intel-accent/20">
                      <p className="text-sm text-intel-accent font-medium">Periodic Behavior Detected</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Dominant period: {profile.temporal_pattern.dominant_period_hours?.toFixed(1)}h
                        {profile.temporal_pattern.periodicity_confidence !== undefined && (
                          <> &middot; Confidence: {Math.round(profile.temporal_pattern.periodicity_confidence * 100)}%</>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No periodic pattern detected</p>
                  )}
                  {profile.temporal_pattern.peak_hours && profile.temporal_pattern.peak_hours.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500">Peak Hours:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {profile.temporal_pattern.peak_hours.map((h) => (
                          <span key={h} className="text-xs px-2 py-0.5 rounded bg-intel-bg text-gray-300">
                            {h}:00
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.temporal_pattern.peak_days && profile.temporal_pattern.peak_days.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500">Peak Days:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {profile.temporal_pattern.peak_days.map((d) => (
                          <span key={d} className="text-xs px-2 py-0.5 rounded bg-intel-bg text-gray-300">
                            {dayNames[d] || d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prediction */}
            {prediction && (prediction.time_confidence > 0 || prediction.location_confidence > 0) && (
              <div className="bg-intel-card border border-intel-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Prediction
                </h3>
                <div className="space-y-3">
                  {prediction.time_confidence > 0 && prediction.predicted_time_window_start && (
                    <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <p className="text-sm text-cyan-400 font-medium">Next Appearance</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTimestamp(prediction.predicted_time_window_start)}
                        {prediction.predicted_time_window_end && (
                          <> — {formatTimestamp(prediction.predicted_time_window_end)}</>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Confidence: {Math.round(prediction.time_confidence * 100)}%
                      </p>
                    </div>
                  )}
                  {prediction.location_confidence > 0 && prediction.predicted_location_name && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-sm text-blue-400 font-medium">Predicted Location</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {prediction.predicted_location_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Probability: {Math.round(prediction.location_confidence * 100)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risk Factors */}
            {profile?.risk_factors && profile.risk_factors.length > 0 && (
              <div className="bg-intel-card border border-intel-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-orange-400" />
                  Risk Factors
                </h3>
                <div className="space-y-2">
                  {profile.risk_factors.map((factor, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-intel-bg/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white">{factor.factor}</p>
                        <p className="text-xs text-gray-500">{factor.description}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {(factor.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Common Locations */}
            {profile?.common_locations && profile.common_locations.length > 0 && (
              <div className="bg-intel-card border border-intel-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  Common Locations
                </h3>
                <div className="space-y-2">
                  {profile.common_locations.map((loc, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-intel-bg/50">
                      <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{loc.name}</p>
                      </div>
                      <span className="text-xs text-gray-400">{loc.visit_count} visits</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Behavior History */}
          {behaviors.length > 0 && (
            <div className="bg-intel-card border border-intel-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                Detected Behaviors ({behaviors.length})
              </h3>
              <div className="space-y-2">
                {behaviors.map((b) => (
                  <div
                    key={b.id}
                    className={`p-3 rounded-lg border ${severityColor(b.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {b.behavior_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs opacity-70 mt-0.5">{b.description}</p>
                        <p className="text-xs opacity-50 mt-1">
                          Confidence: {Math.round(b.confidence * 100)}% &middot;{' '}
                          {formatRelativeTime(b.started_at)}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {b.is_active ? 'Active' : 'Resolved'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event Timeline */}
          {events.length > 0 && (
            <div className="bg-intel-card border border-intel-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-intel-accent" />
                Event History ({events.length} events)
              </h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      event.event_type === 'anomaly' ? 'bg-red-500' :
                      event.event_type === 'appearance' ? 'bg-intel-accent' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500">{event.event_type}</span>
                        {event.location_name && (
                          <span className="text-xs text-gray-500">@ {event.location_name}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round(event.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
