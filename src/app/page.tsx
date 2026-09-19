'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getLocalSession } from '@/offline/session';
import { Zap, ArrowRight } from 'lucide-react';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 space-y-10 text-center">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-brand-blue border border-blue-200 rounded-full text-xs font-extrabold tracking-wide uppercase shadow-sm">
          <Zap className="w-4 h-4 text-brand-blue" />
          <span>Offline-first billing</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-navy-900 tracking-tight leading-none">
          NoPay
        </h1>

        <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl mx-auto">
          Scan, bill, and sync securely — even when the network drops.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-base transition-all hover:scale-105"
          >
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-navy-900 border border-slate-300 font-bold rounded-2xl shadow-sm flex items-center justify-center text-base transition-all"
          >
            <span>Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
