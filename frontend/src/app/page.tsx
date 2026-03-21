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
import CaseManagement from '@/components/CaseManagement';
import CaseDetailView from '@/components/CaseDetailView';
import type { Detection } from '@/types';
import { getGeneralWS, getAlertWS } from '@/lib/websocket';

export default function Home() {
  const [activeView, setActiveView] = useState('dashboard');
  const [wsConnected, setWsConnected] = useState(false);
  const [realtimeDetections, setRealtimeDetections] = useState<Detection[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
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
            onCaseCreated={(id) => {
              setSelectedCaseId(id);
              setActiveView('case-detail');
            }}
          />
        );
      case 'cases':
        return (
          <CaseManagement
            onViewChange={setActiveView}
            onCaseSelect={(id) => {
              setSelectedCaseId(id);
              setActiveView('case-detail');
            }}
          />
        );
      case 'case-detail':
        return selectedCaseId ? (
          <CaseDetailView
            caseId={selectedCaseId}
            onViewChange={setActiveView}
            onEntitySelect={(id) => {
              setSelectedEntityId(id);
              setActiveView('entity-profile');
            }}
          />
        ) : (
          <CaseManagement
            onViewChange={setActiveView}
            onCaseSelect={(id) => {
              setSelectedCaseId(id);
              setActiveView('case-detail');
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

      {/* Alert Toast Notification — compact, sharp */}
      {alertNotification && (
        <div className="fixed top-12 right-3 z-50">
          <div
            className={`flex items-center gap-2 px-3 py-2 border-l-2 bg-intel-panel/95 border-t border-r border-b border-intel-border shadow-lg ${
              alertNotification.severity === 'critical'
                ? 'border-l-sev-critical'
                : alertNotification.severity === 'high'
                ? 'border-l-sev-high'
                : alertNotification.severity === 'medium'
                ? 'border-l-sev-medium'
                : 'border-l-sev-low'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${
              alertNotification.severity === 'critical' ? 'bg-sev-critical' :
              alertNotification.severity === 'high' ? 'bg-sev-high' :
              alertNotification.severity === 'medium' ? 'bg-sev-medium' : 'bg-sev-low'
            } animate-pulse`} />
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-gray-500">
                {alertNotification.severity}
              </p>
              <p className="text-xs text-gray-200">{alertNotification.title}</p>
            </div>
            <button
              onClick={() => setAlertNotification(null)}
              className="ml-2 text-gray-600 hover:text-gray-300 text-xs"
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

      {/* Status Bar — minimal */}
      <footer className="bg-intel-surface border-t border-intel-border px-3 h-6 flex items-center justify-between text-2xs text-gray-600 select-none">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-500">VIOSINT v0.1.0</span>
          <span className="text-intel-border">|</span>
          <span className={wsConnected ? 'text-intel-accent' : 'text-gray-700'}>
            {wsConnected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>{realtimeDetections.length} detections</span>
          <span className="text-intel-border">|</span>
          <span>Visual Intelligence OSINT</span>
        </div>
      </footer>
    </div>
  );
}
