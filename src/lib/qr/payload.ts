import { DecodedQrPayload, StaticMerchantQrPayload, BillQrPayload, BillItem } from '@/types';

export function parseQrPayload(raw: string): DecodedQrPayload | null {
  try {
    if (!raw || typeof raw !== 'string') return null;
    const cleanRaw = raw.trim();
    const data = JSON.parse(cleanRaw);

    if (!data || typeof data !== 'object') return null;

    if (data.type === 'MERCHANT') {
      if (!data.merchantId || !data.merchantName) return null;
      return {
        type: 'MERCHANT',
        version: data.version || 1,
        merchantId: String(data.merchantId),
        merchantName: String(data.merchantName),
      } as StaticMerchantQrPayload;
    }

    if (data.type === 'BILL') {
      if (!data.merchantId || !data.billId || typeof data.total !== 'number') return null;
      return {
        type: 'BILL',
        version: data.version || 1,
        transactionId: data.transactionId || `TXN-${Date.now().toString(36).toUpperCase()}`,
        billId: String(data.billId),
        merchantId: String(data.merchantId),
        merchantName: String(data.merchantName),
        items: Array.isArray(data.items) ? data.items : [],
        subtotal: Number(data.subtotal || data.total),
        discount: Number(data.discount || 0),
        tax: Number(data.tax || 0),
        total: Number(data.total),
        createdAt: data.createdAt || new Date().toISOString(),
        expiresAt: data.expiresAt,
      } as BillQrPayload;
    }

    return null;
  } catch (err) {
    return null;
  }
}

export function encodeStaticMerchantQrPayload(
  arg1: string | { merchantId: string; merchantName: string },
  arg2?: string
): string {
  const merchantId = typeof arg1 === 'object' ? arg1.merchantId : arg1;
  const merchantName = typeof arg1 === 'object' ? arg1.merchantName : arg2 || '';
  const payload: StaticMerchantQrPayload = {
    type: 'MERCHANT',
    version: 1,
    merchantId,
    merchantName,
  };
  return JSON.stringify(payload);
}

export function encodeBillQrPayload(
  bill: Partial<BillQrPayload> & {
    transactionId: string;
    billId: string;
    merchantId: string;
    merchantName: string;
    items: BillItem[];
    total: number;
  }
): string {
  const fullPayload: BillQrPayload = {
    type: 'BILL',
    version: 1,
    createdAt: new Date().toISOString(),
    subtotal: bill.total,
    discount: 0,
    tax: 0,
    ...bill,
  };
  return JSON.stringify(fullPayload);
}
