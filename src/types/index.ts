export type UserRole = 'CUSTOMER' | 'MERCHANT';

export interface User {
  _id: string;
  name: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
  merchantProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantProfile {
  _id: string;
  userId: string;
  shopName: string;
  address: string;
  area: string;
  staticQrPayload: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  _id: string;
  merchantId: string;
  name: string;
  barcode?: string;
  price: number;
  stock: number;
  category?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BillItem {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Bill {
  _id: string;
  billId: string;
  merchantId: string;
  merchantName: string;
  customerId?: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'CREATED' | 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  expiresAt?: string;
}

export type TransactionStatus =
  | 'LOCAL_CREATED'
  | 'PENDING_SYNC'
  | 'SYNCING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REJECTED';

export type TransactionType = 'STATIC_QR' | 'BILL_QR';

export interface Transaction {
  _id?: string;
  transactionId: string;
  merchantId: string;
  merchantName: string;
  customerId?: string;
  customerName?: string;
  billId?: string;
  billSummary?: {
    itemsCount: number;
    total: number;
  };
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  idempotencyKey: string;
  paymentReference?: string;
  failureReason?: string;
  offlineCreated: boolean;
  createdAt: string;
  syncedAt?: string;
}

export interface OfflineSyncQueueItem {
  id?: number; // Dexie auto-increment ID
  transactionId: string;
  idempotencyKey: string;
  payload: Transaction;
  attempts: number;
  lastAttemptAt?: string;
  state: 'PENDING_SYNC' | 'SYNCING' | 'FAILED' | 'CONFIRMED';
  error?: string;
  createdAt: string;
}

// QR Payload Types
export type QrPayloadType = 'MERCHANT' | 'BILL';

export interface StaticMerchantQrPayload {
  type: 'MERCHANT';
  version: number;
  merchantId: string;
  merchantName: string;
}

export interface BillQrPayload {
  type: 'BILL';
  version: number;
  transactionId: string;
  billId: string;
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

export type DecodedQrPayload = StaticMerchantQrPayload | BillQrPayload;
