'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

interface MerchantOption {
  merchantId: string;
  shopName: string;
  area: string;
}

interface Mandate {
  id: string;
  merchantId: string;
  merchantName: string;
  maxAmount: number;
  status: string;
  expiresAt: string;
  activatedAt?: string;
}

interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  config: {
    display: {
      blocks: Record<
        string,
        {
          name: string;
          instruments: { method: string }[];
        }
      >;
      sequence: string[];
      preferences: { show_default_blocks: boolean };
    };
  };
  handler: (response: RazorpayCheckoutResponse) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayCheckoutInstance {
  open: () => void;
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayCheckoutInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export default function CustomerAutoPayPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('');
  const [maxAmount, setMaxAmount] = useState('500');
  const [contact, setContact] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch('/api/autopay/mandates');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load merchant AutoPay settings.');
        return;
      }
      setMerchants(data.merchants || []);
      setMandates(data.mandates || []);
      setEnabled(Boolean(data.enabled));
    } catch {
      setError('Could not load merchant AutoPay settings. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const createMandate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!selectedMerchant) {
      setError('Choose a merchant first.');
      return;
    }
    const amount = Number(maxAmount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 99999) {
      setError('The per-debit limit must be between ₹1 and ₹99,999.');
      return;
    }
    if (!window.Razorpay) {
      setError('Secure payment authorization did not load. Refresh and try again.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/autopay/mandates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: selectedMerchant,
          maxAmount: amount,
          contact,
          consentAccepted: formData.get('consentAccepted') === 'on',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not start UPI AutoPay authorization.');
      }

      const checkout = new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: 'NoPay',
        description: `AutoPay for ${data.merchantName}`,
        prefill: {
          name: data.customerName,
          email: data.customerEmail,
          contact: data.customerContact,
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Authorize with UPI',
                instruments: [{ method: 'upi' }],
              },
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: false },
          },
        },
        handler: (checkoutResponse) => {
          void (async () => {
            try {
              const verifyResponse = await fetch('/api/autopay/mandates/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mandateId: data.mandateId,
                  ...checkoutResponse,
                }),
              });
              const verifyData = await verifyResponse.json();
              if (!verifyResponse.ok && verifyResponse.status !== 202) {
                throw new Error(verifyData.error || 'Mandate authorization could not be verified.');
              }
              setNotice(
                verifyData.status === 'ACTIVE'
                  ? 'UPI AutoPay mandate is active. Each eligible debit will be scheduled after provider notification.'
                  : 'Authorization received. Razorpay is waiting for your bank to activate the mandate.'
              );
              await loadData();
            } catch (verifyError) {
              setError(
                verifyError instanceof Error
                  ? verifyError.message
                  : 'Mandate authorization could not be verified.'
              );
            } finally {
              setSubmitting(false);
            }
          })();
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
      checkout.open();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Could not start UPI AutoPay authorization.'
      );
      setSubmitting(false);
    }
  };

  const revokeMandate = async (mandate: Mandate) => {
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/autopay/mandates/${mandate.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not revoke this mandate.');
      }
      setNotice(
        data.status === 'CANCELLATION_PENDING'
          ? 'Revocation requested with Razorpay. Pending charges are not started while cancellation is processing.'
          : 'Mandate revoked.'
      );
      await loadData();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Could not revoke this mandate.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <button
        onClick={() => router.push('/customer/profile')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-navy-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Profile</span>
      </button>

      <header>
        <h1 className="text-2xl font-black text-navy-900">Merchant AutoPay</h1>
        <p className="mt-1 text-sm text-slate-600">
          Authorize a separate UPI mandate for each merchant. Only merchant-issued bills already
          recorded by NoPay can be considered; offline payment records alone never trigger a debit.
        </p>
        <p className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
          This feature is managed by your signed-in NoPay customer account. Razorpay securely
          processes UPI mandate authorization and debits; you do not need a separate Razorpay
          customer account. You approve the mandate in your UPI app and can review or revoke it here.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm font-semibold text-slate-500">Loading mandates...</p>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-navy-900">Authorize a merchant</h2>
                <p className="text-xs text-slate-500">NoPay records your consent; approve the bank mandate in your UPI app.</p>
              </div>
            </div>
            {!enabled ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Provider-backed AutoPay is not enabled for this NoPay environment.
              </p>
            ) : merchants.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                No merchants currently have an active, verified Razorpay payout account.
              </p>
            ) : (
              <form onSubmit={createMandate} className="space-y-4">
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Merchant
                  <select
                    value={selectedMerchant}
                    onChange={(event) => setSelectedMerchant(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                  >
                    <option value="">Choose a merchant</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.merchantId} value={merchant.merchantId}>
                        {merchant.shopName} · {merchant.area}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Maximum amount per debit (₹)
                  <input
                    type="number"
                    min="1"
                    max="99999"
                    step="0.01"
                    value={maxAmount}
                    onChange={(event) => setMaxAmount(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>

                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Mobile number for UPI mandate
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    pattern="\+?[0-9]{8,15}"
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  By continuing, you authorize this merchant to collect a verified outstanding bill
                  up to ₹{Number(maxAmount || 0).toFixed(2)} per debit while this mandate is active.
                  Razorpay sends a pre-debit notification; the debit is scheduled only after its
                  required notice period. This does not guarantee recovery and is not a substitute
                  for checking whether a bill was actually paid. A one-time ₹1 authorization payment
                  may be charged by Razorpay during mandate setup.
                </div>
                <label className="flex items-start gap-2 text-xs leading-5 text-slate-700">
                  <input name="consentAccepted" type="checkbox" required className="mt-1" />
                  <span>
                    I understand and authorize this merchant-specific UPI mandate, the per-debit
                    limit above, and the required pre-debit notice.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-brand-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? 'Waiting for authorization...' : 'Continue to secure UPI authorization'}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Store className="h-5 w-5 text-slate-500" />
              <h2 className="font-bold text-navy-900">Your mandates</h2>
            </div>
            {mandates.length === 0 ? (
              <p className="text-sm text-slate-500">No merchant mandates yet.</p>
            ) : (
              <div className="space-y-3">
                {mandates.map((mandate) => (
                  <article
                    key={mandate.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="font-bold text-navy-900">{mandate.merchantName}</h3>
                      <p className="text-xs text-slate-600">
                        Up to ₹{mandate.maxAmount.toFixed(2)} per debit · {mandate.status.replaceAll('_', ' ')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Expires {new Date(mandate.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    {mandate.status === 'ACTIVE' && (
                      <button
                        onClick={() => void revokeMandate(mandate)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        Revoke mandate
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
