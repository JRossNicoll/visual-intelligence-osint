'use client';

import { useState, useEffect } from 'react';
import { Activity, Bell, BookOpen, Briefcase, Brain, Clock, Eye, GitBranch, MessageSquare, Radio, Search, Shield, WifiOff } from 'lucide-react';
import { alertsApi } from '@/lib/api';

interface HeaderProps {
  activeView: string;
  onViewChange: (view: string) => void;
  wsConnected: boolean;
}

export default function Header({ activeView, onViewChange, wsConnected }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await alertsApi.getUnreadCount();
        setUnreadCount(data.unread_count);
      } catch {
        // API may not be available yet
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'DASH', icon: Activity },
    { id: 'operator', label: 'OPS', icon: Radio },
    { id: 'cases', label: 'CASES', icon: Briefcase },
    { id: 'investigation', label: 'INVEST', icon: Search },
    { id: 'intel-summary', label: 'INTEL', icon: Brain },
    { id: 'intelligence', label: 'ANALYSIS', icon: Shield },
    { id: 'timeline', label: 'TIMELINE', icon: Clock },
    { id: 'story', label: 'STORY', icon: BookOpen },
    { id: 'graph', label: 'GRAPH', icon: GitBranch },
    { id: 'query', label: 'QUERY', icon: MessageSquare },
    { id: 'streams', label: 'STREAMS', icon: Eye },
    { id: 'entities', label: 'ENTITIES', icon: Eye },
    { id: 'alerts', label: 'ALERTS', icon: Bell },
  ];

  return (
    <header className="bg-intel-surface border-b border-intel-border select-none">
      <div className="flex items-center h-10 px-3">
        {/* Logo — compact */}
        <button
          onClick={() => onViewChange('dashboard')}
          className="flex items-center gap-2 mr-4 flex-shrink-0"
        >
          <div className="w-5 h-5 rounded-sm bg-intel-accent/20 flex items-center justify-center">
            <Eye className="w-3 h-3 text-intel-accent" />
          </div>
          <span className="text-xs font-bold tracking-[0.2em] text-gray-200">VIOSINT</span>
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-intel-border mr-3" />

        {/* Navigation — tight horizontal tabs */}
        <nav className="flex items-center gap-0 flex-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`relative flex items-center gap-1.5 px-2.5 h-10 text-2xs font-semibold tracking-wide whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-intel-accent'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-3 h-3" />
                {item.label}
                {item.id === 'alerts' && unreadCount > 0 && (
                  <span className="ml-0.5 px-1 py-px text-2xs font-bold bg-sev-critical text-white rounded-sm leading-none">
                    {unreadCount}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-1 right-1 h-px bg-intel-accent" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Status — right side */}
        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-2xs">
            {wsConnected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-intel-accent" />
                <span className="text-intel-accent font-medium">LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-gray-600" />
                <span className="text-gray-600 font-medium">OFFLINE</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
