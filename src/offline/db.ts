import Dexie, { Table } from 'dexie';
import { Transaction, OfflineSyncQueueItem, Product, Bill } from '@/types';

export class NoPayOfflineDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  syncQueue!: Table<OfflineSyncQueueItem, number>;
  products!: Table<Product, string>;
  bills!: Table<Bill, string>;

  constructor() {
    super('NoPayOfflineDB');

    // Schema definition for IndexedDB
    this.version(1).stores({
      transactions: 'transactionId, merchantId, customerId, status, idempotencyKey, createdAt',
      syncQueue: '++id, transactionId, idempotencyKey, state, createdAt',
      products: '_id, merchantId, name, barcode',
      bills: 'billId, merchantId, status',
    });
  }
}

export const offlineDb = new NoPayOfflineDatabase();
