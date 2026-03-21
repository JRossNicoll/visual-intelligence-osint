'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import StreamsView from '@/components/StreamsView';
import TargetsView from '@/components/TargetsView';
import EntitiesView from '@/components/EntitiesView';
import AlertsView from '@/components/AlertsView';
import IntelligenceDashboard from '@/components/IntelligenceDashboard';
import TimelineView from '@/components/TimelineView';
import StoryModeView from '@/components/StoryModeView';
import GraphExplorer from '@/components/GraphExplorer';
import NLQueryView from '@/components/NLQueryView';
import OperatorDashboard from '@/components/OperatorDashboard';
import InvestigationView from '@/components/InvestigationView';
import IntelligenceView from '@/components/IntelligenceView';
import EntityProfileView from '@/components/EntityProfileView';
import type { Detection } from '@/types';
import { getGeneralWS, getAlertWS } from '@/lib/websocket';

export default function Home() {
  const [activeView, setActiveView] = useState('dashboard');
  const [wsConnected, setWsConnected] = useState(false);
  const [realtimeDetections, setRealtimeDetections] = useState<Detection[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [alertNotification, setAlertNotification] = useState<{
    title: string;
    severity: string;
  } | null>(null);

  useEffect(() => {
    // Connect general WebSocket
    const generalWs = getGeneralWS();
    const alertWs = getAlertWS();

    const unsubConnected = generalWs.on('connected', () => setWsConnected(true));
    const unsubDisconnected = generalWs.on('disconnected', () => setWsConnected(false));

    // Handle real-time frame detections
    const unsubDetections = generalWs.on('frame_detections', (data) => {
      const detections = (data as { detections?: Detection[] }).detections || [];
      setRealtimeDetections(detections);
    });

    // Handle alert notifications
    const unsubAlerts = alertWs.on('alert', (data) => {
      const alert = data as { title?: string; severity?: string };
      if (alert.title) {
        setAlertNotification({
          title: alert.title,
          severity: alert.severity || 'medium',
        });
        // Auto-dismiss after 5 seconds
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

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            realtimeDetections={realtimeDetections}
            onViewChange={setActiveView}
          />
        );
      case 'streams':
        return <StreamsView />;
      case 'targets':
        return <TargetsView />;
      case 'entities':
        return <EntitiesView />;
      case 'alerts':
        return <AlertsView />;
      case 'intelligence':
        return <IntelligenceDashboard onViewChange={setActiveView} />;
      case 'timeline':
        return <TimelineView />;
      case 'story':
        return <StoryModeView />;
      case 'graph':
        return <GraphExplorer />;
      case 'query':
        return <NLQueryView />;
      case 'operator':
        return (
          <OperatorDashboard
            onViewChange={setActiveView}
            onEntitySelect={(id) => {
              setSelectedEntityId(id);
              setActiveView('entity-profile');
            }}
          />
        );
      case 'investigation':
        return (
          <InvestigationView
            onViewChange={setActiveView}
            initialEntityId={selectedEntityId || undefined}
          />
        );
      case 'intel-summary':
        return <IntelligenceView onViewChange={setActiveView} />;
      case 'entity-profile':
        return selectedEntityId ? (
          <EntityProfileView
            entityId={selectedEntityId}
            onViewChange={setActiveView}
            onEntitySelect={(id) => {
              setSelectedEntityId(id);
            }}
          />
        ) : (
          <InvestigationView onViewChange={setActiveView} />
        );
      default:
        return (
          <Dashboard
            realtimeDetections={realtimeDetections}
            onViewChange={setActiveView}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-intel-bg flex flex-col">
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        wsConnected={wsConnected}
      />

      {/* Alert Toast Notification */}
      {alertNotification && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-right">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-sm ${
              alertNotification.severity === 'critical'
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : alertNotification.severity === 'high'
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                : alertNotification.severity === 'medium'
                ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                {alertNotification.severity} Alert
              </p>
              <p className="text-sm font-medium">{alertNotification.title}</p>
            </div>
            <button
              onClick={() => setAlertNotification(null)}
              className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>

      {/* Status Bar */}
      <footer className="bg-intel-surface border-t border-intel-border px-6 py-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>VIOSINT v0.1.0</span>
          <span>•</span>
          <span className={wsConnected ? 'text-intel-accent' : 'text-gray-600'}>
            {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>{realtimeDetections.length} live detections</span>
          <span>•</span>
          <span>Visual Intelligence OSINT Platform</span>
        </div>
      </footer>
    </div>
  );
}
