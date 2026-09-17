'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Transaction } from '@/types';
import { CheckCircle2, Clock, ShieldCheck, ArrowRight, RefreshCw, Home, FileText } from 'lucide-react';

export default function CustomerPaymentStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams?.get('status');

  const [txn, setTxn] = useState<Transaction | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('nopay_last_txn');
    if (raw) {
      try {
        setTxn(JSON.parse(raw));
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  const isQueued = statusParam === 'queued' || txn?.status === 'PENDING_SYNC';

  return (
    <div className="max-w-md mx-auto py-8 px-4 text-center space-y-6">
      {/* Icon Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-8 space-y-6">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner ${
            isQueued ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {isQueued ? <Clock className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
        </div>

        <div>
          <h2 className="text-2xl font-black text-navy-900">
            {isQueued ? 'Payment Queued Offline' : 'Payment Successful!'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isQueued
              ? 'Stored safely in your local Dexie queue. Will automatically synchronize when connectivity is restored.'
              : 'Transaction confirmed and synced with merchant records.'}
          </p>
        </div>

        {txn && (
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3 text-left">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Transaction ID</span>
              <span className="font-mono font-bold text-navy-900">{txn.transactionId}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Merchant</span>
              <span className="font-bold text-navy-900">{txn.merchantName}</span>
            </div>
            {txn.billId && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold">Bill ID</span>
                <span className="font-mono text-navy-900">{txn.billId}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
              <span className="text-slate-600 font-extrabold">Amount Paid</span>
              <span className="text-xl font-black text-brand-blue">₹{txn.amount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={() => router.push('/customer/dashboard')}
            className="w-full py-3.5 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </button>
          <button
            onClick={() => router.push('/customer/transactions')}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>View Transaction History</span>
          </button>
        </div>
      </div>
    </div>
  );
}
