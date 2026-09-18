'use client';

import { useState, useEffect } from 'react';

export type SyncState = 'IDLE' | 'CONNECTING' | 'SYNCING';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<SyncState>('IDLE');

  useEffect(() => {
    // Set initial status based on browser navigator
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const checkRealConnectivity = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      setSyncState('CONNECTING');
      try {
        // Heartbeat API check with low timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch('/api/auth/me', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);

        setIsOnline(res.ok || res.status < 500);
      } catch (err) {
        setIsOnline(false);
      } finally {
        setSyncState('IDLE');
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      checkRealConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check without periodic polling
    if (navigator.onLine) {
      checkRealConnectivity();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isChecking: syncState === 'CONNECTING', syncState, setSyncState };
}
