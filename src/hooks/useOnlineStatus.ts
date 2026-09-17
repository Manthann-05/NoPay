'use client';

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

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

      setIsChecking(true);
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
        setIsChecking(false);
      }
    };

    const handleOnline = () => {
      checkRealConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic heartbeat check every 15 seconds
    const interval = setInterval(checkRealConnectivity, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, isChecking };
}
