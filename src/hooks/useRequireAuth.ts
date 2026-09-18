'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLocalSession } from '@/offline/session';

/** Client UX guard. Server middleware and APIs remain authoritative. */
export function useRequireAuth() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const session = await getLocalSession();
      if (cancelled) return;
      if (session?.userId) return;

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const res = await fetch('/api/auth/me');
          if (res.ok) return;
        } catch {
          // fall through to login
        }
      }

      router.replace('/login');
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);
}

export function useRequireMerchant() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const session = await getLocalSession();
      if (cancelled) return;

      const hasMerchantRole = Boolean(session?.roles?.includes('MERCHANT'));
      if (hasMerchantRole) return;

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.user?.roles?.includes('MERCHANT')) return;
          }
        } catch {
          // fall through
        }
      }

      if (!session?.userId) {
        router.replace('/login');
        return;
      }
      router.replace('/unauthorized');
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);
}
