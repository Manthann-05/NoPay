'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { QrCodeGenerator } from '@/components/qr/QrCodeGenerator';
import { encodeStaticCustomerQr } from '@/lib/qr/payload';
import { getLocalSession, clearLocalSession } from '@/offline/session';
import { notifyAuthStateChanged } from '@/lib/auth/client';
import { User as UserIcon, ArrowLeft, LogOut, Mail, QrCode, CreditCard } from 'lucide-react';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function CustomerProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    userId?: string;
    name?: string;
    email?: string;
    roles?: ('CUSTOMER' | 'MERCHANT')[];
    activeRole?: 'CUSTOMER' | 'MERCHANT';
    merchantProfileId?: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        // 1. Fallback to local offline session immediately
        const session = await getLocalSession();
        if (session) {
          setUser({
            userId: session.userId,
            name: session.name,
            email: session.email,
            roles: session.roles,
            activeRole: session.activeRole,
            merchantProfileId: session.merchantProfileId,
          });
          setLoading(false);
        }

        // 2. Fetch fresh profile from API if online
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setUser(data.user);
            }
          }
        }
      } catch (err) {
        console.warn('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    await clearLocalSession();
    notifyAuthStateChanged();
    router.replace('/login');
  };

  const customerId = user?.userId || 'CUST-DEMO';
  const customerName = user?.name || 'Customer';
  const customerQrPayload = encodeStaticCustomerQr(customerId, customerName);

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-12 text-center text-xs font-bold text-slate-400">Loading Profile...</div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6">
      <button
        onClick={() => router.push('/customer/dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-navy-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Dashboard</span>
      </button>

      {/* Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-blue text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md">
            {customerName.charAt(0) || 'C'}
          </div>
          <div>
            <h2 className="text-xl font-black text-navy-900">{customerName}</h2>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{user?.email || 'customer@nopay.com'}</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">ID: {customerId}</p>
          </div>
        </div>

        {/* Role Switcher Section */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Active Mode</span>
          <RoleSwitcher
            currentRole={user?.activeRole || 'CUSTOMER'}
            roles={user?.roles || ['CUSTOMER']}
            hasMerchantProfile={!!user?.merchantProfileId}
          />
        </div>

        {/* Account Details */}
        <div className="space-y-3 text-xs border-t border-slate-100 pt-4">
          <div className="flex justify-between items-center text-slate-600">
            <span>Account Type</span>
            <span className="font-bold text-navy-900">Standard Customer</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <button
        onClick={() => router.push('/customer/autopay')}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-blue"
      >
        <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
          <CreditCard className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-bold text-navy-900">Merchant AutoPay</span>
          <span className="block text-xs text-slate-500">Manage per-merchant UPI mandates and revocation</span>
        </span>
      </button>

      {/* Customer Static QR Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-navy-900">Customer Static QR</h3>
            <p className="text-xs text-slate-400">Personal customer identification & payment QR</p>
          </div>
        </div>

        <div className="pt-2">
          <QrCodeGenerator
            value={customerQrPayload}
            size={200}
            qrType="CUSTOMER"
            title={customerName}
            subtitle={`Customer ID: ${customerId}`}
            showActions={true}
          />
        </div>

        <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-1 text-center">
          <p className="text-xs font-bold text-purple-900">Permanent Personal QR</p>
          <p className="text-[11px] text-purple-700 leading-relaxed">
            Show this QR code to merchants or scan it to identify your customer wallet even without an internet connection.
          </p>
        </div>
      </div>
    </div>
  );
}
