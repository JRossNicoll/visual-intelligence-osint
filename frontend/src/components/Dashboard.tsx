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
    { label: 'Active_Streams', value: activeStreams.length, total: streams.length, icon: Camera },
    { label: 'Tracked_Entities', value: entities.length, icon: Eye },
    { label: 'Active_Targets', value: targets.filter((t) => t.is_active).length, total: targets.length, icon: Shield },
    { label: 'Unread_Alerts', value: unreadAlerts.length, total: alerts.length, icon: AlertTriangle },
    { label: 'Total_Detections', value: totalDetections, icon: Zap },
    { label: 'Realtime_Tracks', value: realtimeDetections.length, icon: TrendingUp },
  ];

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-white">Record Queue</h2>
          <p className="text-[11px] font-mono text-zinc-600 mt-1 uppercase tracking-wider">
            Real-time intelligence overview
          </p>
        </div>
        <button
          onClick={() => onViewChange('live')}
          className="flex items-center gap-2 px-4 py-1.5 text-zinc-300 text-[11px] font-mono uppercase tracking-wider border border-intel-border hover:border-intel-border-light hover:text-white transition-colors"
        >
          <Activity className="w-3.5 h-3.5" />
          Open Live Feed
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-intel-border">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-4 bg-intel-card hover:bg-intel-card-hover transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-4 h-4 text-zinc-500" />
                {stat.total !== undefined && (
                  <span className="text-[9px] font-mono text-zinc-600 uppercase">/{stat.total}</span>
                )}
              </div>
              <div className="text-2xl font-light text-white tabular-nums font-mono">
                <AnimatedCounter value={stat.value} />
              </div>
              <div className="text-[10px] font-mono text-zinc-600 mt-1 uppercase tracking-wider">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-intel-border">
        {/* Recent Alerts */}
        <div className="bg-intel-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-intel-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-300">Recent Alerts</h3>
            </div>
            <button
              onClick={() => onViewChange('alerts')}
              className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 uppercase tracking-wider transition-colors"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-intel-border max-h-[360px] overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-[11px] font-mono text-zinc-600 text-center py-8">No alerts yet</p>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 truncate">{alert.title}</p>
                      <p className="text-[10px] font-mono text-zinc-600 mt-0.5">
                        {formatRelativeTime(alert.created_at)}
                      </p>
                    </div>
                    <span className={cn(
                      'text-[9px] font-mono uppercase ml-2 px-1.5 py-0.5 border',
                      alert.severity === 'critical' ? 'text-red-400 border-red-500/20' :
                      alert.severity === 'high' ? 'text-orange-400 border-orange-500/20' :
                      alert.severity === 'medium' ? 'text-yellow-400 border-yellow-500/20' :
                      'text-blue-400 border-blue-500/20'
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
        <div className="bg-intel-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-intel-border">
            <div className="flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-300">Active Streams</h3>
            </div>
            <button
              onClick={() => onViewChange('streams')}
              className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 uppercase tracking-wider transition-colors"
            >
              Manage <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-intel-border max-h-[360px] overflow-y-auto">
            {streams.length === 0 ? (
              <p className="text-[11px] font-mono text-zinc-600 text-center py-8">No streams configured</p>
            ) : (
              streams.slice(0, 5).map((stream) => (
                <div
                  key={stream.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className={cn(
                    'w-1.5 h-1.5',
                    stream.status === 'active' ? 'bg-green-500' : 'bg-zinc-600'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{stream.name}</p>
                    <p className="text-[10px] font-mono text-zinc-600">
                      {stream.source_type.toUpperCase()} &middot; {stream.total_detections.toLocaleString()} det
                    </p>
                  </div>
                  <span className={cn(
                    'text-[9px] font-mono uppercase px-1.5 py-0.5 border',
                    stream.status === 'active' ? 'border-green-500/20 text-green-400' : 'border-intel-border text-zinc-600'
                  )}>
                    {stream.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Entities */}
        <div className="bg-intel-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-intel-border">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-300">Recent Entities</h3>
            </div>
            <button
              onClick={() => onViewChange('entities')}
              className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 uppercase tracking-wider transition-colors"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-intel-border max-h-[360px] overflow-y-auto">
            {entities.length === 0 ? (
              <p className="text-[11px] font-mono text-zinc-600 text-center py-8">No entities tracked yet</p>
            ) : (
              entities.slice(0, 5).map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-6 h-6 flex items-center justify-center border border-intel-border">
                    {entity.entity_type === 'person' ? <User className="w-3 h-3 text-zinc-500" /> :
                     entity.entity_type === 'vehicle' ? <Car className="w-3 h-3 text-zinc-500" /> :
                     <Activity className="w-3 h-3 text-zinc-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{entity.label}</p>
                    <p className="text-[10px] font-mono text-zinc-600">
                      {entity.total_sightings} sightings &middot; {formatRelativeTime(entity.last_seen)}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">
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
        <div className="bg-intel-card border border-intel-border overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-intel-border">
            <Zap className="w-3.5 h-3.5 text-zinc-500" />
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-300">Live Detection Feed</h3>
            <span className="w-1.5 h-1.5 bg-red-500 animate-pulse" />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-intel-border">
              {realtimeDetections.slice(0, 12).map((det, i) => (
                <div
                  key={`${det.entity_id}-${i}`}
                  className="p-3 bg-intel-card text-center hover:bg-intel-card-hover transition-colors"
                >
                  <div className="w-6 h-6 mx-auto mb-2 flex items-center justify-center border border-intel-border">
                    {det.entity_type === 'person' ? <User className="w-3 h-3 text-zinc-500" /> :
                     det.entity_type === 'vehicle' ? <Car className="w-3 h-3 text-zinc-500" /> :
                     <Activity className="w-3 h-3 text-zinc-500" />}
                  </div>
                  <p className="text-[10px] text-zinc-300 truncate capitalize">{det.label}</p>
                  <p className="text-[9px] font-mono text-zinc-600">
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
