'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrScannerModal } from '@/components/qr/QrScannerModal';
import { ScannedQrResult } from '@/lib/qr/payload';
import { storeScannedQrRaw } from '@/lib/qr/scanHandoff';
import { QrCode, ArrowLeft } from 'lucide-react';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function CustomerScanPage() {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(true);

  const handleScanSuccess = (result: ScannedQrResult, rawText: string) => {
    try {
      storeScannedQrRaw(rawText);
      setScannerOpen(false);

      // Replace the scanner route so the payment form is the next screen
      // and a browser refresh cannot reopen the camera modal.
      window.setTimeout(() => {
        if (result.type === 'MERCHANT' || result.type === 'EXTERNAL' || result.type === 'CUSTOMER') {
          router.replace('/customer/static-pay');
        } else {
          router.replace(`/customer/bill/${encodeURIComponent(result.billId)}`);
        }
      }, 0);
    } catch {
      setScannerOpen(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 text-center space-y-6">
      <button
        onClick={() => router.push('/customer/dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-navy-900 mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-card space-y-4">
        <div className="w-16 h-16 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <QrCode className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-navy-900">Scan NoPay QR</h2>
        <p className="text-xs text-slate-500">
          Point your device camera at a Merchant Static QR or Bill QR
        </p>

        <button
          onClick={() => setScannerOpen(true)}
          className="w-full py-3.5 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold rounded-xl shadow-md transition-all text-sm"
        >
          Open Camera
        </button>
      </div>

      {scannerOpen && (
        <QrScannerModal
          onScanSuccess={handleScanSuccess}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
