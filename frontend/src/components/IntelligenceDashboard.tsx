'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronRight,
  Clock,
  Eye,
  RefreshCw,
  Shield,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { intelligenceApi } from '@/lib/api';
import type { EntityProfile, IntelligenceInsight, BehaviorRecord } from '@/types';
import { formatRelativeTime, severityColor } from '@/lib/utils';

interface IntelligenceDashboardProps {
  onViewChange: (view: string) => void;
}

const riskLevelColor = (level: string) => {
  switch (level) {
    case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
    case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    case 'low': return 'text-green-400 bg-green-500/20 border-green-500/30';
    default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  }
};

export default function IntelligenceDashboard({ onViewChange }: IntelligenceDashboardProps) {
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [insights, setInsights] = useState<IntelligenceInsight[]>([]);
  const [behaviors, setBehaviors] = useState<BehaviorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchData = async () => {
    try {
      const [profs, ins, behs] = await Promise.all([
        intelligenceApi.listProfiles({ limit: 20 }).catch(() => []),
        intelligenceApi.listInsights({ limit: 20 }).catch(() => []),
        intelligenceApi.listBehaviors({ limit: 20 }).catch(() => []),
      ]);
      setProfiles(profs);
      setInsights(ins);
      setBehaviors(behs);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const runBatchAnalysis = async () => {
    setAnalyzing(true);
    try {
      await intelligenceApi.analyzeBatch(3);
      await fetchData();
    } catch {
      // Handle error
    } finally {
      setAnalyzing(false);
    }
  };

  const criticalCount = profiles.filter((p) => p.risk_level === 'critical').length;
  const highCount = profiles.filter((p) => p.risk_level === 'high').length;
  const mediumCount = profiles.filter((p) => p.risk_level === 'medium').length;
  const unreviewed = insights.filter((i) => !i.is_reviewed).length;
  const activeBehaviors = behaviors.filter((b) => b.is_active).length;

  const stats = [
    {
      label: 'Entity Profiles',
      value: profiles.length,
      icon: Brain,
      color: 'text-intel-accent',
      bg: 'bg-intel-accent/10',
    },
    {
      label: 'Critical Risk',
      value: criticalCount,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'High Risk',
      value: highCount,
      icon: Shield,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Active Insights',
      value: unreviewed,
      total: insights.length,
      icon: Zap,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'Active Behaviors',
      value: activeBehaviors,
      total: behaviors.length,
      icon: Activity,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Avg Completeness',
      value: profiles.length > 0
        ? Math.round((profiles.reduce((s, p) => s + p.profile_completeness, 0) / profiles.length) * 100)
        : 0,
      suffix: '%',
      icon: TrendingUp,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-intel-accent" />
            Intelligence Dashboard
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Statistical intelligence analysis and risk assessment
          </p>
        </div>
        <button
          onClick={runBatchAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 bg-intel-accent/20 border border-intel-accent/30 rounded-lg text-sm text-intel-accent hover:bg-intel-accent/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-intel-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
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
                  <div className="text-2xl font-bold text-white">
                    {stat.value}{stat.suffix || ''}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk-Scored Entities */}
            <div className="bg-intel-card border border-intel-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Top Risk Entities</h3>
                <button
                  onClick={() => onViewChange('timeline')}
                  className="text-xs text-intel-accent hover:underline flex items-center gap-1"
                >
                  View Timeline <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-3">
                {profiles.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No entity profiles yet. Run analysis to generate.
                  </p>
                ) : (
                  profiles
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .slice(0, 6)
                    .map((profile) => (
                      <div
                        key={profile.entity_id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-intel-bg/50 border border-intel-border/50"
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          profile.risk_level === 'critical' ? 'bg-red-500' :
                          profile.risk_level === 'high' ? 'bg-orange-500' :
                          profile.risk_level === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {profile.entity_id}
                          </p>
                          <p className="text-xs text-gray-500">
                            {profile.visit_count} visits &middot; {profile.entity_type}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${riskLevelColor(profile.risk_level)}`}>
                            {(profile.risk_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Intelligence Insights */}
            <div className="bg-intel-card border border-intel-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Recent Insights</h3>
                <span className="text-xs text-gray-500">
                  {unreviewed} unreviewed
                </span>
              </div>
              <div className="space-y-3">
                {insights.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No insights generated yet
                  </p>
                ) : (
                  insights.slice(0, 5).map((insight) => (
                    <div
                      key={insight.id}
                      className={`p-3 rounded-lg border ${severityColor(insight.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{insight.title}</p>
                          <p className="text-xs opacity-70 mt-0.5 line-clamp-2">
                            {insight.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs opacity-50">
                              {formatRelativeTime(insight.created_at)}
                            </span>
                            <span className="text-xs opacity-50">
                              {Math.round(insight.confidence * 100)}% confidence
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Behaviors */}
            <div className="bg-intel-card border border-intel-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Detected Behaviors</h3>
              </div>
              <div className="space-y-3">
                {behaviors.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No behaviors detected yet
                  </p>
                ) : (
                  behaviors.slice(0, 6).map((behavior) => (
                    <div
                      key={behavior.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-intel-bg/50 border border-intel-border/50"
                    >
                      <div className={`p-1.5 rounded-lg ${
                        behavior.behavior_type === 'loitering' ? 'bg-orange-500/20' :
                        behavior.behavior_type === 'convoy' ? 'bg-purple-500/20' :
                        behavior.behavior_type === 'repeated_visits' ? 'bg-blue-500/20' :
                        'bg-gray-500/20'
                      }`}>
                        <Activity className={`w-3 h-3 ${
                          behavior.behavior_type === 'loitering' ? 'text-orange-400' :
                          behavior.behavior_type === 'convoy' ? 'text-purple-400' :
                          behavior.behavior_type === 'repeated_visits' ? 'text-blue-400' :
                          'text-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {behavior.behavior_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {behavior.entity_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${severityColor(behavior.severity)}`}>
                          {behavior.severity}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Risk Distribution */}
          {profiles.length > 0 && (
            <div className="bg-intel-card border border-intel-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Risk Distribution</h3>
              <div className="flex items-end gap-1 h-32">
                {[
                  { label: 'Critical', count: criticalCount, color: 'bg-red-500' },
                  { label: 'High', count: highCount, color: 'bg-orange-500' },
                  { label: 'Medium', count: mediumCount, color: 'bg-yellow-500' },
                  { label: 'Low', count: profiles.length - criticalCount - highCount - mediumCount, color: 'bg-green-500' },
                ].map((bar) => {
                  const maxCount = Math.max(criticalCount, highCount, mediumCount, profiles.length - criticalCount - highCount - mediumCount, 1);
                  const heightPercent = (bar.count / maxCount) * 100;
                  return (
                    <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{bar.count}</span>
                      <div className="w-full relative" style={{ height: '80px' }}>
                        <div
                          className={`absolute bottom-0 w-full rounded-t ${bar.color} opacity-70 transition-all duration-500`}
                          style={{ height: `${heightPercent}%`, minHeight: bar.count > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
