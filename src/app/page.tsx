'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getLocalSession } from '@/offline/session';
import { QrCode, Store, Smartphone, ShieldCheck, Zap, RefreshCw, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isOnline) {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user) {
              if (data.user.activeRole === 'MERCHANT') {
                router.push('/merchant/dashboard');
              } else {
                router.push('/customer/dashboard');
              }
              return;
            }
          }
        }
        
        // Offline fallback or not authenticated online
        const session = await getLocalSession();
        if (session) {
          if (session.activeRole === 'MERCHANT') {
            router.push('/merchant/dashboard');
          } else {
            router.push('/customer/dashboard');
          }
        } else {
          setIsChecking(false);
        }
      } catch (err) {
        // Desperate fallback
        const session = await getLocalSession();
        if (session) {
          if (session.activeRole === 'MERCHANT') {
            router.push('/merchant/dashboard');
          } else {
            router.push('/customer/dashboard');
          }
        }
        setIsChecking(false);
      }
    }

    checkAuth();
  }, [isOnline, router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-16">
      {/* Hero Header */}
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-brand-blue border border-blue-200 rounded-full text-xs font-extrabold tracking-wide uppercase shadow-sm">
          <Zap className="w-4 h-4 text-brand-blue" />
          <span>Offline-First Billing & QR Payment System</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-navy-900 tracking-tight leading-none">
          Scan, Bill & Synchronize <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-blue-600">
            Without Network Bounds
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
          NoPay empowers merchants to run high-speed counter POS billing and enables customers to scan QR payments seamlessly—even during complete network outages.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-base transition-all hover:scale-105"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-navy-900 border border-slate-300 font-bold rounded-2xl shadow-sm flex items-center justify-center text-base transition-all"
          >
            <span>Sign In to Account</span>
          </Link>
        </div>
      </div>

      {/* Role Feature Cards */}
      <div className="grid md:grid-cols-2 gap-8 pt-8">
        {/* Customer Card */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-card hover:shadow-card-hover transition-all space-y-6">
          <div className="w-14 h-14 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center">
            <Smartphone className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-brand-blue uppercase tracking-wider">
              Mobile-First Experience
            </span>
            <h3 className="text-2xl font-black text-navy-900 mt-1">Customer Wallet</h3>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Scan Static Merchant QRs or Itemized Bill QRs. Pay instantly online or record transactions offline in IndexedDB with automated background synchronization.
            </p>
          </div>
          <ul className="space-y-2.5 text-xs font-semibold text-slate-700">
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Camera QR Scanner with auto-detection</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Itemized bill view without manual total editing</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Razorpay Test Mode integration</span>
            </li>
          </ul>
        </div>

        {/* Merchant Card */}
        <div className="bg-navy-900 text-white p-8 rounded-3xl border border-navy-800 shadow-card hover:shadow-card-hover transition-all space-y-6">
          <div className="w-14 h-14 bg-white/10 text-brand-accent rounded-2xl flex items-center justify-center">
            <Store className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-brand-accent uppercase tracking-wider">
              Desktop POS & Counter Workflow
            </span>
            <h3 className="text-2xl font-black text-white mt-1">Merchant POS Studio</h3>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              Full desktop POS terminal for catalog search, barcode scanning, cart building, offline Bill QR generation, and real-time sales reporting.
            </p>
          </div>
          <ul className="space-y-2.5 text-xs font-semibold text-slate-300">
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-accent" />
              <span>Dual-column POS billing workstation</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-accent" />
              <span>Permanent Static QR & instant Bill QR generator</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-accent" />
              <span>Server-side idempotency protection</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
