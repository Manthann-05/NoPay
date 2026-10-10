'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addOfflineTransaction } from '@/offline/queue';
import { BillQrPayload, Transaction } from '@/types';
import { readScannedQr } from '@/lib/qr/scanHandoff';
import { isBillExpired } from '@/lib/status/labels';
import { useSnackbar } from '@/components/shared/SnackbarProvider';
import { CreditCard, ArrowLeft, ShieldCheck, WifiOff } from 'lucide-react';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function CustomerBillDetailPage() {
  const router = useRouter();
  const params = useParams();
  const billIdParam = params?.id as string;
  const { isOnline } = useOnlineStatus();
  const { showSnackbar } = useSnackbar();

  const [bill, setBill] = useState<BillQrPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [paying, setPaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanned = readScannedQr();
    if (scanned && scanned.type === 'BILL' && scanned.billId === billIdParam) {
      if (isBillExpired(scanned.expiresAt)) {
        setError('Bill Expired');
        setLoading(false);
        return;
      }
      setBill({
        type: 'BILL',
        version: 1,
        transactionId: scanned.transactionId,
        billId: scanned.billId,
        merchantId: scanned.merchantId,
        merchantName: scanned.merchantName,
        items: scanned.items,
        subtotal: scanned.subtotal,
        discount: scanned.discount,
        tax: scanned.tax,
        total: scanned.total,
        createdAt: scanned.createdAt,
        expiresAt: scanned.expiresAt,
      });
      setLoading(false);
      return;
    }

    if (isOnline) {
      fetch(`/api/bills/${billIdParam}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || 'Bill not found or expired.');
            return;
          }
          if (data.bill) {
            if (isBillExpired(data.bill.expiresAt)) {
              setError('Bill Expired');
              return;
            }
            setBill({
              type: 'BILL',
              version: 1,
              transactionId: data.bill.transactionId,
              billId: data.bill.billId,
              merchantId: String(data.bill.merchantId),
              merchantName: data.bill.merchantName,
              items: data.bill.items,
              total: data.bill.total,
              createdAt: data.bill.createdAt,
              expiresAt: data.bill.expiresAt,
            });
          } else {
            setError('Bill not found or expired.');
          }
        })
        .catch(() => setError("You're offline. Scan the Bill QR to view this bill."))
        .finally(() => setLoading(false));
    } else {
      setError('QR code not recognized. Please scan a valid NoPay Bill QR.');
      setLoading(false);
    }
  }, [billIdParam, isOnline]);

  const handlePayBill = async () => {
    if (!bill) return;
    if (isBillExpired(bill.expiresAt)) {
      setError('Bill Expired');
      showSnackbar({
        type: 'error',
        title: 'Bill Has Expired',
        description: 'Please ask the merchant for a new QR bill.',
      });
      return;
    }

    setPaying(true);
    setError(null);

    const txnId = bill.transactionId || `TXN-${Date.now()}`;
    const idempotencyKey = `IDEM-${txnId}-${bill.billId}`;

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
      billId: bill.billId,
      merchantId: bill.merchantId,
      merchantName: bill.merchantName,
      customerId,
      customerName,
      amount: bill.total,
      type: 'BILL_QR',
      status: 'PENDING_SYNC',
      idempotencyKey,
      items: bill.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
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
          try {
            const { offlineDb } = await import('@/offline/db');
            await offlineDb.transactions.put(confirmedTxn);
          } catch {
            // ignore
          }

          sessionStorage.setItem('nopay_last_txn', JSON.stringify(confirmedTxn));
          showSnackbar({
            type: 'success',
            title: 'Bill Paid & Confirmed',
            description: `Payment of ₹${bill.total.toFixed(2)} confirmed online for Bill ${bill.billId}.`,
          });
          router.push('/customer/payment?status=confirmed');
          return;
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 401) {
          const errMsg = data.error || 'This bill could not be confirmed.';
          setError(errMsg);
          showSnackbar({
            type: 'error',
            title: 'Bill Confirmation Failed',
            description: errMsg,
          });
          setPaying(false);
          return;
        }
      } catch {
        // queue offline safely on connection failure
      }
    }

    try {
      await addOfflineTransaction(newTxn);
      sessionStorage.setItem('nopay_last_txn', JSON.stringify(newTxn));
      showSnackbar({
        type: 'pending',
        title: 'Offline Bill Payment Queued',
        description: `₹${bill.total.toFixed(2)} queued offline. Instantly showing as Pending Sync on both customer and merchant displays.`,
        durationMs: 5500,
      });
      router.push('/customer/payment?status=queued');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save transaction';
      setError(errMsg);
      showSnackbar({
        type: 'error',
        title: 'Offline Save Error',
        description: errMsg,
      });
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-bold text-slate-500">Loading bill…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6">
      <button
        onClick={() => router.push('/customer/scan')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-navy-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to QR Scanner</span>
      </button>

      {error && !bill ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center space-y-4">
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => router.push('/customer/scan')}
            className="px-6 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700"
          >
            Scan QR Code Again
          </button>
        </div>
      ) : bill ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden space-y-0">
          <div className="bg-navy-900 text-white p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-lightBlue">
                Bill QR
              </span>
              <span className="px-2.5 py-1 bg-white/10 text-white text-[10px] font-mono font-bold rounded-full">
                {bill.billId}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400">Merchant</span>
              <h2 className="text-xl font-black">{bill.merchantName}</h2>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {!isOnline && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
                <span>You&apos;re offline. The bill total is verified from the QR code and will be visible on both sides immediately.</span>
              </div>
            )}

            {/* Itemized Table */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Order Summary ({bill.items.length} items)
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                {bill.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 text-xs">
                    <div>
                      <span className="font-bold text-navy-900">{item.name}</span>
                      <span className="text-slate-400 ml-1.5 font-medium">x{item.quantity}</span>
                    </div>
                    <span className="font-mono font-bold text-navy-900">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono">₹{(bill.subtotal ?? bill.total).toFixed(2)}</span>
              </div>
              {bill.discount ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-mono">-₹{bill.discount.toFixed(2)}</span>
                </div>
              ) : null}
              {bill.tax ? (
                <div className="flex justify-between text-slate-500">
                  <span>Tax / GST</span>
                  <span className="font-mono">+₹{bill.tax.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between items-center text-sm font-black text-navy-900 pt-2 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-xl text-brand-blue">₹{bill.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePayBill}
              disabled={paying}
              className="w-full py-4 bg-brand-blue hover:bg-brand-darkBlue text-white font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50"
            >
              {paying ? (
                <span>Confirming Bill Payment…</span>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Pay Bill ₹{bill.total.toFixed(2)}</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>NoPay Idempotent Dual-Side Transaction Queue</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
