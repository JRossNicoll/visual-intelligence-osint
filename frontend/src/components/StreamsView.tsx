'use client';

import { useState, useEffect, useRef } from 'react';
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
  Upload,
  FileVideo,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { streamsApi } from '@/lib/api';
import type { Stream } from '@/types';
import { cn } from '@/lib/utils';

export default function StreamsView() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newStream, setNewStream] = useState({
    name: '',
    source_type: 'file' as 'rtsp' | 'file' | 'webrtc',
    source_url: '',
    location_name: '',
    is_live: false,
  });

  const fetchStreams = async () => {
    try { setStreams(await streamsApi.list()); } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!newStream.name) return;

    try {
      setUploading(true);

      if (newStream.source_type === 'file' && selectedFile) {
        setUploadProgress('Creating stream...');
        const stream = await streamsApi.create({
          ...newStream,
          is_live: false,
        });
        try {
          setUploadProgress(`Uploading ${selectedFile.name}...`);
          await streamsApi.uploadVideo(stream.id, selectedFile);
          setUploadProgress('Upload complete. Starting analysis...');
          try {
            await streamsApi.start(stream.id);
          } catch {
            // CV pipeline may not be ready yet
          }
        } catch (uploadErr) {
          try { await streamsApi.delete(stream.id); } catch { /* best-effort cleanup */ }
          throw uploadErr;
        }
      } else {
        await streamsApi.create(newStream);
      }

      setShowCreate(false);
      setNewStream({ name: '', source_type: 'file', source_url: '', location_name: '', is_live: false });
      setSelectedFile(null);
      setUploadProgress('');
      await fetchStreams();
    } catch (err) {
      console.error('Failed to create stream:', err);
      setUploadProgress(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleStart = async (id: string) => { try { await streamsApi.start(id); await fetchStreams(); } catch {} };
  const handleStop = async (id: string) => { try { await streamsApi.stop(id); await fetchStreams(); } catch {} };
  const handleDelete = async (id: string) => { try { await streamsApi.delete(id); await fetchStreams(); } catch {} };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!newStream.name) {
        setNewStream(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      if (!newStream.name) {
        setNewStream(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
      }
    }
  };

  const sourceTypeIcon = (type: string) => {
    if (type === 'rtsp') return <Radio className="w-4 h-4" />;
    if (type === 'file') return <Film className="w-4 h-4" />;
    return <Camera className="w-4 h-4" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const inputCls = 'w-full px-3 py-2 bg-g-bg border border-g-border text-g-text text-sm rounded-md focus:outline-none focus:border-g-accent/40 transition-colors placeholder-g-text-dim';

  const canCreate = newStream.name && (
    (newStream.source_type === 'file' && selectedFile) ||
    (newStream.source_type !== 'file' && newStream.source_url)
  );

  return (
    <div className="p-6 pb-14 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Video Streams</h2>
          <p className="text-sm text-g-text-secondary mt-1">Manage live and recorded video sources</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all border',
            showCreate
              ? 'text-g-text-secondary border-g-border bg-white/[0.03]'
              : 'text-g-text border-g-border bg-white/[0.05] hover:bg-white/[0.08] hover:border-g-border-light'
          )}
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'Add Stream'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-g-card border border-g-border rounded-lg p-6 animate-fade-in">
          <h3 className="text-sm font-medium text-g-text mb-5">New Stream</h3>

          {/* Source Type Selector */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs text-g-text-muted mr-1">Source</span>
            {[
              { key: 'file', label: 'Upload File', icon: Upload },
              { key: 'rtsp', label: 'RTSP Stream', icon: Radio },
              { key: 'webrtc', label: 'WebRTC', icon: Camera },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setNewStream(prev => ({ ...prev, source_type: key as 'rtsp' | 'file' | 'webrtc' }))}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                  newStream.source_type === key
                    ? 'bg-g-accent/10 text-g-accent border-g-accent/20'
                    : 'text-g-text-muted border-g-border hover:text-g-text hover:border-g-border-light'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* File Upload Area */}
          {newStream.source_type === 'file' && (
            <div
              className={cn(
                'border-2 border-dashed mb-5 rounded-lg transition-all cursor-pointer',
                selectedFile
                  ? 'border-g-success/30 bg-g-success/[0.03]'
                  : 'border-g-border hover:border-g-border-light bg-white/[0.01]'
              )}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              {selectedFile ? (
                <div className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-md bg-g-success/10 flex items-center justify-center">
                    <FileVideo className="w-5 h-5 text-g-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-g-text truncate">{selectedFile.name}</p>
                    <p className="text-xs text-g-text-muted mt-0.5">
                      {formatSize(selectedFile.size)} · {selectedFile.type}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="text-g-text-muted hover:text-g-danger transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-12 h-12 rounded-lg bg-white/[0.04] flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6 text-g-text-muted" />
                  </div>
                  <p className="text-sm text-g-text-secondary">Drop a video file here</p>
                  <p className="text-xs text-g-text-muted mt-1">or click to browse · MP4, AVI, MOV, WEBM</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-g-text-muted mb-1.5">Name</label>
              <input type="text" value={newStream.name} onChange={(e) => setNewStream({ ...newStream, name: e.target.value })} placeholder="Front Entrance Camera" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-g-text-muted mb-1.5">Location</label>
              <input type="text" value={newStream.location_name} onChange={(e) => setNewStream({ ...newStream, location_name: e.target.value })} placeholder="Building A - North" className={inputCls} />
            </div>
            {newStream.source_type !== 'file' && (
              <div className="md:col-span-2">
                <label className="block text-xs text-g-text-muted mb-1.5">Source URL</label>
                <input type="text" value={newStream.source_url} onChange={(e) => setNewStream({ ...newStream, source_url: e.target.value })} placeholder={newStream.source_type === 'rtsp' ? 'rtsp://camera-ip:554/stream' : 'https://...'} className={inputCls} />
              </div>
            )}
          </div>

          {newStream.source_type !== 'file' && (
            <div className="flex items-center gap-3 mt-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={newStream.is_live} onChange={(e) => setNewStream({ ...newStream, is_live: e.target.checked })} className="sr-only peer" />
                <div className="w-9 h-5 bg-g-border rounded-full peer peer-checked:bg-g-accent/30 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-g-text-muted after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-g-accent" />
                <span className="ml-2.5 text-sm text-g-text-secondary">Live Stream</span>
              </label>
            </div>
          )}

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="mt-4 flex items-center gap-3 p-3 bg-g-bg border border-g-border rounded-md">
              {uploading ? (
                <Loader2 className="w-4 h-4 text-g-accent animate-spin flex-shrink-0" />
              ) : uploadProgress.startsWith('Error') ? (
                <AlertCircle className="w-4 h-4 text-g-danger flex-shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-g-success flex-shrink-0" />
              )}
              <span className={cn(
                'text-sm',
                uploadProgress.startsWith('Error') ? 'text-g-danger' : 'text-g-text-secondary'
              )}>{uploadProgress}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => { setShowCreate(false); setSelectedFile(null); setUploadProgress(''); }} className="px-4 py-2 text-sm text-g-text-muted hover:text-g-text transition-colors">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!canCreate || uploading}
              className="px-5 py-2 bg-g-accent text-white text-sm font-medium rounded-md disabled:opacity-40 hover:bg-g-accent/90 transition-all flex items-center gap-2"
            >
              {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {newStream.source_type === 'file' ? 'Upload & Analyze' : 'Create Stream'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-g-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading streams...</span>
          </div>
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-white/[0.04] rounded-xl">
            <Camera className="w-6 h-6 text-g-text-muted" />
          </div>
          <p className="text-g-text-secondary text-sm font-medium">No streams configured</p>
          <p className="text-xs text-g-text-muted mt-1">Add a video stream to start tracking</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.map((stream) => (
            <div key={stream.id} className="bg-g-card border border-g-border rounded-lg overflow-hidden hover:border-g-border-light transition-all">
              <div className="relative aspect-video bg-g-bg flex items-center justify-center">
                {stream.status === 'active' ? (
                  <>
                    <div className="absolute top-3 left-3 z-10">
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-g-danger/90 text-white text-[10px] font-semibold rounded-md">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />LIVE
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 text-[11px] text-white/40 font-mono">
                      <span>{stream.total_frames_processed.toLocaleString()} frames</span>
                      <span>{stream.total_detections.toLocaleString()} det</span>
                    </div>
                    <Camera className="w-8 h-8 text-g-text-dim" />
                  </>
                ) : stream.status === 'ready' ? (
                  <div className="text-center">
                    <FileVideo className="w-8 h-8 mx-auto text-g-text-muted" />
                    <p className="text-xs text-g-text-muted mt-2">Ready to process</p>
                  </div>
                ) : (
                  <div className="text-center text-g-text-dim">
                    {sourceTypeIcon(stream.source_type)}
                    <p className="text-xs mt-2 capitalize">{stream.status}</p>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm text-g-text truncate pr-2 font-medium">{stream.name}</h3>
                  <span className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                    stream.status === 'active' ? 'text-g-success bg-g-success/10' :
                    stream.status === 'ready' ? 'text-g-info bg-g-info/10' :
                    stream.status === 'error' ? 'text-g-danger bg-g-danger/10' :
                    'text-g-text-muted bg-white/[0.04]'
                  )}>{stream.status}</span>
                </div>
                <div className="space-y-1 mb-3 text-xs text-g-text-muted">
                  <div className="flex items-center gap-2">{sourceTypeIcon(stream.source_type)}<span className="uppercase">{stream.source_type}</span></div>
                  {stream.location_name && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /><span>{stream.location_name}</span></div>}
                </div>
                <div className="flex items-center gap-2">
                  {stream.status === 'active' ? (
                    <button onClick={() => handleStop(stream.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-g-danger bg-g-danger/10 border border-g-danger/20 text-xs font-medium rounded-md hover:bg-g-danger/15 transition-all"><Square className="w-3 h-3" />Stop</button>
                  ) : (
                    <button onClick={() => handleStart(stream.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-g-text border border-g-border text-xs font-medium rounded-md hover:bg-white/[0.04] transition-all"><Play className="w-3 h-3" />Start</button>
                  )}
                  <button onClick={() => handleDelete(stream.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-g-text-muted border border-g-border text-xs rounded-md hover:text-g-danger hover:border-g-danger/20 transition-all"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
