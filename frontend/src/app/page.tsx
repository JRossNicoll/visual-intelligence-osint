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

  // Command palette keyboard shortcut
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
        return (
          <Dashboard
            realtimeDetections={realtimeDetections}
            onViewChange={setActiveView}
          />
        );
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
        return (
          <Dashboard
            realtimeDetections={realtimeDetections}
            onViewChange={setActiveView}
          />
        );
    }
  };

  const severityStyles: Record<string, string> = {
    critical: 'bg-red-500/15 border-red-500/30 text-red-300',
    high: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
    medium: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300',
    low: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
  };

  return (
    <div className="h-screen flex bg-intel-bg">
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        wsConnected={wsConnected}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 h-screen overflow-hidden transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'
        )}
      >
        {/* Top Bar */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-intel-border/30 bg-intel-surface/40 backdrop-blur-lg flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white capitalize tracking-wide">
              {activeView === 'live' ? 'Live Feed' : activeView}
            </h2>
            <div className="h-4 w-px bg-intel-border/50" />
            <span className="text-xs text-gray-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
              wsConnected
                ? 'bg-intel-accent/10 text-intel-accent border border-intel-accent/20'
                : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
            )}>
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                wsConnected ? 'bg-intel-accent animate-pulse' : 'bg-gray-500'
              )} />
              {wsConnected ? `${realtimeDetections.length} live detections` : 'Offline'}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="min-h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Alert Toast Notification */}
      <AnimatePresence>
        {alertNotification && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed top-20 right-6 z-50"
          >
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md',
                severityStyles[alertNotification.severity] || severityStyles.medium
              )}
            >
              <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  {alertNotification.severity} Alert
                </p>
                <p className="text-sm font-medium">{alertNotification.title}</p>
              </div>
              <button
                onClick={() => setAlertNotification(null)}
                className="ml-2 opacity-50 hover:opacity-100 transition-opacity text-sm"
              >
                &times;
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setActiveView}
      />

      {/* Status Bar */}
      <footer
        className={cn(
          'fixed bottom-0 right-0 h-7 flex items-center justify-between text-[10px] text-gray-600 px-4 bg-intel-surface/60 backdrop-blur-sm border-t border-intel-border/20 transition-all duration-300',
          sidebarCollapsed ? 'left-[72px]' : 'left-[260px]'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono">VIOSINT v0.1.0</span>
          <div className="h-2.5 w-px bg-intel-border/30" />
          <span className={wsConnected ? 'text-intel-accent' : ''}>
            {wsConnected ? 'WS Connected' : 'WS Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>{realtimeDetections.length} active tracks</span>
          <div className="h-2.5 w-px bg-intel-border/30" />
          <span className="font-mono">{new Date().toLocaleTimeString()}</span>
        </div>
      </footer>
    </div>
  );
}
