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
    const interval = setInterval(fetchUnread, 30000);
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
          'w-full flex items-center gap-3 text-[13px] transition-all duration-150 relative group rounded-md',
          collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
          isActive
            ? 'bg-g-accent/10 text-g-accent'
            : 'text-g-text-secondary hover:text-g-text hover:bg-white/[0.04]'
        )}
        title={collapsed ? item.label : undefined}
      >
        <div className="relative flex-shrink-0">
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
          {showBadge && collapsed && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold bg-g-danger text-white rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {!collapsed && (
          <>
            <span className="flex-1 text-left font-medium">{item.label}</span>
            {showBadge && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-g-danger/15 text-g-danger rounded-full">
                {unreadCount}
              </span>
            )}
          </>
        )}
        {collapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-g-card text-g-text text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 rounded-md border border-g-border shadow-lg shadow-black/30">
            {item.label}
          </div>
        )}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-200 ease-out',
        'bg-g-surface border-r border-g-border',
        collapsed ? 'w-[60px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-12 border-b border-g-border flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'px-5'
      )}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-g-accent/15 flex items-center justify-center flex-shrink-0">
            <Eye className="w-4 h-4 text-g-accent" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-g-text">VIOSINT</span>
          )}
        </div>
      </div>

      {/* Search */}
      {!collapsed ? (
        <div className="px-3 py-3">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] border border-g-border text-g-text-muted text-[13px] rounded-md hover:bg-white/[0.05] hover:border-g-border-light transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-g-text-dim bg-white/[0.04] rounded">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>
        </div>
      ) : (
        <div className="flex justify-center py-3">
          <button
            onClick={onOpenCommandPalette}
            className="p-2 text-g-text-muted hover:text-g-text hover:bg-white/[0.04] transition-all rounded-md"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-5">
        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[11px] font-medium text-g-text-dim tracking-wide uppercase">
              Overview
            </p>
          )}
          <div className="space-y-0.5">
            {overviewItems.map(renderNavItem)}
          </div>
        </div>

        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[11px] font-medium text-g-text-dim tracking-wide uppercase">
              Intelligence
            </p>
          )}
          <div className="space-y-0.5">
            {intelItems.map(renderNavItem)}
          </div>
        </div>
      </nav>

      {/* Bottom */}
      <div className="flex-shrink-0 border-t border-g-border p-3 space-y-1">
        <div className={cn(
          'flex items-center gap-2.5 rounded-md',
          collapsed ? 'justify-center p-2' : 'px-3 py-2',
        )}>
          {wsConnected ? (
            <Wifi className="w-4 h-4 text-g-success flex-shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 text-g-text-muted flex-shrink-0" />
          )}
          {!collapsed && (
            <span className="text-xs text-g-text-secondary">
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className={cn(
            'w-full flex items-center gap-2.5 text-g-text-muted hover:text-g-text hover:bg-white/[0.04] transition-all rounded-md',
            collapsed ? 'justify-center p-2' : 'px-3 py-2'
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
