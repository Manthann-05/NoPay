'use client';

import { Transaction } from '@/types';

export interface TxnEventDetail {
  transaction: Transaction;
  isOffline: boolean;
  action: 'CREATED' | 'UPDATED' | 'SYNCED' | 'FAILED';
}

const CHANNEL_NAME = 'nopay_live_transactions';
const CUSTOM_EVENT_NAME = 'nopay:transaction_event';

/**
 * Broadcasts a transaction event locally to:
 * 1. Same-window components via CustomEvent
 * 2. Cross-tab/windows on same browser via BroadcastChannel
 * 3. Cross-tab via localStorage trigger (fallback for older browser contexts)
 */
export function broadcastTransactionEvent(detail: TxnEventDetail): void {
  if (typeof window === 'undefined') return;

  // 1. Dispatch custom event for current window
  try {
    const event = new CustomEvent<TxnEventDetail>(CUSTOM_EVENT_NAME, { detail });
    window.dispatchEvent(event);
  } catch (err) {
    console.warn('CustomEvent dispatch warning:', err);
  }

  // 2. BroadcastChannel for other tabs/windows
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(detail);
      channel.close();
    }
  } catch (err) {
    console.warn('BroadcastChannel error:', err);
  }

  // 3. LocalStorage notification storage key for fallback listening
  try {
    localStorage.setItem(
      'nopay_latest_broadcast_txn',
      JSON.stringify({ ...detail, _ts: Date.now() })
    );
  } catch {
    // Ignore localStorage storage quota / private mode errors
  }
}

/**
 * Subscribes to real-time local transaction events (same window and cross-tab).
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToTransactionEvents(callback: (detail: TxnEventDetail) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Same-window listener
  const handleCustomEvent = (e: Event) => {
    const customEvt = e as CustomEvent<TxnEventDetail>;
    if (customEvt.detail) {
      callback(customEvt.detail);
    }
  };
  window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);

  // BroadcastChannel listener
  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<TxnEventDetail>) => {
        if (event.data) {
          callback(event.data);
        }
      };
    } catch (err) {
      console.warn('BroadcastChannel init error:', err);
    }
  }

  // LocalStorage storage listener fallback for other tabs
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'nopay_latest_broadcast_txn' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue) as TxnEventDetail;
        callback(parsed);
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (channel) {
      try {
        channel.close();
      } catch {
        // ignore
      }
    }
  };
}
