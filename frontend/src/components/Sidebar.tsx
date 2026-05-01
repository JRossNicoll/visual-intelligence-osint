'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  Command,
  Eye,
  LayoutDashboard,
  MonitorPlay,
  Search,
  Settings,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { alertsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  wsConnected: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCommandPalette: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
  { id: 'live', label: 'Live Feed', icon: MonitorPlay, section: 'overview' },
  { id: 'streams', label: 'Streams', icon: Camera, section: 'intelligence' },
  { id: 'targets', label: 'Targets', icon: Shield, section: 'intelligence' },
  { id: 'entities', label: 'Entities', icon: Eye, section: 'intelligence' },
  { id: 'alerts', label: 'Alerts', icon: Bell, section: 'intelligence' },
];

export default function Sidebar({
  activeView,
  onViewChange,
  wsConnected,
  collapsed,
  onToggleCollapse,
  onOpenCommandPalette,
}: SidebarProps) {
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

  const overviewItems = navItems.filter((i) => i.section === 'overview');
  const intelItems = navItems.filter((i) => i.section === 'intelligence');

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300 ease-in-out',
        'bg-intel-surface/80 backdrop-blur-xl border-r border-intel-border/50',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 border-b border-intel-border/50 flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'px-5'
      )}>
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-intel-accent/20 to-intel-cyan/20 flex items-center justify-center border border-intel-accent/20 shadow-glow-sm">
            <Eye className="w-5 h-5 text-intel-accent" />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-intel-accent animate-glow-pulse" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-base font-bold tracking-wider text-white">
                VIOSINT
              </h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wide -mt-0.5">
                VISUAL INTELLIGENCE
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Search / Command Palette Trigger */}
      {!collapsed && (
        <div className="px-4 py-3">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-intel-bg/60 border border-intel-border/50 text-gray-500 text-sm hover:border-intel-border-light hover:text-gray-400 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left text-xs">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-intel-card text-[10px] font-mono text-gray-500 border border-intel-border/50">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>
        </div>
      )}
      {collapsed && (
        <div className="flex justify-center py-3">
          <button
            onClick={onOpenCommandPalette}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-400 hover:bg-intel-bg/60 transition-all"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-6">
        {/* Overview Section */}
        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Overview
            </p>
          )}
          <div className="space-y-0.5">
            {overviewItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all relative group',
                    collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                    isActive
                      ? 'bg-intel-accent/10 text-intel-accent'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-intel-accent shadow-glow-sm" />
                  )}
                  <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive && 'drop-shadow-[0_0_6px_rgba(0,255,136,0.4)]')} />
                  {!collapsed && <span>{item.label}</span>}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-intel-card text-white text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-intel-border shadow-lg">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intelligence Section */}
        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Intelligence
            </p>
          )}
          <div className="space-y-0.5">
            {intelItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              const showBadge = item.id === 'alerts' && unreadCount > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all relative group',
                    collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                    isActive
                      ? 'bg-intel-accent/10 text-intel-accent'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-intel-accent shadow-glow-sm" />
                  )}
                  <div className="relative flex-shrink-0">
                    <Icon className={cn('w-[18px] h-[18px]', isActive && 'drop-shadow-[0_0_6px_rgba(0,255,136,0.4)]')} />
                    {showBadge && collapsed && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {showBadge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded-md border border-red-500/30">
                          {unreadCount}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-intel-card text-white text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-intel-border shadow-lg">
                      {item.label}
                      {showBadge && (
                        <span className="ml-1.5 text-red-400">({unreadCount})</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="flex-shrink-0 border-t border-intel-border/50 p-3 space-y-2">
        {/* Connection Status */}
        <div className={cn(
          'flex items-center gap-2.5 rounded-lg transition-all',
          collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
          wsConnected ? 'text-intel-accent' : 'text-gray-500'
        )}>
          <div className="relative flex-shrink-0">
            {wsConnected ? (
              <Wifi className="w-[18px] h-[18px]" />
            ) : (
              <WifiOff className="w-[18px] h-[18px]" />
            )}
            {wsConnected && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-intel-accent animate-pulse" />
            )}
          </div>
          {!collapsed && (
            <div className="flex-1">
              <span className="text-xs font-medium">
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
              <p className="text-[10px] text-gray-600">
                {wsConnected ? 'Real-time active' : 'No connection'}
              </p>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] transition-all',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
