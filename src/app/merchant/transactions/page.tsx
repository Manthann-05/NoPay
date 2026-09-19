'use client';

import React, { useState, useEffect } from 'react';
import { getOfflineTransactions } from '@/offline/queue';
import { Transaction } from '@/types';
import { transactionStatusLabel, transactionStatusTone } from '@/lib/status/labels';
import { FileText, Clock, CheckCircle2, Search, RefreshCw, X, ArrowUpRight } from 'lucide-react';

export default function MerchantTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'BILL_QR' | 'STATIC_QR' | 'PENDING'>('ALL');
  const [search, setSearch] = useState<string>('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

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

  const filtered = transactions.filter((t) => {
    const matchesFilter =
      filter === 'ALL'
        ? true
        : filter === 'BILL_QR'
        ? t.type === 'BILL_QR'
        : filter === 'STATIC_QR'
        ? t.type === 'STATIC_QR'
        : t.status === 'PENDING_SYNC' || t.status === 'RETRY_PENDING';

    const matchesSearch =
      t.transactionId.toLowerCase().includes(search.toLowerCase()) ||
      (t.billId && t.billId.toLowerCase().includes(search.toLowerCase())) ||
      (t.customerName && t.customerName.toLowerCase().includes(search.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900">Merchant Sales History</h1>
          <p className="text-xs text-slate-400">Complete log of online and offline transactions</p>
        </div>
        <button
          onClick={loadTransactions}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Transaction ID, Bill ID, or Customer Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {(['ALL', 'BILL_QR', 'STATIC_QR', 'PENDING'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === tab
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'ALL'
                ? 'All Sales'
                : tab === 'BILL_QR'
                ? 'Itemized Bill QR'
                : tab === 'STATIC_QR'
                ? 'Static QR'
                : 'Offline Queued'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">Loading sales records...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">No matching sales records.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Txn ID</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Sync Status</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-navy-900">
                {filtered.map((t) => (
                  <tr key={t.transactionId} className="hover:bg-slate-50/50">
                    <td className="p-4 font-mono font-bold">{t.transactionId}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-extrabold text-[10px] rounded-md">
                        {t.type}
                      </span>
                    </td>
                    <td className="p-4 font-black text-brand-blue">₹{t.amount.toFixed(2)}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md flex items-center gap-1 w-fit ${transactionStatusTone(t.status)}`}
                      >
                        {t.status === 'PENDING_SYNC' || t.status === 'RETRY_PENDING' ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {transactionStatusLabel(t.status).toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-[11px]">
                      {new Date(t.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedTxn(t)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Details Modal Drawer */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-navy-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 relative shadow-2xl">
            <button
              onClick={() => setSelectedTxn(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-navy-900"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Transaction Receipt
              </span>
              <h3 className="text-xl font-black text-navy-900">{selectedTxn.transactionId}</h3>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Payment Type</span>
                <span className="font-bold text-navy-900">{selectedTxn.type}</span>
              </div>
              {selectedTxn.billId && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Bill ID</span>
                  <span className="font-mono text-navy-900">{selectedTxn.billId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Idempotency Key</span>
                <span className="font-mono text-[10px] text-slate-600 truncate max-w-[180px]">
                  {selectedTxn.idempotencyKey}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700">Total Amount</span>
                <span className="text-lg font-black text-brand-blue">₹{selectedTxn.amount.toFixed(2)}</span>
              </div>
            </div>

            {selectedTxn.items && selectedTxn.items.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Item Breakdown
                </span>
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {selectedTxn.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between text-xs">
                      <span>
                        {item.name} ({item.quantity}x)
                      </span>
                      <span className="font-bold">₹{(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedTxn(null)}
              className="w-full py-3 bg-navy-900 text-white font-bold rounded-xl hover:bg-slate-800 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
