'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  Command,
  Eye,
  LayoutDashboard,
  MonitorPlay,
  Search,
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

  const renderNavItem = (item: typeof navItems[0]) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    const showBadge = item.id === 'alerts' && unreadCount > 0;
    return (
      <button
        key={item.id}
        onClick={() => onViewChange(item.id)}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative group',
          collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
          isActive
            ? 'bg-white/[0.06] text-intel-accent'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
        )}
        title={collapsed ? item.label : undefined}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-intel-accent" />
        )}
        <div className="relative flex-shrink-0">
          <Icon className="w-[18px] h-[18px]" />
          {showBadge && collapsed && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold bg-red-500 text-white rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {showBadge && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-400 rounded">
                {unreadCount}
              </span>
            )}
          </>
        )}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-zinc-900 text-white text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-intel-border">
            {item.label}
          </div>
        )}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300 ease-in-out',
        'bg-intel-surface border-r border-intel-border',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-14 border-b border-intel-border flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'px-5'
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-intel-accent/10 flex items-center justify-center">
            <Eye className="w-4 h-4 text-intel-accent" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-white">VIOSINT</h1>
              <p className="text-[9px] text-zinc-600 tracking-widest">VISUAL INTELLIGENCE</p>
            </div>
          )}
        </div>
      </div>

      {/* Search / Command Palette Trigger */}
      {!collapsed ? (
        <div className="px-3 py-3">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-intel-border text-zinc-500 text-sm hover:border-intel-border-light hover:text-zinc-400 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left text-xs">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-intel-bg text-[10px] font-mono text-zinc-600 border border-intel-border">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>
        </div>
      ) : (
        <div className="flex justify-center py-3">
          <button
            onClick={onOpenCommandPalette}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-400 hover:bg-white/[0.03] transition-colors"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1 px-3 space-y-5">
        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
              Overview
            </p>
          )}
          <div className="space-y-0.5">
            {overviewItems.map(renderNavItem)}
          </div>
        </div>

        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
              Intelligence
            </p>
          )}
          <div className="space-y-0.5">
            {intelItems.map(renderNavItem)}
          </div>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="flex-shrink-0 border-t border-intel-border p-3 space-y-1">
        <div className={cn(
          'flex items-center gap-2.5 rounded-lg transition-colors',
          collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
          wsConnected ? 'text-intel-accent' : 'text-zinc-600'
        )}>
          {wsConnected ? <Wifi className="w-4 h-4 flex-shrink-0" /> : <WifiOff className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && (
            <div className="flex-1">
              <span className="text-xs font-medium">{wsConnected ? 'Connected' : 'Disconnected'}</span>
              <p className="text-[10px] text-zinc-700">{wsConnected ? 'Real-time active' : 'No connection'}</p>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03] transition-colors',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2'
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
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
