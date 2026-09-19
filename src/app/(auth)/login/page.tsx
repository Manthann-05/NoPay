'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { getLocalSession } from '@/offline/session';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function redirectAuthenticatedUser() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data.authenticated && data.user) {
            router.replace(data.user.activeRole === 'MERCHANT'
              ? '/merchant/dashboard'
              : '/customer/dashboard');
            return;
          }
        }
      } catch {
        // Fall back to the offline session below.
      }

      const session = await getLocalSession();
      if (!cancelled && session?.userId) {
        router.replace(session.activeRole === 'MERCHANT' && session.roles.includes('MERCHANT')
          ? '/merchant/dashboard'
          : '/customer/dashboard');
      }
    }

    void redirectAuthenticatedUser();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Save session for offline mode
      const { user } = data;
      await (await import('@/offline/session')).saveLocalSession(
        user.userId,
        user.name,
        user.email,
        user.roles,
        user.activeRole,
        user.merchantProfileId,
        user.merchantProfile?.shopName
      );

      router.replace(user.activeRole === 'MERCHANT' ? '/merchant/dashboard' : '/customer/dashboard');
    } catch (err) {
      setError('An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-modal space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue text-white flex items-center justify-center mx-auto shadow-md">
            <QrCode className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-navy-900">Welcome Back</h2>
          <p className="text-xs text-slate-500">Sign in to access your NoPay wallet or POS terminal</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-4 border-t border-slate-100 text-xs text-slate-500">
          Don't have an account?{' '}
          <Link href="/register" className="font-bold text-brand-blue hover:underline">
            Register now
          </Link>
        </div>
      </div>
    </div>
  );
}
