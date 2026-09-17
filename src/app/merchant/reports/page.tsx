'use client';

import React, { useState, useEffect } from 'react';
import { getOfflineTransactions } from '@/offline/queue';
import { Transaction } from '@/types';
import { BarChart3, TrendingUp, CreditCard, DollarSign, Calendar, RefreshCw } from 'lucide-react';

export default function MerchantReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const localTxns = await getOfflineTransactions();
      let serverTxns: Transaction[] = [];

      try {
        const res = await fetch('/api/transactions');
        if (res.ok) {
          const data = await res.json();
          serverTxns = data.transactions || [];
        }
      } catch (err) {
        console.warn('API fetch warning:', err);
      }

      const map = new Map<string, Transaction>();
      localTxns.forEach((t) => map.set(t.transactionId, t));
      serverTxns.forEach((t) => map.set(t.transactionId, t));

      setTransactions(Array.from(map.values()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
  const billQrRevenue = transactions
    .filter((t) => t.type === 'BILL_QR')
    .reduce((sum, t) => sum + t.amount, 0);
  const staticQrRevenue = transactions
    .filter((t) => t.type === 'STATIC_QR')
    .reduce((sum, t) => sum + t.amount, 0);
  const pendingSyncCount = transactions.filter((t) => t.status === 'PENDING_SYNC').length;

  const billQrPercent = totalRevenue > 0 ? (billQrRevenue / totalRevenue) * 100 : 50;
  const staticQrPercent = totalRevenue > 0 ? (staticQrRevenue / totalRevenue) * 100 : 50;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900">Sales Reports & Analytics</h1>
          <p className="text-xs text-slate-400">Revenue breakdown across online and offline channels</p>
        </div>
        <button
          onClick={loadTransactions}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-extrabold uppercase text-slate-400">Total Gross Sales</span>
          <p className="text-3xl font-black text-navy-900">₹{totalRevenue.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 font-medium">{transactions.length} total orders processed</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-extrabold uppercase text-slate-400">Itemized Bill QR Sales</span>
          <p className="text-3xl font-black text-brand-blue">₹{billQrRevenue.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 font-medium">From POS checkout bills</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-extrabold uppercase text-slate-400">Static QR Sales</span>
          <p className="text-3xl font-black text-purple-600">₹{staticQrRevenue.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 font-medium">From counter poster scans</p>
        </div>
      </div>

      {/* Analytics Visual Bars */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
        <h3 className="text-base font-black text-navy-900">Payment Channel Breakdown</h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-navy-900">
              <span>Itemized Bill QR Checkout ({billQrPercent.toFixed(1)}%)</span>
              <span>₹{billQrRevenue.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-brand-blue h-3 rounded-full transition-all duration-500"
                style={{ width: `${billQrPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-navy-900">
              <span>Static Merchant QR ({staticQrPercent.toFixed(1)}%)</span>
              <span>₹{staticQrRevenue.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-purple-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${staticQrPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Health Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-navy-900">Offline Queue Health</h4>
          <p className="text-xs text-slate-500">
            {pendingSyncCount > 0
              ? `${pendingSyncCount} transactions are currently waiting in local Dexie queue.`
              : 'All offline transactions are 100% synchronized with MongoDB server.'}
          </p>
        </div>
        <a
          href="/merchant/sync"
          className="px-5 py-2.5 bg-navy-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shrink-0"
        >
          Manage Sync Queue
        </a>
      </div>
    </div>
  );
}
