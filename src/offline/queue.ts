import { offlineDb } from './db';
import { Transaction, OfflineSyncQueueItem } from '@/types';

export async function addOfflineTransaction(txn: Transaction): Promise<OfflineSyncQueueItem> {
  // 1. Save to local IndexedDB transactions table
  await offlineDb.transactions.put(txn);

  // 2. Add item to syncQueue
  const queueItem: OfflineSyncQueueItem = {
    transactionId: txn.transactionId,
    idempotencyKey: txn.idempotencyKey,
    payload: txn,
    attempts: 0,
    state: 'PENDING_SYNC',
    createdAt: new Date().toISOString(),
  };

  const id = await offlineDb.syncQueue.add(queueItem);
  queueItem.id = id;

  console.log(`📥 Transaction ${txn.transactionId} queued offline in IndexedDB.`);
  return queueItem;
}

export async function getPendingSyncQueue(): Promise<OfflineSyncQueueItem[]> {
  return offlineDb.syncQueue
    .where('state')
    .equals('PENDING_SYNC')
    .toArray();
}

export async function markSyncQueueState(
  transactionId: string,
  state: 'SYNCING' | 'CONFIRMED' | 'FAILED',
  error?: string
): Promise<void> {
  const item = await offlineDb.syncQueue.where('transactionId').equals(transactionId).first();
  if (item && item.id) {
    await offlineDb.syncQueue.update(item.id, {
      state,
      error,
      attempts: item.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
    });
  }

  // Update local transaction status as well
  const txnStatusMap = {
    SYNCING: 'SYNCING',
    CONFIRMED: 'CONFIRMED',
    FAILED: 'FAILED',
  } as const;

  if (txnStatusMap[state]) {
    await offlineDb.transactions.where('transactionId').equals(transactionId).modify({
      status: txnStatusMap[state],
      failureReason: error,
      syncedAt: state === 'CONFIRMED' ? new Date().toISOString() : undefined,
    });
  }
}

export async function getAllLocalTransactions(): Promise<Transaction[]> {
  return offlineDb.transactions.orderBy('createdAt').reverse().toArray();
}

export const getOfflineTransactions = getAllLocalTransactions;

