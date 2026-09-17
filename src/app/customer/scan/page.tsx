'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrScannerModal } from '@/components/qr/QrScannerModal';
import { DecodedQrPayload } from '@/types';
import { QrCode, ArrowLeft } from 'lucide-react';

export default function CustomerScanPage() {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(true);

  const handleScanSuccess = (payload: DecodedQrPayload, rawText: string) => {
    sessionStorage.setItem('nopay_scanned_qr', JSON.stringify(payload));

    if (payload.type === 'MERCHANT') {
      router.push('/customer/static-pay');
    } else if (payload.type === 'BILL') {
      router.push(`/customer/bill/${payload.billId}`);
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
          Open Scanner Camera
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
