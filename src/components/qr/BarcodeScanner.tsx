'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Scan, X, AlertCircle, Upload, ArrowRight, Keyboard } from 'lucide-react';

interface BarcodeScannerProps {
  onDetected: (rawText: string) => void;
  onClose: () => void;
}

const BARCODE_READER_ID = 'nopay-barcode-reader';

function stopVideoTracks(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.querySelectorAll('video').forEach((video) => {
    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  });
}

/**
 * Product barcode scanner supporting physical camera (environment + front fallback),
 * image file upload, and manual barcode entry for testing.
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasDetectedRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    try {
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          if (scanner.isScanning) await scanner.stop();
        } catch {
          // ignore
        }
        try {
          scanner.clear();
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }
      stopVideoTracks(BARCODE_READER_ID);
    } finally {
      isCleaningUpRef.current = false;
    }
  }, []);

  const triggerDetected = useCallback((code: string) => {
    if (hasDetectedRef.current) return;
    hasDetectedRef.current = true;
    void stopCamera().then(() => {
      onDetected(code.trim());
    });
  }, [onDetected, stopCamera]);

  useEffect(() => {
    isMountedRef.current = true;
    hasDetectedRef.current = false;

    async function startCamera() {
      setIsStarting(true);
      setCameraError(null);

      await new Promise((r) => setTimeout(r, 150));
      if (!isMountedRef.current) return;

      const element = document.getElementById(BARCODE_READER_ID);
      if (!element) {
        setCameraError('Camera container not found.');
        setIsStarting(false);
        return;
      }

      const supportedFormats = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const scanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const width = Math.max(180, Math.min(Math.floor(viewfinderWidth * 0.86), 360));
          const height = Math.max(80, Math.min(Math.floor(viewfinderHeight * 0.45), 180));
          return { width, height };
        },
        aspectRatio: 1.7,
      };

      try {
        const html5QrCode = new Html5Qrcode(BARCODE_READER_ID, {
          verbose: false,
          formatsToSupport: supportedFormats,
        });
        scannerRef.current = html5QrCode;

        // Try environment camera first, then fall back to any available camera (front camera, webcam, etc.)
        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            scanConfig,
            (decodedText) => {
              triggerDetected(decodedText);
            },
            () => {}
          );
        } catch {
          // Fallback to query available devices
          await stopCamera();
          if (!isMountedRef.current) return;

          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            throw new Error('No camera found on this device');
          }

          const fallbackCamera = cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[0];
          const fallbackScanner = new Html5Qrcode(BARCODE_READER_ID, {
            verbose: false,
            formatsToSupport: supportedFormats,
          });
          scannerRef.current = fallbackScanner;

          await fallbackScanner.start(
            fallbackCamera.id,
            scanConfig,
            (decodedText) => {
              triggerDetected(decodedText);
            },
            () => {}
          );
        }

        if (isMountedRef.current) setIsStarting(false);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        setIsStarting(false);
        const msg = String(err instanceof Error ? err.message : err || '');
        if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
          setCameraError('Camera permission denied. Use manual barcode entry below or allow camera in browser settings.');
        } else if (msg.includes('NotFound') || msg.includes('No camera')) {
          setCameraError('No camera found on this device. You can type or paste a barcode below.');
        } else {
          setCameraError('Camera unavailable. You can enter or select a test barcode below.');
        }
        setShowManual(true);
      }
    }

    void startCamera();
    return () => {
      isMountedRef.current = false;
      void stopCamera();
    };
  }, [stopCamera, triggerDetected]);

  const handleClose = useCallback(async () => {
    await stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    triggerDetected(manualCode.trim());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = scannerRef.current || new Html5Qrcode(BARCODE_READER_ID, { verbose: false });
      const result = await html5QrCode.scanFile(file, true);
      triggerDetected(result);
    } catch {
      alert('Could not detect a clear barcode in the uploaded image. Please try another image or type the number.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-modal overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-brand-lightBlue" />
            <h3 className="font-bold text-base">Scan Product Barcode</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close barcode scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Camera Viewfinder */}
          <div
            className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700 flex items-center justify-center"
            style={{ minHeight: '180px' }}
          >
            <div id={BARCODE_READER_ID} className="w-full h-full min-h-[180px]" />

            {!cameraError && !isStarting && (
              <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-brand-blue/70 pointer-events-none shadow-sm animate-pulse" />
            )}

            {isStarting && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900">
                <div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-400">Starting camera…</p>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{cameraError}</p>
            </div>
          )}

          <p className="text-[11px] text-slate-500 text-center font-medium">
            Point camera at the barcode, upload an image, or enter the code below
          </p>

          {/* Manual Entry & Quick Test */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowManual((prev) => !prev)}
                className="text-xs font-bold text-brand-blue hover:text-brand-darkBlue flex items-center gap-1.5"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>{showManual ? 'Hide manual entry' : 'Type barcode manually'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-slate-600 hover:text-navy-900 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Image</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {showManual && (
              <form onSubmit={handleManualSubmit} className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 8901234567890"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-navy-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm"
                  >
                    <span>Detect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick test barcodes */}
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Sample Barcodes:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Milk', code: '8901234567890' },
                      { label: 'Bread', code: '8901234567891' },
                      { label: 'Meds', code: '890123400001' },
                      { label: 'Notebook', code: '890200000001' },
                      { label: 'Book', code: '9781847941831' },
                    ].map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => triggerDetected(item.code)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono rounded-lg transition-colors"
                      >
                        {item.label}: {item.code.slice(-5)}
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
