'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Car,
  Eye,
  Shield,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import { streamsApi, entitiesApi, targetsApi, alertsApi } from '@/lib/api';
import type { Stream, Entity, Target, Alert, Detection, WSFrameDetections } from '@/types';
import { formatRelativeTime, severityColor } from '@/lib/utils';

interface DashboardProps {
  realtimeDetections: Detection[];
  onViewChange: (view: string) => void;
}

export default function Dashboard({ realtimeDetections, onViewChange }: DashboardProps) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, e, t, a] = await Promise.all([
          streamsApi.list().catch(() => []),
          entitiesApi.list({ limit: 20 }).catch(() => []),
          targetsApi.list().catch(() => []),
          alertsApi.list({ limit: 10 }).catch(() => []),
        ]);
        setStreams(s);
        setEntities(e);
        setTargets(t);
        setAlerts(a);
      } catch {
        // Handle gracefully
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const activeStreams = streams.filter((s) => s.status === 'active');
  const totalDetections = streams.reduce((sum, s) => sum + s.total_detections, 0);
  const unreadAlerts = alerts.filter((a) => !a.is_read);

  const stats = [
    {
      label: 'Active Streams',
      value: activeStreams.length,
      total: streams.length,
      icon: Camera,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Tracked Entities',
      value: entities.length,
      icon: Eye,
      color: 'text-intel-accent',
      bg: 'bg-intel-accent/10',
    },
    {
      label: 'Active Targets',
      value: targets.filter((t) => t.is_active).length,
      total: targets.length,
      icon: Shield,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Unread Alerts',
      value: unreadAlerts.length,
      total: alerts.length,
      icon: AlertTriangle,
      color: 'text-intel-warning',
      bg: 'bg-intel-warning/10',
    },
    {
      label: 'Total Detections',
      value: totalDetections,
      icon: Zap,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'Real-time Tracks',
      value: realtimeDetections.length,
      icon: TrendingUp,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-intel-card border border-intel-border rounded-xl p-4 hover:border-intel-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                {stat.total !== undefined && (
                  <span className="text-xs text-gray-500">/{stat.total}</span>
                )}
              </div>
              <div className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Alerts */}
        <div className="bg-intel-card border border-intel-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
            <button
              onClick={() => onViewChange('alerts')}
              className="text-xs text-intel-accent hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No alerts yet</p>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${severityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <p className="text-xs opacity-70 mt-0.5">
                        {formatRelativeTime(alert.created_at)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold uppercase ml-2">{alert.severity}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Streams */}
        <div className="bg-intel-card border border-intel-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Active Streams</h3>
            <button
              onClick={() => onViewChange('streams')}
              className="text-xs text-intel-accent hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="space-y-3">
            {streams.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No streams configured</p>
            ) : (
              streams.slice(0, 5).map((stream) => (
                <div
                  key={stream.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-intel-bg/50 border border-intel-border/50"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      stream.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{stream.name}</p>
                    <p className="text-xs text-gray-500">
                      {stream.source_type.toUpperCase()} &middot; {stream.total_detections} detections
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{stream.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Entities */}
        <div className="bg-intel-card border border-intel-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Entities</h3>
            <button
              onClick={() => onViewChange('entities')}
              className="text-xs text-intel-accent hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {entities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No entities tracked yet</p>
            ) : (
              entities.slice(0, 5).map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-intel-bg/50 border border-intel-border/50"
                >
                  <div className="w-8 h-8 rounded-lg bg-intel-accent/10 flex items-center justify-center">
                    {entity.entity_type === 'person' ? (
                      <User className="w-4 h-4 text-intel-accent" />
                    ) : entity.entity_type === 'vehicle' ? (
                      <Car className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Activity className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{entity.label}</p>
                    <p className="text-xs text-gray-500">
                      {entity.total_sightings} sightings &middot;{' '}
                      {formatRelativeTime(entity.last_seen)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {Math.round(entity.confidence * 100)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Real-time Detection Feed */}
      {realtimeDetections.length > 0 && (
        <div className="bg-intel-card border border-intel-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">
            Live Detection Feed
            <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {realtimeDetections.slice(0, 12).map((det, i) => (
              <div
                key={`${det.entity_id}-${i}`}
                className="p-2 rounded-lg bg-intel-bg/50 border border-intel-border/50 text-center"
              >
                <div className="text-sm font-medium text-white">{det.label}</div>
                <div className="text-xs text-gray-400">
                  Track #{det.track_id || '?'} &middot; {Math.round(det.confidence * 100)}%
                </div>
                {det.attributes?.color && (
                  <div className="text-xs text-intel-accent mt-1">
                    {String(det.attributes.color)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
