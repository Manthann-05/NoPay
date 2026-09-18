import { parseNoPayQr, type NoPayQrResult } from '@/lib/qr/payload';

const SCANNED_QR_KEY = 'nopay_scanned_qr';

/** Persist the raw NoPay QR string. Never store arbitrary JSON as a QR. */
export function storeScannedQrRaw(rawText: string): void {
  sessionStorage.setItem(SCANNED_QR_KEY, rawText);
}

export function readScannedQr(): NoPayQrResult | null {
  const raw = sessionStorage.getItem(SCANNED_QR_KEY);
  if (!raw) return null;
  return parseNoPayQr(raw);
}

export function clearScannedQr(): void {
  sessionStorage.removeItem(SCANNED_QR_KEY);
}
