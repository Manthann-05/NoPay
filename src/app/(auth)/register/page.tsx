'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, Lock, Mail, User, Store, ArrowRight, AlertCircle, MapPin } from 'lucide-react';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initialRole, setInitialRole] = useState<'CUSTOMER' | 'MERCHANT'>('CUSTOMER');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          initialRole,
          shopName: initialRole === 'MERCHANT' ? shopName : undefined,
          address: initialRole === 'MERCHANT' ? address : undefined,
          area: initialRole === 'MERCHANT' ? area : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      // Automatically log them in by fetching their profile and saving to offline session
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.authenticated && meData.user) {
            const { user } = meData;
            await (await import('@/offline/session')).saveLocalSession(
              user.userId,
              user.name,
              user.email,
              user.roles,
              user.activeRole,
              user.merchantProfileId,
              user.merchantProfile?.shopName
            );
          }
        }
      } catch (err) {
        console.warn('Could not save offline session during registration', err);
      }

      if (initialRole === 'MERCHANT') {
        router.push('/merchant/dashboard');
      } else {
        router.push('/customer/dashboard');
      }
      router.refresh();
    } catch (err) {
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg bg-white p-8 rounded-3xl border border-slate-200 shadow-modal space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue text-white flex items-center justify-center mx-auto shadow-md">
            <QrCode className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-navy-900">Create NoPay Account</h2>
          <p className="text-xs text-slate-500">Choose your initial role to begin</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setInitialRole('CUSTOMER')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              initialRole === 'CUSTOMER'
                ? 'bg-white text-brand-blue shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Customer</span>
          </button>
          <button
            type="button"
            onClick={() => setInitialRole('MERCHANT')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              initialRole === 'MERCHANT'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Merchant POS</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Manthan Kadu"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manthan@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue outline-none"
              />
            </div>
          </div>

          {/* Additional Merchant Fields */}
          {initialRole === 'MERCHANT' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-brand-blue" />
                <span>Shop & Store Details</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Shop Name</label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="ABC General Store"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-brand-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop #12, Main Street"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Area / Locality</label>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Downtown"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-brand-blue"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
          >
            {loading ? 'Creating Account...' : 'Register Account'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-4 border-t border-slate-100 text-xs text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-brand-blue hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
