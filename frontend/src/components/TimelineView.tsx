'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  Search,
  Users,
} from 'lucide-react';
import { intelligenceApi } from '@/lib/api';
import type { TemporalEvent, EntityProfile } from '@/types';
import { formatTimestamp, formatRelativeTime, severityColor } from '@/lib/utils';

interface TimelineViewProps {
  onSelectEntity?: (entityId: string) => void;
}

export default function TimelineView({ onSelectEntity }: TimelineViewProps) {
  const [events, setEvents] = useState<TemporalEvent[]>([]);
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [evts, profs] = await Promise.all([
          intelligenceApi.listEvents({ limit: 200 }).catch(() => []),
          intelligenceApi.listProfiles({ limit: 50 }).catch(() => []),
        ]);
        setEvents(evts);
        setProfiles(profs);
      } catch {
        // API may not be available
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = selectedEntity
    ? events.filter((e) => e.entity_id === selectedEntity)
    : events;

  // Group events by date
  const groupedEvents = filteredEvents.reduce<Record<string, TemporalEvent[]>>((acc, event) => {
    const date = new Date(event.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

  const toggleGroup = (date: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-intel-accent" />
            Activity Timeline
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Temporal event history across all entities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="pl-9 pr-4 py-2 bg-intel-card border border-intel-border rounded-lg text-sm text-white focus:outline-none focus:border-intel-accent"
            >
              <option value="">All Entities</option>
              {profiles.map((p) => (
                <option key={p.entity_id} value={p.entity_id}>
                  {p.entity_id} ({p.entity_type})
                </option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-500">
            {filteredEvents.length} events
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-intel-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-20">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No temporal events recorded yet</p>
          <p className="text-sm text-gray-600 mt-1">
            Events are generated as the intelligence engine processes detections
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedEvents)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([date, dateEvents]) => {
              const isExpanded = expandedGroups.has(date) || expandedGroups.size === 0;
              return (
                <div
                  key={date}
                  className="bg-intel-card border border-intel-border rounded-xl overflow-hidden"
                >
                  {/* Date Header */}
                  <button
                    onClick={() => toggleGroup(date)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-intel-accent" />
                      <span className="text-sm font-semibold text-white">{date}</span>
                      <span className="text-xs text-gray-500 px-2 py-0.5 bg-intel-bg rounded-full">
                        {dateEvents.length} events
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Events List */}
                  {isExpanded && (
                    <div className="border-t border-intel-border">
                      {dateEvents.map((event, idx) => (
                        <div
                          key={event.id}
                          className={`flex items-start gap-4 px-4 py-3 hover:bg-white/5 transition-colors ${
                            idx < dateEvents.length - 1 ? 'border-b border-intel-border/50' : ''
                          }`}
                        >
                          {/* Timeline Line */}
                          <div className="flex flex-col items-center pt-1">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                event.event_type === 'anomaly'
                                  ? 'bg-red-500'
                                  : event.event_type === 'appearance'
                                  ? 'bg-intel-accent'
                                  : 'bg-blue-500'
                              }`}
                            />
                            {idx < dateEvents.length - 1 && (
                              <div className="w-px h-full bg-intel-border mt-1" />
                            )}
                          </div>

                          {/* Event Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {event.entity_id}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  event.event_type === 'anomaly'
                                    ? 'bg-red-500/20 text-red-400'
                                    : event.event_type === 'appearance'
                                    ? 'bg-intel-accent/20 text-intel-accent'
                                    : 'bg-blue-500/20 text-blue-400'
                                }`}
                              >
                                {event.event_type}
                              </span>
                              {event.is_weekend && (
                                <span className="text-xs text-gray-500">Weekend</span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </span>
                              {event.location_name && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.location_name}
                                </span>
                              )}
                              <span>
                                {dayNames[event.day_of_week]} @ {event.hour_of_day}:00
                              </span>
                              {event.co_occurring_entities && event.co_occurring_entities.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {event.co_occurring_entities.length} co-occurring
                                </span>
                              )}
                            </div>

                            {event.duration_seconds && (
                              <div className="text-xs text-gray-500 mt-1">
                                Duration: {Math.round(event.duration_seconds)}s
                              </div>
                            )}
                          </div>

                          {/* Confidence */}
                          <div className="text-right">
                            <span className="text-xs text-gray-400">
                              {Math.round(event.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
