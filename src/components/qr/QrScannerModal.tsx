'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { NoPayQrType, parseScannedQr, ScannedQrResult } from '@/lib/qr/payload';
import { Image as ImageIcon, AlertCircle, QrCode, X } from 'lucide-react';

interface QrScannerModalProps {
  onScanSuccess: (result: ScannedQrResult, rawText: string) => void;
  onClose: () => void;
  allowedTypes?: NoPayQrType[];
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

export function QrScannerModal({
  onScanSuccess,
  onClose,
  allowedTypes,
}: QrScannerModalProps) {
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

    await stopCamera();
    await new Promise((r) => setTimeout(r, 150));
    if (!isMountedRef.current) return;

    const element = document.getElementById(READER_ELEMENT_ID);
    if (!element) {
      setCameraError('Camera container not found. Please try again.');
      setIsStarting(false);
      return;
    }

    const html5QrCode = new Html5Qrcode(READER_ELEMENT_ID, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = html5QrCode;

    const scannerConfig = {
      fps: 12,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight, window.innerWidth);
        const size = Math.max(140, Math.min(Math.floor(minEdge * 0.72), 280));
        return { width: size, height: size };
      },
      aspectRatio: 1.0,
    };
    const onDecoded = (decodedText: string) => {
      if (hasScannedRef.current) return;

      const result = parseScannedQr(decodedText);
      if (result) {
        if (allowedTypes && !allowedTypes.includes(result.type)) {
          setScanStatus(`This NoPay QR is for ${result.type.toLowerCase()}, not this screen`);
          return;
        }
        hasScannedRef.current = true;
        setScanStatus('NoPay QR detected');
        stopCamera().then(() => {
          if (isMountedRef.current) {
            onScanSuccessRef.current(result, decodedText);
          }
        });
      } else {
        setScanStatus('QR not recognized — point at a valid payment QR');
      }
    };
    const onFrameError = () => {
      // Frames without a QR code are expected while scanning.
    };

    try {
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          scannerConfig,
          onDecoded,
          onFrameError
        );
      } catch (firstError) {
        await stopCamera();
        if (!isMountedRef.current) return;

        const cameras = await Html5Qrcode.getCameras();
        const fallbackCamera = cameras.find((camera) =>
          /back|rear|environment/i.test(camera.label)
        ) || cameras[0];

        if (!fallbackCamera) {
          throw firstError;
        }

        const fallbackScanner = new Html5Qrcode(READER_ELEMENT_ID, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = fallbackScanner;
        await fallbackScanner.start(
          fallbackCamera.id,
          scannerConfig,
          onDecoded,
          onFrameError
        );
      }

      if (isMountedRef.current) {
        setIsStarting(false);
        setScanStatus('Point camera at a NoPay QR code');
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setIsStarting(false);
      await stopCamera();

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
  }, [allowedTypes, stopCamera]);

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
        if (parsed && (!allowedTypes || allowedTypes.includes(parsed.type))) {
          onScanSuccessRef.current(parsed, result);
        } else {
          setImageError(
            parsed
              ? `This NoPay QR is for ${parsed.type.toLowerCase()}, not this screen.`
              : 'Only NoPay QR codes are supported. External bank or UPI QR codes are not accepted.'
          );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-mono">
      <div className="relative w-full max-w-md neo-box overflow-hidden bg-surface">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-border bg-foreground text-background">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            <h3 className="font-black text-sm uppercase tracking-wider">SCANNER TERMINAL</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 border border-background hover:bg-background hover:text-foreground transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[280px] aspect-square overflow-hidden bg-black border-2 border-border shadow-[4px_4px_0px_0px_var(--border)] flex items-center justify-center mx-auto">
              <div id={READER_ELEMENT_ID} className="w-full h-full" />

              {!cameraError && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-white" />
                  <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-white" />
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-white" />
                  <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-white" />
                </div>
              )}

              {isStarting && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent animate-spin" />
                  <p className="text-[10px] uppercase font-bold tracking-wider">Starting camera…</p>
                </div>
              )}
            </div>

            {!cameraError && !isStarting && (
              <p className="text-xs text-foreground-muted mt-3 text-center font-bold">{scanStatus}</p>
            )}

            {cameraError && (
              <div className="mt-3 p-3 border-2 border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2 w-full">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2 text-left">
                  <p className="font-bold">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="font-black underline uppercase"
                  >
                    Try camera again
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-0.5 bg-border" />
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">or</span>
            <div className="flex-1 h-0.5 bg-border" />
          </div>

          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full neo-btn-secondary py-3 text-xs"
            >
              <ImageIcon className="w-4 h-4" />
              <span>UPLOAD IMAGE FILE</span>
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
              <div className="mt-2 p-3 border-2 border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p>{imageError}</p>
              </div>
            )}

            <p className="text-[10px] text-foreground-muted text-center mt-3 uppercase tracking-wider">
              Only NoPay protocol QR codes are recognized.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

}
