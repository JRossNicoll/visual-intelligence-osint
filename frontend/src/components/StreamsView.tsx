'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  Play,
  Square,
  Plus,
  Trash2,
  MapPin,
  Activity,
  Radio,
  Film,
  X,
} from 'lucide-react';
import { streamsApi } from '@/lib/api';
import type { Stream } from '@/types';
import { cn } from '@/lib/utils';

export default function StreamsView() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newStream, setNewStream] = useState({
    name: '',
    source_type: 'rtsp' as 'rtsp' | 'file' | 'webrtc',
    source_url: '',
    location_name: '',
    is_live: true,
  });

  const fetchStreams = async () => {
    try { setStreams(await streamsApi.list()); } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    try {
      await streamsApi.create(newStream);
      setShowCreate(false);
      setNewStream({ name: '', source_type: 'rtsp', source_url: '', location_name: '', is_live: true });
      await fetchStreams();
    } catch (err) { console.error('Failed to create stream:', err); }
  };

  const handleStart = async (id: string) => { try { await streamsApi.start(id); await fetchStreams(); } catch {} };
  const handleStop = async (id: string) => { try { await streamsApi.stop(id); await fetchStreams(); } catch {} };
  const handleDelete = async (id: string) => { try { await streamsApi.delete(id); await fetchStreams(); } catch {} };

  const sourceTypeIcon = (type: string) => {
    if (type === 'rtsp') return <Radio className="w-3.5 h-3.5" />;
    if (type === 'file') return <Film className="w-3.5 h-3.5" />;
    return <Camera className="w-3.5 h-3.5" />;
  };

  const inputCls = 'w-full px-3 py-1.5 bg-intel-bg border border-intel-border text-zinc-200 text-[12px] font-mono focus:outline-none focus:border-intel-border-light transition-colors placeholder-zinc-600';

  return (
    <div className="p-6 pb-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-white">Video Streams</h2>
          <p className="text-[11px] font-mono text-zinc-600 mt-1 uppercase tracking-wider">
            Manage live and recorded video sources
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-colors border',
            showCreate
              ? 'text-zinc-400 border-intel-border hover:bg-white/[0.02]'
              : 'text-zinc-300 border-intel-border hover:border-intel-border-light hover:text-white'
          )}
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'Add Stream'}
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-intel-card border border-intel-border p-5">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 mb-4">New Stream</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mono-label mb-1.5">Name</label>
                  <input type="text" value={newStream.name} onChange={(e) => setNewStream({ ...newStream, name: e.target.value })} placeholder="Front Entrance Camera" className={inputCls} />
                </div>
                <div>
                  <label className="block mono-label mb-1.5">Source Type</label>
                  <select value={newStream.source_type} onChange={(e) => setNewStream({ ...newStream, source_type: e.target.value as 'rtsp' | 'file' | 'webrtc' })} className={inputCls}>
                    <option value="rtsp">RTSP Stream</option>
                    <option value="file">Video File</option>
                    <option value="webrtc">WebRTC</option>
                  </select>
                </div>
                <div>
                  <label className="block mono-label mb-1.5">Source URL</label>
                  <input type="text" value={newStream.source_url} onChange={(e) => setNewStream({ ...newStream, source_url: e.target.value })} placeholder="rtsp://camera-ip:554/stream" className={inputCls} />
                </div>
                <div>
                  <label className="block mono-label mb-1.5">Location</label>
                  <input type="text" value={newStream.location_name} onChange={(e) => setNewStream({ ...newStream, location_name: e.target.value })} placeholder="Building A - North" className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={newStream.is_live} onChange={(e) => setNewStream({ ...newStream, is_live: e.target.checked })} className="sr-only peer" />
                  <div className="w-8 h-4 bg-intel-border peer peer-checked:bg-green-500/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-500 after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-green-400" />
                  <span className="ml-2 text-[11px] font-mono text-zinc-400 uppercase">Live Stream</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setShowCreate(false)} className="px-4 py-1.5 text-[11px] font-mono text-zinc-500 hover:text-white uppercase tracking-wider transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={!newStream.name} className="px-5 py-1.5 bg-zinc-200 text-black text-[11px] font-mono uppercase tracking-wider disabled:opacity-40 hover:bg-white transition-colors">
                  Create Stream
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-zinc-600"><Activity className="w-4 h-4 animate-spin" /><span className="text-[11px] font-mono uppercase">Loading streams...</span></div>
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 border border-intel-border">
            <Camera className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-zinc-400 text-sm">No streams configured</p>
          <p className="text-[11px] font-mono text-zinc-600 mt-1">Add a video stream to start tracking</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-intel-border">
          {streams.map((stream) => (
            <div key={stream.id} className="bg-intel-card overflow-hidden hover:bg-intel-card-hover transition-colors">
              <div className="relative aspect-video bg-intel-bg flex items-center justify-center">
                {stream.status === 'active' ? (
                  <>
                    <div className="absolute top-2 left-2 z-10">
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/90 text-white text-[9px] font-mono font-bold uppercase tracking-wider">
                        <span className="w-1 h-1 bg-white animate-pulse" />LIVE
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10 text-[10px] text-white/50 font-mono">
                      <span>{stream.total_frames_processed.toLocaleString()} frames</span>
                      <span>{stream.total_detections.toLocaleString()} det</span>
                    </div>
                    <Camera className="w-8 h-8 text-zinc-800" />
                  </>
                ) : (
                  <div className="text-center text-zinc-700">
                    {sourceTypeIcon(stream.source_type)}
                    <p className="text-[10px] font-mono mt-1 uppercase">{stream.status}</p>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs text-zinc-200 truncate pr-2">{stream.name}</h3>
                  <span className={cn(
                    'text-[9px] font-mono uppercase px-1.5 py-0.5 border',
                    stream.status === 'active' ? 'border-green-500/20 text-green-400' :
                    stream.status === 'error' ? 'border-red-500/20 text-red-400' :
                    'border-intel-border text-zinc-600'
                  )}>{stream.status}</span>
                </div>
                <div className="space-y-1 mb-3 text-[10px] font-mono text-zinc-600">
                  <div className="flex items-center gap-2">{sourceTypeIcon(stream.source_type)}<span className="uppercase">{stream.source_type}</span></div>
                  {stream.location_name && <div className="flex items-center gap-2"><MapPin className="w-3 h-3" /><span>{stream.location_name}</span></div>}
                </div>
                <div className="flex items-center gap-2">
                  {stream.status === 'active' ? (
                    <button onClick={() => handleStop(stream.id)} className="flex items-center gap-1.5 px-3 py-1 text-red-400 border border-red-500/20 text-[10px] font-mono uppercase hover:bg-red-500/10 transition-colors"><Square className="w-3 h-3" />Stop</button>
                  ) : (
                    <button onClick={() => handleStart(stream.id)} className="flex items-center gap-1.5 px-3 py-1 text-zinc-300 border border-intel-border text-[10px] font-mono uppercase hover:border-intel-border-light transition-colors"><Play className="w-3 h-3" />Start</button>
                  )}
                  <button onClick={() => handleDelete(stream.id)} className="flex items-center gap-1.5 px-3 py-1 text-zinc-600 border border-intel-border text-[10px] font-mono hover:text-red-400 hover:border-red-500/20 transition-colors"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
