'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { OfflineBadge } from './OfflineBadge';
import { RoleSwitcher } from './RoleSwitcher';
import { UserRole } from '@/types';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getLocalSession, clearLocalSession } from '@/offline/session';
import { AUTH_STATE_CHANGED_EVENT, notifyAuthStateChanged } from '@/lib/auth/client';
import {
  QrCode,
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  BarChart3,
  Settings,
  LogOut,
  User as UserIcon,
  Store,
} from 'lucide-react';

interface NavbarUser {
  name: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
  merchantProfile?: {
    shopName: string;
  } | null;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  
  const [user, setUser] = useState<NavbarUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUser() {
      try {
        if (isOnline) {
          const res = await fetch('/api/auth/me', {
            cache: 'no-store',
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated) {
              setUser(data.user);
              return;
            }
          }
        }
        
        // Fallback to local session if offline or API failed
        const session = await getLocalSession();
        if (session) {
          setUser({
            name: session.name,
            email: session.email,
            roles: session.roles,
            activeRole: session.activeRole,
            merchantProfile: session.merchantName ? { shopName: session.merchantName } : null
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load user', err);
        const session = await getLocalSession();
        if (session && !controller.signal.aborted) {
          setUser({
            name: session.name,
            email: session.email,
            roles: session.roles,
            activeRole: session.activeRole,
            merchantProfile: session.merchantName ? { shopName: session.merchantName } : null
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadUser();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, loadUser);
    return () => {
      controller.abort();
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, loadUser);
    };
  }, [isOnline]);

  const activeRole = user?.activeRole || 'CUSTOMER';
  const roles = user?.roles || ['CUSTOMER'];

  const handleLogout = async () => {
    try {
      if (isOnline) {
        await fetch('/api/auth/logout', { method: 'POST' });
      }
      await clearLocalSession();
      setUser(null);
      notifyAuthStateChanged();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const customerNav = [
    { label: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboard },
    { label: 'Scan QR', href: '/customer/scan', icon: QrCode },
    { label: 'Transactions', href: '/customer/transactions', icon: History },
    { label: 'Profile', href: '/customer/profile', icon: Settings },
  ];

  const merchantNav = [
    { label: 'Dashboard', href: '/merchant/dashboard', icon: LayoutDashboard },
    { label: 'Billing / POS', href: '/merchant/billing', icon: ShoppingCart },
    { label: 'Products', href: '/merchant/products', icon: Package },
    { label: 'Static QR', href: '/merchant/static-qr', icon: QrCode },
    { label: 'Transactions', href: '/merchant/transactions', icon: History },
    { label: 'Reports', href: '/merchant/reports', icon: BarChart3 },
    { label: 'Profile', href: '/merchant/profile', icon: Settings },
  ];

  const currentNavItems = activeRole === 'MERCHANT' ? merchantNav : customerNav;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Shop Name */}
          <div className={`flex items-center ${
            activeRole === 'MERCHANT' ? 'gap-1.5' : 'gap-3'
          }`}>
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-navy-900 to-brand-blue flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-navy-900 block leading-tight">
                  No<span className="text-brand-blue">Pay</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase block">
                  Offline POS & Sync
                </span>
              </div>
            </Link>

            {/* Merchant Shop Tag */}
            {activeRole === 'MERCHANT' && user?.merchantProfile?.shopName && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-navy-50 text-navy-900 border border-navy-200 rounded-lg text-xs font-medium">
                <Store className="w-3.5 h-3.5 text-brand-blue" />
                <span className="font-semibold truncate max-w-[140px]">
                  {user.merchantProfile.shopName}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className={`flex min-w-0 flex-1 items-center justify-center ${
            activeRole === 'MERCHANT' ? 'gap-0 px-0' : 'gap-0.5 px-2'
          }`}>
            {user && currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || Boolean(pathname?.startsWith(item.href + '/'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center rounded-lg py-2 font-medium transition-colors ${
                    activeRole === 'MERCHANT'
                      ? 'gap-0.5 px-1 text-[11px]'
                      : 'gap-1.5 px-2.5 text-sm'
                  } ${
                    isActive
                      ? 'bg-blue-50 text-brand-blue font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-blue' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Header Actions (Offline Badge, Role Switcher, Auth Buttons) */}
          <div className="flex items-center gap-3">
            <OfflineBadge />

            {!isLoading && (
              user ? (
                <>
                  <div className="hidden md:block">
                    <RoleSwitcher
                      currentRole={activeRole}
                      roles={roles}
                      compact={activeRole === 'MERCHANT'}
                      onRoleChanged={(newRole) => setUser((current) => (
                        current ? { ...current, activeRole: newRole } : current
                      ))}
                    />
                  </div>

                  <div className={`relative flex items-center border-l border-slate-200 ${
                    activeRole === 'MERCHANT' ? 'gap-1 pl-1.5' : 'gap-2 pl-2'
                  }`}>
                    <div className="hidden sm:flex flex-col text-right">
                      <span className="text-xs font-bold text-slate-800 leading-tight">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-slate-500">{user.email}</span>
                    </div>

                    <button
                      onClick={handleLogout}
                      title="Logout"
                      className={`text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ${
                        activeRole === 'MERCHANT' ? 'p-1.5' : 'p-2'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-navy-900 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 text-xs font-bold text-white bg-brand-blue hover:bg-brand-darkBlue rounded-xl shadow-sm transition-all"
                  >
                    Get Started
                  </Link>
                </div>
              )
            )}

          </div>
        </div>
      </div>
    </header>
  );
}
