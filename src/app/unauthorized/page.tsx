'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center space-y-6">
      <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-navy-900">Not authorized</h1>
        <p className="text-sm text-slate-600">
          This area is for merchant accounts. Sign in with a merchant account or enable merchant mode from your customer dashboard.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/customer/dashboard"
          className="px-5 py-3 bg-brand-blue text-white text-sm font-bold rounded-xl"
        >
          Customer dashboard
        </Link>
        <Link
          href="/merchant-setup"
          className="px-5 py-3 bg-slate-100 text-navy-900 text-sm font-bold rounded-xl"
        >
          Enable merchant mode
        </Link>
      </div>
    </div>
  );
}
