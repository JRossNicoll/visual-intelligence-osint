'use client';

import { useState, useEffect, useRef } from 'react';
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
import { formatRelativeTime, severityColor, cn } from '@/lib/utils';

interface DashboardProps {
  realtimeDetections: Detection[];
  onViewChange: (view: string) => void;
}

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();
    let rafId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    prevValue.current = value;

    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  return <>{displayValue.toLocaleString()}</>;
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
    { label: 'Active Streams', value: activeStreams.length, total: streams.length, icon: Camera, color: 'text-blue-400' },
    { label: 'Tracked Entities', value: entities.length, icon: Eye, color: 'text-intel-accent' },
    { label: 'Active Targets', value: targets.filter((t) => t.is_active).length, total: targets.length, icon: Shield, color: 'text-purple-400' },
    { label: 'Unread Alerts', value: unreadAlerts.length, total: alerts.length, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Total Detections', value: totalDetections, icon: Zap, color: 'text-yellow-400' },
    { label: 'Real-time Tracks', value: realtimeDetections.length, icon: TrendingUp, color: 'text-cyan-400' },
  ];

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Command Center</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Real-time intelligence overview</p>
        </div>
        <button
          onClick={() => onViewChange('live')}
          className="flex items-center gap-2 px-4 py-2 text-intel-accent text-sm font-medium rounded-lg border border-intel-accent/20 hover:bg-intel-accent/5 transition-colors"
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
              className="rounded-xl p-4 bg-intel-card border border-intel-border hover:border-intel-border-light transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-1.5 rounded-lg bg-white/[0.04]">
                  <Icon className={cn('w-4 h-4', stat.color)} />
                </div>
                {stat.total !== undefined && (
                  <span className="text-[10px] text-zinc-600 font-mono">/{stat.total}</span>
                )}
              </div>
              <div className="text-2xl font-semibold text-white tabular-nums">
                <AnimatedCounter value={stat.value} />
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Alerts */}
        <div className="rounded-xl bg-intel-card border border-intel-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-intel-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-medium text-white">Recent Alerts</h3>
            </div>
            <button
              onClick={() => onViewChange('alerts')}
              className="flex items-center gap-1 text-xs text-intel-accent hover:text-intel-accent-dim transition-colors"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-1 max-h-[360px] overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">No alerts yet</p>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-300 truncate">{alert.title}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {formatRelativeTime(alert.created_at)}
                      </p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium uppercase ml-2 px-1.5 py-0.5 rounded',
                      alert.severity === 'critical' ? 'text-red-400 bg-red-500/10' :
                      alert.severity === 'high' ? 'text-orange-400 bg-orange-500/10' :
                      alert.severity === 'medium' ? 'text-yellow-400 bg-yellow-500/10' :
                      'text-blue-400 bg-blue-500/10'
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
        <div className="rounded-xl bg-intel-card border border-intel-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-intel-border">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium text-white">Active Streams</h3>
            </div>
            <button
              onClick={() => onViewChange('streams')}
              className="flex items-center gap-1 text-xs text-intel-accent hover:text-intel-accent-dim transition-colors"
            >
              Manage <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-1 max-h-[360px] overflow-y-auto">
            {streams.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">No streams configured</p>
            ) : (
              streams.slice(0, 5).map((stream) => (
                <div
                  key={stream.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    stream.status === 'active' ? 'bg-green-400' : 'bg-zinc-600'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-300 truncate">{stream.name}</p>
                    <p className="text-[11px] text-zinc-600">
                      {stream.source_type.toUpperCase()} &middot; {stream.total_detections.toLocaleString()} detections
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium capitalize px-1.5 py-0.5 rounded',
                    stream.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'
                  )}>
                    {stream.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Entities */}
        <div className="rounded-xl bg-intel-card border border-intel-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-intel-border">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-intel-accent" />
              <h3 className="text-sm font-medium text-white">Recent Entities</h3>
            </div>
            <button
              onClick={() => onViewChange('entities')}
              className="flex items-center gap-1 text-xs text-intel-accent hover:text-intel-accent-dim transition-colors"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-1 max-h-[360px] overflow-y-auto">
            {entities.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">No entities tracked yet</p>
            ) : (
              entities.slice(0, 5).map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    entity.entity_type === 'person' ? 'bg-purple-500/10 text-purple-400' :
                    entity.entity_type === 'vehicle' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-orange-500/10 text-orange-400'
                  )}>
                    {entity.entity_type === 'person' ? <User className="w-3.5 h-3.5" /> :
                     entity.entity_type === 'vehicle' ? <Car className="w-3.5 h-3.5" /> :
                     <Activity className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-300 truncate">{entity.label}</p>
                    <p className="text-[11px] text-zinc-600">
                      {entity.total_sightings} sightings &middot; {formatRelativeTime(entity.last_seen)}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-intel-accent">
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
        <div className="rounded-xl bg-intel-card border border-intel-border overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-intel-border">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-medium text-white">Live Detection Feed</h3>
            <span className="flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {realtimeDetections.slice(0, 12).map((det, i) => (
                <div
                  key={`${det.entity_id}-${i}`}
                  className="p-3 rounded-lg border border-intel-border text-center hover:border-intel-border-light transition-colors"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center',
                    det.entity_type === 'person' ? 'bg-purple-500/10 text-purple-400' :
                    det.entity_type === 'vehicle' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-orange-500/10 text-orange-400'
                  )}>
                    {det.entity_type === 'person' ? <User className="w-3.5 h-3.5" /> :
                     det.entity_type === 'vehicle' ? <Car className="w-3.5 h-3.5" /> :
                     <Activity className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-[11px] font-medium text-zinc-300 truncate capitalize">{det.label}</p>
                  <p className="text-[10px] text-zinc-600 font-mono">
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
