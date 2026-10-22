'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  getMerchantOfflineTransactions,
  isCurrentMerchantTransaction,
} from '@/offline/queue';
import { offlineDb } from '@/offline/db';
import { subscribeToTransactionEvents } from '@/offline/liveChannel';
import { Transaction } from '@/types';
import { transactionStatusLabel, transactionStatusTone } from '@/lib/status/labels';
import { useSnackbar } from '@/components/shared/SnackbarProvider';
import { FileText, Clock, CheckCircle2, Search, RefreshCw, X, ArrowUpRight, ShieldCheck, AlertCircle } from 'lucide-react';

export default function MerchantTransactionsPage() {
  const { showSnackbar } = useSnackbar();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'BILL_QR' | 'STATIC_QR' | 'PENDING'>('ALL');
  const [search, setSearch] = useState<string>('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const refreshInProgress = useRef(false);

  useEffect(() => {
    loadTransactions();

    // Listen to transaction events from this window or another tab on this device.
    const unsubscribe = subscribeToTransactionEvents((detail) => {
      void isCurrentMerchantTransaction(detail.transaction)
        .then((isCurrentMerchant) => {
          if (!isCurrentMerchant) return;

          setTransactions((prev) => {
            const map = new Map<string, Transaction>();
            map.set(detail.transaction.transactionId, detail.transaction);
            prev.forEach((t) => {
              if (!map.has(t.transactionId)) map.set(t.transactionId, t);
            });
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });

          if (detail.action === 'CREATED') {
            showSnackbar({
              type: detail.isOffline ? 'pending' : 'success',
              title: detail.isOffline ? 'New Offline Record Received' : 'Transaction Record Created',
              description: `₹${detail.transaction.amount.toFixed(2)} · ${detail.transaction.transactionId}. NoPay has not verified a money transfer.`,
              durationMs: 5000,
            });
          } else if (detail.action === 'SYNCED') {
            showSnackbar({
              type: 'success',
              title: 'Transaction Record Synced',
              description: `₹${detail.transaction.amount.toFixed(2)} · ${detail.transaction.transactionId} is recorded in the NoPay ledger.`,
              durationMs: 4000,
            });
          }
        })
        .catch((err: unknown) => console.warn('Could not verify merchant transaction event:', err));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const refreshWhenOnline = () => {
      if (!document.hidden && navigator.onLine) void loadTransactions(false);
    };
    const interval = window.setInterval(refreshWhenOnline, 10000);
    window.addEventListener('online', refreshWhenOnline);
    document.addEventListener('visibilitychange', refreshWhenOnline);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', refreshWhenOnline);
      document.removeEventListener('visibilitychange', refreshWhenOnline);
    };
  }, []);

  const loadTransactions = async (showLoading = true) => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    if (showLoading) setLoading(true);
    try {
      const localTxns = await getMerchantOfflineTransactions();
      let serverTxns: Transaction[] = [];

      if (navigator.onLine) {
        const res = await fetch('/api/transactions');
        if (res.ok) {
          const data = await res.json();
          serverTxns = data.transactions || [];
          if (serverTxns.length > 0) {
            await offlineDb.transactions.bulkPut(serverTxns);
          }
        }
      }

      const map = new Map<string, Transaction>();
      // Put local transactions first, and server ones can complement / override with synced state
      localTxns.forEach((t) => map.set(t.transactionId, t));
      serverTxns.forEach((t) => map.set(t.transactionId, t));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTransactions(merged);
    } catch (err) {
      console.warn('Could not refresh merchant transaction records:', err);
    } finally {
      refreshInProgress.current = false;
      if (showLoading) setLoading(false);
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
          <h1 className="text-2xl font-black text-navy-900">Merchant Transaction Records</h1>
          <p className="text-xs text-slate-500">
            Server-synced records refresh automatically and are cached on this device. A customer’s record cannot reach your device while both phones are offline.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void loadTransactions()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
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
                : 'Offline Queued / Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">Loading transaction records...</div>
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
                  <th className="p-4">Payment Status</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-navy-900">
                {filtered.map((t) => (
                  <tr key={t.transactionId} className="hover:bg-slate-50/50">
                    <td className="p-4 font-mono font-bold">
                      {t.transactionId}
                    </td>
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
                          <Clock className="w-3 h-3 animate-pulse" />
                        ) : t.status === 'CONFIRMED' || t.status === 'SYNCED' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        <span>{transactionStatusLabel(t.status)}</span>
                      </span>
                    </td>
                    <td className="p-4 text-[10px] font-semibold">
                      <span>
                        {t.paymentStatus === 'PAID'
                          ? 'Provider payment captured'
                          : t.paymentStatus === 'AUTOPAY_SCHEDULED'
                            ? 'AutoPay scheduled'
                            : t.paymentStatus === 'FAILED'
                              ? 'Debit failed'
                              : 'Unverified'}
                      </span>
                      {t.autopayStatus && (
                        <span className="mt-1 block text-slate-500">
                          {t.autopayStatus === 'TRANSFER_PENDING'
                            ? 'Merchant payout pending'
                            : t.autopayStatus === 'TRANSFERRED'
                              ? 'Transfer processed · bank settlement separate'
                              : t.autopayStatus === 'TRANSFER_FAILED'
                                ? 'Merchant payout failed'
                                : t.autopayStatus === 'SCHEDULED'
                                  ? `Debit scheduled${t.autopayPaymentAfter ? ` · ${new Date(t.autopayPaymentAfter).toLocaleString()}` : ''}`
                                  : t.autopayStatus === 'CAPTURED'
                                    ? 'Merchant payout processing'
                                  : t.autopayStatus === 'FAILED'
                                    ? 'Debit failed'
                                    : t.autopayStatus.replaceAll('_', ' ')}
                        </span>
                      )}
                      {t.payoutStatus && (
                        <span className="mt-1 block text-slate-500">
                          {t.payoutStatus === 'TRANSFERRED'
                            ? 'Merchant transfer processed · bank settlement separate'
                            : t.payoutStatus === 'TRANSFER_PENDING'
                              ? 'Merchant transfer pending'
                              : t.payoutStatus === 'TRANSFER_FAILED'
                                ? 'Merchant transfer failed · review required'
                                : 'Merchant transfer pending'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      {t.customerName || 'Customer'}
                    </td>
                    <td className="p-4 text-slate-400 text-[11px] font-mono">
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
                Transaction Record
              </span>
              <h3 className="text-xl font-black text-navy-900">{selectedTxn.transactionId}</h3>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Payment Type</span>
                <span className="font-bold text-navy-900">{selectedTxn.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Current State</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${transactionStatusTone(selectedTxn.status)}`}>
                  {transactionStatusLabel(selectedTxn.status)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Payment Status</span>
                <span className="font-semibold">
                  {selectedTxn.paymentStatus === 'PAID'
                    ? 'Provider debit captured'
                    : selectedTxn.paymentStatus === 'AUTOPAY_SCHEDULED'
                      ? 'AutoPay debit scheduled'
                      : selectedTxn.paymentStatus === 'FAILED'
                        ? 'AutoPay debit failed'
                        : 'Unverified'}
                </span>
              </div>
              {selectedTxn.autopayStatus && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Merchant Payout</span>
                  <span className="font-semibold">
                    {selectedTxn.autopayStatus === 'TRANSFERRED'
                      ? 'Transfer processed; bank settlement is separate'
                      : selectedTxn.autopayStatus === 'TRANSFER_PENDING'
                        ? 'Pending'
                        : selectedTxn.autopayStatus === 'TRANSFER_FAILED'
                          ? 'Failed · support action required'
                          : selectedTxn.autopayStatus.replaceAll('_', ' ')}
                  </span>
                </div>
              )}
              {selectedTxn.billId && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Bill ID</span>
                  <span className="font-mono text-navy-900">{selectedTxn.billId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Customer</span>
                <span className="font-semibold text-navy-900">{selectedTxn.customerName || 'Customer'}</span>
              </div>
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
