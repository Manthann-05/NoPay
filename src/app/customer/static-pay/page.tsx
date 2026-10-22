'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addOfflineTransaction } from '@/offline/queue';
import { Transaction } from '@/types';
import { readScannedQr } from '@/lib/qr/scanHandoff';
import { useSnackbar } from '@/components/shared/SnackbarProvider';
import { Store, CreditCard, ArrowLeft, FileText, WifiOff } from 'lucide-react';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function CustomerStaticPayPage() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const { showSnackbar } = useSnackbar();
  const [merchant, setMerchant] = useState<{
    merchantId: string;
    merchantName: string;
    canAcceptQrRecords: boolean | null;
  } | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const result = readScannedQr();
    if (!result || result.type !== 'MERCHANT') {
      setError('Only a valid NoPay merchant QR can be used here.');
      return;
    }

    setMerchant({
      merchantId: result.merchantId,
      merchantName: result.merchantName || 'Merchant',
      canAcceptQrRecords: null,
    });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fetch(`/api/merchants/${encodeURIComponent(result.merchantId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.merchant?.shopName) {
            setMerchant({
              merchantId: result.merchantId,
              merchantName: data.merchant.shopName,
              canAcceptQrRecords: data.merchant.canAcceptQrRecords === true,
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
      showSnackbar({
        type: 'warning',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than ₹0.',
      });
      return;
    }

    if (!merchant) return;

    setLoading(true);
    setError(null);

    const txnId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const idempotencyKey = crypto.randomUUID();

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
          const confirmedTxn = { ...newTxn, status: 'CONFIRMED' as const };
          // Save locally so offline records stay complete
          try {
            const { offlineDb } = await import('@/offline/db');
            await offlineDb.transactions.put(confirmedTxn);
          } catch {
            // ignore
          }

          sessionStorage.setItem('nopay_last_txn', JSON.stringify(confirmedTxn));
          showSnackbar({
            type: 'success',
            title: 'QR Record Received',
            description: `The ₹${numAmount.toFixed(2)} record was saved in NoPay. This does not confirm that money was paid.`,
          });
          window.location.assign('/customer/payment?status=confirmed');
          return;
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 401) {
          const errorMsg = data.error || 'This transaction could not be confirmed.';
          setError(errorMsg);
          showSnackbar({
            type: 'error',
            title: 'Payment Rejected by Server',
            description: errorMsg,
          });
          setLoading(false);
          return;
        }
      } catch {
        // queue offline gracefully on connection hiccup
      }
    }

    try {
      await addOfflineTransaction(newTxn);
      sessionStorage.setItem('nopay_last_txn', JSON.stringify(newTxn));
      showSnackbar({
        type: 'pending',
        title: 'Offline Record Saved',
        description: `₹${numAmount.toFixed(2)} saved on this device. It will sync when you reconnect; the merchant cannot see it while you are offline.`,
        durationMs: 5500,
      });
      window.location.assign('/customer/payment?status=queued');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save transaction';
      setError(errMsg);
      showSnackbar({
        type: 'error',
        title: 'Offline Save Error',
        description: errMsg,
      });
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
              <p className="text-[10px] font-mono text-slate-500">Merchant ID: {merchant.merchantId}</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-xs leading-5 text-amber-950">
            <strong>This only creates a transaction record.</strong> NoPay will not send money or confirm a cash, UPI,
            or bank payment made elsewhere. Check the merchant and amount, then verify any external payment in your
            payment app or bank.
          </div>

          {!isOnline && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
              <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                NoPay cannot check this merchant while offline. This saves only an unpaid record on this device; the
                merchant cannot see it until you reconnect. This does not transfer money or confirm any external payment.
              </span>
            </div>
          )}

          {merchant.canAcceptQrRecords === false ? (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This merchant needs to submit shop details and at least one supporting document before NoPay can accept QR transaction records.
            </div>
          ) : (
          <form onSubmit={handlePay} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Enter Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
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
              className="w-full py-4 bg-brand-blue hover:bg-brand-darkBlue text-white font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50"
            >
              {loading ? (
                <span>Saving record…</span>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Create Record for ₹{amount || '0.00'}</span>
                </>
              )}
            </button>
          </form>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold pt-2">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>NoPay QR transaction record</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
