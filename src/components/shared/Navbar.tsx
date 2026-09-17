'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { OfflineBadge } from './OfflineBadge';
import { RoleSwitcher } from './RoleSwitcher';
import { UserRole } from '@/types';
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
  Menu,
  X,
  HelpCircle,
} from 'lucide-react';

interface NavbarProps {
  user?: {
    name: string;
    email: string;
    roles: UserRole[];
    activeRole: UserRole;
    merchantProfile?: {
      shopName: string;
    } | null;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeRole = user?.activeRole || 'CUSTOMER';
  const roles = user?.roles || ['CUSTOMER'];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const customerNav = [
    { label: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboard },
    { label: 'Scan QR', href: '/customer/scan', icon: QrCode },
    { label: 'Transactions', href: '/customer/transactions', icon: History },
    { label: 'Settings', href: '/customer/settings', icon: Settings },
  ];

  const merchantNav = [
    { label: 'Dashboard', href: '/merchant/dashboard', icon: LayoutDashboard },
    { label: 'Billing / POS', href: '/merchant/billing', icon: ShoppingCart },
    { label: 'Products', href: '/merchant/products', icon: Package },
    { label: 'Static QR', href: '/merchant/static-qr', icon: QrCode },
    { label: 'Transactions', href: '/merchant/transactions', icon: History },
    { label: 'Reports', href: '/merchant/reports', icon: BarChart3 },
    { label: 'Settings', href: '/merchant/settings', icon: Settings },
  ];

  const currentNavItems = activeRole === 'MERCHANT' ? merchantNav : customerNav;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Shop Name */}
          <div className="flex items-center gap-3">
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
          <nav className="hidden lg:flex items-center gap-1">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || Boolean(pathname?.startsWith(item.href + '/'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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

            {user ? (
              <>
                <div className="hidden md:block">
                  <RoleSwitcher currentRole={activeRole} roles={roles} />
                </div>

                <div className="relative flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-800 leading-tight">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-500">{user.email}</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    title="Logout"
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
            )}

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
          {user && (
            <div className="mb-3 p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-200">
              <div>
                <div className="text-sm font-bold text-slate-900">{user.name}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
              </div>
              <RoleSwitcher currentRole={activeRole} roles={roles} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-blue text-white font-semibold shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
