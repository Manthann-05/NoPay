'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addOfflineTransaction } from '@/offline/queue';
import { Transaction } from '@/types';
import { readScannedQr } from '@/lib/qr/scanHandoff';
import { Store, CreditCard, ArrowLeft, ShieldCheck, WifiOff } from 'lucide-react';

export default function CustomerStaticPayPage() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [merchant, setMerchant] = useState<{ merchantId: string; merchantName: string } | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const result = readScannedQr();
    if (!result || result.type !== 'MERCHANT') {
      setError('QR code not recognized. Please scan a valid NoPay Merchant QR.');
      return;
    }

    setMerchant({
      merchantId: result.merchantId,
      merchantName: 'Merchant',
    });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fetch(`/api/merchants/${encodeURIComponent(result.merchantId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.merchant?.shopName) {
            setMerchant({
              merchantId: result.merchantId,
              merchantName: data.merchant.shopName,
            });
          }
        })
        .catch(() => {
          // keep generic name offline / on error
        });
    }
  }, []);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than ₹0');
      return;
    }

    if (!merchant) return;

    setLoading(true);
    setError(null);

    const txnId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const idempotencyKey = `IDEM-${txnId}`;

    let customerName = 'Customer';
    let customerId: string | undefined;
    try {
      const { getLocalSession } = await import('@/offline/session');
      const session = await getLocalSession();
      if (session?.name) customerName = session.name;
      customerId = session?.userId;
    } catch {
      // ignore
    }

    const newTxn: Transaction = {
      transactionId: txnId,
      merchantId: merchant.merchantId,
      merchantName: merchant.merchantName,
      customerId,
      customerName,
      amount: numAmount,
      type: 'STATIC_QR',
      status: 'PENDING_SYNC',
      idempotencyKey,
      items: note ? [{ name: note, quantity: 1, price: numAmount }] : [],
      offlineCreated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isOnline) {
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTxn),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          sessionStorage.setItem(
            'nopay_last_txn',
            JSON.stringify({ ...newTxn, status: 'CONFIRMED' })
          );
          router.push('/customer/payment?status=confirmed');
          return;
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 401) {
          setError(data.error || 'This transaction could not be confirmed.');
          setLoading(false);
          return;
        }
      } catch {
        // queue offline
      }
    }

    try {
      await addOfflineTransaction(newTxn);
      sessionStorage.setItem('nopay_last_txn', JSON.stringify(newTxn));
      router.push('/customer/payment?status=queued');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
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

      {error && !merchant ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center space-y-4">
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => router.push('/customer/scan')}
            className="px-6 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700"
          >
            Back to Scanner
          </button>
        </div>
      ) : merchant ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-6 space-y-6">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-12 h-12 bg-navy-900 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
              <Store className="w-6 h-6 text-brand-lightBlue" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Paying To
              </span>
              <h3 className="text-lg font-black text-navy-900 leading-snug">{merchant.merchantName}</h3>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
              <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
              <span>You&apos;re offline. Your transaction will be saved and will sync when internet returns.</span>
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
                <span>Saving…</span>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Continue ₹{amount || '0.00'}</span>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold pt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Saved offline until confirmed online</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
