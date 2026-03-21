'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Camera,
  Crosshair,
  Eye,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  Settings,
  User,
  Car,
  Box,
  Zap,
  Clock,
} from 'lucide-react';
import type { Detection, Stream, WSFrameDetections } from '@/types';
import { streamsApi } from '@/lib/api';
import { getStreamWS, WSClient } from '@/lib/websocket';
import { cn, formatRelativeTime } from '@/lib/utils';

interface DetectionOverlayProps {
  detections: Detection[];
  containerWidth: number;
  containerHeight: number;
  sourceWidth: number;
  sourceHeight: number;
}

function DetectionOverlay({
  detections,
  containerWidth,
  containerHeight,
  sourceWidth,
  sourceHeight,
}: DetectionOverlayProps) {
  const scaleX = containerWidth / sourceWidth;
  const scaleY = containerHeight / sourceHeight;

  const getColor = (entityType: string) => {
    switch (entityType) {
      case 'person': return { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' };
      case 'vehicle': return { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' };
      default: return { border: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' };
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {detections.map((det, i) => {
        const [x, y, w, h] = det.bbox;
        const color = getColor(det.entity_type);
        const left = x * scaleX;
        const top = y * scaleY;
        const width = w * scaleX;
        const height = h * scaleY;

        return (
          <div key={`${det.track_id || i}-${det.label}`}>
            {/* Bounding Box */}
            <div
              className="absolute transition-all duration-100"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                border: `2px solid ${color.border}`,
                backgroundColor: color.bg,
              }}
            >
              {/* Corner markers for tactical feel */}
              <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2" style={{ borderColor: color.border }} />
              <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2" style={{ borderColor: color.border }} />
              <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2" style={{ borderColor: color.border }} />
              <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2" style={{ borderColor: color.border }} />
            </div>

            {/* Label */}
            <div
              className="absolute flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
              style={{
                left: `${left}px`,
                top: `${Math.max(0, top - 22)}px`,
                backgroundColor: color.border,
                color: 'white',
              }}
            >
              {det.track_id != null && (
                <span className="opacity-80">#{det.track_id}</span>
              )}
              <span className="uppercase">{det.label}</span>
              <span className="opacity-70">{Math.round(det.confidence * 100)}%</span>
            </div>

            {/* Attributes below box */}
            {det.attributes && Object.keys(det.attributes).length > 0 && (
              <div
                className="absolute text-[9px] font-medium px-1 py-0.5 whitespace-nowrap"
                style={{
                  left: `${left}px`,
                  top: `${top + height + 2}px`,
                  color: color.text,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                }}
              >
                {Object.entries(det.attributes)
                  .filter(([k]) => k !== 'class')
                  .slice(0, 3)
                  .map(([k, v]) => `${String(v)}`)
                  .join(' | ')}
              </div>
            )}
          </div>
        );
      })}

      {/* Crosshair overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-intel-accent/10" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-intel-accent/10" />
      </div>
    </div>
  );
}

interface StreamFeedProps {
  stream: Stream;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function StreamFeed({ stream, isExpanded, onToggleExpand }: StreamFeedProps) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [stats, setStats] = useState({ fps: 0, activeTracts: 0, frameNumber: 0 });
  const [wsClient, setWsClient] = useState<WSClient | null>(null);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stream.status !== 'active') return;

    const client = getStreamWS(stream.id);
    setWsClient(client);

    client.on('connected', () => setConnected(true));
    client.on('disconnected', () => setConnected(false));

    client.on('frame_detections', (data) => {
      const frame = data as unknown as WSFrameDetections;
      setDetections(frame.detections || []);
      setStats({
        fps: frame.fps || 0,
        activeTracts: frame.active_tracks || 0,
        frameNumber: frame.frame_number || 0,
      });
    });

    client.connect();

    return () => {
      client.disconnect();
    };
  }, [stream.id, stream.status]);

  const containerWidth = containerRef.current?.clientWidth || 640;
  const containerHeight = containerRef.current?.clientHeight || 360;

  return (
    <div className={cn(
      'bg-intel-card border border-intel-border rounded-xl overflow-hidden transition-all',
      isExpanded ? 'col-span-full' : ''
    )}>
      {/* Video Area */}
      <div
        ref={containerRef}
        className={cn(
          'relative bg-black overflow-hidden',
          isExpanded ? 'aspect-video' : 'aspect-video'
        )}
      >
        {/* Placeholder / Video feed area */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-intel-bg via-gray-900 to-intel-bg">
          {stream.status === 'active' ? (
            <>
              {/* Simulated feed background */}
              <div className="absolute inset-0 opacity-20">
                <div className="w-full h-full bg-gradient-to-br from-blue-900/20 to-green-900/20" />
              </div>
              <Camera className="w-12 h-12 text-intel-accent/30" />

              {/* Scan line effect */}
              <div className="scanline opacity-20" />

              {/* Detection overlay */}
              <DetectionOverlay
                detections={detections}
                containerWidth={containerWidth}
                containerHeight={containerHeight}
                sourceWidth={stream.width || 640}
                sourceHeight={stream.height || 480}
              />
            </>
          ) : (
            <div className="text-center">
              <Camera className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500 capitalize">{stream.status}</p>
            </div>
          )}
        </div>

        {/* Top bar overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            {stream.status === 'active' && (
              <span className="flex items-center gap-1.5 px-2 py-1 bg-red-600/80 text-white text-[10px] font-bold rounded tracking-wider">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            <span className="text-xs text-white/90 font-medium">{stream.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <span className="flex items-center gap-1 text-[10px] text-intel-accent">
                <Radio className="w-3 h-3" />
                WS
              </span>
            )}
            <button
              onClick={onToggleExpand}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4 text-white/70" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white/70" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom stats bar */}
        {stream.status === 'active' && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-t from-black/70 to-transparent">
            <div className="flex items-center gap-4 text-[10px] text-white/70">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                {stats.fps.toFixed(1)} FPS
              </span>
              <span className="flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-intel-accent" />
                {detections.length} detections
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-blue-400" />
                {stats.activeTracts} tracks
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Frame #{stats.frameNumber}
              </span>
            </div>
            {stream.location_name && (
              <span className="text-[10px] text-white/50">
                {stream.location_name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Detection Summary Panel (when expanded) */}
      {isExpanded && detections.length > 0 && (
        <div className="border-t border-intel-border p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Active Detections ({detections.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {detections.map((det, i) => (
              <div
                key={`${det.track_id || i}`}
                className={cn(
                  'p-2 rounded-lg border text-center',
                  det.entity_type === 'person' ? 'border-purple-500/30 bg-purple-500/5' :
                  det.entity_type === 'vehicle' ? 'border-blue-500/30 bg-blue-500/5' :
                  'border-orange-500/30 bg-orange-500/5'
                )}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {det.entity_type === 'person' ? <User className="w-3 h-3 text-purple-400" /> :
                   det.entity_type === 'vehicle' ? <Car className="w-3 h-3 text-blue-400" /> :
                   <Box className="w-3 h-3 text-orange-400" />}
                  <span className="text-xs font-medium text-white">{det.label}</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {det.track_id != null && `#${det.track_id} · `}
                  {Math.round(det.confidence * 100)}%
                </div>
                {det.attributes?.color && (
                  <div className="text-[10px] text-intel-accent mt-0.5 capitalize">
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

export default function LiveFeedView() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const data = await streamsApi.list();
        setStreams(data);
      } catch {
        // Handle gracefully
      } finally {
        setLoading(false);
      }
    };
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeStreams = streams.filter(s => s.status === 'active');
  const inactiveStreams = streams.filter(s => s.status !== 'active');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="w-6 h-6 text-intel-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Live Intelligence Feed</h2>
          <p className="text-sm text-gray-400 mt-1">
            Real-time object detection and tracking across all active streams
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-intel-accent">
            <Radio className="w-4 h-4" />
            {activeStreams.length} active
          </span>
          <span className="text-gray-500">
            {inactiveStreams.length} inactive
          </span>
        </div>
      </div>

      {activeStreams.length === 0 && inactiveStreams.length === 0 ? (
        <div className="text-center py-20">
          <Camera className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No streams available</p>
          <p className="text-sm text-gray-500 mt-1">
            Go to Streams to add and configure video sources
          </p>
        </div>
      ) : (
        <>
          {/* Active Streams Grid */}
          {activeStreams.length > 0 && (
            <div className={cn(
              'grid gap-4',
              activeStreams.length === 1 ? 'grid-cols-1' :
              activeStreams.length <= 4 ? 'grid-cols-1 md:grid-cols-2' :
              'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            )}>
              {activeStreams.map((stream) => (
                <StreamFeed
                  key={stream.id}
                  stream={stream}
                  isExpanded={expandedStream === stream.id}
                  onToggleExpand={() =>
                    setExpandedStream(expandedStream === stream.id ? null : stream.id)
                  }
                />
              ))}
            </div>
          )}

          {/* Inactive streams as smaller cards */}
          {inactiveStreams.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Inactive Streams</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {inactiveStreams.map((stream) => (
                  <div
                    key={stream.id}
                    className="bg-intel-card border border-intel-border/50 rounded-lg p-3 opacity-60"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-gray-600" />
                      <span className="text-xs text-gray-400 truncate">{stream.name}</span>
                    </div>
                    <p className="text-[10px] text-gray-600 capitalize">{stream.status}</p>
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
