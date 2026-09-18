'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types';
import { Store, Smartphone, ArrowRightLeft, PlusCircle } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: UserRole;
  roles: UserRole[];
  hasMerchantProfile?: boolean;
  onRoleChanged?: (newRole: UserRole) => void;
}

export function RoleSwitcher({ currentRole, roles, hasMerchantProfile, onRoleChanged }: RoleSwitcherProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const hasMerchantRole = roles.includes('MERCHANT');

  const switchRole = async (targetRole: UserRole) => {
    if (targetRole === currentRole) return;

    if (targetRole === 'MERCHANT' && !hasMerchantRole) {
      router.push('/merchant-setup');
      return;
    }

    setLoading(true);
    try {
      // 1. Always update local session in Dexie (works offline)
      try {
        const { updateLocalActiveRole } = await import('@/offline/session');
        await updateLocalActiveRole(targetRole);
      } catch (e) {
        console.warn('Could not update local session role:', e);
      }

      // 2. If online, sync to server
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await fetch('/api/auth/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activeRole: targetRole }),
          });
        } catch (apiErr) {
          console.warn('Could not sync role change to API:', apiErr);
        }
      }

      if (onRoleChanged) onRoleChanged(targetRole);
      if (targetRole === 'MERCHANT') {
        router.push('/merchant/dashboard');
      } else {
        router.push('/customer/dashboard');
      }
      router.refresh();
    } catch (err) {
      console.error('Failed to switch role:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
      <button
        onClick={() => switchRole('CUSTOMER')}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          currentRole === 'CUSTOMER'
            ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Customer</span>
      </button>

      <button
        onClick={() => switchRole('MERCHANT')}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          currentRole === 'MERCHANT'
            ? 'bg-navy-900 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Store className="w-3.5 h-3.5" />
        <span>Merchant</span>
        {!hasMerchantRole && (
          <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
            + Setup
          </span>
        )}
      </button>
    </div>
  );
}
