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
  | 'SYNCED'
  | 'FAILED'
  | 'REJECTED'
  | 'RETRY_PENDING';

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
  items?: BillItem[];
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  paymentStatus?: 'UNVERIFIED' | 'PENDING' | 'AUTOPAY_SCHEDULED' | 'PAID' | 'FAILED';
  payoutStatus?: 'PENDING' | 'TRANSFER_PENDING' | 'TRANSFERRED' | 'TRANSFER_FAILED';
  deferredPaymentConsent?: boolean;
  deferredPaymentConsentAt?: string;
  autopayStatus?:
    | 'SCHEDULING'
    | 'SCHEDULED'
    | 'CAPTURED'
    | 'FAILED'
    | 'TRANSFER_PENDING'
    | 'TRANSFERRED'
    | 'TRANSFER_FAILED';
  autopayPaymentAfter?: string;
  idempotencyKey: string;
  paymentReference?: string;
  razorpayOrderId?: string;
  razorpayTransferId?: string;
  failureReason?: string;
  offlineCreated?: boolean;
  offlineReceived?: boolean;
  createdAt: string;
  updatedAt?: string;
  syncedAt?: string;
}

export type OfflineSyncQueueState =
  | 'PENDING_SYNC'
  | 'SYNCING'
  | 'CONFIRMED'
  | 'SYNCED'
  | 'FAILED'
  | 'REJECTED'
  | 'RETRY_PENDING';

export interface OfflineSyncQueueItem {
  id?: number; // Dexie auto-increment ID
  transactionId: string;
  idempotencyKey: string;
  payload: Transaction;
  attempts: number;
  maxAttempts?: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  state: OfflineSyncQueueState;
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
  subtotal?: number;
  discount?: number;
  tax?: number;
  total: number;
  createdAt: string;
  expiresAt?: string;
}

export type DecodedQrPayload = StaticMerchantQrPayload | BillQrPayload;

/**
 * Local session stored in IndexedDB for offline access.
 * SECURITY: No passwords, JWT secrets, or tokens stored here.
 * Only the minimum profile information needed to render the app shell offline.
 */
export interface LocalSession {
  id: string; // always 'current' — singleton pattern
  userId: string;
  name: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
  merchantProfileId?: string;
  merchantName?: string;
  lastSyncedAt: string;
  createdAt: string;
}
