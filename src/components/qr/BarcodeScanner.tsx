'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Scan, X, AlertCircle } from 'lucide-react';

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
 * Product barcode scanner only. Does not parse NoPay QR formats.
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasDetectedRef = useRef(false);
  const isCleaningUpRef = useRef(false);

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

  useEffect(() => {
    let isMounted = true;
    hasDetectedRef.current = false;

    async function startCamera() {
      setIsStarting(true);
      setCameraError(null);

      await new Promise((r) => setTimeout(r, 150));
      if (!isMounted) return;

      const element = document.getElementById(BARCODE_READER_ID);
      if (!element) {
        setCameraError('Camera container not found.');
        setIsStarting(false);
        return;
      }

      try {
        const html5QrCode = new Html5Qrcode(BARCODE_READER_ID, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.max(180, Math.min(Math.floor(viewfinderWidth * 0.86), 360));
              const height = Math.max(80, Math.min(Math.floor(viewfinderHeight * 0.32), 140));
              return { width, height };
            },
            aspectRatio: 1.7,
          },
          (decodedText) => {
            if (hasDetectedRef.current) return;
            hasDetectedRef.current = true;
            stopCamera().then(() => {
              if (isMounted) {
                onDetected(decodedText.trim());
              }
            });
          },
          () => {
            // ignore frame failures
          }
        );

        if (isMounted) setIsStarting(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        setIsStarting(false);
        const msg = String(err instanceof Error ? err.message : err || '');
        if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
          setCameraError('Camera permission denied. Please allow camera access and try again.');
        } else if (msg.includes('NotFound')) {
          setCameraError('No camera found on this device.');
        } else {
          setCameraError('Unable to start the camera. Please try again.');
        }
      }
    }

    startCamera();
    return () => {
      isMounted = false;
      void stopCamera();
    };
  }, [onDetected, stopCamera]);

  const handleClose = useCallback(async () => {
    await stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-modal overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
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

        <div className="p-6 space-y-4">
          <div
            className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700 flex items-center justify-center"
            style={{ aspectRatio: '1.7' }}
          >
            <div id={BARCODE_READER_ID} className="w-full h-full" />

            {!cameraError && !isStarting && (
              <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-brand-blue/60 pointer-events-none" />
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
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="font-medium">{cameraError}</p>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center font-medium">
            Point camera at the product barcode on the packaging
          </p>
        </div>
      </div>
    </div>
  );
}
