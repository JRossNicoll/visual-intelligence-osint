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
import { formatRelativeTime, severityColor } from '@/lib/utils';

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

  const riskLabel = (level: string) => {
    switch (level) {
      case 'critical': return { text: 'CRITICAL', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
      case 'high': return { text: 'HIGH', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };
      case 'medium': return { text: 'MEDIUM', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
      default: return { text: 'LOW', color: 'text-green-400 bg-green-500/10 border-green-500/30' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading entity profile...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <User className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Entity not found</p>
        <button
          onClick={() => onViewChange('investigation')}
          className="mt-3 px-4 py-2 text-sm text-intel-accent bg-intel-accent/10 rounded-lg hover:bg-intel-accent/20 transition-colors"
        >
          Back to Investigation
        </button>
      </div>
    );
  }

  const risk = riskLabel(profile.risk_level);
  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'events' as const, label: `Events (${profile.recent_events.length})` },
    { id: 'alerts' as const, label: `Alerts (${profile.alerts.length})` },
    { id: 'insights' as const, label: `Insights (${profile.insights.length})` },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onViewChange('investigation')}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">{profile.entity_id}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${risk.color}`}>
                {risk.text}
              </span>
              {profile.is_on_watchlist && (
                <div className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-4 h-4 fill-yellow-400" />
                  <span className="text-xs font-medium">Watched</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {profile.entity_type} &middot; {profile.risk_summary}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!profile.is_on_watchlist && (
            <button
              onClick={handleAddToWatchlist}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-colors"
            >
              <Star className="w-3.5 h-3.5" />
              Add to Watchlist
            </button>
          )}
          <button
            onClick={() => onViewChange('investigation')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-intel-surface border border-intel-border rounded-lg hover:bg-intel-card transition-colors"
          >
            Back to Investigation
          </button>
        </div>
      </div>

      {/* Risk Score Hero */}
      <div className="bg-intel-card border border-intel-border rounded-xl p-5">
        <div className="flex items-center gap-6">
          {/* Risk Circle */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-intel-border" />
              <circle
                cx="50" cy="50" r="42" fill="none" strokeWidth="6"
                strokeDasharray={`${profile.risk_score * 264} 264`}
                strokeLinecap="round"
                className={`${
                  profile.risk_score > 0.7 ? 'text-red-500' :
                  profile.risk_score > 0.4 ? 'text-orange-500' :
                  profile.risk_score > 0.2 ? 'text-yellow-500' : 'text-green-500'
                }`}
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-white">{(profile.risk_score * 100).toFixed(0)}</span>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">First Seen</div>
              <div className="text-sm font-medium text-white">
                {profile.first_seen ? formatRelativeTime(profile.first_seen) : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Last Seen</div>
              <div className="text-sm font-medium text-white">
                {profile.last_seen ? formatRelativeTime(profile.last_seen) : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Total Visits</div>
              <div className="text-sm font-medium text-white">{profile.visit_count}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Last Location</div>
              <div className="text-sm font-medium text-white truncate">
                {profile.last_location || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Profile Completeness */}
          <div className="text-center flex-shrink-0">
            <div className="text-xs text-gray-500 mb-1">Completeness</div>
            <div className="text-lg font-bold text-intel-accent">
              {(profile.profile_completeness * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-intel-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-intel-accent border-intel-accent'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Common Locations */}
          <div className="bg-intel-card border border-intel-border rounded-xl">
            <div className="flex items-center gap-2 p-4 border-b border-intel-border">
              <MapPin className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-semibold text-white">Common Locations</h3>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {profile.common_locations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No location data</p>
              ) : (
                <div className="divide-y divide-intel-border/50">
                  {profile.common_locations.map((loc, i) => (
                    <div key={i} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-sm text-white">{loc.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">{loc.visit_count} visits</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Associated Entities */}
          <div className="bg-intel-card border border-intel-border rounded-xl">
            <div className="flex items-center gap-2 p-4 border-b border-intel-border">
              <Users className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Associated Entities</h3>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {profile.associated_entities.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No associations</p>
              ) : (
                <div className="divide-y divide-intel-border/50">
                  {profile.associated_entities.map((assoc) => (
                    <div
                      key={assoc.entity_id}
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => onEntitySelect?.(assoc.entity_id)}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-sm text-white">{assoc.entity_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-intel-bg rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${assoc.strength * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{(assoc.strength * 100).toFixed(0)}%</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Behaviors */}
          <div className="bg-intel-card border border-intel-border rounded-xl">
            <div className="flex items-center gap-2 p-4 border-b border-intel-border">
              <Eye className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Behavior Patterns</h3>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {profile.behaviors.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No behaviors detected</p>
              ) : (
                <div className="divide-y divide-intel-border/50">
                  {profile.behaviors.map((behavior, i) => (
                    <div key={i} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${severityColor(behavior.severity)}`}>
                          {behavior.severity}
                        </span>
                        <span className="text-xs text-gray-500">{behavior.type}</span>
                        {behavior.is_active && (
                          <span className="text-xs text-green-400 font-medium">Active</span>
                        )}
                        <span className="text-xs text-gray-600 ml-auto">
                          {Math.round(behavior.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-sm text-white">{behavior.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Predictions */}
          <div className="bg-intel-card border border-intel-border rounded-xl">
            <div className="flex items-center gap-2 p-4 border-b border-intel-border">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Predictions</h3>
            </div>
            <div className="p-4 space-y-4">
              {profile.temporal_pattern ? (
                <div className="bg-intel-bg/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Temporal Pattern</div>
                  <p className="text-sm text-white">
                    {typeof profile.temporal_pattern === 'object'
                      ? JSON.stringify(profile.temporal_pattern).slice(0, 100)
                      : String(profile.temporal_pattern)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No temporal pattern detected</p>
              )}

              {profile.predicted_next_time ? (
                <div className="bg-intel-bg/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Predicted Next Appearance</div>
                  <p className="text-sm text-white">
                    {typeof profile.predicted_next_time === 'object'
                      ? JSON.stringify(profile.predicted_next_time).slice(0, 100)
                      : String(profile.predicted_next_time)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No time prediction available</p>
              )}

              {profile.predicted_next_location ? (
                <div className="bg-intel-bg/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Predicted Next Location</div>
                  <p className="text-sm text-white">
                    {typeof profile.predicted_next_location === 'object'
                      ? JSON.stringify(profile.predicted_next_location).slice(0, 100)
                      : String(profile.predicted_next_location)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No location prediction available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-intel-card border border-intel-border rounded-xl">
          <div className="max-h-[500px] overflow-y-auto">
            {profile.recent_events.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">No recent events</p>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-px bg-intel-border" />
                {profile.recent_events.map((event) => (
                  <div key={event.id} className="relative pl-12 pr-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="absolute left-[19px] w-3 h-3 rounded-full bg-intel-accent border-2 border-intel-accent/70" />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-intel-accent font-medium">{event.event_type}</span>
                          {event.location_name && (
                            <span className="text-xs text-gray-500">
                              <MapPin className="w-3 h-3 inline" /> {event.location_name}
                            </span>
                          )}
                        </div>
                        {event.confidence !== undefined && (
                          <span className="text-xs text-gray-600">Confidence: {Math.round(event.confidence * 100)}%</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-600">{formatRelativeTime(event.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-intel-card border border-intel-border rounded-xl">
          <div className="max-h-[500px] overflow-y-auto">
            {profile.alerts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">No alerts for this entity</p>
            ) : (
              <div className="divide-y divide-intel-border/50">
                {profile.alerts.map((alert) => (
                  <div key={alert.id} className="p-4 hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${severityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500">{alert.alert_type}</span>
                      <span className="text-xs text-gray-600 ml-auto">
                        {formatRelativeTime(alert.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-white">{alert.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="bg-intel-card border border-intel-border rounded-xl">
          <div className="max-h-[500px] overflow-y-auto">
            {profile.insights.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">No intelligence insights</p>
            ) : (
              <div className="divide-y divide-intel-border/50">
                {profile.insights.map((insight) => (
                  <div key={insight.id} className="p-4 hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${severityColor(insight.severity)}`}>
                        {insight.severity}
                      </span>
                      <span className="text-xs text-gray-500">{insight.type}</span>
                      <span className="text-xs text-gray-600 ml-auto">
                        {Math.round(insight.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white">{insight.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{insight.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
