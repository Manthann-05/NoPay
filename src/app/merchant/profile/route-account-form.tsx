'use client';

import { useCallback, useEffect, useState } from 'react';

type RouteStatus = {
  enabled: boolean;
  status: string;
  settlementStatus: string;
};

export function RouteAccountForm() {
  const [status, setStatus] = useState<RouteStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/merchant/route-account');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load payout account status.');
        return;
      }
      setStatus(data);
    } catch {
      setError('Could not load payout account status.');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/merchant/route-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalBusinessName: formData.get('legalBusinessName'),
          businessType: formData.get('businessType'),
          phone: formData.get('phone'),
          pan: formData.get('pan'),
          gst: formData.get('gst'),
          category: formData.get('category'),
          subcategory: formData.get('subcategory'),
          street: formData.get('street'),
          city: formData.get('city'),
          state: formData.get('state'),
          postalCode: formData.get('postalCode'),
          accountNumber: formData.get('accountNumber'),
          ifsc: formData.get('ifsc'),
          beneficiaryName: formData.get('beneficiaryName'),
          acceptedTerms: formData.get('acceptedTerms') === 'on',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not submit payout details.');
      }
      setNotice(
        `Payout account submitted. Account status: ${data.status}; settlement verification: ${data.settlementStatus}.`
      );
      form.reset();
      await loadStatus();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit payout details.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label: string, name: string, type = 'text', autoComplete?: string) => (
    <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={name !== 'gst'}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
      />
    </label>
  );

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-bold text-navy-900">Razorpay merchant payouts</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Verified provider-connected bank details are needed before a customer mandate or AutoPay
          debit can be enabled. PAN and bank data go directly from this server to Razorpay and are
          not stored by NoPay. Razorpay Route approval and account eligibility are required.
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

      {status ? (
        <>
          {!status.enabled && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Razorpay Route onboarding is disabled in this environment.
            </p>
          )}
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            <strong>Connected account:</strong> {status.status.replaceAll('_', ' ')} ·{' '}
            <strong>Bank verification:</strong> {status.settlementStatus.replaceAll('_', ' ')}
          </div>
          {status.enabled && status.status === 'NOT_STARTED' && (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {field('Legal business name', 'legalBusinessName', 'text', 'organization')}
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                  Business type
                  <select
                    name="businessType"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="individual">Individual</option>
                    <option value="proprietorship">Proprietorship</option>
                    <option value="partnership">Partnership</option>
                    <option value="private_limited">Private limited</option>
                    <option value="public_limited">Public limited</option>
                    <option value="llp">LLP</option>
                    <option value="ngo">NGO</option>
                    <option value="trust">Trust</option>
                    <option value="society">Society</option>
                    <option value="other">Other</option>
                    <option value="not_yet_registered">Not yet registered</option>
                  </select>
                </label>
                {field('Business phone', 'phone', 'tel', 'tel')}
                {field('PAN', 'pan', 'text', 'off')}
                {field('GSTIN (optional)', 'gst', 'text', 'off')}
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                  Business category
                  <select
                    name="category"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="food">Food</option>
                    <option value="ecommerce">E-commerce / retail</option>
                    <option value="services">Services</option>
                    <option value="education">Education</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="housing">Housing</option>
                    <option value="others">Others</option>
                  </select>
                </label>
                {field('Business subcategory (Razorpay code)', 'subcategory')}
                {field('Registered street address', 'street', 'text', 'street-address')}
                {field('City', 'city', 'text', 'address-level2')}
                {field('State', 'state', 'text', 'address-level1')}
                {field('Postal code', 'postalCode', 'text', 'postal-code')}
                {field('Beneficiary name', 'beneficiaryName', 'text', 'name')}
                {field('Bank account number', 'accountNumber', 'text', 'off')}
                {field('IFSC', 'ifsc', 'text', 'off')}
              </div>
              <label className="flex items-start gap-2 text-xs leading-5 text-slate-700">
                <input name="acceptedTerms" type="checkbox" required className="mt-1" />
                <span>I confirm these are the merchant’s accurate legal and settlement details and accept Razorpay Route onboarding terms.</span>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-navy-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? 'Submitting securely...' : 'Submit to Razorpay'}
              </button>
            </form>
          )}
          {status.status === 'FAILED' && (
            <p className="text-xs text-slate-600">
              Razorpay did not accept the last submission. Contact support before attempting account setup again.
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-500">Loading payout account status...</p>
      )}
    </section>
  );
}
