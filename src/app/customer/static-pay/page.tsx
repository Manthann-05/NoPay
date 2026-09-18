'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addOfflineTransaction } from '@/offline/queue';
import { StaticMerchantQrPayload, Transaction } from '@/types';
import { Store, CreditCard, ArrowLeft, ShieldCheck, WifiOff, CheckCircle2, Zap } from 'lucide-react';

export default function CustomerStaticPayPage() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [payload, setPayload] = useState<StaticMerchantQrPayload | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('nopay_scanned_qr');
    if (!raw) {
      setError('No scanned QR data found. Please scan a QR code again.');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.type === 'MERCHANT') {
        setPayload(parsed as StaticMerchantQrPayload);
      } else {
        setError('Scanned QR is not a Static Merchant QR code.');
      }
    } catch {
      setError('Failed to parse scanned QR payload.');
    }
  }, []);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than ₹0');
      return;
    }

    if (!payload) return;

    setLoading(true);
    setError(null);

    const txnId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const idempotencyKey = `IDEM-${txnId}-${Date.now()}`;

    let customerName = 'Customer';
    try {
      const { getLocalSession } = await import('@/offline/session');
      const session = await getLocalSession();
      if (session?.name) customerName = session.name;
    } catch {}

    const newTxn: Transaction = {
      transactionId: txnId,
      merchantId: payload.merchantId,
      merchantName: payload.merchantName,
      customerName,
      amount: numAmount,
      type: 'STATIC_QR',
      status: 'PENDING_SYNC',
      idempotencyKey,
      items: note ? [{ name: note, quantity: 1, price: numAmount }] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isOnline) {
      try {
        // Online Payment Flow via API
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: [newTxn] }),
        });
        const data = await res.json();
        if (res.ok) {
          sessionStorage.setItem('nopay_last_txn', JSON.stringify({ ...newTxn, status: 'CONFIRMED' }));
          router.push('/customer/payment?status=success');
          return;
        }
      } catch (err) {
        console.warn('Online sync failed, queuing offline instead:', err);
      }
    }

    // Fallback to Offline Queued Transaction
    try {
      await addOfflineTransaction(newTxn);
      sessionStorage.setItem('nopay_last_txn', JSON.stringify(newTxn));
      router.push('/customer/payment?status=queued');
    } catch (err: any) {
      setError(err.message || 'Failed to process transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6">
      <button
        onClick={() => router.push('/customer/scan')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-navy-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Scan Different QR</span>
      </button>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center space-y-4">
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => router.push('/customer/scan')}
            className="px-6 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700"
          >
            Back to Scanner
          </button>
        </div>
      ) : payload ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-6 space-y-6">
          {/* Merchant Card */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-12 h-12 bg-navy-900 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
              <Store className="w-6 h-6 text-brand-lightBlue" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Paying To</span>
              <h3 className="text-lg font-black text-navy-900 leading-snug">{payload.merchantName}</h3>
              <p className="text-xs text-slate-500 font-mono">ID: {payload.merchantId}</p>
            </div>
          </div>

          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
              <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
              <span>You are currently offline. Transaction will be queued & synchronized when online.</span>
            </div>
          )}

          <form onSubmit={handlePay} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Enter Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 text-3xl font-black text-navy-900 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
            </div>

            {/* Quick Amount Chips */}
            <div className="flex gap-2">
              {[50, 100, 200, 500].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setAmount(val.toString())}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                >
                  +₹{val}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Add Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Groceries, Snacks"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue text-navy-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-brand-blue hover:bg-brand-darkBlue text-white font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Pay ₹{amount || '0.00'}</span>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold pt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>End-to-End Idempotent Offline Pay</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
