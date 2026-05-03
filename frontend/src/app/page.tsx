'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
    <div className="h-screen flex bg-intel-bg relative z-10">
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
          'flex-1 h-screen overflow-hidden transition-all duration-200 ease-in-out',
          sidebarCollapsed ? 'ml-[56px]' : 'ml-[280px]'
        )}
      >
        {/* Top Bar */}
        <header className="h-12 flex items-center justify-between px-6 border-b border-intel-border flex-shrink-0 bg-intel-surface">
          <div className="flex items-center gap-4">
            <h2 className="text-[11px] font-mono font-medium uppercase tracking-widest text-zinc-200">
              {viewLabels[activeView] || activeView}
            </h2>
            <span className="text-[10px] font-mono text-zinc-600">
              Session:{new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border',
              wsConnected
                ? 'text-green-500 border-green-500/20'
                : 'text-zinc-600 border-intel-border'
            )}>
              <span className={cn(
                'w-1.5 h-1.5',
                wsConnected ? 'bg-green-500' : 'bg-zinc-600'
              )} />
              {wsConnected ? `${realtimeDetections.length}_LIVE` : 'OFFLINE'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="h-[calc(100vh-3rem)] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="min-h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Alert Toast */}
      <AnimatePresence>
        {alertNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-3 right-3 z-50"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 bg-intel-card border border-intel-border">
              <div className={cn(
                'w-1.5 h-1.5',
                alertNotification.severity === 'critical' ? 'bg-red-500' :
                alertNotification.severity === 'high' ? 'bg-orange-500' :
                alertNotification.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
              )} />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">
                  {alertNotification.severity}_alert
                </p>
                <p className="text-xs text-zinc-200">{alertNotification.title}</p>
              </div>
              <button
                onClick={() => setAlertNotification(null)}
                className="ml-2 text-zinc-600 hover:text-zinc-400 transition-colors text-sm"
              >
                &times;
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setActiveView}
      />

      {/* Status Bar */}
      <footer
        className={cn(
          'fixed bottom-0 right-0 h-6 flex items-center justify-between text-[9px] font-mono text-zinc-600 px-4 bg-intel-surface border-t border-intel-border transition-all duration-200 z-10 uppercase tracking-wider',
          sidebarCollapsed ? 'left-[56px]' : 'left-[280px]'
        )}
      >
        <div className="flex items-center gap-4">
          <span>VIOSINT_v0.1.0</span>
          <span className={wsConnected ? 'text-green-500' : ''}>
            {wsConnected ? 'WS:CONNECTED' : 'WS:DISCONNECTED'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>{realtimeDetections.length}_tracks</span>
        </div>
      </footer>
    </div>
  );
}
