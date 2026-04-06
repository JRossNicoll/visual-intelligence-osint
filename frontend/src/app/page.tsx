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
import LoginScreen from '@/components/LoginScreen';
import Sprint1CaseList from '@/components/Sprint1CaseList';
import Sprint1CaseDetail from '@/components/Sprint1CaseDetail';
import OntologyManager from '@/components/OntologyManager';
import DataSourcesManager from '@/components/DataSourcesManager';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import type { Detection } from '@/types';
import { getGeneralWS, getAlertWS } from '@/lib/websocket';
import { authApi, getAuthToken } from '@/lib/api';

export default function Home() {
  // Auth state — token kept in memory only
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  const [activeView, setActiveView] = useState('sprint1-cases');
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

  const handleLoginSuccess = (username: string, role: string) => {
    setIsAuthenticated(true);
    setCurrentUser({ username, role });
    setActiveView('sprint1-cases');
  };

  const handleLogout = () => {
    authApi.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveView('sprint1-cases');
  };

  // --- Login gate ---
  if (!isAuthenticated || !getAuthToken()) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const renderView = () => {
    switch (activeView) {
      // Sprint 1 screens — primary flow
      case 'sprint1-cases':
        return (
          <Sprint1CaseList
            onCaseSelect={(id) => {
              setSelectedCaseId(id);
              setActiveView('sprint1-case-detail');
            }}
          />
        );
      case 'sprint1-case-detail':
        return selectedCaseId ? (
          <Sprint1CaseDetail
            caseId={selectedCaseId}
            onBack={() => setActiveView('sprint1-cases')}
          />
        ) : (
          <Sprint1CaseList
            onCaseSelect={(id) => {
              setSelectedCaseId(id);
              setActiveView('sprint1-case-detail');
            }}
          />
        );

      // Legacy views
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
      case 'ontology':
        return <OntologyManager />;
      case 'fusion':
        return <DataSourcesManager />;
      case 'workflows':
        return <WorkflowBuilder />;
      default:
        return (
          <Sprint1CaseList
            onCaseSelect={(id) => {
              setSelectedCaseId(id);
              setActiveView('sprint1-case-detail');
            }}
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
            className={`flex items-center gap-2 px-3 py-2 border-l-2 bg-intel-panel/95 backdrop-blur-sm border-t border-r border-b border-intel-border/60 shadow-lg rounded ${
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

      {/* User bar */}
      {currentUser && (
        <div className="bg-intel-surface/50 border-b border-intel-border/30 px-4 h-6 flex items-center justify-end text-2xs text-gray-600">
          <span className="text-gray-500">{currentUser.username}</span>
          <span className="text-intel-border mx-2">|</span>
          <span className="text-gray-600 uppercase">{currentUser.role}</span>
          <span className="text-intel-border mx-2">|</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-intel-accent transition-colors">
            Sign Out
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>

      {/* Status Bar — minimal */}
      <footer className="bg-intel-surface border-t border-intel-border/60 px-4 h-6 flex items-center justify-between text-2xs text-gray-500 select-none">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-intel-accent/70 tracking-wide">VIOSINT v0.1.0</span>
          <span className="text-intel-border">|</span>
          <span className={wsConnected ? 'text-intel-accent' : 'text-gray-600'}>
            {wsConnected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>{realtimeDetections.length} detections</span>
          <span className="text-intel-border">|</span>
          <span className="tracking-wide">Visual Intelligence OSINT</span>
        </div>
      </footer>
    </div>
  );
}
