'use client';

import React, { useState, useEffect } from 'react';
import { QrCodeGenerator } from '@/components/qr/QrCodeGenerator';
import { encodeStaticMerchantQrPayload } from '@/lib/qr/payload';
import { Store, Download, Printer, ShieldCheck, Share2 } from 'lucide-react';

export default function MerchantStaticQrPage() {
  const [merchant, setMerchant] = useState({
    id: 'SHOP123',
    name: 'NoPay General Store',
  });

  useEffect(() => {
    async function loadMerchantData() {
      try {
        const { getLocalSession } = await import('@/offline/session');
        const session = await getLocalSession();
        if (session) {
          setMerchant({
            id: session.merchantProfileId || session.userId || 'SHOP123',
            name: session.merchantName || (session.name ? `${session.name}'s Shop` : 'NoPay General Store'),
          });
        }

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setMerchant({
                id: data.user.merchantProfileId || 'SHOP123',
                name: data.user.merchantProfile?.shopName || (data.user.name ? `${data.user.name}'s Shop` : 'NoPay General Store'),
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error loading merchant profile:', err);
      }
    }
    loadMerchantData();
  }, []);

  const qrPayload = encodeStaticMerchantQrPayload({
    merchantId: merchant.id,
    merchantName: merchant.name,
  });

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-navy-900">Permanent Merchant Static QR</h1>
        <p className="text-xs text-slate-500">
          Display or print this QR poster for your checkout counter. Customers can scan to enter any payment amount offline.
        </p>
      </div>

      {/* Printable Poster Container */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 p-8 shadow-card text-center space-y-6 print:border-none print:shadow-none">
        <div className="space-y-2">
          <div className="w-14 h-14 bg-navy-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Store className="w-7 h-7 text-brand-lightBlue" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            OFFICIAL NOPAY MERCHANT QR
          </span>
          <h2 className="text-2xl font-black text-navy-900">{merchant.name}</h2>
          <p className="text-xs font-mono text-slate-400">Merchant ID: {merchant.id}</p>
        </div>

        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 inline-block shadow-inner">
          <QrCodeGenerator value={qrPayload} size={240} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-extrabold text-navy-900">Scan & Pay Any Amount</p>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            Supports instant offline payment queueing & server synchronization.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>NoPay End-to-End Idempotent Checkout</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="flex-1 py-3.5 bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Printer className="w-4 h-4 text-brand-lightBlue" />
          <span>Print QR Poster</span>
        </button>
      </div>
    </div>
  );
}
