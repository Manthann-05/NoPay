import { offlineDb } from './db';
import { LocalSession, UserRole } from '@/types';

/**
 * Save session to IndexedDB for offline access
 */
export async function saveLocalSession(
  userId: string,
  name: string,
  email: string,
  roles: UserRole[],
  activeRole: UserRole,
  merchantProfileId?: string,
  merchantName?: string
): Promise<void> {
  const session: LocalSession = {
    id: 'current',
    userId,
    name,
    email,
    roles,
    activeRole,
    merchantProfileId,
    merchantName,
    lastSyncedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await offlineDb.localSession.put(session);
}

/**
 * Get current session from IndexedDB when offline
 */
export async function getLocalSession(): Promise<LocalSession | undefined> {
  try {
    return await offlineDb.localSession.get('current');
  } catch (err) {
    console.error('Failed to get local session', err);
    return undefined;
  }
}

/**
 * Clear session on logout
 */
export async function clearLocalSession(): Promise<void> {
  try {
    await offlineDb.localSession.delete('current');
    await offlineDb.merchantProfiles.clear(); // Clear cached merchant profiles too
  } catch (err) {
    console.error('Failed to clear local session', err);
  }
}

/**
 * Update just the active role in the local session
 */
export async function updateLocalActiveRole(role: UserRole): Promise<void> {
  try {
    const session = await getLocalSession();
    if (session) {
      await offlineDb.localSession.update('current', { activeRole: role });
    }
  } catch (err) {
    console.error('Failed to update local active role', err);
  }
}
