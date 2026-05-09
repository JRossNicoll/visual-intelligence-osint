'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Camera,
  Car,
  Crosshair,
  Maximize2,
  Minimize2,
  Radio,
  User,
} from 'lucide-react';
import type { Detection, Stream, WSFrameDetections } from '@/types';
import { streamsApi } from '@/lib/api';
import { getStreamWS, WSClient } from '@/lib/websocket';
import { cn } from '@/lib/utils';

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
      case 'person': return { border: '#4a9eff', bg: 'rgba(74, 158, 255, 0.08)', text: '#4a9eff' };
      case 'vehicle': return { border: '#34d399', bg: 'rgba(52, 211, 153, 0.08)', text: '#34d399' };
      default: return { border: '#a78bfa', bg: 'rgba(167, 139, 250, 0.08)', text: '#a78bfa' };
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
            <div
              className="absolute transition-all duration-75"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                border: `1px solid ${color.border}`,
                backgroundColor: color.bg,
                borderRadius: '4px',
              }}
            >
              <div className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: color.border }} />
              <div className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: color.border }} />
              <div className="absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: color.border }} />
              <div className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: color.border }} />
            </div>

            <div
              className="absolute flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-semibold tracking-wider uppercase rounded"
              style={{
                left: `${left}px`,
                top: `${Math.max(0, top - 18)}px`,
                backgroundColor: color.border,
                color: '#050507',
              }}
            >
              {det.track_id != null && <span className="opacity-70">#{det.track_id}</span>}
              <span>{det.label}</span>
              <span className="opacity-60">{Math.round(det.confidence * 100)}%</span>
            </div>

            {det.attributes && Object.keys(det.attributes).length > 0 && (
              <div
                className="absolute text-[7px] font-mono px-1.5 py-0.5 whitespace-nowrap rounded"
                style={{
                  left: `${left}px`,
                  top: `${top + height + 2}px`,
                  color: color.text,
                  backgroundColor: 'rgba(5,5,7,0.85)',
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

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.03]" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/[0.03]" />
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
      'bg-g-card border border-g-border rounded-lg overflow-hidden transition-all',
      isExpanded ? 'col-span-full' : ''
    )}>
      <div
        ref={containerRef}
        className="relative bg-black overflow-hidden aspect-video"
      >
        <div className="absolute inset-0 flex items-center justify-center bg-g-bg">
          {stream.status === 'active' ? (
            <>
              <Camera className="w-10 h-10 text-g-text-dim/20" />
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
              <Camera className="w-8 h-8 text-g-text-dim mx-auto mb-2" />
              <p className="text-xs text-g-text-dim capitalize">{stream.status}</p>
            </div>
          )}
        </div>

        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            {stream.status === 'active' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-g-danger/90 text-white text-[9px] font-bold rounded">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            <span className="text-xs text-white/70">{stream.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <span className="flex items-center gap-1 text-[9px] text-g-success font-mono">
                <Radio className="w-3 h-3" /> WS
              </span>
            )}
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-white/10 transition-colors rounded"
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5 text-white/50" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-white/50" />
              )}
            </button>
          </div>
        </div>

        {stream.status === 'active' && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center gap-3 text-[10px] text-white/40 font-mono">
              <span>{stats.fps.toFixed(1)} fps</span>
              <span>{detections.length} det</span>
              <span>{stats.activeTracks} trk</span>
              <span>#{stats.frameNumber}</span>
            </div>
            {stream.location_name && (
              <span className="text-[9px] text-white/30 font-mono">
                {stream.location_name}
              </span>
            )}
          </div>
        )}
      </div>

      {isExpanded && detections.length > 0 && (
        <div className="p-4 border-t border-g-border">
          <div className="flex items-center gap-2.5 mb-3">
            <Crosshair className="w-3.5 h-3.5 text-g-text-muted" />
            <span className="text-xs font-medium text-g-text-secondary">Active Detections</span>
            <span className="text-xs text-g-text-muted">({detections.length})</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {detections.slice(0, 12).map((det, i) => (
              <div
                key={`${det.track_id || i}`}
                className="p-2.5 bg-g-surface border border-g-border rounded-md text-center"
              >
                <div className="w-6 h-6 mx-auto mb-1.5 flex items-center justify-center bg-white/[0.04] rounded text-g-text-muted">
                  {det.entity_type === 'person' ? <User className="w-3 h-3" /> :
                   det.entity_type === 'vehicle' ? <Car className="w-3 h-3" /> :
                   <Box className="w-3 h-3" />}
                </div>
                <p className="text-[10px] text-g-text truncate capitalize">{det.label}</p>
                <p className="text-[9px] font-mono text-g-text-muted mt-0.5">
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
    const interval = setInterval(fetchStreams, 15000);
    return () => clearInterval(interval);
  }, []);

  const activeStreams = streams.filter((s) => s.status === 'active');
  const inactiveStreams = streams.filter((s) => s.status !== 'active');

  return (
    <div className="p-6 pb-14 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Live Feed</h2>
          <p className="text-sm text-g-text-secondary mt-1">Real-time video streams with detection overlays</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 text-xs text-g-text-muted">
            <Camera className="w-4 h-4" />
            {activeStreams.length > 0 && (
              <span className="w-2 h-2 bg-g-success rounded-full animate-pulse" />
            )}
            <span>{activeStreams.length} active</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-g-text-muted">
          <Camera className="w-4 h-4 animate-pulse mr-2" />
          <span className="text-sm">Loading streams...</span>
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-white/[0.04] rounded-xl">
            <Camera className="w-6 h-6 text-g-text-muted" />
          </div>
          <p className="text-g-text-secondary text-sm font-medium">No video streams available</p>
          <p className="text-xs text-g-text-muted mt-1">Configure streams to start live monitoring</p>
        </div>
      ) : (
        <>
          {activeStreams.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="w-2 h-2 bg-g-success rounded-full animate-pulse" />
                <h3 className="text-xs font-medium text-g-text-secondary uppercase tracking-wide">Active Streams</h3>
              </div>
              <div className={cn(
                'grid gap-4',
                expandedStream ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
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
            </div>
          )}

          {inactiveStreams.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-g-text-secondary uppercase tracking-wide mb-3">Inactive Streams</h3>
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
