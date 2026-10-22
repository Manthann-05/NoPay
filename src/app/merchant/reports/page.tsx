'use client';

import React, { useState, useEffect } from 'react';
import { getMerchantOfflineTransactions } from '@/offline/queue';
import { Transaction } from '@/types';
import { BarChart3, TrendingUp, CreditCard, Calendar, RefreshCw, ArrowRight } from 'lucide-react';

function startOf(period: 'week' | 'month'): Date {
  const d = new Date();
  if (period === 'week') {
    const day = d.getDay();
    d.setDate(d.getDate() - day);
  } else {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function groupByDay(txns: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  txns.forEach((t) => {
    const day = new Date(t.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
    map[day] = (map[day] || 0) + t.amount;
  });
  return map;
}

export default function MerchantReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const localTxns = await getMerchantOfflineTransactions();
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

      const all = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setTransactions(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Period filter ---
  const filtered = period === 'all'
    ? transactions
    : transactions.filter((t) => new Date(t.createdAt) >= startOf(period as 'week' | 'month'));

  // --- Metrics ---
  const ledgerRecords = filtered.filter((t) => t.status === 'CONFIRMED' || t.status === 'SYNCED');
  const recordedAmount = ledgerRecords.reduce((sum, t) => sum + t.amount, 0);
  const billQrAmount = ledgerRecords.filter((t) => t.type === 'BILL_QR').reduce((sum, t) => sum + t.amount, 0);
  const staticQrAmount = ledgerRecords.filter((t) => t.type === 'STATIC_QR').reduce((sum, t) => sum + t.amount, 0);
  const txnCount = ledgerRecords.length;
  const avgRecord = txnCount > 0 ? recordedAmount / txnCount : 0;
  const pendingCount = transactions.filter((t) =>
    t.status === 'LOCAL_CREATED' ||
    t.status === 'PENDING_SYNC' ||
    t.status === 'SYNCING' ||
    t.status === 'RETRY_PENDING'
  ).length;

  const billQrPercent = recordedAmount > 0 ? (billQrAmount / recordedAmount) * 100 : 0;
  const staticQrPercent = recordedAmount > 0 ? (staticQrAmount / recordedAmount) * 100 : 0;

  // --- Daily breakdown bar chart ---
  const dailyMap = groupByDay(ledgerRecords);
  const dailyEntries = Object.entries(dailyMap).slice(-7); // last 7 days max
  const maxDailyVal = Math.max(...dailyEntries.map(([, v]) => v), 1);

  return (
    <div className="merchant-theme max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900">Transaction Record Reports</h1>
          <p className="text-xs text-slate-400">QR record totals are not payment totals; NoPay cannot confirm payments made outside its online checkout.</p>
        </div>
        <button
          onClick={loadTransactions}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {(['week', 'month', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              period === p
                ? 'bg-navy-900 shadow-sm'
                : 'bg-white border text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
          </button>
        ))}
        {loading && (
          <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin ml-2" />
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Recorded Amount</span>
          <p className="text-2xl font-black text-navy-900">₹{recordedAmount.toFixed(0)}</p>
          <p className="text-[11px] text-slate-500">{txnCount} records received by NoPay</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Average Record</span>
          <p className="text-2xl font-black text-emerald-600">₹{avgRecord.toFixed(0)}</p>
          <p className="text-[11px] text-slate-500">per transaction</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Bill QR</span>
          <p className="text-2xl font-black text-brand-blue">₹{billQrAmount.toFixed(0)}</p>
          <p className="text-[11px] text-slate-500">records received by NoPay</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Static QR</span>
          <p className="text-2xl font-black text-purple-600">₹{staticQrAmount.toFixed(0)}</p>
          <p className="text-[11px] text-slate-500">records received by NoPay</p>
        </div>
      </div>

      {/* Daily Bar Chart */}
      {dailyEntries.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-navy-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-blue" />
            Daily Synced Record Breakdown
          </h3>
          <div className="flex items-end gap-2 h-28">
            {dailyEntries.map(([day, amount]) => {
              const pct = Math.max(4, Math.round((amount / maxDailyVal) * 100));
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[9px] font-bold text-navy-900">₹{amount >= 1000 ? `${(amount/1000).toFixed(1)}k` : amount.toFixed(0)}</span>
                  <div
                    className="w-full bg-brand-blue/80 hover:bg-brand-blue rounded-t-lg transition-all"
                    style={{ height: `${pct}%` }}
                    title={`₹${amount.toFixed(2)}`}
                  />
                  <span className="text-[8px] text-slate-400 font-medium truncate w-full text-center">{day.split(' ').slice(0, 2).join(' ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Channel Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
        <h3 className="text-sm font-black text-navy-900">Synced Record Type Breakdown</h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-navy-900">
              <span>Itemized Bill QR ({billQrPercent.toFixed(1)}%)</span>
              <span>₹{billQrAmount.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-brand-blue h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${billQrPercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-navy-900">
              <span>Static Merchant QR ({staticQrPercent.toFixed(1)}%)</span>
              <span>₹{staticQrAmount.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${staticQrPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions in period */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-navy-900">Recent Transaction Records</h3>
            <a href="/merchant/transactions" className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.slice(0, 6).map((t) => (
              <div key={t.transactionId} className="flex items-center justify-between py-3 text-xs">
                <div>
                  <p className="font-bold text-navy-900 font-mono">{t.transactionId.slice(0, 16)}…</p>
                  <p className="text-[11px] text-slate-400">{formatDate(t.createdAt)} · {t.type}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-base text-navy-900">₹{t.amount.toFixed(2)}</p>
                  <span className="text-[10px] font-bold text-slate-500">QR record</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Records Waiting for Connection */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-amber-900">{pendingCount} pending transaction record{pendingCount > 1 ? 's' : ''}</p>
            <p className="text-[11px] text-amber-700">NoPay does not confirm payments made outside its online checkout. Check your payment app or bank separately.</p>
          </div>
          <a
            href="/merchant/transactions"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-all"
          >
            Review Records
          </a>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm space-y-2">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-500">No transaction records for this period</p>
          <p className="text-xs text-slate-400">Create records or sync offline transactions to see them here.</p>
        </div>
      )}
    </div>
  );
}
