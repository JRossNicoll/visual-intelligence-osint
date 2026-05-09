'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import CommandPalette from '@/components/CommandPalette';
import Dashboard from '@/components/Dashboard';
import StreamsView from '@/components/StreamsView';
import TargetsView from '@/components/TargetsView';
import EntitiesView from '@/components/EntitiesView';
import AlertsView from '@/components/AlertsView';
import LiveFeedView from '@/components/LiveFeedView';
import type { Detection } from '@/types';
import { getGeneralWS, getAlertWS } from '@/lib/websocket';
import { cn } from '@/lib/utils';

export default function Home() {
  const [activeView, setActiveView] = useState('dashboard');
  const [wsConnected, setWsConnected] = useState(false);
  const [realtimeDetections, setRealtimeDetections] = useState<Detection[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [alertNotification, setAlertNotification] = useState<{
    title: string;
    severity: string;
  } | null>(null);

  useEffect(() => {
    const generalWs = getGeneralWS();
    const alertWs = getAlertWS();

    const unsubConnected = generalWs.on('connected', () => setWsConnected(true));
    const unsubDisconnected = generalWs.on('disconnected', () => setWsConnected(false));

    const unsubDetections = generalWs.on('frame_detections', (data) => {
      const detections = (data as { detections?: Detection[] }).detections || [];
      setRealtimeDetections(detections);
    });

    const unsubAlerts = alertWs.on('alert', (data) => {
      const alert = data as { title?: string; severity?: string };
      if (alert.title) {
        setAlertNotification({
          title: alert.title,
          severity: alert.severity || 'medium',
        });
        setTimeout(() => setAlertNotification(null), 5000);
      }
    });

    generalWs.connect();
    alertWs.connect();

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubDetections();
      unsubAlerts();
      generalWs.disconnect();
      alertWs.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard realtimeDetections={realtimeDetections} onViewChange={setActiveView} />;
      case 'live':
        return <LiveFeedView />;
      case 'streams':
        return <StreamsView />;
      case 'targets':
        return <TargetsView />;
      case 'entities':
        return <EntitiesView />;
      case 'alerts':
        return <AlertsView />;
      default:
        return <Dashboard realtimeDetections={realtimeDetections} onViewChange={setActiveView} />;
    }
  };

  const viewLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    live: 'Live Feed',
    streams: 'Streams',
    targets: 'Targets',
    entities: 'Entities',
    alerts: 'Alerts',
  };

  return (
    <div className="h-screen flex bg-g-bg relative">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        wsConnected={wsConnected}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <main
        className={cn(
          'flex-1 h-screen overflow-hidden transition-all duration-200 ease-out',
          sidebarCollapsed ? 'ml-[60px]' : 'ml-[260px]'
        )}
      >
        {/* Top Bar */}
        <header className="h-12 flex items-center justify-between px-6 border-b border-g-border flex-shrink-0 bg-g-surface/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-g-text">
              {viewLabels[activeView] || activeView}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex items-center gap-2 px-2.5 py-1 text-xs rounded-full',
              wsConnected
                ? 'text-g-success bg-g-success/10'
                : 'text-g-text-muted bg-white/[0.03]'
            )}>
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                wsConnected ? 'bg-g-success' : 'bg-g-text-muted'
              )} />
              {wsConnected ? `${realtimeDetections.length} live` : 'Offline'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="h-[calc(100vh-3rem)] overflow-y-auto">
          <div key={activeView} className="min-h-full view-enter">
            {renderView()}
          </div>
        </div>
      </main>

      {/* Alert Toast */}
      {alertNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 bg-g-card border border-g-border rounded-lg shadow-2xl shadow-black/40">
            <div className={cn(
              'w-2 h-2 rounded-full',
              alertNotification.severity === 'critical' ? 'bg-red-500' :
              alertNotification.severity === 'high' ? 'bg-orange-500' :
              alertNotification.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
            )} />
            <div>
              <p className="text-[10px] font-medium text-g-text-secondary capitalize">
                {alertNotification.severity} Alert
              </p>
              <p className="text-sm text-g-text">{alertNotification.title}</p>
            </div>
            <button
              onClick={() => setAlertNotification(null)}
              className="ml-2 text-g-text-muted hover:text-g-text transition-colors"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setActiveView}
      />

      {/* Status Bar */}
      <footer
        className={cn(
          'fixed bottom-0 right-0 h-7 flex items-center justify-between text-[11px] text-g-text-muted px-4 bg-g-surface/80 backdrop-blur-sm border-t border-g-border transition-all duration-200 z-10',
          sidebarCollapsed ? 'left-[60px]' : 'left-[260px]'
        )}
      >
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px]">VIOSINT v0.1.0</span>
          <span className={cn('font-mono text-[10px]', wsConnected ? 'text-g-success' : '')}>
            {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px]">{realtimeDetections.length} tracks</span>
        </div>
      </footer>
    </div>
  );
}
