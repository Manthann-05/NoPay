'use client';

import React, { useState, useEffect } from 'react';
import { getPendingSyncQueue, getOfflineTransactions } from '@/offline/queue';
import { processSyncQueue, SyncProgress } from '@/offline/sync';
import { OfflineSyncQueueItem, Transaction } from '@/types';
import { RefreshCw, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Zap, Server } from 'lucide-react';

export default function MerchantSyncPage() {
  const [queue, setQueue] = useState<OfflineSyncQueueItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const q = await getPendingSyncQueue();
      const txns = await getOfflineTransactions();
      setQueue(q);
      setTransactions(txns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    await processSyncQueue((p) => {
      setProgress(p);
    });
    await loadData();
    setIsSyncing(false);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900">Sync Manager & Queue Center</h1>
          <p className="text-xs text-slate-400">
            Inspect Dexie.js IndexedDB queue, idempotency keys, and trigger manual server synchronization
          </p>
        </div>
        <button
          onClick={handleTriggerSync}
          disabled={isSyncing || queue.length === 0}
          className="px-6 py-3 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Progress Notification */}
      {progress && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between text-xs text-brand-darkBlue font-semibold">
          <span>{progress.message || `Syncing items... (${progress.completed}/${progress.total})`}</span>
          <span className="font-mono">{progress.completed} / {progress.total}</span>
        </div>
      )}

      {/* Queue Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-extrabold uppercase text-slate-400">Pending Queue Size</span>
          <p className="text-3xl font-black text-amber-500">{queue.length}</p>
          <p className="text-[11px] text-slate-500">Transactions awaiting server sync</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-extrabold uppercase text-slate-400">Total IndexedDB Txns</span>
          <p className="text-3xl font-black text-navy-900">{transactions.length}</p>
          <p className="text-[11px] text-slate-500">Stored in local browser storage</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-extrabold uppercase text-slate-400">Idempotency Protection</span>
          <p className="text-xl font-black text-emerald-600 flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-6 h-6" /> 100% Active
          </p>
          <p className="text-[11px] text-slate-500">Server deduplicates repeated syncs</p>
        </div>
      </div>

      {/* Sync Queue Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-black text-navy-900">Pending Sync Items</h3>
          <button
            onClick={loadData}
            className="text-xs text-brand-blue font-bold hover:underline"
          >
            Refresh List
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400">Loading queue status...</div>
        ) : queue.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-navy-900">Sync Queue is Clear!</p>
            <p className="text-xs text-slate-400">All local transactions are synchronized with MongoDB.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Queue ID</th>
                  <th className="p-3">Txn ID</th>
                  <th className="p-3">Idempotency Key</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Last Attempt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-navy-900">
                {queue.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-mono text-[11px]">{item.id}</td>
                    <td className="p-3 font-mono font-bold">{item.transactionId}</td>
                    <td className="p-3 font-mono text-[10px] text-slate-500">{item.idempotencyKey}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-md">
                        {item.state}
                      </span>
                    </td>
                    <td className="p-3 font-bold">{item.attempts}</td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {item.lastAttemptAt ? new Date(item.lastAttemptAt).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
