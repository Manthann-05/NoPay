'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { processSyncQueue } from '@/offline/sync';
import { getPendingSyncQueue } from '@/offline/queue';
import { OfflineSyncQueueItem } from '@/types';
import { RefreshCw, CheckCircle2, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function MerchantSyncPage() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [queue, setQueue] = useState<OfflineSyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    try {
      const pending = await getPendingSyncQueue();
      setQueue(pending);
    } catch (err) {
      console.error('Failed to load sync queue', err);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      const result = await processSyncQueue();
      setLastSyncResult(
        `Sync completed: ${result.syncedCount} synced, ${result.failedCount} failed/pending retry.`
      );
      await loadQueue();
    } catch (err) {
      setLastSyncResult('Sync operation failed. Please check network connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <button
        onClick={() => router.push('/merchant/dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-navy-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-2xl font-black text-navy-900">Sync & Queue Manager</h1>
            <p className="text-xs text-slate-500">
              Manage local transaction queue and trigger server synchronization
            </p>
          </div>

          <button
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
            className="px-5 py-2.5 bg-brand-blue hover:bg-brand-darkBlue disabled:bg-slate-200 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
          </button>
        </div>

        {lastSyncResult && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs font-semibold text-brand-blue">
            {lastSyncResult}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-navy-900">Pending Sync Queue ({queue.length})</h3>
          {queue.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-600">All transactions are synced!</p>
              <p className="text-[11px] text-slate-400">No pending items in your local IndexedDB queue.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
              {queue.map((item) => (
                <div key={item.idempotencyKey} className="p-4 flex items-center justify-between bg-white text-xs">
                  <div className="space-y-1">
                    <p className="font-bold text-navy-900">Txn ID: {item.transactionId}</p>
                    <p className="text-[11px] text-slate-400 font-mono">Key: {item.idempotencyKey}</p>
                    <p className="text-[11px] text-slate-500">
                      Amount: ₹{item.payload.amount.toFixed(2)} • Attempts: {item.attempts}
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      item.state === 'RETRY_PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {item.state}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
