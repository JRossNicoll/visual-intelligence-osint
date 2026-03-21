import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

export function formatRelativeTime(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = now - then;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'low': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
}

export function entityTypeIcon(type: string): string {
  switch (type) {
    case 'person': return 'User';
    case 'vehicle': return 'Car';
    default: return 'Box';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-green-400';
    case 'processing': return 'text-blue-400';
    case 'error': return 'text-red-400';
    case 'ready': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}
