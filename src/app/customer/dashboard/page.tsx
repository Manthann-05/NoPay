'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, History, RefreshCw, Smartphone, Store, ShieldCheck, ArrowRight, Zap, CheckCircle2, Clock, CreditCard } from 'lucide-react';
import { QrScannerModal } from '@/components/qr/QrScannerModal';
import { getAllLocalTransactions } from '@/offline/queue';
import { ScannedQrResult } from '@/lib/qr/payload';
import { storeScannedQrRaw } from '@/lib/qr/scanHandoff';
import { transactionStatusLabel, transactionStatusTone } from '@/lib/status/labels';
import { Transaction } from '@/types';
import { useMounted } from '@/hooks/useMounted';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function CustomerDashboardPage() {
  const isMounted = useMounted();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. First load from local session (works completely offline)
        const { getLocalSession } = await import('@/offline/session');
        const session = await getLocalSession();
        if (session) {
          setUser({ name: session.name, email: session.email });
        }

        // 2. If online, optionally sync profile data from API
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
              const data = await res.json();
              if (data.authenticated && data.user) {
                setUser(data.user);
              }
            }
          } catch (e) {
            // Ignore network errors when falling back
          }
        }

        // 3. Load local transactions from Dexie
        const localData = await getAllLocalTransactions();
        setRecentTxns(localData.slice(0, 5));
      } catch (err) {
        console.error('Customer dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleQrDetected = (result: ScannedQrResult, rawText: string) => {
    setScannerOpen(false);

    if (result.type === 'TRANSACTION') return;

    storeScannedQrRaw(rawText);

    if (result.type === 'MERCHANT') {
      window.location.assign('/customer/static-pay');
    } else if (result.type === 'BILL') {
      window.location.assign('/customer/bill');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900 text-white p-6 rounded-3xl shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-brand-accent tracking-wider uppercase">
            NoPay Customer Portal
          </span>
          <div className="flex items-center gap-1 text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full font-semibold">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Resilient Offline Mode</span>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight">
          Hello, {user ? user.name : 'Customer'} 👋
        </h1>
        <p className="text-xs text-slate-300">
          Scan any NoPay Merchant or Bill QR to make a instant payment online or save offline.
        </p>
      </div>

      {/* DOMINANT ACTION BUTTON: SCAN QR */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card text-center space-y-4">
        <div className="w-16 h-16 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <QrCode className="w-9 h-9" />
        </div>

        <div>
          <h2 className="text-xl font-black text-navy-900">Scan QR</h2>
          <p className="text-xs text-slate-500 mt-1">
            Scan a Merchant QR or Bill QR
          </p>
        </div>

        <button
          onClick={() => setScannerOpen(true)}
          className="w-full py-4 bg-brand-blue hover:bg-brand-darkBlue text-white font-extrabold text-base rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <QrCode className="w-5 h-5" />
          <span>Open Camera</span>
        </button>
      </div>

      <Link
        href="/customer/autopay"
        className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left transition-colors hover:border-brand-blue"
      >
        <span className="rounded-xl bg-white p-2 text-blue-700">
          <CreditCard className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-navy-900">Manage merchant AutoPay</span>
          <span className="block text-xs text-slate-600">
            Set per-merchant limits, review consent, or revoke a mandate
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-blue-700" />
      </Link>

      {/* Recent Activity List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand-blue" />
            <h3 className="font-bold text-sm text-navy-900">Recent Transactions</h3>
          </div>
          <Link
            href="/customer/transactions"
            className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentTxns.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No recent transactions yet.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Scan a merchant QR to test a transaction.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentTxns.map((txn) => (
              <div
                key={txn.transactionId}
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-colors"
              >
                <div>
                  <div className="text-xs font-bold text-navy-900">{txn.merchantName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {txn.transactionId} • {isMounted ? new Date(txn.createdAt).toLocaleDateString() : '...'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-navy-900">₹{txn.amount}</div>
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${transactionStatusTone(
                      txn.status
                    )}`}
                  >
                    {transactionStatusLabel(txn.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enable Merchant Mode Promotion */}
      <div className="p-5 bg-navy-900 text-white rounded-3xl flex items-center justify-between shadow-md">
        <div className="space-y-1">
          <div className="text-xs font-bold text-brand-accent flex items-center gap-1">
            <Store className="w-3.5 h-3.5" />
            <span>Own a Store or Shop?</span>
          </div>
          <div className="text-sm font-black">Enable Merchant POS Mode</div>
          <div className="text-[11px] text-slate-300">Accept QR payments & manage inventory</div>
        </div>
        <Link
          href="/merchant-setup"
          className="px-4 py-2 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold text-xs rounded-xl transition-all shrink-0"
        >
          Enable Now
        </Link>
      </div>

      {/* QR Scanner Camera Modal */}
      {scannerOpen && (
        <QrScannerModal
          onScanSuccess={handleQrDetected}
          onClose={() => setScannerOpen(false)}
          allowedTypes={['MERCHANT', 'BILL']}
        />
      )}
    </div>
  );
}
