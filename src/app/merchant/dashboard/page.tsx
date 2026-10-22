'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMerchantOfflineTransactions, isCurrentMerchantTransaction } from '@/offline/queue';
import { subscribeToTransactionEvents } from '@/offline/liveChannel';
import { Transaction } from '@/types';
import { useSnackbar } from '@/components/shared/SnackbarProvider';
import {
  CreditCard,
  QrCode,
  Package,
  TrendingUp,
  ArrowRight,
  FileText,
  BarChart3,
  Zap,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function MerchantDashboardPage() {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [stats, setStats] = useState({
    recordedAmount: 0,
    totalRecordCount: 0,
    activeProductsCount: 0,
  });
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDashboardData();

    const refreshWhenVisible = () => {
      if (!document.hidden && navigator.onLine) void loadDashboardData();
    };
    const refreshInterval = window.setInterval(refreshWhenVisible, 10000);
    window.addEventListener('online', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    const unsubscribe = subscribeToTransactionEvents((detail) => {
      void isCurrentMerchantTransaction(detail.transaction)
        .then((isCurrentMerchant) => {
          if (!isCurrentMerchant) return;
          loadDashboardData();
          if (detail.action === 'CREATED') {
            showSnackbar({
              type: detail.isOffline ? 'pending' : 'success',
              title: detail.isOffline ? 'Record Saved on This Device' : 'QR Record Received',
              description: `₹${detail.transaction.amount.toFixed(2)} · ${detail.transaction.transactionId}. This record does not confirm payment.`,
              durationMs: 5000,
            });
          }
        })
        .catch((err: unknown) => console.warn('Could not verify merchant transaction event:', err));
    });

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('online', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      unsubscribe();
    };
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { offlineDb } = await import('@/offline/db');
      const { getLocalSession } = await import('@/offline/session');
      const [localTxns, session] = await Promise.all([
        getMerchantOfflineTransactions(),
        getLocalSession(),
      ]);
      let productsCount = session?.merchantProfileId
        ? await offlineDb.products.where('merchantId').equals(session.merchantProfileId).count()
        : 0;

      let serverTxns: Transaction[] = [];

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

      const map = new Map<string, Transaction>();
      localTxns.forEach((t) => map.set(t.transactionId, t));
      serverTxns.forEach((t) => map.set(t.transactionId, t));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const ledgerRecords = merged.filter((t) => t.status === 'CONFIRMED' || t.status === 'SYNCED');
      const recordedAmount = ledgerRecords.reduce((sum, t) => sum + t.amount, 0);

      setStats({
        recordedAmount,
        totalRecordCount: merged.length,
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
    <div className="w-full py-6 space-y-7 font-mono">
      {/* Top Welcome Header */}
      <div className="neo-box p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase px-2 py-0.5 border border-border bg-foreground text-background">
              MERCHANT PROTOCOL // POS WORKSPACE
            </span>
            <span className="text-[10px] font-bold uppercase text-foreground">
              [P2P RESILIENT]
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase text-foreground tracking-tight">
            MERCHANT COMMAND CENTER
          </h1>
          <p className="text-xs text-foreground-muted max-w-xl">
            Create bills, generate QR codes, and review transaction records. A QR record does not confirm money was paid.
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0">
          <Link
            href="/merchant/billing"
            className="neo-btn text-xs py-3 px-5 flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>OPEN POS BILLING</span>
          </Link>
          <Link
            href="/merchant/static-qr"
            className="neo-btn-secondary text-xs py-3 px-4 flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>STATIC QR POSTER</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards (Neobrutalist solid blocks) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="neo-box p-5 space-y-2">
          <div className="flex justify-between items-center text-foreground-muted">
            <span className="text-xs font-black uppercase">QR RECORD TOTAL</span>
            <TrendingUp className="w-4 h-4 text-foreground" />
          </div>
          <p className="text-3xl font-black text-foreground">₹{stats.recordedAmount.toFixed(2)}</p>
          <p className="text-[10px] text-foreground-muted uppercase">RECORD AMOUNT · NOT PAYMENT TOTAL</p>
        </div>

        <div className="neo-box p-5 space-y-2">
          <div className="flex justify-between items-center text-foreground-muted">
            <span className="text-xs font-black uppercase">RECORD COUNT</span>
            <FileText className="w-4 h-4 text-foreground" />
          </div>
          <p className="text-3xl font-black text-foreground">{stats.totalRecordCount}</p>
          <p className="text-[10px] text-foreground-muted uppercase">INCLUDES QUEUED ENTRIES</p>
        </div>

        <div className="neo-box p-5 space-y-2">
          <div className="flex justify-between items-center text-foreground-muted">
            <span className="text-xs font-black uppercase">INVENTORY ITEMS</span>
            <Package className="w-4 h-4 text-foreground" />
          </div>
          <p className="text-3xl font-black text-foreground">{stats.activeProductsCount}</p>
          <p className="text-[10px] text-foreground-muted uppercase">ACTIVE PRODUCTS IN CATALOG</p>
        </div>
      </div>

      {/* Quick Action Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link
          href="/merchant/billing"
          className="neo-box-interactive p-5 group space-y-2 block"
        >
          <div className="w-10 h-10 border-2 border-border bg-foreground text-background flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black uppercase text-foreground">
            POS BILLING TERMINAL
          </h3>
          <p className="text-xs text-foreground-muted">Live cart building & instant bill barcode generator</p>
        </Link>

        <Link
          href="/merchant/products"
          className="neo-box-interactive p-5 group space-y-2 block"
        >
          <div className="w-10 h-10 border-2 border-border bg-foreground text-background flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black uppercase text-foreground">
            PRODUCT CATALOG
          </h3>
          <p className="text-xs text-foreground-muted">Manage offline items, barcodes, prices & stock</p>
        </Link>

        <Link
          href="/merchant/transactions"
          className="neo-box-interactive p-5 group space-y-2 block"
        >
          <div className="w-10 h-10 border-2 border-border bg-foreground text-background flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black uppercase text-foreground">
            TRANSACTIONS ({stats.totalRecordCount})
          </h3>
          <p className="text-xs text-foreground-muted">Audit transaction ledger status and signatures</p>
        </Link>

        <Link
          href="/merchant/reports"
          className="neo-box-interactive p-5 group space-y-2 block"
        >
          <div className="w-10 h-10 border-2 border-border bg-foreground text-background flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black uppercase text-foreground">
            AUDIT REPORTS
          </h3>
          <p className="text-xs text-foreground-muted">Sales distribution analytics & ledger exports</p>
        </Link>
      </div>

      <div className="border-2 border-amber-500 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
        <strong>Payment transparency:</strong> QR scans create transaction records only. They do not transfer money or
        confirm cash, UPI, or bank payments made outside NoPay. Verify external payments in your payment app or bank.
      </div>

      {/* Recent Ledger Transactions */}
      <div className="neo-box p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-border pb-3">
          <div>
            <h3 className="text-base font-black uppercase text-foreground">RECENT LEDGER TRANSACTIONS</h3>
            <p className="text-xs text-foreground-muted">Real-time local event stream</p>
          </div>
          <Link
            href="/merchant/transactions"
            className="text-xs font-bold underline text-foreground hover:opacity-80 flex items-center gap-1"
          >
            <span>VIEW ALL</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentTxns.length === 0 ? (
          <div className="py-8 text-center text-xs text-foreground-muted font-bold uppercase">
            NO TRANSACTIONS RECORDED YET.
          </div>
        ) : (
          <div className="divide-y-2 divide-border">
            {recentTxns.map((t) => (
              <div key={t.transactionId} className="py-3.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-foreground">{t.transactionId}</span>
                    <span className="text-[9px] font-bold border border-border px-1.5 py-0.2 bg-surface text-foreground">
                      {t.type}
                    </span>
                  </div>

                  <p className="text-[10px] text-foreground-muted mt-0.5">
                    {new Date(t.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <span className="text-base font-black text-foreground">₹{t.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
