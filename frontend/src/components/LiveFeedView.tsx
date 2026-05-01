'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  Grid3X3,
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
      case 'person': return { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7' };
      case 'vehicle': return { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' };
      default: return { border: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316' };
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
              className="absolute transition-all duration-75"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                border: `1.5px solid ${color.border}`,
                backgroundColor: color.bg,
                borderRadius: '2px',
              }}
            >
              {/* Corner markers */}
              <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2" style={{ borderColor: color.border }} />
              <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2" style={{ borderColor: color.border }} />
              <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2" style={{ borderColor: color.border }} />
              <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2" style={{ borderColor: color.border }} />
            </div>

            {/* Label */}
            <div
              className="absolute flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold tracking-wide rounded-sm"
              style={{
                left: `${left}px`,
                top: `${Math.max(0, top - 20)}px`,
                backgroundColor: color.border,
                color: 'white',
              }}
            >
              {det.track_id != null && (
                <span className="opacity-70">#{det.track_id}</span>
              )}
              <span className="uppercase">{det.label}</span>
              <span className="opacity-60">{Math.round(det.confidence * 100)}%</span>
            </div>

            {/* Attributes */}
            {det.attributes && Object.keys(det.attributes).length > 0 && (
              <div
                className="absolute text-[8px] font-medium px-1 py-0.5 whitespace-nowrap rounded-sm"
                style={{
                  left: `${left}px`,
                  top: `${top + height + 2}px`,
                  color: color.text,
                  backgroundColor: 'rgba(0,0,0,0.75)',
                }}
              >
                {Object.entries(det.attributes)
                  .filter(([k]) => k !== 'class')
                  .slice(0, 3)
                  .map(([, v]) => `${String(v)}`)
                  .join(' | ')}
              </div>
            )}
          </div>
        );
      })}

      {/* Crosshair overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-intel-accent/5" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-intel-accent/5" />
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
  const [stats, setStats] = useState({ fps: 0, activeTracks: 0, frameNumber: 0 });
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
        activeTracks: frame.active_tracks || 0,
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
      'glass-card rounded-xl overflow-hidden transition-all',
      isExpanded ? 'col-span-full' : ''
    )}>
      {/* Video Area */}
      <div
        ref={containerRef}
        className="relative bg-black overflow-hidden aspect-video"
      >
        {/* Placeholder / Video feed area */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-intel-bg via-gray-900 to-intel-bg">
          {stream.status === 'active' ? (
            <>
              <div className="absolute inset-0 opacity-15">
                <div className="w-full h-full bg-gradient-to-br from-blue-900/20 to-green-900/20" />
              </div>
              <Camera className="w-12 h-12 text-intel-accent/20" />
              <div className="scanline opacity-15" />
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
              <Camera className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-600 capitalize">{stream.status}</p>
            </div>
          )}
        </div>

        {/* Top bar overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            {stream.status === 'active' && (
              <span className="flex items-center gap-1.5 px-2 py-1 bg-red-600/80 text-white text-[9px] font-bold rounded-md tracking-widest backdrop-blur-sm">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            <span className="text-xs text-white/80 font-medium">{stream.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <span className="flex items-center gap-1 text-[9px] text-intel-accent font-mono">
                <Radio className="w-3 h-3" />
                WS
              </span>
            )}
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5 text-white/60" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-white/60" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom stats bar */}
        {stream.status === 'active' && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-t from-black/70 to-transparent">
            <div className="flex items-center gap-4 text-[10px] text-white/60 font-mono">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                {stats.fps.toFixed(1)} FPS
              </span>
              <span className="flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-intel-accent" />
                {detections.length} det
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-blue-400" />
                {stats.activeTracks} tracks
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                #{stats.frameNumber}
              </span>
            </div>
            {stream.location_name && (
              <span className="text-[9px] text-white/40 font-mono">
                {stream.location_name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Detection Summary Panel (when expanded) */}
      {isExpanded && detections.length > 0 && (
        <div className="p-4 border-t border-intel-border/20">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair className="w-3.5 h-3.5 text-intel-accent" />
            <span className="text-xs font-semibold text-white">Active Detections</span>
            <span className="text-[10px] text-gray-500 font-mono">({detections.length})</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {detections.slice(0, 12).map((det, i) => (
              <div
                key={`${det.track_id || i}`}
                className="p-2 rounded-lg bg-white/[0.02] border border-intel-border/15 text-center"
              >
                <div className={cn(
                  'w-6 h-6 rounded mx-auto mb-1 flex items-center justify-center',
                  det.entity_type === 'person' ? 'bg-purple-500/10 text-purple-400' :
                  det.entity_type === 'vehicle' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-orange-500/10 text-orange-400'
                )}>
                  {det.entity_type === 'person' ? <User className="w-3 h-3" /> :
                   det.entity_type === 'vehicle' ? <Car className="w-3 h-3" /> :
                   <Box className="w-3 h-3" />}
                </div>
                <p className="text-[10px] text-white truncate capitalize">{det.label}</p>
                <p className="text-[9px] text-gray-500 font-mono">
                  {Math.round(det.confidence * 100)}%
                </p>
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
  const [loading, setLoading] = useState(true);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);

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

  const activeStreams = streams.filter((s) => s.status === 'active');
  const inactiveStreams = streams.filter((s) => s.status !== 'active');

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Live Feed</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time video streams with detection overlays
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="relative">
              <Camera className="w-4 h-4" />
              {activeStreams.length > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
            </div>
            <span className="font-mono">{activeStreams.length}</span> active
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Camera className="w-5 h-5 animate-pulse mr-2" />
          <span className="text-sm">Loading streams...</span>
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-intel-card flex items-center justify-center mx-auto mb-4 border border-intel-border/30">
            <Camera className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No video streams available</p>
          <p className="text-sm text-gray-600 mt-1">Configure streams to start live monitoring</p>
        </div>
      ) : (
        <>
          {/* Active Streams */}
          {activeStreams.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Active Streams
              </h3>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  'grid gap-4',
                  expandedStream ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
                )}
              >
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
              </motion.div>
            </div>
          )}

          {/* Inactive Streams */}
          {inactiveStreams.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Inactive Streams
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveStreams.map((stream) => (
                  <StreamFeed
                    key={stream.id}
                    stream={stream}
                    isExpanded={false}
                    onToggleExpand={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
