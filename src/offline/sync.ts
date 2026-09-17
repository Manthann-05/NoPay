import { getPendingSyncQueue, markSyncQueueState } from './queue';

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  isSyncing: boolean;
  message?: string;
}

type SyncCallback = (progress: SyncProgress) => void;

let isSyncInProgress = false;

export async function processSyncQueue(onProgress?: SyncCallback): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  if (isSyncInProgress) {
    return { syncedCount: 0, failedCount: 0 };
  }

  isSyncInProgress = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const queue = await getPendingSyncQueue();

    if (queue.length === 0) {
      if (onProgress) {
        onProgress({ total: 0, completed: 0, failed: 0, isSyncing: false, message: 'All transactions synchronized' });
      }
      return { syncedCount: 0, failedCount: 0 };
    }

    if (onProgress) {
      onProgress({
        total: queue.length,
        completed: 0,
        failed: 0,
        isSyncing: true,
        message: `Syncing ${queue.length} transaction(s)...`,
      });
    }

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      await markSyncQueueState(item.transactionId, 'SYNCING');

      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item.payload),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          await markSyncQueueState(item.transactionId, 'CONFIRMED');
          syncedCount++;
        } else {
          const errorMsg = data.error || data.message || 'Sync rejected by server';
          await markSyncQueueState(item.transactionId, 'FAILED', errorMsg);
          failedCount++;
        }
      } catch (err: any) {
        await markSyncQueueState(item.transactionId, 'FAILED', err.message || 'Network connection failed during sync');
        failedCount++;
      }

      if (onProgress) {
        onProgress({
          total: queue.length,
          completed: syncedCount,
          failed: failedCount,
          isSyncing: true,
          message: `Syncing ${i + 1}/${queue.length}...`,
        });
      }
    }

    if (onProgress) {
      onProgress({
        total: queue.length,
        completed: syncedCount,
        failed: failedCount,
        isSyncing: false,
        message: syncedCount > 0 ? `✓ ${syncedCount} transaction(s) synchronized` : 'Sync finished',
      });
    }

    return { syncedCount, failedCount };
  } finally {
    isSyncInProgress = false;
  }
}
