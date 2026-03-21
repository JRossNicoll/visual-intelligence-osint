'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  GitBranch,
  MapPin,
  RefreshCw,
  Star,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { operatorApi } from '@/lib/api';
import type { EntityFullProfile } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

const sevColor = (s: string) => {
  switch (s) {
    case 'critical': return 'text-sev-critical';
    case 'high': return 'text-sev-high';
    case 'medium': return 'text-sev-medium';
    default: return 'text-sev-low';
  }
};

interface EntityProfileViewProps {
  entityId: string;
  onViewChange: (view: string) => void;
  onEntitySelect?: (entityId: string) => void;
}

export default function EntityProfileView({ entityId, onViewChange, onEntitySelect }: EntityProfileViewProps) {
  const [profile, setProfile] = useState<EntityFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'alerts' | 'insights'>('overview');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await operatorApi.getEntityProfile(entityId);
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [entityId]);

  const handleAddToWatchlist = async () => {
    if (!profile) return;
    try {
      await operatorApi.addToWatchlist(profile.entity_id, 'Added from profile view', 'high');
      setProfile(prev => prev ? { ...prev, is_on_watchlist: true } : null);
    } catch { /* */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-600">
        <User className="w-5 h-5 mb-2 opacity-30" />
        <p className="text-xs">Entity not found</p>
        <button
          onClick={() => onViewChange('investigation')}
          className="mt-2 px-2 py-1 text-2xs text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all duration-200"
        >
          BACK
        </button>
      </div>
    );
  }

  const riskColor = profile.risk_score > 0.7 ? 'text-sev-critical' :
    profile.risk_score > 0.4 ? 'text-sev-high' :
    profile.risk_score > 0.2 ? 'text-sev-medium' : 'text-intel-accent';

  const riskStroke = profile.risk_score > 0.7 ? 'text-sev-critical' :
    profile.risk_score > 0.4 ? 'text-sev-high' :
    profile.risk_score > 0.2 ? 'text-sev-medium' : 'text-intel-accent';

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'events' as const, label: `Events (${profile.recent_events.length})` },
    { id: 'alerts' as const, label: `Alerts (${profile.alerts.length})` },
    { id: 'insights' as const, label: `Insights (${profile.insights.length})` },
  ];

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => onViewChange('investigation')} className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-gray-200">{profile.entity_id}</span>
              <span className={`text-2xs font-bold uppercase ${sevColor(profile.risk_level)}`}>{profile.risk_level}</span>
              {profile.is_on_watchlist && (
                <Star className="w-3 h-3 text-sev-medium fill-sev-medium" />
              )}
            </div>
            <p className="text-2xs text-gray-600 mt-0.5">
              {profile.entity_type} &middot; {profile.risk_summary}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!profile.is_on_watchlist && (
            <button onClick={handleAddToWatchlist} className="flex items-center gap-1 px-2 py-1 text-2xs text-intel-accent border border-intel-accent/30 rounded hover:bg-intel-accent/10 transition-all duration-200">
              <Star className="w-3 h-3" /> WATCH
            </button>
          )}
          <button onClick={() => onViewChange('investigation')} className="px-2 py-1 text-2xs text-gray-500 border border-intel-border rounded hover:text-gray-300 transition-all duration-200">
            BACK
          </button>
        </div>
      </div>

      {/* Risk + Stats strip */}
      <div className="bg-intel-panel border border-intel-border/60 rounded">
        <div className="flex items-center gap-4 px-3 py-2">
          {/* Compact risk circle */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-intel-border" />
              <circle
                cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                strokeDasharray={`${profile.risk_score * 264} 264`}
                strokeLinecap="round"
                className={riskStroke}
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold tabular-nums ${riskColor}`}>{(profile.risk_score * 100).toFixed(0)}</span>
            </div>
          </div>

          {/* Key stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 flex-1 text-2xs">
            <div>
              <span className="text-gray-600">First seen</span>
              <div className="text-xs text-gray-200">{profile.first_seen ? formatRelativeTime(profile.first_seen) : 'N/A'}</div>
            </div>
            <div>
              <span className="text-gray-600">Last seen</span>
              <div className="text-xs text-gray-200">{profile.last_seen ? formatRelativeTime(profile.last_seen) : 'N/A'}</div>
            </div>
            <div>
              <span className="text-gray-600">Visits</span>
              <div className="text-xs text-gray-200 tabular-nums">{profile.visit_count}</div>
            </div>
            <div>
              <span className="text-gray-600">Location</span>
              <div className="text-xs text-gray-200 truncate">{profile.last_location || 'Unknown'}</div>
            </div>
          </div>

          <div className="text-center flex-shrink-0">
            <div className="text-2xs text-gray-600">Complete</div>
            <div className="text-xs font-bold text-intel-accent tabular-nums">{(profile.profile_completeness * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-intel-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-2xs font-medium border-b-2 transition-all duration-200 ${
              activeTab === tab.id ? 'border-intel-accent text-intel-accent' : 'border-transparent text-gray-600 hover:text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Common Locations */}
          <div className="bg-intel-panel border border-intel-border/60 rounded">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Locations</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {profile.common_locations.length === 0 ? (
                <p className="text-2xs text-gray-600 text-center py-4">None</p>
              ) : (
                profile.common_locations.map((loc, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-intel-border/20">
                    <span className="text-xs text-gray-300">{loc.name}</span>
                    <span className="text-2xs text-gray-600 tabular-nums">{loc.visit_count}v</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Associated Entities */}
          <div className="bg-intel-panel border border-intel-border/60 rounded">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
              <Users className="w-3 h-3 text-gray-400" />
              <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Associations</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {profile.associated_entities.length === 0 ? (
                <p className="text-2xs text-gray-600 text-center py-4">None</p>
              ) : (
                profile.associated_entities.map((assoc) => (
                  <div
                    key={assoc.entity_id}
                    className="flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 cursor-pointer transition-all duration-150"
                    onClick={() => onEntitySelect?.(assoc.entity_id)}
                  >
                    <GitBranch className="w-3 h-3 text-gray-600" />
                    <span className="text-xs text-gray-200 font-mono flex-1 truncate">{assoc.entity_id.slice(0, 12)}</span>
                    <div className="w-12 bg-intel-bg rounded h-1">
                      <div className="h-1 rounded bg-intel-accent/50" style={{ width: `${assoc.strength * 100}%` }} />
                    </div>
                    <span className="text-2xs text-gray-600 tabular-nums">{(assoc.strength * 100).toFixed(0)}%</span>
                    <ChevronRight className="w-3 h-3 text-gray-700" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Behaviors */}
          <div className="bg-intel-panel border border-intel-border/60 rounded">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
              <Eye className="w-3 h-3 text-gray-400" />
              <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Behaviors</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {profile.behaviors.length === 0 ? (
                <p className="text-2xs text-gray-600 text-center py-4">None</p>
              ) : (
                profile.behaviors.map((behavior, i) => (
                  <div key={i} className="px-3 py-1.5 border-b border-intel-border/20">
                    <div className="flex items-center gap-1.5 text-2xs">
                      <span className={`font-bold uppercase ${sevColor(behavior.severity)}`}>{behavior.severity}</span>
                      <span className="text-gray-600">{behavior.type}</span>
                      {behavior.is_active && <span className="text-intel-accent">active</span>}
                      <span className="text-gray-700 ml-auto tabular-nums">{Math.round(behavior.confidence * 100)}%</span>
                    </div>
                    <p className="text-xs text-gray-200 mt-0.5">{behavior.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Predictions */}
          <div className="bg-intel-panel border border-intel-border/60 rounded">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-intel-border/60">
              <TrendingUp className="w-3 h-3 text-gray-400" />
              <span className="text-2xs font-semibold text-gray-300 uppercase tracking-wider">Predictions</span>
            </div>
            <div className="px-3 py-2 space-y-2">
              {profile.temporal_pattern ? (
                <div>
                  <div className="text-2xs text-gray-600">Temporal pattern</div>
                  <p className="text-xs text-gray-200">
                    {typeof profile.temporal_pattern === 'object'
                      ? JSON.stringify(profile.temporal_pattern).slice(0, 80)
                      : String(profile.temporal_pattern)}
                  </p>
                </div>
              ) : (
                <p className="text-2xs text-gray-700">No temporal pattern</p>
              )}

              {profile.predicted_next_time ? (
                <div>
                  <div className="text-2xs text-gray-600">Next appearance</div>
                  <p className="text-xs text-gray-200">
                    {typeof profile.predicted_next_time === 'object'
                      ? JSON.stringify(profile.predicted_next_time).slice(0, 80)
                      : String(profile.predicted_next_time)}
                  </p>
                </div>
              ) : (
                <p className="text-2xs text-gray-700">No time prediction</p>
              )}

              {profile.predicted_next_location ? (
                <div>
                  <div className="text-2xs text-gray-600">Next location</div>
                  <p className="text-xs text-gray-200">
                    {typeof profile.predicted_next_location === 'object'
                      ? JSON.stringify(profile.predicted_next_location).slice(0, 80)
                      : String(profile.predicted_next_location)}
                  </p>
                </div>
              ) : (
                <p className="text-2xs text-gray-700">No location prediction</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-intel-panel border border-intel-border/60 rounded">
          <div className="max-h-[400px] overflow-y-auto">
            {profile.recent_events.length === 0 ? (
              <p className="text-2xs text-gray-600 text-center py-8">No events</p>
            ) : (
              profile.recent_events.map((event) => (
                <div key={event.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150">
                  <div className="w-1.5 h-1.5 rounded-full bg-intel-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-2xs">
                      <span className="text-intel-accent font-medium">{event.event_type}</span>
                      {event.location_name && <span className="text-gray-600"><MapPin className="w-3 h-3 inline" /> {event.location_name}</span>}
                      {event.confidence !== undefined && <span className="text-gray-700 tabular-nums">{Math.round(event.confidence * 100)}%</span>}
                    </div>
                  </div>
                  <span className="text-2xs text-gray-400 flex-shrink-0 font-medium">{formatRelativeTime(event.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-intel-panel border border-intel-border/60 rounded">
          <div className="max-h-[400px] overflow-y-auto">
            {profile.alerts.length === 0 ? (
              <p className="text-2xs text-gray-600 text-center py-8">No alerts</p>
            ) : (
              profile.alerts.map((alert) => (
                <div key={alert.id} className="px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150">
                  <div className="flex items-center gap-1.5 text-2xs">
                    <span className={`font-bold uppercase ${sevColor(alert.severity)}`}>{alert.severity}</span>
                    <span className="text-gray-600">{alert.alert_type}</span>
                    <span className="text-gray-700 ml-auto">{formatRelativeTime(alert.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-200 mt-0.5">{alert.title}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="bg-intel-panel border border-intel-border/60 rounded">
          <div className="max-h-[400px] overflow-y-auto">
            {profile.insights.length === 0 ? (
              <p className="text-2xs text-gray-600 text-center py-8">No insights</p>
            ) : (
              profile.insights.map((insight) => (
                <div key={insight.id} className="px-3 py-1.5 border-b border-intel-border/20 hover:bg-intel-card/40 transition-all duration-150">
                  <div className="flex items-center gap-1.5 text-2xs">
                    <span className={`font-bold uppercase ${sevColor(insight.severity)}`}>{insight.severity}</span>
                    <span className="text-gray-600">{insight.type}</span>
                    <span className="text-gray-700 ml-auto tabular-nums">{Math.round(insight.confidence * 100)}%</span>
                  </div>
                  <p className="text-xs text-gray-200 mt-0.5">{insight.title}</p>
                  <p className="text-2xs text-gray-500 mt-0.5 line-clamp-1">{insight.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
