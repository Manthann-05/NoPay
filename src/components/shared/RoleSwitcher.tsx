'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types';
import { notifyAuthStateChanged } from '@/lib/auth/client';
import { Store, Smartphone } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: UserRole;
  roles: UserRole[];
  hasMerchantProfile?: boolean;
  onRoleChanged?: (newRole: UserRole) => void;
  compact?: boolean;
}

export function RoleSwitcher({ currentRole, roles, hasMerchantProfile, onRoleChanged, compact = false }: RoleSwitcherProps) {
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
      try {
        const { updateLocalActiveRole } = await import('@/offline/session');
        await updateLocalActiveRole(targetRole);
      } catch (e) {
        console.warn('Could not update local session role:', e);
      }

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
      notifyAuthStateChanged();
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
    <div className="flex w-fit max-w-full px-1 items-center border-2 border-border bg-surface shadow-[2px_2px_0px_0px_var(--border)] font-mono">
      <button
        onClick={() => switchRole('CUSTOMER')}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
          currentRole === 'CUSTOMER'
            ? 'bg-foreground text-background shadow-[1px_1px_0px_0px_var(--border)]'
            : 'text-foreground hover:bg-surface-hover'
        }`}
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>CUSTOMER</span>
      </button>

      <button
        onClick={() => switchRole('MERCHANT')}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
          currentRole === 'MERCHANT'
            ? 'bg-foreground text-background shadow-[1px_1px_0px_0px_var(--border)]'
            : 'text-foreground hover:bg-surface-hover'
        }`}
      >
        <Store className="w-3.5 h-3.5" />
        <span>MERCHANT</span>
        {!hasMerchantRole && (
          <span className="ml-0.5 text-[8px] border border-border bg-background text-foreground px-1 py-0.2 font-black">
            +
          </span>
        )}
      </button>
    </div>
  );
}
