'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Building2, MapPin, ArrowRight, ShieldCheck } from 'lucide-react';

export default function MerchantSetupPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/merchant/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopName, address, area }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to enable Merchant Mode');
      }

      router.push('/merchant/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-navy-900 text-brand-lightBlue rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-navy-900">Setup Merchant Store</h1>
        <p className="text-xs text-slate-500">
          Enable Merchant POS Billing, Static QR generation, and Offline Itemized Checkout.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Store / Business Name *</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="e.g. ABC Supermart & Grocery"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue text-navy-900 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Street Address *</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="e.g. Shop 12, Main Street"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue text-navy-900 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Area / City *</label>
            <input
              type="text"
              required
              placeholder="e.g. Downtown Metro"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full px-4 py-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue text-navy-900 bg-slate-50 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-navy-900 hover:bg-slate-800 text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm pt-4"
          >
            {loading ? (
              <span>Initializing Merchant Mode...</span>
            ) : (
              <>
                <span>Launch Merchant POS</span>
                <ArrowRight className="w-4 h-4 text-brand-lightBlue" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold pt-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Includes Static QR & Offline POS Engine</span>
        </div>
      </div>
    </div>
  );
}
