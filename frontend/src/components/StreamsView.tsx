'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { streamsApi } from '@/lib/api';
import type { Stream } from '@/types';
import { formatRelativeTime, statusColor } from '@/lib/utils';

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Video Streams</h2>
          <p className="text-sm text-gray-400 mt-1">Manage live and recorded video sources</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-intel-accent/10 text-intel-accent border border-intel-accent/30 rounded-lg hover:bg-intel-accent/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Stream
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-intel-card border border-intel-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">New Stream</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={newStream.name}
                onChange={(e) => setNewStream({ ...newStream, name: e.target.value })}
                placeholder="e.g., Front Entrance Camera"
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Source Type</label>
              <select
                value={newStream.source_type}
                onChange={(e) => setNewStream({ ...newStream, source_type: e.target.value as 'rtsp' | 'file' | 'webrtc' })}
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              >
                <option value="rtsp">RTSP Stream</option>
                <option value="file">Video File</option>
                <option value="webrtc">WebRTC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Source URL</label>
              <input
                type="text"
                value={newStream.source_url}
                onChange={(e) => setNewStream({ ...newStream, source_url: e.target.value })}
                placeholder="rtsp://camera-ip:554/stream"
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={newStream.location_name}
                onChange={(e) => setNewStream({ ...newStream, location_name: e.target.value })}
                placeholder="e.g., Building A - North"
                className="w-full px-3 py-2 bg-intel-bg border border-intel-border rounded-lg text-white text-sm focus:outline-none focus:border-intel-accent"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={newStream.is_live}
                onChange={(e) => setNewStream({ ...newStream, is_live: e.target.checked })}
                className="rounded border-intel-border"
              />
              Live Stream
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
              className="px-4 py-2 bg-intel-accent text-black text-sm font-medium rounded-lg hover:bg-intel-accent/90 disabled:opacity-50 transition-colors"
            >
              Create Stream
            </button>
          </div>
        </div>
      )}

      {/* Stream Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Activity className="w-6 h-6 text-intel-accent animate-spin" />
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-20">
          <Camera className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No streams configured</p>
          <p className="text-sm text-gray-500 mt-1">Add a video stream to start tracking</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.map((stream) => (
            <div
              key={stream.id}
              className="bg-intel-card border border-intel-border rounded-xl overflow-hidden hover:border-intel-accent/30 transition-colors"
            >
              {/* Video Preview Area */}
              <div className="relative aspect-video bg-intel-bg flex items-center justify-center">
                {stream.status === 'active' ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-red-500/80 text-white text-xs font-semibold rounded">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <span className="text-xs text-white/80">
                        {stream.total_frames_processed} frames
                      </span>
                      <span className="text-xs text-white/80">
                        {stream.total_detections} detections
                      </span>
                    </div>
                    <div className="scanline opacity-30" />
                    <Camera className="w-8 h-8 text-intel-accent/50" />
                  </>
                ) : (
                  <div className="text-center">
                    {sourceTypeIcon(stream.source_type)}
                    <p className="text-xs text-gray-500 mt-2 capitalize">{stream.status}</p>
                  </div>
                )}
              </div>

              {/* Stream Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white truncate">{stream.name}</h3>
                  <span className={`text-xs font-medium capitalize ${statusColor(stream.status)}`}>
                    {stream.status}
                  </span>
                </div>

                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {sourceTypeIcon(stream.source_type)}
                    <span className="uppercase">{stream.source_type}</span>
                    {stream.source_url && (
                      <span className="truncate text-gray-500 ml-1">{stream.source_url}</span>
                    )}
                  </div>
                  {stream.location_name && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span>{stream.location_name}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {stream.status === 'active' ? (
                    <button
                      onClick={() => handleStop(stream.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-xs hover:bg-red-500/20 transition-colors"
                    >
                      <Square className="w-3 h-3" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(stream.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-intel-accent/10 text-intel-accent border border-intel-accent/30 rounded-lg text-xs hover:bg-intel-accent/20 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(stream.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg text-xs hover:bg-gray-500/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
