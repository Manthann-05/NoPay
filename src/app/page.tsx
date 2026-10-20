'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getLocalSession } from '@/offline/session';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import {
  QrCode,
  ArrowRight,
  Database,
  Activity,
  Terminal,
  Check,
  Lock,
  Layers,
  Zap,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function getDashboardRouteFromSession(session: { activeRole?: string; roles?: string[] } | null | undefined) {
  if (!session) return null;

  if (session.activeRole === 'MERCHANT' && session.roles?.includes('MERCHANT')) {
    return '/merchant/dashboard';
  }

  if (session.activeRole === 'CUSTOMER' || session.roles?.includes('CUSTOMER')) {
    return '/customer/dashboard';
  }

  return null;
}

export default function HomePage() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [isChecking, setIsChecking] = useState(true);
  const didRedirectRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (didRedirectRef.current) return;

      try {
        if (isOnline) {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (!cancelled && res.ok) {
            const data = await res.json();
            const route = data?.authenticated && data?.user
              ? getDashboardRouteFromSession({
                  activeRole: data.user.activeRole,
                  roles: data.user.roles,
                })
              : null;

            if (route) {
              didRedirectRef.current = true;
              router.replace(route);
              return;
            }
          }
        }

        const session = await getLocalSession();
        if (cancelled) return;

        const localRoute = getDashboardRouteFromSession(session);
        if (localRoute) {
          didRedirectRef.current = true;
          router.replace(localRoute);
          return;
        }

        setIsChecking(false);
      } catch {
        if (cancelled) return;

        const session = await getLocalSession();
        const localRoute = getDashboardRouteFromSession(session);
        if (localRoute) {
          didRedirectRef.current = true;
          router.replace(localRoute);
          return;
        }

        setIsChecking(false);
      }
    }

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [isOnline, router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="border-2 border-border bg-surface p-6 shadow-[4px_4px_0px_0px_var(--border)] text-center font-mono">
          <div className="w-6 h-6 border-2 border-foreground border-t-transparent animate-spin mx-auto mb-3"></div>
          <span className="text-xs font-black uppercase tracking-widest text-foreground">INITIALIZING SYSTEM...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-20 py-8 md:py-14">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto text-center space-y-8 px-4 py-8">
        {/* Neobrutalist Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-border bg-surface text-foreground font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_var(--border)]">
          <span className="w-2.5 h-2.5 bg-foreground inline-block"></span>
          <span>PROTOCOL // ZERO-NETWORK POS</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black uppercase tracking-tight text-foreground leading-[0.95]">
            ZERO NETWORK.
            <br />
            ZERO DOWNTIME.
          </h1>

          <p className="text-base sm:text-lg text-foreground-muted max-w-2xl mx-auto font-mono font-medium leading-relaxed">
            High-velocity offline payments and billing ledger. Built with IndexedDB local persistence, cryptographic QR codes, and tamper-resistant P2P synchronization.
          </p>
        </div>

        {/* CTA Button Array */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/register"
            className="w-full sm:w-auto neo-btn group"
          >
            <span>LAUNCH TERMINAL</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto neo-btn-secondary"
          >
            <span>SIGN IN TO PORTAL</span>
          </Link>
        </div>
      </section>

      {/* Neobrutalist Feature Grid */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="neo-box p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 border-2 border-border bg-foreground text-background flex items-center justify-center shadow-[2px_2px_0px_0px_var(--border)]">
                <Database className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono font-black uppercase tracking-widest text-foreground-muted">
                  01 // ENGINE
                </div>
                <h3 className="text-xl font-black uppercase text-foreground tracking-tight">Offline Dexie DB</h3>
              </div>
              <p className="text-xs font-mono text-foreground-muted leading-relaxed">
                Transactions, cart items, and product inventories are written directly to IndexedDB with zero cloud dependency.
              </p>
            </div>
            <div className="pt-4 border-t-2 border-border flex items-center justify-between text-xs font-mono font-bold">
              <span>LATENCY</span>
              <span className="underline decoration-2">&lt; 1MS</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="neo-box p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 border-2 border-border bg-foreground text-background flex items-center justify-center shadow-[2px_2px_0px_0px_var(--border)]">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono font-black uppercase tracking-widest text-foreground-muted">
                  02 // SECURITY
                </div>
                <h3 className="text-xl font-black uppercase text-foreground tracking-tight">Encrypted Bill QR</h3>
              </div>
              <p className="text-xs font-mono text-foreground-muted leading-relaxed">
                Scannable barcodes encapsulate itemized records, digital signatures, and merchant verification tokens directly inside the image.
              </p>
            </div>
            <div className="pt-4 border-t-2 border-border flex items-center justify-between text-xs font-mono font-bold">
              <span>ALGORITHM</span>
              <span className="underline decoration-2">SHA-256 HMAC</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="neo-box p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 border-2 border-border bg-foreground text-background flex items-center justify-center shadow-[2px_2px_0px_0px_var(--border)]">
                <Activity className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono font-black uppercase tracking-widest text-foreground-muted">
                  03 // RECONCILIATION
                </div>
                <h3 className="text-xl font-black uppercase text-foreground tracking-tight">Auto Sync Queue</h3>
              </div>
              <p className="text-xs font-mono text-foreground-muted leading-relaxed">
                Background workers detect network reinstatement and synchronize accumulated offline records without duplication.
              </p>
            </div>
            <div className="pt-4 border-t-2 border-border flex items-center justify-between text-xs font-mono font-bold">
              <span>SYNC GUARANTEE</span>
              <span className="underline decoration-2">IDEMPOTENT</span>
            </div>
          </div>
        </div>
      </section>

      {/* Terminal Telemetry Box */}
      <section className="max-w-4xl mx-auto px-4 font-mono">
        <div className="border-2 border-border bg-surface shadow-[6px_6px_0px_0px_var(--border)]">
          <div className="px-4 py-3 bg-foreground text-background flex items-center justify-between border-b-2 border-border">
            <div className="flex items-center gap-2 text-xs font-black uppercase">
              <Terminal className="w-4 h-4" />
              <span>TERMINAL TELEMETRY</span>
            </div>
            <span className="text-[10px] font-bold border border-background px-1.5 py-0.5">
              STATUS: READY
            </span>
          </div>

          <div className="p-6 text-xs space-y-3 text-foreground">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 font-bold" />
              <span>OFFLINE STORAGE ENGINE: OK [INDEXEDDB ACTIVE]</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 font-bold" />
              <span>BROADCASTCHANNEL: LISTENING FOR PEER DISPATCH</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 font-bold" />
              <span>CRYPTOGRAPHIC BILL SIGNER: READY</span>
            </div>
            <div className="p-3 mt-4 border-2 border-border bg-background text-foreground">
              <code>$ nopay sync --verify-checksums</code>
              <div className="mt-1 font-bold">&gt;&gt; 0 CONFLICT ANOMALIES. PERSISTED RECORDS VERIFIED.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Conversion Banner */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="neo-box p-10 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-foreground">
            INITIALIZE YOUR WORKSPACE NOW
          </h2>
          <p className="text-xs sm:text-sm font-mono text-foreground-muted max-w-lg mx-auto">
            Switch freely between Customer wallet mode and Merchant point-of-sale terminal with complete offline ledger integrity.
          </p>
          <div className="flex items-center justify-center">
            <Link
              href="/register"
              className="neo-btn"
            >
              CREATE NEW PROFILE
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
