import { TransactionStatus } from '@/types';

export function transactionStatusLabel(status: TransactionStatus | string): string {
  switch (status) {
    case 'LOCAL_CREATED':
      return 'Saved Offline';
    case 'PENDING_SYNC':
      return 'Pending Sync';
    case 'SYNCING':
      return 'Syncing';
    case 'CONFIRMED':
      return 'Recorded on Ledger';
    case 'SYNCED':
      return 'Recorded on Ledger';
    case 'FAILED':
      return 'Failed';
    case 'REJECTED':
      return 'Transaction Rejected';
    case 'RETRY_PENDING':
      return 'Pending Sync';
    default:
      return 'Saved Offline';
  }
}

export function transactionStatusTone(status: TransactionStatus | string): string {
  switch (status) {
    case 'CONFIRMED':
    case 'SYNCED':
      return 'border border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold';
    case 'PENDING_SYNC':
    case 'LOCAL_CREATED':
    case 'RETRY_PENDING':
      return 'border border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold';
    case 'SYNCING':
      return 'border border-border bg-foreground text-background font-bold';
    case 'REJECTED':
    case 'FAILED':
      return 'border border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold';
    default:
      return 'border border-border bg-surface text-foreground font-bold';
  }
}


export function isBillExpired(expiresAt?: string | Date | null): boolean {
  if (!expiresAt) return false;
  const ts = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() > ts;
}
