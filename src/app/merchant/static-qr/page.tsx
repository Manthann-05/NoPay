'use client';

import React, { useState, useEffect } from 'react';
import { QrCodeGenerator } from '@/components/qr/QrCodeGenerator';
import { encodeStaticMerchantQrPayload } from '@/lib/qr/payload';
import { subscribeToTransactionEvents } from '@/offline/liveChannel';
import { getMerchantOfflineTransactions } from '@/offline/queue';
import { Transaction } from '@/types';
import { transactionStatusLabel, transactionStatusTone } from '@/lib/status/labels';
import { useSnackbar } from '@/components/shared/SnackbarProvider';
import { Store, Printer, ShieldCheck, Clock, CheckCircle2, History } from 'lucide-react';

export default function MerchantStaticQrPage() {
  const { showSnackbar } = useSnackbar();
  const [merchant, setMerchant] = useState({
    id: 'SHOP123',
    name: 'NoPay General Store',
  });
  const [incomingTxns, setIncomingTxns] = useState<Transaction[]>([]);

  const loadLocalTxns = async () => {
    try {
      const all = await getMerchantOfflineTransactions();
      const staticOnes = all.filter((t) => t.type === 'STATIC_QR');
      setIncomingTxns(staticOnes.slice(0, 5));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    async function loadMerchantData() {
      try {
        const { getLocalSession } = await import('@/offline/session');
        const session = await getLocalSession();
        if (session) {
          setMerchant({
            id: session.merchantProfileId || session.userId || 'SHOP123',
            name: session.merchantName || (session.name ? `${session.name}'s Shop` : 'NoPay General Store'),
          });
        }

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setMerchant({
                id: data.user.merchantProfileId || 'SHOP123',
                name: data.user.merchantProfile?.shopName || (data.user.name ? `${data.user.name}'s Shop` : 'NoPay General Store'),
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error loading merchant profile:', err);
      }
    }

    loadMerchantData();
    loadLocalTxns();

    // Listen to live transaction events when customers scan this static QR
    const unsubscribe = subscribeToTransactionEvents((detail) => {
      loadLocalTxns();
      if (detail.transaction.type === 'STATIC_QR') {
        showSnackbar({
          type: detail.isOffline ? 'pending' : 'success',
          title: detail.isOffline ? 'Offline Transaction Record Added' : 'Transaction Record Synced',
          description: `₹${detail.transaction.amount.toFixed(2)} · ${detail.transaction.transactionId} [${detail.transaction.status}]. NoPay has not verified a money transfer.`,
          durationMs: 5000,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const qrPayload = encodeStaticMerchantQrPayload({
    merchantId: merchant.id,
    merchantName: merchant.name,
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-navy-900">Permanent Merchant Static QR</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Display or print this QR poster for your counter. Customer-created offline records sync after the customer reconnects.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          {/* Printable Poster Container */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-8 shadow-card text-center space-y-5 print:border-none print:shadow-none">
            <div className="space-y-2">
              <div className="w-14 h-14 bg-navy-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
                <Store className="w-7 h-7 text-brand-lightBlue" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                OFFICIAL NOPAY MERCHANT QR
              </span>
              <h2 className="text-2xl font-black text-navy-900">{merchant.name}</h2>
              <p className="text-xs font-mono text-slate-400">Merchant ID: {merchant.id}</p>
            </div>

            <div className="p-2 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 inline-block shadow-inner">
              <QrCodeGenerator value={qrPayload} size={200} />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-extrabold text-navy-900">Scan &amp; Pay Any Amount</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                This QR identifies your shop. It does not transfer or verify payment. Offline customer records stay on the customer&apos;s device until they reconnect.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>NoPay Merchant QR</span>
            </div>
          </div>

          <div className="flex print:hidden">
            <button
              onClick={() => window.print()}
              className="w-full py-3.5 bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4 text-brand-lightBlue" />
              <span>Print QR Poster</span>
            </button>
          </div>
        </div>

        {/* Local static QR transaction records */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 print:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brand-blue" />
              <h3 className="text-sm font-bold text-navy-900">Static QR Transactions</h3>
            </div>
            <span className="shrink-0 text-[10px] bg-slate-100 font-bold text-slate-600 px-2 py-0.5 rounded-full">
              This device
            </span>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            These are records already available on this device. A customer&apos;s offline record is not visible here until it syncs after reconnection.
          </p>

          {incomingTxns.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No static QR transactions are stored on this device yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {incomingTxns.map((txn) => (
                <div key={txn.transactionId} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 font-bold text-navy-900">
                      <span>{txn.customerName || 'Customer'}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${transactionStatusTone(txn.status)}`}>
                        {transactionStatusLabel(txn.status)}
                      </span>
                    </div>
                    <span className="block truncate text-[10px] text-slate-400 font-mono">{txn.transactionId}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-black text-brand-blue">₹{txn.amount.toFixed(2)}</span>
                    <div className="text-[10px] text-slate-400">
                      {new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
