'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseQrPayload } from '@/lib/qr/payload';
import { DecodedQrPayload } from '@/types';
import { Camera, X, RefreshCw, Type, AlertCircle, Sparkles } from 'lucide-react';

interface QrScannerModalProps {
  onScanSuccess: (payload: DecodedQrPayload, rawText: string) => void;
  onClose: () => void;
}

export function QrScannerModal({ onScanSuccess, onClose }: QrScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (activeTab === 'camera') {
      const html5QrCode = new Html5Qrcode('reader');
      scannerRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode
        .start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            const parsed = parseQrPayload(decodedText);
            if (parsed) {
              if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(console.error);
              }
              onScanSuccess(parsed, decodedText);
            } else {
              setCameraError('Unrecognized QR format. Please scan a valid NoPay Merchant or Bill QR.');
            }
          },
          () => {}
        )
        .catch((err) => {
          if (isMounted) {
            setCameraError('Unable to access device camera. Please allow camera permissions or use manual entry below.');
          }
        });
    }

    return () => {
      isMounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [activeTab]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const parsed = parseQrPayload(manualInput);
    if (!parsed) {
      setManualError('Invalid QR payload string. Please verify the JSON string structure.');
      return;
    }

    onScanSuccess(parsed, manualInput);
  };

  const handleLoadSampleMerchant = () => {
    const sample = JSON.stringify({
      type: 'MERCHANT',
      version: 1,
      merchantId: 'SHOP123',
      merchantName: 'ABC General Store',
    });
    setManualInput(sample);
  };

  const handleLoadSampleBill = () => {
    const sample = JSON.stringify({
      type: 'BILL',
      version: 1,
      transactionId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      billId: 'BILL-4587',
      merchantId: 'SHOP123',
      merchantName: 'ABC General Store',
      items: [
        { name: 'Milk 1L', quantity: 2, price: 60 },
        { name: 'Bread', quantity: 1, price: 40 },
        { name: 'Chips', quantity: 2, price: 20 },
      ],
      subtotal: 200,
      discount: 0,
      tax: 0,
      total: 200,
      createdAt: new Date().toISOString(),
    });
    setManualInput(sample);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-modal overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-blue" />
            <h3 className="font-bold text-base">NoPay QR Scanner</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'camera'
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Camera Scanner
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'manual'
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Manual Entry (Test)
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'camera' ? (
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-[280px] h-[280px] rounded-2xl overflow-hidden bg-slate-900 border-2 border-brand-blue flex items-center justify-center">
                <div id="reader" className="w-full h-full"></div>

                {/* Scanning Frame Overlay */}
                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-brand-blue/60 rounded-2xl m-6"></div>
              </div>

              {cameraError && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{cameraError}</p>
                    <button
                      onClick={() => setActiveTab('manual')}
                      className="mt-1 text-brand-blue font-bold underline cursor-pointer"
                    >
                      Switch to Manual Entry
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 mt-4 text-center">
                Point your camera at a NoPay Merchant QR or Bill QR. Type will be automatically detected offline.
              </p>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Paste / Enter QR Payload JSON:
                </label>
                <textarea
                  rows={5}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder='{"type":"MERCHANT","merchantId":"SHOP123",...}'
                  className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none"
                />
              </div>

              {manualError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {manualError}
                </div>
              )}

              {/* Sample Test Data Helpers */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Quick Load Test Payloads:
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSampleMerchant}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-blue-50 hover:text-brand-blue border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Static Merchant</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleBill}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-blue-50 hover:text-brand-blue border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Bill QR (₹200)</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-brand-blue hover:bg-brand-darkBlue text-white font-bold text-sm rounded-xl shadow-md transition-all mt-4"
              >
                Decode & Continue
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
