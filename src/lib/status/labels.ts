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
      return 'bg-emerald-100 text-emerald-800';
    case 'PENDING_SYNC':
    case 'LOCAL_CREATED':
    case 'RETRY_PENDING':
      return 'bg-amber-100 text-amber-900';
    case 'SYNCING':
      return 'bg-blue-100 text-blue-800';
    case 'REJECTED':
    case 'FAILED':
      return 'bg-rose-100 text-rose-900';
    default:
      return 'bg-slate-200 text-slate-700';
  }
}

export function isBillExpired(expiresAt?: string | Date | null): boolean {
  if (!expiresAt) return false;
  const ts = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() > ts;
}
