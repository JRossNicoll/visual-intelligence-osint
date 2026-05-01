'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
    {
      label: 'Active Streams',
      value: activeStreams.length,
      total: streams.length,
      icon: Camera,
      color: 'text-blue-400',
      bgGradient: 'from-blue-500/20 to-blue-600/5',
      borderColor: 'border-blue-500/20',
      glowColor: 'shadow-[0_0_15px_rgba(59,130,246,0.1)]',
    },
    {
      label: 'Tracked Entities',
      value: entities.length,
      icon: Eye,
      color: 'text-intel-accent',
      bgGradient: 'from-emerald-500/20 to-emerald-600/5',
      borderColor: 'border-emerald-500/20',
      glowColor: 'shadow-glow-sm',
    },
    {
      label: 'Active Targets',
      value: targets.filter((t) => t.is_active).length,
      total: targets.length,
      icon: Shield,
      color: 'text-purple-400',
      bgGradient: 'from-purple-500/20 to-purple-600/5',
      borderColor: 'border-purple-500/20',
      glowColor: 'shadow-[0_0_15px_rgba(168,85,247,0.1)]',
    },
    {
      label: 'Unread Alerts',
      value: unreadAlerts.length,
      total: alerts.length,
      icon: AlertTriangle,
      color: 'text-intel-warning',
      bgGradient: 'from-orange-500/20 to-orange-600/5',
      borderColor: 'border-orange-500/20',
      glowColor: 'shadow-[0_0_15px_rgba(255,107,53,0.1)]',
    },
    {
      label: 'Total Detections',
      value: totalDetections,
      icon: Zap,
      color: 'text-yellow-400',
      bgGradient: 'from-yellow-500/20 to-yellow-600/5',
      borderColor: 'border-yellow-500/20',
      glowColor: 'shadow-[0_0_15px_rgba(250,204,21,0.1)]',
    },
    {
      label: 'Real-time Tracks',
      value: realtimeDetections.length,
      icon: TrendingUp,
      color: 'text-cyan-400',
      bgGradient: 'from-cyan-500/20 to-cyan-600/5',
      borderColor: 'border-cyan-500/20',
      glowColor: 'shadow-[0_0_15px_rgba(6,182,212,0.1)]',
    },
  ];

  const staggerChildren = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Command Center</h2>
          <p className="text-sm text-gray-500 mt-0.5">Real-time intelligence overview</p>
        </div>
        <button
          onClick={() => onViewChange('live')}
          className="flex items-center gap-2 px-4 py-2 bg-intel-accent/10 text-intel-accent text-sm font-medium rounded-xl border border-intel-accent/20 hover:bg-intel-accent/20 hover:shadow-glow-sm transition-all"
        >
          <Activity className="w-4 h-4" />
          Open Live Feed
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats Grid */}
      <motion.div
        variants={staggerChildren}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              className={cn(
                'glass-card glass-card-hover rounded-xl p-4 relative overflow-hidden group cursor-default',
                stat.glowColor
              )}
            >
              <div className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-50',
                stat.bgGradient
              )} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('p-2 rounded-lg bg-white/[0.06]', stat.borderColor, 'border')}>
                    <Icon className={cn('w-4 h-4', stat.color)} />
                  </div>
                  {stat.total !== undefined && (
                    <span className="text-[10px] text-gray-500 font-mono">/{stat.total}</span>
                  )}
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-[11px] text-gray-400 mt-1 font-medium">{stat.label}</div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-intel-border/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-intel-warning" />
              <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
            </div>
            <button
              onClick={() => onViewChange('alerts')}
              className="flex items-center gap-1 text-xs text-intel-accent hover:text-intel-accent-dim transition-colors font-medium"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-1.5 max-h-[360px] overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No alerts yet</p>
            ) : (
              alerts.slice(0, 5).map((alert, i) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'p-3 rounded-lg border transition-colors cursor-default',
                    severityColor(alert.severity)
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <p className="text-[11px] opacity-60 mt-0.5">
                        {formatRelativeTime(alert.created_at)}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase ml-2 opacity-80">
                      {alert.severity}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Active Streams */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-intel-border/30">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Active Streams</h3>
            </div>
            <button
              onClick={() => onViewChange('streams')}
              className="flex items-center gap-1 text-xs text-intel-accent hover:text-intel-accent-dim transition-colors font-medium"
            >
              Manage <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-1.5 max-h-[360px] overflow-y-auto">
            {streams.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No streams configured</p>
            ) : (
              streams.slice(0, 5).map((stream, i) => (
                <motion.div
                  key={stream.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-intel-border/20 hover:border-intel-border/40 transition-colors"
                >
                  <div className="relative">
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        stream.status === 'active'
                          ? 'bg-green-400'
                          : 'bg-gray-600'
                      )}
                    />
                    {stream.status === 'active' && (
                      <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{stream.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {stream.source_type.toUpperCase()} &middot; {stream.total_detections.toLocaleString()} detections
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium capitalize px-2 py-0.5 rounded-md',
                    stream.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'
                  )}>
                    {stream.status}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Recent Entities */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-intel-border/30">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-intel-accent" />
              <h3 className="text-sm font-semibold text-white">Recent Entities</h3>
            </div>
            <button
              onClick={() => onViewChange('entities')}
              className="flex items-center gap-1 text-xs text-intel-accent hover:text-intel-accent-dim transition-colors font-medium"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 space-y-1.5 max-h-[360px] overflow-y-auto">
            {entities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No entities tracked yet</p>
            ) : (
              entities.slice(0, 5).map((entity, i) => (
                <motion.div
                  key={entity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-intel-border/20 hover:border-intel-border/40 transition-colors"
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    entity.entity_type === 'person'
                      ? 'bg-purple-500/10 text-purple-400'
                      : entity.entity_type === 'vehicle'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-orange-500/10 text-orange-400'
                  )}>
                    {entity.entity_type === 'person' ? (
                      <User className="w-4 h-4" />
                    ) : entity.entity_type === 'vehicle' ? (
                      <Car className="w-4 h-4" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{entity.label}</p>
                    <p className="text-[11px] text-gray-500">
                      {entity.total_sightings} sightings &middot; {formatRelativeTime(entity.last_seen)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-intel-accent">
                      {Math.round(entity.confidence * 100)}%
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Real-time Detection Feed */}
      {realtimeDetections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-5 py-4 border-b border-intel-border/30">
            <div className="relative">
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">
              Live Detection Feed
            </h3>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {realtimeDetections.slice(0, 12).map((det, i) => (
                <div
                  key={`${det.entity_id}-${i}`}
                  className="p-3 rounded-lg bg-white/[0.02] border border-intel-border/20 text-center hover:border-intel-border/40 transition-colors"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center',
                    det.entity_type === 'person'
                      ? 'bg-purple-500/10 text-purple-400'
                      : det.entity_type === 'vehicle'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-orange-500/10 text-orange-400'
                  )}>
                    {det.entity_type === 'person' ? (
                      <User className="w-3.5 h-3.5" />
                    ) : det.entity_type === 'vehicle' ? (
                      <Car className="w-3.5 h-3.5" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-white truncate capitalize">
                    {det.label}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    {Math.round(det.confidence * 100)}%
                    {det.track_id != null && ` #${det.track_id}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
