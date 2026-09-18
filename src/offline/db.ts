import Dexie, { Table } from 'dexie';
import { Transaction, OfflineSyncQueueItem, Product, Bill, LocalSession, MerchantProfile } from '@/types';

export class NoPayOfflineDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  syncQueue!: Table<OfflineSyncQueueItem, number>;
  products!: Table<Product, string>;
  bills!: Table<Bill, string>;
  localSession!: Table<LocalSession, string>;
  merchantProfiles!: Table<MerchantProfile, string>;

  constructor() {
    super('NoPayOfflineDB');

    // Schema definition for IndexedDB
    // v1: Original schema
    // v2: Added localSession and merchantProfiles for true offline operation
    this.version(1).stores({
      transactions: 'transactionId, merchantId, customerId, status, idempotencyKey, createdAt',
      syncQueue: '++id, transactionId, idempotencyKey, state, createdAt',
      products: '_id, merchantId, name, barcode',
      bills: 'billId, merchantId, status',
    });

    this.version(2).stores({
      transactions: 'transactionId, merchantId, customerId, status, idempotencyKey, createdAt',
      syncQueue: '++id, transactionId, idempotencyKey, state, createdAt',
      products: '_id, merchantId, name, barcode',
      bills: 'billId, merchantId, status',
      localSession: 'id', // 'id' will always be 'current'
      merchantProfiles: '_id, userId',
    }).upgrade(tx => {
      // Any upgrade logic if needed from v1 to v2
    });
  }
}

export const offlineDb = new NoPayOfflineDatabase();
