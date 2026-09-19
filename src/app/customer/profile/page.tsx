'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { User, UserRole } from '@/types';
import { User as UserIcon, Store, ArrowLeft, LogOut, ShieldCheck, Mail } from 'lucide-react';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function CustomerProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-12 text-center text-xs font-bold text-slate-400">Loading Profile...</div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6">
      <button
        onClick={() => router.push('/customer/dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-navy-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Dashboard</span>
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-blue text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md">
            {user?.name?.charAt(0) || 'C'}
          </div>
          <div>
            <h2 className="text-xl font-black text-navy-900">{user?.name || 'Customer Account'}</h2>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{user?.email || 'customer@nopay.com'}</span>
            </div>
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
          <div className="flex justify-between items-center text-slate-600">
            <span>Offline Sync Status</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Enabled
            </span>
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
    </div>
  );
}
