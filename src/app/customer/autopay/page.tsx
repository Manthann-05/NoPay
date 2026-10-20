'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useMounted } from '@/hooks/useMounted';

export const dynamic = 'force-dynamic';

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

export default function CustomerAutoPayPage() {
  const isMounted = useMounted();
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
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'nopay_active_autopay_mandates',
          JSON.stringify(
            {
              ownerId: data.customerId,
              mandates: (data.mandates || [])
                .filter((mandate: Mandate) => mandate.status === 'ACTIVE')
                .map((mandate: Mandate) => ({
                  merchantId: mandate.merchantId,
                  maxAmount: mandate.maxAmount,
                  expiresAt: mandate.expiresAt,
                })),
            }
          )
        );
      }
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
                  ? 'UPI AutoPay mandate is active.'
                  : 'Authorization received. Bank is activating the mandate.'
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
          ? 'Revocation requested with Razorpay.'
          : 'Mandate revoked.'
      );
      await loadData();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Could not revoke this mandate.');
    }
  };

  if (!isMounted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center font-mono">
        <p className="text-xs font-black uppercase text-foreground">LOADING AUTOPAY...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6 font-mono">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <button
        onClick={() => router.push('/customer/profile')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:opacity-80 uppercase"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>BACK TO PROFILE</span>
      </button>

      <header className="space-y-2">
        <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">MERCHANT AUTOPAY</h1>
        <p className="text-xs text-foreground-muted leading-relaxed">
          Authorize a separate UPI mandate per merchant. Only verified bills recorded by NoPay can be considered; offline payment records alone never trigger a debit.
        </p>
      </header>

      {error && (
        <div role="alert" className="p-3.5 border-2 border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]">
          [ERROR] {error}
        </div>
      )}
      {notice && (
        <div role="status" className="p-3.5 border-2 border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]">
          [CONFIRMED] {notice}
        </div>
      )}


      {loading ? (
        <p className="py-10 text-center text-xs font-black uppercase text-foreground-muted">LOADING MANDATES...</p>
      ) : (
        <>
          <section className="neo-box p-6 space-y-5">
            <div className="flex items-center gap-3 border-b-2 border-border pb-3">
              <div className="border-2 border-border bg-foreground text-background p-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase text-foreground">AUTHORIZE MERCHANT</h2>
                <p className="text-[11px] text-foreground-muted">Approve the bank mandate in your UPI app</p>
              </div>
            </div>

            {!enabled ? (
              <p className="border-2 border-border bg-background p-3 text-xs text-foreground font-bold uppercase">
                UPI AutoPay is disabled for this environment.
              </p>
            ) : merchants.length === 0 ? (
              <p className="border-2 border-border bg-background p-3 text-xs text-foreground font-bold uppercase">
                No merchants currently have an active payout account.
              </p>
            ) : (
              <form onSubmit={createMandate} className="space-y-4">
                <label className="block space-y-1.5 text-xs font-bold text-foreground uppercase">
                  MERCHANT
                  <select
                    value={selectedMerchant}
                    onChange={(event) => setSelectedMerchant(event.target.value)}
                    required
                    className="neo-input px-3 py-2.5 text-xs uppercase"
                  >
                    <option value="">CHOOSE A MERCHANT</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.merchantId} value={merchant.merchantId}>
                        {merchant.shopName} · {merchant.area}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5 text-xs font-bold text-foreground uppercase">
                  MAX DEBIT AMOUNT (₹)
                  <input
                    type="number"
                    min="1"
                    max="99999"
                    step="0.01"
                    value={maxAmount}
                    onChange={(event) => setMaxAmount(event.target.value)}
                    required
                    className="neo-input px-3 py-2.5 text-xs"
                  />
                </label>

                <label className="block space-y-1.5 text-xs font-bold text-foreground uppercase">
                  UPI MOBILE NUMBER
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    pattern="\+?[0-9]{8,15}"
                    required
                    className="neo-input px-3 py-2.5 text-xs"
                  />
                </label>

                <div className="p-3 border-2 border-border bg-background text-[11px] leading-relaxed text-foreground-muted">
                  By continuing, you authorize this merchant to collect verified outstanding bills up to ₹{Number(maxAmount || 0).toFixed(2)} per debit while this mandate is active.
                </div>

                <label className="flex items-start gap-2 text-xs text-foreground font-bold">
                  <input name="consentAccepted" type="checkbox" required className="mt-1 accent-foreground" />
                  <span>I authorize this merchant-specific UPI mandate and per-debit limit.</span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full neo-btn py-3 text-xs"
                >
                  {submitting ? 'WAITING FOR AUTHORIZATION...' : 'AUTHORIZE UPI MANDATE'}
                </button>
              </form>
            )}
          </section>

          <section className="neo-box p-6 space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-border pb-3">
              <Store className="h-5 w-5 text-foreground" />
              <h2 className="text-sm font-black uppercase text-foreground">REGISTERED MANDATES</h2>
            </div>

            {mandates.length === 0 ? (
              <p className="text-xs font-bold uppercase text-foreground-muted">No merchant mandates configured yet.</p>
            ) : (
              <div className="space-y-3">
                {mandates.map((mandate) => (
                  <article
                    key={mandate.id}
                    className="p-4 border-2 border-border bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <h3 className="font-black text-sm uppercase text-foreground">{mandate.merchantName}</h3>
                      <p className="text-xs text-foreground-muted">
                        UP TO ₹{mandate.maxAmount.toFixed(2)} // {mandate.status}
                      </p>
                      <p className="text-[10px] text-foreground-subtle mt-0.5">
                        EXPIRES {new Date(mandate.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    {mandate.status === 'ACTIVE' && (
                      <button
                        onClick={() => void revokeMandate(mandate)}
                        className="neo-btn-secondary py-1.5 px-3 text-xs"
                      >
                        REVOKE
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
