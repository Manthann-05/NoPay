'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addOfflineTransaction } from '@/offline/queue';
import { BillQrPayload, Transaction } from '@/types';
import { Store, Receipt, CreditCard, ArrowLeft, ShieldCheck, WifiOff, FileText, CheckCircle } from 'lucide-react';

export default function CustomerBillDetailPage() {
  const router = useRouter();
  const params = useParams();
  const billIdParam = params?.id as string;
  const { isOnline } = useOnlineStatus();

  const [billPayload, setBillPayload] = useState<BillQrPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [paying, setPaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check session storage first (populated by scanner)
    const raw = sessionStorage.getItem('nopay_scanned_qr');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'BILL' && parsed.billId === billIdParam) {
          setBillPayload(parsed as BillQrPayload);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse scanned QR session storage', err);
      }
    }

    // Otherwise fetch online from API if online
    if (isOnline) {
      fetch(`/api/bills/${billIdParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.bill) {
            setBillPayload({
              type: 'BILL',
              version: 1,
              transactionId: data.bill.transactionId,
              billId: data.bill.billId,
              merchantId: data.bill.merchantId,
              merchantName: data.bill.merchantName,
              items: data.bill.items,
              total: data.bill.totalAmount,
              createdAt: data.bill.createdAt,
            });
          } else {
            setError('Bill not found or expired.');
          }
        })
        .catch(() => setError('Failed to fetch bill details.'))
        .finally(() => setLoading(false));
    } else {
      setError('Offline mode: Please scan the Bill QR code directly to load itemized details.');
      setLoading(false);
    }
  }, [billIdParam, isOnline]);

  const handlePayBill = async () => {
    if (!billPayload) return;
    setPaying(true);
    setError(null);

    const txnId = billPayload.transactionId || `TXN-${Date.now()}`;
    const idempotencyKey = `IDEM-${txnId}-${billPayload.billId}`;

    const newTxn: Transaction = {
      transactionId: txnId,
      billId: billPayload.billId,
      merchantId: billPayload.merchantId,
      merchantName: billPayload.merchantName,
      customerName: 'Customer',
      amount: billPayload.total,
      type: 'BILL_QR',
      status: 'PENDING_SYNC',
      idempotencyKey,
      items: billPayload.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isOnline) {
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: [newTxn] }),
        });
        if (res.ok) {
          sessionStorage.setItem('nopay_last_txn', JSON.stringify({ ...newTxn, status: 'CONFIRMED' }));
          router.push('/customer/payment?status=success');
          return;
        }
      } catch (err) {
        console.warn('Online pay failed, falling back to offline queueing:', err);
      }
    }

    try {
      await addOfflineTransaction(newTxn);
      sessionStorage.setItem('nopay_last_txn', JSON.stringify(newTxn));
      router.push('/customer/payment?status=queued');
    } catch (err: any) {
      setError(err.message || 'Failed to process transaction');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-bold text-slate-500">Loading Bill Details...</p>
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

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center space-y-4">
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => router.push('/customer/scan')}
            className="px-6 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700"
          >
            Scan QR Code Again
          </button>
        </div>
      ) : billPayload ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden space-y-0">
          {/* Header */}
          <div className="bg-navy-900 text-white p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-lightBlue">
                Itemized Bill Summary
              </span>
              <span className="px-2.5 py-1 bg-white/10 text-white text-[10px] font-mono font-bold rounded-full">
                ID: {billPayload.billId}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">{billPayload.merchantName}</h2>
            <p className="text-xs text-slate-300">
              Generated {new Date(billPayload.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {!isOnline && (
            <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-amber-800 text-xs font-semibold">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Offline Mode: Payment will be stored locally in Dexie queue and auto-synced.</span>
            </div>
          )}

          {/* Itemized Table */}
          <div className="p-6 space-y-6">
            <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
              <div className="bg-slate-50 px-4 py-2.5 flex justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                <span>Item & Qty</span>
                <span>Amount</span>
              </div>
              {billPayload.items.map((item, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-navy-900">{item.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {item.quantity} × ₹{item.price.toFixed(2)}
                    </p>
                  </div>
                  <span className="font-extrabold text-navy-900">
                    ₹{(item.quantity * item.price).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Calculation */}
            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-600 font-semibold">
                <span>Subtotal ({billPayload.items.length} items)</span>
                <span>₹{billPayload.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-black text-navy-900 pt-2 border-t border-blue-200/60">
                <span>Total Amount Due</span>
                <span className="text-2xl text-brand-blue">₹{billPayload.total.toFixed(2)}</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handlePayBill}
              disabled={paying}
              className="w-full py-4 bg-brand-blue hover:bg-brand-darkBlue text-white font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base"
            >
              {paying ? (
                <span>Processing Payment...</span>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Pay Bill ₹{billPayload.total.toFixed(2)}</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verified Itemized Bill Payment</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
