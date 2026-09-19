'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { parseScannedQr, ScannedQrResult } from '@/lib/qr/payload';
import { Image as ImageIcon, AlertCircle, QrCode, X } from 'lucide-react';

interface QrScannerModalProps {
  onScanSuccess: (result: ScannedQrResult, rawText: string) => void;
  onClose: () => void;
}

const READER_ELEMENT_ID = 'nopay-qr-reader';
const IMAGE_READER_ID = 'nopay-qr-image-reader';

function stopVideoTracks(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.querySelectorAll('video').forEach((video) => {
    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  });
}

export function QrScannerModal({ onScanSuccess, onClose }: QrScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [scanStatus, setScanStatus] = useState<string>('Pointing at QR code…');
  const [imageError, setImageError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;

  const stopCamera = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    try {
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
        } catch {
          // already stopped
        }
        try {
          scanner.clear();
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }
      stopVideoTracks(READER_ELEMENT_ID);
    } finally {
      isCleaningUpRef.current = false;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsStarting(true);
    setCameraError(null);
    hasScannedRef.current = false;

    await new Promise((r) => setTimeout(r, 150));
    if (!isMountedRef.current) return;

    const element = document.getElementById(READER_ELEMENT_ID);
    if (!element) {
      setCameraError('Camera container not found. Please try again.');
      setIsStarting(false);
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode(READER_ELEMENT_ID, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight, window.innerWidth);
              const size = Math.max(140, Math.min(Math.floor(minEdge * 0.72), 280));
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
          },
        (decodedText) => {
          if (hasScannedRef.current) return;

          const result = parseScannedQr(decodedText);
          if (result) {
            hasScannedRef.current = true;
            setScanStatus(result.type === 'EXTERNAL' ? 'Payment QR detected' : 'NoPay QR detected');
            stopCamera().then(() => {
              if (isMountedRef.current) {
                onScanSuccessRef.current(result, decodedText);
              }
            });
          } else {
            setScanStatus('QR not recognized — point at a valid payment QR');
          }
        },
        () => {
          // frame decode failure
        }
      );

      if (isMountedRef.current) {
        setIsStarting(false);
        setScanStatus('Point camera at a NoPay QR code');
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setIsStarting(false);

      const msg = String(err instanceof Error ? err.message : err || '');
      if (
        msg.includes('Permission') ||
        msg.includes('permission') ||
        msg.includes('NotAllowed') ||
        msg.includes('denied')
      ) {
        setCameraError(
          'Camera permission was denied. Please allow camera access in your browser settings and try again.'
        );
      } else if (msg.includes('NotFound') || msg.includes('no camera')) {
        setCameraError('No camera found on this device. Please use Scan from Image below.');
      } else {
        setCameraError(
          'Unable to start the camera. Please check your browser settings or use Scan from Image.'
        );
      }
    }
  }, [stopCamera]);

  useEffect(() => {
    isMountedRef.current = true;
    void startCamera();

    return () => {
      isMountedRef.current = false;
      void stopCamera();
    };
    // start once per modal mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(async () => {
    await stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    await stopCamera();

    try {
      const scanner = new Html5Qrcode(IMAGE_READER_ID, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      try {
        const result = await scanner.scanFile(file, false);
        const parsed = parseScannedQr(result);
        if (parsed) {
          onScanSuccessRef.current(parsed, result);
        } else {
          setImageError('QR code not recognized. Please scan a valid NoPay QR.');
          if (isMountedRef.current) {
            void startCamera();
          }
        }
      } finally {
        try {
          scanner.clear();
        } catch {
          // ignore
        }
      }
    } catch {
      setImageError('No QR code found in this image. Please try a clearer photo.');
      if (isMountedRef.current) {
        void startCamera();
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-modal overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-brand-blue" />
            <h3 className="font-bold text-base">Scan QR</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-brand-blue flex items-center justify-center mx-auto">
              <div id={READER_ELEMENT_ID} className="w-full h-full" />

              {!cameraError && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-brand-blue rounded-tl-sm" />
                  <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-brand-blue rounded-tr-sm" />
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-brand-blue rounded-bl-sm" />
                  <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-brand-blue rounded-br-sm" />
                </div>
              )}

              {isStarting && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900">
                  <div className="w-8 h-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Starting camera…</p>
                </div>
              )}
            </div>

            {!cameraError && !isStarting && (
              <p className="text-xs text-slate-500 mt-3 text-center font-medium">{scanStatus}</p>
            )}

            {cameraError && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2 w-full">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="font-medium">{cameraError}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-brand-blue text-slate-700 hover:text-brand-blue font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Scan from Image</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFile}
              aria-label="Select QR code image"
            />

            <div id={IMAGE_READER_ID} className="hidden" />

            {imageError && (
              <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="font-medium">{imageError}</p>
              </div>
            )}

            <p className="text-[11px] text-slate-400 text-center mt-2">
              Use a screenshot, photo, or saved image of a NoPay QR
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
