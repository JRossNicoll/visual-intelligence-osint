'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Play,
  Square,
  Plus,
  Trash2,
  MapPin,
  Activity,
  Upload,
  Radio,
  Film,
  X,
} from 'lucide-react';
import { streamsApi } from '@/lib/api';
import type { Stream } from '@/types';
import { formatRelativeTime, statusColor, cn } from '@/lib/utils';

export default function StreamsView() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newStream, setNewStream] = useState<{
    name: string;
    source_type: 'rtsp' | 'file' | 'webrtc';
    source_url: string;
    location_name: string;
    is_live: boolean;
  }>({
    name: '',
    source_type: 'rtsp',
    source_url: '',
    location_name: '',
    is_live: true,
  });

  const fetchStreams = async () => {
    try {
      const data = await streamsApi.list();
      setStreams(data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
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
    } catch (err) {
      console.error('Failed to create stream:', err);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await streamsApi.start(id);
      await fetchStreams();
    } catch (err) {
      console.error('Failed to start stream:', err);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await streamsApi.stop(id);
      await fetchStreams();
    } catch (err) {
      console.error('Failed to stop stream:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await streamsApi.delete(id);
      await fetchStreams();
    } catch (err) {
      console.error('Failed to delete stream:', err);
    }
  };

  const sourceTypeIcon = (type: string) => {
    switch (type) {
      case 'rtsp': return <Radio className="w-4 h-4" />;
      case 'file': return <Film className="w-4 h-4" />;
      case 'webrtc': return <Camera className="w-4 h-4" />;
      default: return <Camera className="w-4 h-4" />;
    }
  };

  const inputClasses = 'w-full px-3.5 py-2.5 bg-intel-bg/80 border border-intel-border/50 rounded-xl text-white text-sm focus:outline-none focus:border-intel-accent/50 focus:shadow-glow-sm transition-all placeholder-gray-600';
  const labelClasses = 'block text-xs text-gray-400 mb-1.5 font-medium';

  return (
    <div className="p-6 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Video Streams</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage live and recorded video sources</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
            showCreate
              ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
              : 'bg-intel-accent/10 text-intel-accent border border-intel-accent/20 hover:bg-intel-accent/20 hover:shadow-glow-sm'
          )}
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'Add Stream'}
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-intel-accent" />
                New Stream
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Name</label>
                  <input
                    type="text"
                    value={newStream.name}
                    onChange={(e) => setNewStream({ ...newStream, name: e.target.value })}
                    placeholder="e.g., Front Entrance Camera"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Source Type</label>
                  <select
                    value={newStream.source_type}
                    onChange={(e) => setNewStream({ ...newStream, source_type: e.target.value as 'rtsp' | 'file' | 'webrtc' })}
                    className={inputClasses}
                  >
                    <option value="rtsp">RTSP Stream</option>
                    <option value="file">Video File</option>
                    <option value="webrtc">WebRTC</option>
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Source URL</label>
                  <input
                    type="text"
                    value={newStream.source_url}
                    onChange={(e) => setNewStream({ ...newStream, source_url: e.target.value })}
                    placeholder="rtsp://camera-ip:554/stream"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Location</label>
                  <input
                    type="text"
                    value={newStream.location_name}
                    onChange={(e) => setNewStream({ ...newStream, location_name: e.target.value })}
                    placeholder="e.g., Building A - North"
                    className={inputClasses}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-5">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStream.is_live}
                    onChange={(e) => setNewStream({ ...newStream, is_live: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-intel-border rounded-full peer peer-checked:bg-intel-accent/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-intel-accent" />
                  <span className="ml-2.5 text-sm text-gray-300">Live Stream</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newStream.name}
                  className="px-5 py-2.5 bg-intel-accent text-intel-bg text-sm font-semibold rounded-xl hover:shadow-glow-md disabled:opacity-40 transition-all"
                >
                  Create Stream
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-gray-500">
            <Activity className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading streams...</span>
          </div>
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-intel-card flex items-center justify-center mx-auto mb-4 border border-intel-border/30">
            <Camera className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No streams configured</p>
          <p className="text-sm text-gray-600 mt-1">Add a video stream to start tracking</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {streams.map((stream, i) => (
            <motion.div
              key={stream.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card glass-card-hover rounded-xl overflow-hidden group"
            >
              {/* Video Preview Area */}
              <div className="relative aspect-video bg-intel-bg flex items-center justify-center overflow-hidden">
                {stream.status === 'active' ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
                    <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-red-500/90 text-white text-[10px] font-bold rounded-md tracking-wider backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                      <span className="text-[11px] text-white/70 font-mono">
                        {stream.total_frames_processed.toLocaleString()} frames
                      </span>
                      <span className="text-[11px] text-white/70 font-mono">
                        {stream.total_detections.toLocaleString()} detections
                      </span>
                    </div>
                    <div className="scanline opacity-20" />
                    <Camera className="w-8 h-8 text-intel-accent/30" />
                  </>
                ) : (
                  <div className="text-center">
                    <div className="text-gray-600 mb-1">{sourceTypeIcon(stream.source_type)}</div>
                    <p className="text-xs text-gray-600 capitalize">{stream.status}</p>
                  </div>
                )}
              </div>

              {/* Stream Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white truncate pr-2">{stream.name}</h3>
                  <span className={cn(
                    'text-[10px] font-semibold capitalize px-2 py-0.5 rounded-md',
                    stream.status === 'active'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : stream.status === 'error'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                  )}>
                    {stream.status}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {sourceTypeIcon(stream.source_type)}
                    <span className="uppercase font-mono text-[10px]">{stream.source_type}</span>
                  </div>
                  {stream.location_name && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{stream.location_name}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {stream.status === 'active' ? (
                    <button
                      onClick={() => handleStop(stream.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors"
                    >
                      <Square className="w-3 h-3" /> Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(stream.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-intel-accent/10 text-intel-accent border border-intel-accent/20 rounded-lg text-xs font-medium hover:bg-intel-accent/20 transition-colors"
                    >
                      <Play className="w-3 h-3" /> Start
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(stream.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-intel-border/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
