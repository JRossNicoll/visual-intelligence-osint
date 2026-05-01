'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  Bell,
  Camera,
  Eye,
  LayoutDashboard,
  MonitorPlay,
  Search,
  Shield,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  action: string;
  category: string;
}

const commands: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Overview and statistics', icon: LayoutDashboard, action: 'dashboard', category: 'Navigation' },
  { id: 'live', label: 'Live Feed', description: 'Real-time video streams', icon: MonitorPlay, action: 'live', category: 'Navigation' },
  { id: 'streams', label: 'Streams', description: 'Manage video sources', icon: Camera, action: 'streams', category: 'Navigation' },
  { id: 'targets', label: 'Targets', description: 'Intelligence targets', icon: Shield, action: 'targets', category: 'Navigation' },
  { id: 'entities', label: 'Entities', description: 'Tracked entities', icon: Eye, action: 'entities', category: 'Navigation' },
  { id: 'alerts', label: 'Alerts', description: 'Alert notifications', icon: Bell, action: 'alerts', category: 'Navigation' },
];

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        onNavigate(filtered[selectedIndex].action);
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [filtered, selectedIndex, onNavigate, onClose]
  );

  if (!isOpen) return null;

  const categories = Array.from(new Set(filtered.map((c) => c.category)));

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-slide-in-up">
        <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border-intel-border-light/30">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-intel-border/50">
            <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search commands..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
            />
            <kbd className="px-1.5 py-0.5 rounded bg-intel-card text-[10px] font-mono text-gray-500 border border-intel-border/50">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-500">
                No results found
              </div>
            ) : (
              categories.map((category) => (
                <div key={category}>
                  <p className="px-5 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                    {category}
                  </p>
                  {filtered
                    .filter((cmd) => cmd.category === category)
                    .map((cmd) => {
                      const globalIdx = filtered.indexOf(cmd);
                      const Icon = cmd.icon;
                      const isSelected = globalIdx === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            onNavigate(cmd.action);
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors',
                            isSelected
                              ? 'bg-intel-accent/10 text-white'
                              : 'text-gray-400 hover:bg-white/[0.03]'
                          )}
                        >
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                            isSelected ? 'bg-intel-accent/20 text-intel-accent' : 'bg-intel-card text-gray-500'
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{cmd.label}</p>
                            <p className="text-xs text-gray-500 truncate">{cmd.description}</p>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] text-gray-500 font-mono">Enter</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-5 py-2.5 border-t border-intel-border/50 text-[10px] text-gray-600">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-intel-card border border-intel-border/50 font-mono">
                &uarr;&darr;
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-intel-card border border-intel-border/50 font-mono">
                Enter
              </kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-intel-card border border-intel-border/50 font-mono">
                Esc
              </kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
