'use client';

import { useState } from 'react';
import { Eye, AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';

interface LoginScreenProps {
  onLoginSuccess: (username: string, role: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const tokenData = await authApi.login(username, password);
      onLoginSuccess(tokenData.username, tokenData.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-intel-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-intel-accent/15 flex items-center justify-center mb-4">
            <Eye className="w-6 h-6 text-intel-accent" />
          </div>
          <h1 className="text-lg font-bold tracking-[0.3em] text-gray-200">VIOSINT</h1>
          <p className="text-2xs text-gray-600 mt-1 tracking-widest uppercase">Visual Intelligence OSINT Platform</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-intel-surface border border-intel-border/60 rounded-md p-6 space-y-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-2">
            Operator Login
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-sev-critical/10 border border-sev-critical/30 text-xs text-sev-critical">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-2xs text-gray-500 mb-1 uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded bg-intel-bg border border-intel-border text-sm text-gray-200 placeholder:text-gray-600 focus:border-intel-accent/50 focus:outline-none transition-colors"
              placeholder="admin"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-2xs text-gray-500 mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-intel-bg border border-intel-border text-sm text-gray-200 placeholder:text-gray-600 focus:border-intel-accent/50 focus:outline-none transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded bg-intel-accent/15 border border-intel-accent/30 text-sm font-semibold text-intel-accent hover:bg-intel-accent/25 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <p className="text-center text-2xs text-gray-700 mt-2">
            Session expires after 8 hours
          </p>
        </form>
      </div>
    </div>
  );
}
