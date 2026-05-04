'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Car,
  Eye,
  Shield,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import { streamsApi, entitiesApi, targetsApi, alertsApi } from '@/lib/api';
import type { Stream, Entity, Target, Alert, Detection } from '@/types';
import { formatRelativeTime, cn } from '@/lib/utils';

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
    { label: 'Active Streams', value: activeStreams.length, total: streams.length, icon: Camera, color: 'text-g-accent' },
    { label: 'Entities', value: entities.length, icon: Eye, color: 'text-violet-400' },
    { label: 'Active Targets', value: targets.filter((t) => t.is_active).length, total: targets.length, icon: Shield, color: 'text-emerald-400' },
    { label: 'Unread Alerts', value: unreadAlerts.length, total: alerts.length, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Detections', value: totalDetections, icon: Zap, color: 'text-rose-400' },
    { label: 'Live Tracks', value: realtimeDetections.length, icon: TrendingUp, color: 'text-cyan-400' },
  ];

  return (
    <div className="p-6 pb-14 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Dashboard</h2>
          <p className="text-sm text-g-text-secondary mt-1">Real-time intelligence overview</p>
        </div>
        <button
          onClick={() => onViewChange('live')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-g-text bg-white/[0.05] border border-g-border rounded-md hover:bg-white/[0.08] hover:border-g-border-light transition-all"
        >
          <Activity className="w-4 h-4" />
          Open Live Feed
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-4 bg-g-card border border-g-border rounded-lg hover:border-g-border-light transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn('w-8 h-8 rounded-md flex items-center justify-center bg-white/[0.04]', stat.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                {stat.total !== undefined && (
                  <span className="text-xs text-g-text-dim font-mono">/{stat.total}</span>
                )}
              </div>
              <div className="text-2xl font-semibold text-white tabular-nums">
                {stat.value.toLocaleString()}
              </div>
              <div className="text-xs text-g-text-muted mt-1">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Alerts */}
        <div className="bg-g-card border border-g-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-g-border">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-medium text-g-text">Recent Alerts</h3>
            </div>
            <button
              onClick={() => onViewChange('alerts')}
              className="flex items-center gap-1 text-xs text-g-text-muted hover:text-g-accent transition-colors"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-g-border max-h-[360px] overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-sm text-g-text-muted text-center py-10">No alerts yet</p>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-g-text truncate">{alert.title}</p>
                      <p className="text-xs text-g-text-muted mt-0.5">
                        {formatRelativeTime(alert.created_at)}
                      </p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium ml-2 px-2 py-0.5 rounded-full',
                      alert.severity === 'critical' ? 'text-red-400 bg-red-400/10' :
                      alert.severity === 'high' ? 'text-orange-400 bg-orange-400/10' :
                      alert.severity === 'medium' ? 'text-yellow-400 bg-yellow-400/10' :
                      'text-blue-400 bg-blue-400/10'
                    )}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Streams */}
        <div className="bg-g-card border border-g-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-g-border">
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-g-accent" />
              <h3 className="text-sm font-medium text-g-text">Active Streams</h3>
            </div>
            <button
              onClick={() => onViewChange('streams')}
              className="flex items-center gap-1 text-xs text-g-text-muted hover:text-g-accent transition-colors"
            >
              Manage <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-g-border max-h-[360px] overflow-y-auto">
            {streams.length === 0 ? (
              <p className="text-sm text-g-text-muted text-center py-10">No streams configured</p>
            ) : (
              streams.slice(0, 5).map((stream) => (
                <div
                  key={stream.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    stream.status === 'active' ? 'bg-g-success' : 'bg-g-text-dim'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-g-text truncate">{stream.name}</p>
                    <p className="text-xs text-g-text-muted">
                      {stream.source_type.toUpperCase()} · {stream.total_detections.toLocaleString()} detections
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                    stream.status === 'active' ? 'text-g-success bg-g-success/10' : 'text-g-text-muted bg-white/[0.04]'
                  )}>
                    {stream.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Entities */}
        <div className="bg-g-card border border-g-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-g-border">
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-medium text-g-text">Recent Entities</h3>
            </div>
            <button
              onClick={() => onViewChange('entities')}
              className="flex items-center gap-1 text-xs text-g-text-muted hover:text-g-accent transition-colors"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-g-border max-h-[360px] overflow-y-auto">
            {entities.length === 0 ? (
              <p className="text-sm text-g-text-muted text-center py-10">No entities tracked yet</p>
            ) : (
              entities.slice(0, 5).map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-white/[0.04] rounded-md text-g-text-secondary">
                    {entity.entity_type === 'person' ? <User className="w-4 h-4" /> :
                     entity.entity_type === 'vehicle' ? <Car className="w-4 h-4" /> :
                     <Activity className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-g-text truncate">{entity.label}</p>
                    <p className="text-xs text-g-text-muted">
                      {entity.total_sightings} sightings · {formatRelativeTime(entity.last_seen)}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-g-text-secondary">
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
        <div className="bg-g-card border border-g-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-g-border">
            <Zap className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-medium text-g-text">Live Detection Feed</h3>
            <span className="w-2 h-2 bg-g-danger rounded-full animate-pulse" />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {realtimeDetections.slice(0, 12).map((det, i) => (
                <div
                  key={`${det.entity_id}-${i}`}
                  className="p-3 bg-g-surface border border-g-border rounded-md text-center hover:border-g-border-light transition-all"
                >
                  <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center bg-white/[0.04] rounded-md text-g-text-secondary">
                    {det.entity_type === 'person' ? <User className="w-4 h-4" /> :
                     det.entity_type === 'vehicle' ? <Car className="w-4 h-4" /> :
                     <Activity className="w-4 h-4" />}
                  </div>
                  <p className="text-xs text-g-text truncate capitalize">{det.label}</p>
                  <p className="text-[10px] font-mono text-g-text-muted mt-0.5">
                    {Math.round(det.confidence * 100)}%
                    {det.track_id != null && ` #${det.track_id}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
