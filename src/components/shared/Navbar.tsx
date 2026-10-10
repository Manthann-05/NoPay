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

const CUSTOMER_ROUTE_PATHS = [
  '/customer/dashboard',
  '/customer/scan',
  '/customer/transactions',
  '/customer/profile',
];

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

  useEffect(() => {
    if (!isOnline || !user || typeof navigator === 'undefined' || !navigator.serviceWorker) {
      return;
    }

    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: 'CACHE_ROUTES',
        routes: CUSTOMER_ROUTE_PATHS,
      });
    });
  }, [isOnline, user?.email]);

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
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Shop Name */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-navy-900 to-brand-blue flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-navy-900 block leading-tight">
                  No<span className="text-brand-blue">Pay</span>
                </span>
                <span className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase block">
                  Offline POS
                </span>
              </div>
            </Link>

            {/* Merchant Shop Tag */}
            {activeRole === 'MERCHANT' && user?.merchantProfile?.shopName && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-navy-50 text-navy-900 border border-navy-200 rounded-lg text-xs font-medium shrink-0">
                <Store className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                <span className="font-bold truncate max-w-[120px]">
                  {user.merchantProfile.shopName}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="flex min-w-0 items-center justify-center gap-1 overflow-x-auto scrollbar-none py-1">
            {user && currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || Boolean(pathname?.startsWith(item.href + '/'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(event) => {
                    if (typeof navigator !== 'undefined' && !navigator.onLine) {
                      event.preventDefault();
                      window.location.assign(item.href);
                    }
                  }}
                  className={`flex shrink-0 items-center rounded-lg py-1.5 px-2 text-xs font-medium transition-all gap-1.5 ${
                    isActive
                      ? 'bg-blue-50 text-brand-blue font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-blue' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Header Actions (Offline Badge, Role Switcher, Auth Buttons) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <OfflineBadge />

            {!isLoading && (
              user ? (
                <>
                  <div className="hidden md:block">
                    <RoleSwitcher
                      currentRole={activeRole}
                      roles={roles}
                      compact={true}
                      onRoleChanged={(newRole) => setUser((current) => (
                        current ? { ...current, activeRole: newRole } : current
                      ))}
                    />
                  </div>

                  <div className="relative flex items-center border-l border-slate-200 gap-2 pl-2.5">
                    <div className="hidden xl:flex flex-col text-right">
                      <span className="text-xs font-bold text-slate-800 leading-tight">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-slate-500">{user.email}</span>
                    </div>

                    <button
                      onClick={handleLogout}
                      title="Logout"
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
