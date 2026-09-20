'use client';

export const AUTH_STATE_CHANGED_EVENT = 'nopay:auth-state-changed';

export function notifyAuthStateChanged(): void {
  window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
}
