'use client';

import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { processSyncQueue, SyncProgress } from '@/offline/sync';
import { getPendingSyncQueue } from '@/offline/queue';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

export function OfflineBadge() {
  const { isOnline, syncState } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  const fetchQueueCount = async () => {
    try {
      const queue = await getPendingSyncQueue();
      const pending = queue.filter(item => item.state === 'PENDING_SYNC');
      const retrying = queue.filter(item => item.state === 'RETRY_PENDING');
      
      setPendingCount(pending.length);
      setRetryCount(retrying.length);
    } catch (err) {
      // IndexedDB fallback
    }
  };

  useEffect(() => {
    fetchQueueCount();
    const interval = setInterval(fetchQueueCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // Automatic sync trigger when internet connection returns
  useEffect(() => {
    if (isOnline && (pendingCount > 0 || retryCount > 0) && (!syncProgress || !syncProgress.isSyncing)) {
      triggerManualSync();
    }
  }, [isOnline, pendingCount, retryCount]);

  const triggerManualSync = async () => {
    if (!isOnline) return;
    await processSyncQueue((progress) => {
      setSyncProgress(progress);
      fetchQueueCount();
    });
  };

  const totalPending = pendingCount + retryCount;

  return (
    <div className="flex items-center gap-2">
      {/* Network Connection Pill */}
      {isOnline ? (
        syncState === 'CONNECTING' ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-brand-blue border border-blue-200 rounded-full text-xs font-semibold shadow-sm">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">Connecting</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Online</span>
          </div>
        )
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-semibold shadow-sm animate-pulse-subtle">
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Offline Mode</span>
        </div>
      )}

      {/* Sync Queue Trigger / Status Pill */}
      {totalPending > 0 && (
        <button
          onClick={triggerManualSync}
          disabled={!isOnline || syncProgress?.isSyncing}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            syncProgress?.isSyncing
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : retryCount > 0 
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 cursor-pointer'
                : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 cursor-pointer'
          }`}
          title="Click to process pending offline transactions"
        >
          {retryCount > 0 && !syncProgress?.isSyncing ? (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          ) : (
            <RefreshCw className={`w-3.5 h-3.5 ${syncProgress?.isSyncing ? 'animate-spin text-blue-600' : 'text-amber-700'}`} />
          )}
          <span>
            {syncProgress?.isSyncing
              ? `Syncing (${syncProgress.completed}/${syncProgress.total})`
              : `${totalPending} Pending`}
          </span>
        </button>
      )}
    </div>
  );
}
