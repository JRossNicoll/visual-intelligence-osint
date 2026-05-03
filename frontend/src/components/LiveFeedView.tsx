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
      case 'person': return { border: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.08)', text: '#a1a1aa' };
      case 'vehicle': return { border: '#71717a', bg: 'rgba(113, 113, 122, 0.08)', text: '#71717a' };
      default: return { border: '#52525b', bg: 'rgba(82, 82, 91, 0.08)', text: '#52525b' };
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
                border: `1px solid ${color.border}`,
                backgroundColor: color.bg,
              }}
            >
              {/* Corner markers */}
              <div className="absolute -top-px -left-px w-2 h-2 border-t border-l" style={{ borderColor: color.border }} />
              <div className="absolute -top-px -right-px w-2 h-2 border-t border-r" style={{ borderColor: color.border }} />
              <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l" style={{ borderColor: color.border }} />
              <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r" style={{ borderColor: color.border }} />
            </div>

            {/* Label */}
            <div
              className="absolute flex items-center gap-1 px-1 py-0.5 text-[8px] font-mono font-bold tracking-wider uppercase"
              style={{
                left: `${left}px`,
                top: `${Math.max(0, top - 16)}px`,
                backgroundColor: color.border,
                color: '#0a0a0a',
              }}
            >
              {det.track_id != null && (
                <span className="opacity-70">#{det.track_id}</span>
              )}
              <span>{det.label}</span>
              <span className="opacity-60">{Math.round(det.confidence * 100)}%</span>
            </div>

            {/* Attributes */}
            {det.attributes && Object.keys(det.attributes).length > 0 && (
              <div
                className="absolute text-[7px] font-mono px-1 py-0.5 whitespace-nowrap"
                style={{
                  left: `${left}px`,
                  top: `${top + height + 2}px`,
                  color: color.text,
                  backgroundColor: 'rgba(10,10,10,0.85)',
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
        <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-600/10" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-zinc-600/10" />
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
      'border border-intel-border overflow-hidden transition-all',
      isExpanded ? 'col-span-full' : ''
    )}>
      {/* Video Area */}
      <div
        ref={containerRef}
        className="relative bg-black overflow-hidden aspect-video"
      >
        <div className="absolute inset-0 flex items-center justify-center bg-intel-bg">
          {stream.status === 'active' ? (
            <>
              <Camera className="w-10 h-10 text-zinc-900" />
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
              <Camera className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
              <p className="text-[10px] font-mono text-zinc-700 uppercase">{stream.status}</p>
            </div>
          )}
        </div>

        {/* Top bar overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            {stream.status === 'active' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-600/80 text-white text-[8px] font-mono font-bold uppercase tracking-widest">
                <span className="w-1 h-1 bg-white animate-pulse" />
                LIVE
              </span>
            )}
            <span className="text-[10px] text-white/70 font-mono">{stream.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <span className="flex items-center gap-1 text-[8px] text-green-400 font-mono uppercase">
                <Radio className="w-2.5 h-2.5" />
                WS
              </span>
            )}
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-white/10 transition-colors"
            >
              {isExpanded ? (
                <Minimize2 className="w-3 h-3 text-white/50" />
              ) : (
                <Maximize2 className="w-3 h-3 text-white/50" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom stats bar */}
        {stream.status === 'active' && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center gap-3 text-[9px] text-white/50 font-mono uppercase">
              <span>{stats.fps.toFixed(1)}_fps</span>
              <span>{detections.length}_det</span>
              <span>{stats.activeTracks}_trk</span>
              <span>#{stats.frameNumber}</span>
            </div>
            {stream.location_name && (
              <span className="text-[8px] text-white/30 font-mono uppercase">
                {stream.location_name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Detection Summary Panel (when expanded) */}
      {isExpanded && detections.length > 0 && (
        <div className="p-3 border-t border-intel-border">
          <div className="flex items-center gap-2 mb-2">
            <Crosshair className="w-3 h-3 text-zinc-500" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Active Detections</span>
            <span className="text-[9px] font-mono text-zinc-600">({detections.length})</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-intel-border">
            {detections.slice(0, 12).map((det, i) => (
              <div
                key={`${det.track_id || i}`}
                className="p-2 bg-intel-card text-center"
              >
                <div className="w-5 h-5 mx-auto mb-1 flex items-center justify-center border border-intel-border">
                  {det.entity_type === 'person' ? <User className="w-2.5 h-2.5 text-zinc-500" /> :
                   det.entity_type === 'vehicle' ? <Car className="w-2.5 h-2.5 text-zinc-500" /> :
                   <Box className="w-2.5 h-2.5 text-zinc-500" />}
                </div>
                <p className="text-[9px] text-zinc-400 truncate capitalize">{det.label}</p>
                <p className="text-[8px] font-mono text-zinc-600">
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
          <h2 className="text-2xl font-light text-white">Live Feed</h2>
          <p className="text-[11px] font-mono text-zinc-600 mt-1 uppercase tracking-wider">
            Real-time video streams with detection overlays
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 uppercase">
            <Camera className="w-3.5 h-3.5" />
            {activeStreams.length > 0 && (
              <span className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
            )}
            <span>{activeStreams.length} active</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600">
          <Camera className="w-4 h-4 animate-pulse mr-2" />
          <span className="text-[11px] font-mono uppercase">Loading streams...</span>
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 border border-intel-border">
            <Camera className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-zinc-400 text-sm">No video streams available</p>
          <p className="text-[11px] font-mono text-zinc-600 mt-1">Configure streams to start live monitoring</p>
        </div>
      ) : (
        <>
          {/* Active Streams */}
          {activeStreams.length > 0 && (
            <div>
              <h3 className="mono-label mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
                Active Streams
              </h3>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  'grid gap-px bg-intel-border',
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
              <h3 className="mono-label mb-3">Inactive Streams</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-intel-border">
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
