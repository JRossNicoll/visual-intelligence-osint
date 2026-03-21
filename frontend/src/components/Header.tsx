'use client';

import { useState, useEffect } from 'react';
import { Activity, Bell, BookOpen, Briefcase, Brain, Clock, Eye, GitBranch, MessageSquare, Radio, Search, Shield, Wifi, WifiOff } from 'lucide-react';
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
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'operator', label: 'Operator', icon: Radio },
    { id: 'cases', label: 'Cases', icon: Briefcase },
    { id: 'investigation', label: 'Investigation', icon: Search },
    { id: 'intel-summary', label: 'Intel', icon: Brain },
    { id: 'intelligence', label: 'Analysis', icon: Shield },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'story', label: 'Story Mode', icon: BookOpen },
    { id: 'graph', label: 'Graph', icon: GitBranch },
    { id: 'query', label: 'Query', icon: MessageSquare },
    { id: 'streams', label: 'Streams', icon: Eye },
    { id: 'entities', label: 'Entities', icon: Eye },
    { id: 'alerts', label: 'Alerts', icon: Bell },
  ];

  return (
    <header className="bg-intel-surface border-b border-intel-border">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-intel-accent/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-intel-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-white">VIOSINT</h1>
            <p className="text-xs text-gray-500 -mt-0.5">Visual Intelligence OSINT</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-intel-accent/10 text-intel-accent border border-intel-accent/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {item.id === 'alerts' && unreadCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            {wsConnected ? (
              <>
                <Wifi className="w-4 h-4 text-intel-accent" />
                <span className="text-intel-accent">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-gray-500" />
                <span className="text-gray-500">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
