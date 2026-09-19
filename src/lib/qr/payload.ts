/**
 * NoPay QR Payload Library
 *
 * Internal QR format — users NEVER see this structure.
 *
 * Static Merchant QR:  NOPAY://v1/merchant/<merchantId>
 * Bill QR:             NOPAY://v1/bill/<billId>?d=<base64url-compact-json>
 *
 * The 'd' parameter in Bill QR is a base64url-encoded JSON containing the
 * minimum bill data needed for offline display. This avoids exposing the
 * raw format to users while supporting fully offline bill scanning.
 *
 * SECURITY: QR codes must NEVER contain:
 * - passwords / JWT secrets / API keys / private keys
 * - Razorpay secrets / bank credentials
 * - UPI PINs / CVVs
 */

import { DecodedQrPayload, StaticMerchantQrPayload, BillQrPayload, BillItem } from '@/types';

const NOPAY_SCHEME = 'NOPAY://';
const NOPAY_VERSION = 'v1';

// ─── Compact Bill data structure encoded in QR (internal) ───────────────────
interface CompactBillData {
  txn: string;       // transactionId
  m: string;         // merchantId
  mn: string;        // merchantName (display only — server validates)
  items: Array<[string, number, number]>; // [name, qty, price]
  sub: number;       // subtotal
  disc?: number;     // discount
  tax?: number;      // tax amount
  tot: number;       // total
  exp?: string;      // expiresAt ISO string
  at: string;        // createdAt ISO string
}

// ─── Public result types ─────────────────────────────────────────────────────

export type NoPayQrType = 'MERCHANT' | 'BILL';

export interface NoPayMerchantQrResult {
  type: 'MERCHANT';
  merchantId: string;
}

export interface NoPayBillQrResult {
  type: 'BILL';
  billId: string;
  transactionId: string;
  merchantId: string;
  merchantName: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: string;
  expiresAt?: string;
}

export type NoPayQrResult = NoPayMerchantQrResult | NoPayBillQrResult;

export interface ExternalQrResult {
  type: 'EXTERNAL';
  raw: string;
  scheme: string;
  merchantName: string;
  presetAmount?: number;
}

export type ScannedQrResult = NoPayQrResult | ExternalQrResult;

/** Accept standard UPI/bank QR payloads as a UI-only payment destination. */
export function parseScannedQr(raw: string): ScannedQrResult | null {
  const noPayResult = parseNoPayQr(raw);
  if (noPayResult) return noPayResult;

  const value = raw.trim();
  if (!value) return null;

  let scheme = 'QR';
  let merchantName = 'External payment QR';
  let presetAmount: number | undefined;
  try {
    const url = new URL(value);
    scheme = url.protocol.replace(':', '').toUpperCase() || scheme;
    const name = url.searchParams.get('pn') || url.searchParams.get('name');
    const amount = Number(url.searchParams.get('am'));
    if (name) merchantName = name;
    if (Number.isFinite(amount) && amount > 0) presetAmount = amount;
  } catch {
    // Bank QR payloads are not always URL-shaped; preserve the raw value.
  }

  return { type: 'EXTERNAL', raw: value, scheme, merchantName, presetAmount };
}

// ─── Base64url helpers ───────────────────────────────────────────────────────

