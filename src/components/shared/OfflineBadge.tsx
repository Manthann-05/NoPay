'use client';

import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { processSyncQueue, SyncProgress } from '@/offline/sync';
import { getPendingSyncQueue } from '@/offline/queue';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

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
    <div className="flex items-center gap-1.5 font-mono">
      {/* Network Connection Indicator */}
      {isOnline ? (
        syncState === 'CONNECTING' ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-border bg-surface text-foreground text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_var(--border)]">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
            <span className="hidden sm:inline">CONNECTING</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-border bg-surface text-foreground text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_var(--border)]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse inline-block"></span>
            <Wifi className="w-3 h-3 text-emerald-500" />
            <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400">ONLINE</span>
          </div>
        )
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_var(--border)]">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
          <WifiOff className="w-3 h-3 text-rose-500" />
          <span className="hidden sm:inline">OFFLINE MODE</span>
        </div>
      )}

      {/* Sync Queue Pill */}
      {totalPending > 0 && (
        <button
          onClick={triggerManualSync}
          disabled={!isOnline || syncProgress?.isSyncing}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 border-2 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer ${
            retryCount > 0
              ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}
          title="Click to process pending offline transactions"
        >
          {retryCount > 0 && !syncProgress?.isSyncing ? (
            <AlertTriangle className="w-3 h-3 text-rose-500" />
          ) : (
            <RefreshCw className={`w-3 h-3 ${syncProgress?.isSyncing ? 'animate-spin' : ''}`} />
          )}
          <span>
            {syncProgress?.isSyncing
              ? `SYNC (${syncProgress.completed}/${syncProgress.total})`
              : `${totalPending} PENDING`}
          </span>
        </button>
      )}

    </div>
  );
}
