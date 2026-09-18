'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOfflineTransactions } from '@/offline/queue';
import { Transaction } from '@/types';
import { ArrowLeft, Clock, CheckCircle2, ShoppingBag, ArrowUpRight, Search, WifiOff, RefreshCw } from 'lucide-react';

export default function CustomerTransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED'>('ALL');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // 1. Fetch offline Dexie transactions
      const localTxns = await getOfflineTransactions();

      // 2. Fetch server transactions if online
      let serverTxns: Transaction[] = [];
      try {
        const res = await fetch('/api/transactions');
        if (res.ok) {
          const data = await res.json();
          serverTxns = data.transactions || [];
        }
      } catch (err) {
        console.warn('Could not fetch server transactions:', err);
      }

      // Merge and deduplicate by transactionId
      const map = new Map<string, Transaction>();
      localTxns.forEach((t) => map.set(t.transactionId, t));
      serverTxns.forEach((t) => map.set(t.transactionId, t));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTransactions(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTxns = transactions.filter((t) => {
    if (filter === 'PENDING') return t.status === 'PENDING_SYNC' || t.status === 'RETRY_PENDING';
    if (filter === 'CONFIRMED') return t.status === 'CONFIRMED' || t.status === 'SYNCED';
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/customer/dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-navy-900 mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <h1 className="text-2xl font-black text-navy-900">Transaction History</h1>
        </div>
        <button
          onClick={loadTransactions}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
        {(['ALL', 'PENDING', 'CONFIRMED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all ${
              filter === tab ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900'
            }`}
          >
            {tab === 'ALL' ? 'All Transactions' : tab === 'PENDING' ? 'Offline Queued' : 'Synced'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-400">Loading history...</div>
      ) : filteredTxns.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-navy-900">No Transactions Found</h3>
          <p className="text-xs text-slate-500">Scan a QR code to complete your first payment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTxns.map((t) => (
            <div
              key={t.transactionId}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    t.status === 'PENDING_SYNC'
                      ? 'bg-amber-50 text-amber-600'
                      : t.status === 'RETRY_PENDING'
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {t.status === 'PENDING_SYNC' || t.status === 'RETRY_PENDING' ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-navy-900">{t.merchantName}</h4>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                        t.status === 'PENDING_SYNC'
                          ? 'bg-amber-100 text-amber-800'
                          : t.status === 'RETRY_PENDING'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {t.status === 'PENDING_SYNC'
                        ? 'OFFLINE QUEUED'
                        : t.status === 'RETRY_PENDING'
                        ? 'RETRY PENDING'
                        : 'CONFIRMED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {new Date(t.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-base font-black text-navy-900">₹{t.amount.toFixed(2)}</span>
                <p className="text-[10px] text-slate-400 font-mono">{t.transactionId}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