function toBase64Url(str: string): string {
  if (typeof window !== 'undefined' && typeof btoa !== 'undefined') {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  // Node.js (server-side)
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  if (typeof window !== 'undefined' && typeof atob !== 'undefined') {
    return decodeURIComponent(escape(atob(padded + padding)));
  }
  return Buffer.from(padded + padding, 'base64').toString('utf-8');
}

// ─── PARSER ─────────────────────────────────────────────────────────────────

/**
 * Parse a raw QR string.
 * Returns a typed NoPayQrResult if valid, null if not a NoPay QR.
 * Never throws.
 */
export function parseNoPayQr(raw: string): NoPayQrResult | null {
  try {
    if (!raw || typeof raw !== 'string') return null;

    const trimmed = raw.trim();

    // Must start with NOPAY:// (case-insensitive)
    if (!trimmed.toUpperCase().startsWith(NOPAY_SCHEME)) return null;

    // Strip scheme and parse as URL.
    // NOTE: We must prefix a dummy HOST, not just 'http://' — otherwise the
    // first path segment (the version, e.g. 'v1') is consumed as the hostname
    // and disappears from pathname, which would make every valid QR unparseable.
    const asUrl = 'http://qr.nopay.internal/' + trimmed.slice(NOPAY_SCHEME.length);

    let parsed: URL;
    try {
      parsed = new URL(asUrl);
    } catch {
      return null;
    }

    // pathname will be like /v1/merchant/SHOP123 or /v1/bill/BILL-001
    const parts = parsed.pathname.replace(/^\//, '').split('/');
    // parts[0] = version, parts[1] = type, parts[2] = id
    if (parts.length < 3) return null;

    const version = parts[0].toLowerCase(); // case-insensitive version tag
    const qrType = parts[1].toUpperCase();
    const id = parts.slice(2).join('/'); // in case id contains '/'

    // Only support v1 for now
    if (version !== NOPAY_VERSION) return null;

    if (qrType === 'MERCHANT') {
      if (!id || id.trim() === '') return null;
      return {
        type: 'MERCHANT',
        merchantId: decodeURIComponent(id.trim()),
      } satisfies NoPayMerchantQrResult;
    }

    if (qrType === 'BILL') {
      if (!id || id.trim() === '') return null;

      const dParam = parsed.searchParams.get('d');
      if (!dParam) return null;

      // Decode compact bill data
      let compact: CompactBillData;
      try {
        const decoded = fromBase64Url(dParam);
        compact = JSON.parse(decoded);
      } catch {
        return null;
      }

      if (
        typeof compact.txn !== 'string' ||
        compact.txn.trim() === '' ||
        typeof compact.m !== 'string' ||
        compact.m.trim() === '' ||
        typeof compact.mn !== 'string' ||
        !Array.isArray(compact.items) ||
        typeof compact.tot !== 'number' ||
        !Number.isFinite(compact.tot) ||
        compact.tot <= 0
      ) {
        return null;
      }

      const items: BillItem[] = compact.items
        .filter((row) => Array.isArray(row) && row.length >= 3)
        .map(([name, quantity, price]) => ({
          name: String(name),
          quantity: Number(quantity),
          price: Number(price),
        }))
        .filter((item) => item.name && item.quantity > 0 && Number.isFinite(item.price) && item.price >= 0);

      if (items.length === 0) return null;

      return {
        type: 'BILL',
        billId: decodeURIComponent(id.trim()),
        transactionId: compact.txn.trim(),
        merchantId: compact.m.trim(),
        merchantName: compact.mn,
        items,
        subtotal: Number(compact.sub ?? compact.tot),
        discount: Number(compact.disc ?? 0),
        tax: Number(compact.tax ?? 0),
        total: Number(compact.tot),
        createdAt: compact.at || new Date().toISOString(),
        expiresAt: compact.exp,
      } satisfies NoPayBillQrResult;
    }

    return null;
  } catch {
    return null;
  }
}

// ─── ENCODERS ────────────────────────────────────────────────────────────────

/**
 * Generate a Static Merchant QR string.
 * Format: NOPAY://v1/merchant/<merchantId>
 */
export function encodeStaticMerchantQr(merchantId: string): string {
  if (!merchantId) throw new Error('merchantId is required');
  return `${NOPAY_SCHEME}${NOPAY_VERSION}/merchant/${encodeURIComponent(merchantId)}`;
}

/**
 * Generate a Bill QR string.
 * Format: NOPAY://v1/bill/<billId>?d=<base64url-compact>
 */
export function encodeBillQr(params: {
  billId: string;
  transactionId: string;
  merchantId: string;
  merchantName: string;
  items: BillItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  expiresAt?: string;
}): string {
  const compact: CompactBillData = {
    txn: params.transactionId,
    m: params.merchantId,
    mn: params.merchantName,
    items: params.items.map((i) => [i.name, i.quantity, i.price]),
    sub: params.subtotal,
    disc: params.discount ?? 0,
    tax: params.tax ?? 0,
    tot: params.total,
    at: new Date().toISOString(),
    exp: params.expiresAt,
  };

  const encoded = toBase64Url(JSON.stringify(compact));
  return `${NOPAY_SCHEME}${NOPAY_VERSION}/bill/${encodeURIComponent(params.billId)}?d=${encoded}`;
}

// ─── LEGACY COMPATIBILITY (deprecated — for internal migration use only) ─────

/**
 * Maps a recognized NoPay QR into the internal typed payload used by screens.
 * Arbitrary JSON is never accepted.
 */
export function parseQrPayload(raw: string): DecodedQrPayload | null {
  const noPayResult = parseNoPayQr(raw);
  if (!noPayResult) return null;

  if (noPayResult.type === 'MERCHANT') {
    return {
      type: 'MERCHANT',
      version: 1,
      merchantId: noPayResult.merchantId,
      merchantName: '',
    } as StaticMerchantQrPayload;
  }

  return {
    type: 'BILL',
    version: 1,
    transactionId: noPayResult.transactionId,
    billId: noPayResult.billId,
    merchantId: noPayResult.merchantId,
    merchantName: noPayResult.merchantName,
    items: noPayResult.items,
    subtotal: noPayResult.subtotal,
    discount: noPayResult.discount,
    tax: noPayResult.tax,
    total: noPayResult.total,
    createdAt: noPayResult.createdAt,
    expiresAt: noPayResult.expiresAt,
  } as BillQrPayload;
}

/**
 * @deprecated Use encodeStaticMerchantQr() instead.
 */
export function encodeStaticMerchantQrPayload(
  arg1: string | { merchantId: string; merchantName: string },
  arg2?: string
): string {
  const merchantId = typeof arg1 === 'object' ? arg1.merchantId : arg1;
  return encodeStaticMerchantQr(merchantId);
}

/**
 * @deprecated Use encodeBillQr() instead.
 */
export function encodeBillQrPayload(
  bill: {
    transactionId: string;
    billId: string;
    merchantId: string;
    merchantName: string;
    items: BillItem[];
    total: number;
    subtotal?: number;
    discount?: number;
    tax?: number;
    expiresAt?: string;
  }
): string {
  return encodeBillQr({
    billId: bill.billId,
    transactionId: bill.transactionId,
    merchantId: bill.merchantId,
    merchantName: bill.merchantName,
    items: bill.items,
    subtotal: bill.subtotal ?? bill.total,
    discount: bill.discount ?? 0,
    tax: bill.tax ?? 0,
    total: bill.total,
    expiresAt: bill.expiresAt,
  });
}
