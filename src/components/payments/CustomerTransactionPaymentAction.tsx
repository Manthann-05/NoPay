'use client';

import { useState } from 'react';
import Script from 'next/script';
import { CreditCard } from 'lucide-react';
import type { Transaction } from '@/types';

export function CustomerTransactionPaymentAction({
  transactionId,
  amount,
  onPaid,
}: {
  transactionId: string;
  amount: number;
  onPaid(transaction: Pick<Transaction, 'paymentStatus' | 'paymentReference' | 'payoutStatus'>): void;
}) {
  const [busy, setBusy] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payOnline = async () => {
    if (!checkoutReady || !window.Razorpay) {
      setError('Secure checkout is not ready. Refresh and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const orderResponse = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error || 'Could not start checkout.');

      const checkout = new window.Razorpay({
        key: orderData.keyId,
        order_id: orderData.order.id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'NoPay',
        description: `Payment to ${orderData.merchantName}`,
        handler: (checkoutResponse) => {
          void (async () => {
            try {
              const verifyResponse = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactionId, ...checkoutResponse }),
              });
              const verifyData = await verifyResponse.json();
              if (!verifyResponse.ok) {
                throw new Error(verifyData.error || 'Payment is not confirmed yet.');
              }
              onPaid(verifyData.transaction);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Payment verification failed.');
            } finally {
              setBusy(false);
            }
          })();
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.open();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start online checkout.');
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onReady={() => setCheckoutReady(true)}
        onError={() => setError('Secure checkout could not load. Check your connection and try again.')}
      />
      <button
        type="button"
        onClick={() => void payOnline()}
        disabled={busy || !checkoutReady}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-[11px] font-bold text-white hover:bg-brand-darkBlue disabled:opacity-60"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {busy ? 'Waiting for payment…' : checkoutReady ? `Pay ₹${amount.toFixed(2)} online` : 'Loading secure checkout…'}
      </button>
      {error && <p role="alert" className="mt-1 text-[10px] font-semibold text-rose-700">{error}</p>}
    </div>
  );
}
