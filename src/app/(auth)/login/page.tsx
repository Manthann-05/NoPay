'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { getLocalSession } from '@/offline/session';
import { notifyAuthStateChanged } from '@/lib/auth/client';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function redirectAuthenticatedUser() {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && !isSubmittingRef.current && data.authenticated && data.user) {
            router.replace(data.user.activeRole === 'MERCHANT'
              ? '/merchant/dashboard'
              : '/customer/dashboard');
            return;
          }
        }
      } catch {
        // Fall back to offline session
      }

      if (cancelled || isSubmittingRef.current) return;

      const session = await getLocalSession();
      if (!cancelled && !isSubmittingRef.current && session?.userId) {
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
    isSubmittingRef.current = true;
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
        setError(data.error || 'Authentication failed');
        return;
      }

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

      notifyAuthStateChanged();
      router.replace(user.activeRole === 'MERCHANT' ? '/merchant/dashboard' : '/customer/dashboard');
    } catch (err) {
      setError('An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md neo-box p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 border-2 border-border bg-foreground text-background flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_var(--border)]">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black uppercase text-foreground tracking-tight">TERMINAL ACCESS</h2>
          <p className="text-xs font-mono text-foreground-muted">Sign in to authenticate session keys</p>
        </div>

        {error && (
          <div className="p-3 border-2 border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono font-bold flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>[AUTH REJECTED] {error}</span>
          </div>
        )}


        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">
              EMAIL ADDRESS
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-foreground-muted absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="neo-input pl-9 pr-3 py-2.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">
              PASSWORD
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-foreground-muted absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="neo-input pl-9 pr-3 py-2.5 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full neo-btn py-3 mt-2"
          >
            {loading ? 'AUTHENTICATING...' : 'SIGN IN'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-4 border-t-2 border-border text-xs font-mono text-foreground-muted flex items-center justify-between">
          <span>NO ACCOUNT?</span>
          <Link href="/register" className="font-bold underline text-foreground hover:opacity-80">
            REGISTER TERMINAL
          </Link>
        </div>
      </div>
    </div>
  );
}
