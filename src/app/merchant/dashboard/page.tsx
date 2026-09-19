'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOfflineTransactions, getPendingSyncQueue } from '@/offline/queue';
import { Transaction } from '@/types';
import { transactionStatusLabel, transactionStatusTone } from '@/lib/status/labels';
import {
  Store,
  CreditCard,
  QrCode,
  Package,
  TrendingUp,
  Clock,
  ArrowRight,
  PlusCircle,
  FileText,
  BarChart3,
  RefreshCw,
  Zap,
} from 'lucide-react';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function MerchantDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    todayRevenue: 0,
    totalSalesCount: 0,
    pendingSyncCount: 0,
    activeProductsCount: 0,
  });
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Load local Dexie data first (completely offline)
      const { offlineDb } = await import('@/offline/db');
      const pendingQueue = await getPendingSyncQueue();
      const localTxns = await getOfflineTransactions();
      let productsCount = await offlineDb.products.count();

      let serverTxns: Transaction[] = [];

      // 2. Fetch online API products & transactions only if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const prodRes = await fetch('/api/products');
          if (prodRes.ok) {
            const prodData = await prodRes.json();
            if (prodData.products) productsCount = prodData.products.length;
          }

          const txnRes = await fetch('/api/transactions');
          if (txnRes.ok) {
            const txnData = await txnRes.json();
            serverTxns = txnData.transactions || [];
          }
        } catch (e) {
          console.warn('API fetch warning:', e);
        }
      }

      // Merge transactions
      const map = new Map<string, Transaction>();
      localTxns.forEach((t) => map.set(t.transactionId, t));
      serverTxns.forEach((t) => map.set(t.transactionId, t));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const totalRevenue = merged.reduce((sum, t) => sum + t.amount, 0);

      setStats({
        todayRevenue: totalRevenue,
        totalSalesCount: merged.length,
        pendingSyncCount: pendingQueue.length,
        activeProductsCount: productsCount,
      });

      setRecentTxns(merged.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-navy-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-lightBlue px-3 py-1 bg-white/10 rounded-full">
            Merchant POS Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Merchant Dashboard</h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Offline-First Billing System. Create itemized QR bills, accept instant QR payments, and manage sync queues seamlessly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/merchant/billing"
            className="px-6 py-3.5 bg-brand-blue hover:bg-blue-600 text-white font-black rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Open POS Billing</span>
          </Link>
          <Link
            href="/merchant/static-qr"
            className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2"
          >
            <QrCode className="w-4 h-4 text-brand-lightBlue" />
            <span>Static QR Poster</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider">Total Sales</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-navy-900">₹{stats.todayRevenue.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 font-medium">Combined online & offline revenue</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider">Total Transactions</span>
            <FileText className="w-5 h-5 text-brand-blue" />
          </div>
          <p className="text-3xl font-black text-navy-900">{stats.totalSalesCount}</p>
          <p className="text-[11px] text-slate-500 font-medium">Processed order count</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider">Offline Queued</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-black text-navy-900">{stats.pendingSyncCount}</p>
            {stats.pendingSyncCount > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                Pending Sync
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Awaiting auto server sync</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider">Products</span>
            <Package className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-black text-navy-900">{stats.activeProductsCount}</p>
          <p className="text-[11px] text-slate-500 font-medium">Items in inventory catalog</p>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/merchant/billing"
          className="bg-blue-50/70 border border-blue-100 p-5 rounded-2xl hover:border-brand-blue hover:shadow-md transition-all group space-y-2"
        >
          <div className="w-10 h-10 bg-brand-blue text-white rounded-xl flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-navy-900 group-hover:text-brand-blue transition-colors">
            POS Billing Workspace
          </h3>
          <p className="text-xs text-slate-500">Live cart building & instant Bill QR generator</p>
        </Link>

        <Link
          href="/merchant/products"
          className="bg-slate-50 border border-slate-200 p-5 rounded-2xl hover:border-slate-300 hover:shadow-md transition-all group space-y-2"
        >
          <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-navy-900 group-hover:text-purple-600 transition-colors">
            Product Catalog
          </h3>
          <p className="text-xs text-slate-500">Manage prices, stock & barcode numbers</p>
        </Link>

        <Link
          href="/merchant/sync"
          className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl hover:border-amber-400 hover:shadow-md transition-all group space-y-2"
        >
          <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-navy-900 group-hover:text-amber-600 transition-colors">
            Sync Center ({stats.pendingSyncCount})
          </h3>
          <p className="text-xs text-slate-500">Review pending transactions and sync now</p>
        </Link>

        <Link
          href="/merchant/reports"
          className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl hover:border-emerald-400 hover:shadow-md transition-all group space-y-2"
        >
          <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-navy-900 group-hover:text-emerald-600 transition-colors">
            Sales Reports
          </h3>
          <p className="text-xs text-slate-500">Analytics charts & payment distribution</p>
        </Link>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-navy-900">Recent Transactions</h3>
            <p className="text-xs text-slate-400">Latest sales across static & bill QR payments</p>
          </div>
          <Link
            href="/merchant/transactions"
            className="text-xs font-extrabold text-brand-blue hover:text-brand-darkBlue flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentTxns.length === 0 ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400">No transactions recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTxns.map((t) => (
              <div key={t.transactionId} className="py-3.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy-900">{t.transactionId}</span>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                        t.type === 'BILL_QR' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.type}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${transactionStatusTone(
                        t.status
                      )}`}
                    >
                      {transactionStatusLabel(t.status)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {new Date(t.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <span className="text-base font-black text-navy-900">₹{t.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
