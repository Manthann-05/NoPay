import { offlineDb } from './db';
import { Transaction, OfflineSyncQueueItem, OfflineSyncQueueState } from '@/types';
import { broadcastTransactionEvent } from './liveChannel';

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

  // 3. Broadcast real-time event to merchant and customer listeners
  broadcastTransactionEvent({
    transaction: txn,
    isOffline: true,
    action: 'CREATED',
  });

  return queueItem;
}

export async function recordReceivedOfflineTransaction(txn: Transaction): Promise<boolean> {
  const receivedTxn: Transaction = {
    ...txn,
    status: 'PENDING_SYNC',
    offlineCreated: true,
    offlineReceived: true,
    updatedAt: new Date().toISOString(),
  };

  const inserted = await offlineDb.transaction('rw', offlineDb.transactions, async () => {
    const existingById = await offlineDb.transactions.get(receivedTxn.transactionId);
    if (existingById) {
      if (existingById.idempotencyKey !== receivedTxn.idempotencyKey) {
        throw new Error('A different transaction already uses this transaction ID.');
      }
      return false;
    }

    const existingByKey = await offlineDb.transactions
      .where('idempotencyKey')
      .equals(receivedTxn.idempotencyKey)
      .first();
    if (existingByKey) {
      throw new Error('This payment QR was already used for a different transaction.');
    }

    await offlineDb.transactions.add(receivedTxn);
    return true;
  });

  if (inserted) {
    broadcastTransactionEvent({
      transaction: receivedTxn,
      isOffline: true,
      action: 'CREATED',
    });
  }

  return inserted;
}

export async function getPendingSyncQueue(): Promise<OfflineSyncQueueItem[]> {
  const pending = await offlineDb.syncQueue.where('state').equals('PENDING_SYNC').toArray();
  const retrying = await offlineDb.syncQueue.where('state').equals('RETRY_PENDING').toArray();
  
  // Filter out retry items that shouldn't be retried yet based on backoff
  const now = new Date().getTime();
  const readyToRetry = retrying.filter(item => {
    if (!item.nextRetryAt) return true;
    return new Date(item.nextRetryAt).getTime() <= now;
  });
  
  return [...pending, ...readyToRetry];
}

export async function markSyncQueueState(
  transactionId: string,
  state: OfflineSyncQueueState,
  error?: string,
  nextRetryAt?: string
): Promise<void> {
  const item = await offlineDb.syncQueue.where('transactionId').equals(transactionId).first();
  if (item && item.id) {
    await offlineDb.syncQueue.update(item.id, {
      state,
      error,
      attempts: state === 'SYNCING' ? item.attempts + 1 : item.attempts,
      lastAttemptAt: state === 'SYNCING' ? new Date().toISOString() : item.lastAttemptAt,
      nextRetryAt,
    });
  }

  // Update local transaction status as well
  const txnStatusMap: Record<string, string> = {
    SYNCING: 'SYNCING',
    CONFIRMED: 'CONFIRMED',
    SYNCED: 'SYNCED',
    FAILED: 'FAILED',
    REJECTED: 'REJECTED',
    RETRY_PENDING: 'RETRY_PENDING',
  };

  if (txnStatusMap[state]) {
    await offlineDb.transactions.where('transactionId').equals(transactionId).modify({
      status: txnStatusMap[state] as any,
      failureReason: error,
      syncedAt: (state === 'CONFIRMED' || state === 'SYNCED') ? new Date().toISOString() : undefined,
    });

    const updatedTxn = await offlineDb.transactions.where('transactionId').equals(transactionId).first();
    if (updatedTxn) {
      broadcastTransactionEvent({
        transaction: updatedTxn,
        isOffline: false,
        action: state === 'CONFIRMED' || state === 'SYNCED' ? 'SYNCED' : state === 'FAILED' || state === 'REJECTED' ? 'FAILED' : 'UPDATED',
      });
    }
  }
}

export async function getAllLocalTransactions(): Promise<Transaction[]> {
  return offlineDb.transactions.orderBy('createdAt').reverse().toArray();
}

export const getOfflineTransactions = getAllLocalTransactions;
