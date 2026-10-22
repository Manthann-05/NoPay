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
import { ThemeToggle } from './ThemeToggle';

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
  '/customer/static-pay',
  '/customer/bill',
  '/customer/payment',
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
    { label: 'DASHBOARD', href: '/customer/dashboard', icon: LayoutDashboard },
    { label: 'SCAN QR', href: '/customer/scan', icon: QrCode },
    { label: 'TRANSACTIONS', href: '/customer/transactions', icon: History },
    { label: 'PROFILE', href: '/customer/profile', icon: Settings },
  ];

  const merchantNav = [
    { label: 'DASHBOARD', href: '/merchant/dashboard', icon: LayoutDashboard },
    { label: 'POS BILLING', href: '/merchant/billing', icon: ShoppingCart },
    { label: 'PRODUCTS', href: '/merchant/products', icon: Package },
    { label: 'STATIC QR', href: '/merchant/static-qr', icon: QrCode },
    { label: 'TRANSACTIONS', href: '/merchant/transactions', icon: History },
    { label: 'REPORTS', href: '/merchant/reports', icon: BarChart3 },
    { label: 'PROFILE', href: '/merchant/profile', icon: Settings },
  ];

  const currentNavItems = activeRole === 'MERCHANT' ? merchantNav : customerNav;

  return (
    <header className="sticky top-0 z-40 bg-surface border-b-2 border-border shadow-[0px_3px_0px_0px_var(--border)] transition-colors duration-150">
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Shop Tag */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 border-2 border-border bg-foreground text-background flex items-center justify-center font-black shadow-[2px_2px_0px_0px_var(--border)] group-hover:translate-x-[-1px] group-hover:translate-y-[-1px] transition-transform">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="leading-none">
                <span className="text-lg font-black tracking-tighter text-foreground block uppercase">
                  NO<span className="underline decoration-2 underline-offset-2">PAY</span>
                </span>
                <span className="text-[9px] font-mono font-bold tracking-widest text-foreground-muted block mt-0.5">
                  OFFLINE POS
                </span>
              </div>
            </Link>

            {activeRole === 'MERCHANT' && user?.merchantProfile?.shopName && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 border-2 border-border bg-surface text-foreground font-mono text-xs font-bold shadow-[2px_2px_0px_0px_var(--border)] shrink-0">
                <Store className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[120px] uppercase">
                  {user.merchantProfile.shopName}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          {activeRole !== 'MERCHANT' && (
          <nav aria-label="Customer navigation" className="flex min-w-0 items-center justify-center gap-1.5 overflow-x-auto scrollbar-none py-1">
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
                  className={`flex shrink-0 items-center py-1.5 px-2.5 text-xs font-mono font-bold border-2 transition-all gap-1.5 ${
                    isActive
                      ? 'bg-foreground text-background border-border shadow-[2px_2px_0px_0px_var(--border)] translate-x-[-1px] translate-y-[-1px]'
                      : 'border-transparent text-foreground hover:border-border hover:bg-surface-hover'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          )}

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <OfflineBadge />

            {/* Global Theme Toggle */}
            <ThemeToggle compact={true} />

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

                  <div className="flex items-center border-l-2 border-border gap-2 pl-2">
                    <div className="hidden xl:flex flex-col text-right font-mono">
                      <span className="text-xs font-black text-foreground leading-tight truncate max-w-[100px]">
                        {user.name}
                      </span>
                      <span className="text-[9px] text-foreground-muted truncate max-w-[100px]">{user.email}</span>
                    </div>

                    <button
                      onClick={handleLogout}
                      title="Logout"
                      className="p-1.5 border-2 border-border bg-surface text-foreground hover:bg-foreground hover:text-background transition-colors shadow-[2px_2px_0px_0px_var(--border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-3 py-2 text-xs font-mono font-bold text-foreground border-2 border-transparent hover:border-border hover:bg-surface-hover transition-all"
                  >
                    SIGN IN
                  </Link>
                  <Link
                    href="/register"
                    className="px-3.5 py-2 text-xs font-mono font-black text-background bg-foreground border-2 border-border shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                  >
                    REGISTER
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      </div>
      {activeRole === 'MERCHANT' && user && (
        <div className="border-t border-border/70 bg-surface">
          <nav
            aria-label="Merchant navigation"
            className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto scrollbar-none p-4 sm:px-6 lg:px-8 lg:justify-center"
          >
            {merchantNav.map((item) => {
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
                  className={`flex shrink-0 items-center gap-2 border-2 px-3 py-2 text-[11px] font-mono font-bold transition-all ${
                    isActive
                      ? 'border-border bg-foreground text-background shadow-[2px_2px_0px_0px_var(--border)]'
                      : 'border-transparent text-foreground hover:border-border hover:bg-surface-hover'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
