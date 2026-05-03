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
          'w-full flex items-center gap-3 text-[11px] font-mono transition-colors relative group',
          collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
          isActive
            ? 'bg-white/[0.06] text-zinc-100 border-l-2 border-zinc-100'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border-l-2 border-transparent'
        )}
        title={collapsed ? item.label : undefined}
      >
        <div className="relative flex-shrink-0">
          <Icon className="w-4 h-4" />
          {showBadge && collapsed && (
            <span className="absolute -top-1 -right-1 w-3 h-3 flex items-center justify-center text-[7px] font-bold bg-red-500 text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {!collapsed && (
          <>
            <span className="flex-1 text-left uppercase tracking-wider">{item.label}</span>
            {showBadge && (
              <span className="px-1 py-0.5 text-[9px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                {unreadCount}
              </span>
            )}
          </>
        )}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-900 text-zinc-200 text-[10px] font-mono uppercase opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-intel-border">
            {item.label}
          </div>
        )}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-200 ease-in-out',
        'bg-intel-surface border-r border-intel-border',
        collapsed ? 'w-[56px]' : 'w-[280px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-12 border-b border-intel-border flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'px-4'
      )}>
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          {!collapsed && (
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-mono font-semibold tracking-widest text-zinc-200">VIOSINT</span>
              <span className="text-[8px] font-mono text-zinc-600 tracking-widest">v0.1</span>
            </div>
          )}
        </div>
      </div>

      {/* Search / Command Palette Trigger */}
      {!collapsed ? (
        <div className="px-3 py-2.5">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-1.5 border border-intel-border text-zinc-600 text-[11px] font-mono hover:border-intel-border-light hover:text-zinc-400 transition-colors"
          >
            <Search className="w-3 h-3" />
            <span className="flex-1 text-left">search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-mono text-zinc-600 border border-intel-border">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>
        </div>
      ) : (
        <div className="flex justify-center py-2.5">
          <button
            onClick={onOpenCommandPalette}
            className="p-2 text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03] transition-colors"
            title="Search (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1 space-y-4">
        <div>
          {!collapsed && (
            <p className="px-4 mb-1.5 mono-label">
              Overview
            </p>
          )}
          <div className="space-y-px">
            {overviewItems.map(renderNavItem)}
          </div>
        </div>

        <div>
          {!collapsed && (
            <p className="px-4 mb-1.5 mono-label">
              Intelligence
            </p>
          )}
          <div className="space-y-px">
            {intelItems.map(renderNavItem)}
          </div>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="flex-shrink-0 border-t border-intel-border p-3 space-y-1">
        <div className={cn(
          'flex items-center gap-2 transition-colors',
          collapsed ? 'justify-center p-2' : 'px-3 py-1.5',
        )}>
          {wsConnected ? (
            <Wifi className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
          )}
          {!collapsed && (
            <div className="flex-1 font-mono">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                {wsConnected ? 'LINK:OK' : 'LINK:NONE'}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className={cn(
            'w-full flex items-center gap-2 text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03] transition-colors',
            collapsed ? 'justify-center p-2' : 'px-3 py-1.5'
          )}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : (
            <>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
