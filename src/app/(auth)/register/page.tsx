'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, Lock, Mail, User, Store, ArrowRight, AlertCircle } from 'lucide-react';
import { getLocalSession } from '@/offline/session';
import { notifyAuthStateChanged } from '@/lib/auth/client';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initialRole, setInitialRole] = useState<'CUSTOMER' | 'MERCHANT'>('CUSTOMER');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');

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
        // Fall back to offline session
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          initialRole,
          shopName: initialRole === 'MERCHANT' ? shopName : undefined,
          address: initialRole === 'MERCHANT' ? address : undefined,
          area: initialRole === 'MERCHANT' ? area : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.authenticated && meData.user) {
            const { user } = meData;
            await (await import('@/offline/session')).saveLocalSession(
              user.userId,
              user.name,
              user.email,
              user.roles,
              user.activeRole,
              user.merchantProfileId,
              user.merchantProfile?.shopName
            );
          }
        }
      } catch (err) {
        console.warn('Could not save offline session during registration', err);
      }

      notifyAuthStateChanged();
      router.replace(initialRole === 'MERCHANT' ? '/merchant/dashboard' : '/customer/dashboard');
    } catch (err) {
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg neo-box p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 border-2 border-border bg-foreground text-background flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_var(--border)]">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black uppercase text-foreground tracking-tight">CREATE PROFILE</h2>
          <p className="text-xs font-mono text-foreground-muted">Select role to initialize keys</p>
        </div>

        {error && (
          <div className="p-3 border-2 border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono font-bold flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>[REGISTRATION REJECTED] {error}</span>
          </div>
        )}


        {/* Role Selector Blocks */}
        <div className="grid grid-cols-2 gap-2 p-1 border-2 border-border bg-surface shadow-[3px_3px_0px_0px_var(--border)] font-mono">
          <button
            type="button"
            onClick={() => setInitialRole('CUSTOMER')}
            className={`py-2 px-3 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${
              initialRole === 'CUSTOMER'
                ? 'bg-foreground text-background'
                : 'text-foreground hover:bg-surface-hover'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>CUSTOMER</span>
          </button>
          <button
            type="button"
            onClick={() => setInitialRole('MERCHANT')}
            className={`py-2 px-3 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${
              initialRole === 'MERCHANT'
                ? 'bg-foreground text-background'
                : 'text-foreground hover:bg-surface-hover'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>MERCHANT POS</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">FULL NAME</label>
            <div className="relative">
              <User className="w-4 h-4 text-foreground-muted absolute left-3 top-3.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Manthan Kadu"
                className="neo-input pl-9 pr-3 py-2.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">EMAIL ADDRESS</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-foreground-muted absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manthan@company.com"
                className="neo-input pl-9 pr-3 py-2.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-foreground mb-1.5 uppercase">PASSWORD</label>
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

          {/* Additional Merchant Fields */}
          {initialRole === 'MERCHANT' && (
            <div className="p-4 border-2 border-border bg-background space-y-3 font-mono">
              <div className="text-xs font-black uppercase text-foreground flex items-center gap-1.5">
                <Store className="w-4 h-4" />
                <span>SHOP & TERMINAL CONFIGURATION</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-foreground-muted mb-1 uppercase">SHOP NAME</label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Apex Provisions"
                  className="neo-input px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-foreground-muted mb-1 uppercase">ADDRESS</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Terminal #104"
                    className="neo-input px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-foreground-muted mb-1 uppercase">LOCALITY</label>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Downtown Hub"
                    className="neo-input px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full neo-btn py-3 mt-2"
          >
            {loading ? 'CREATING CREDENTIALS...' : 'CREATE ACCOUNT'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-4 border-t-2 border-border text-xs font-mono text-foreground-muted flex items-center justify-between">
          <span>ALREADY REGISTERED?</span>
          <Link href="/login" className="font-bold underline text-foreground hover:opacity-80">
            SIGN IN
          </Link>
        </div>
      </div>
    </div>
  );
}
