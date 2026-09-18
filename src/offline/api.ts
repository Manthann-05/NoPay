import { getLocalSession } from './session';
import { offlineDb } from './db';
import { Product } from '@/types';

/**
 * Enhanced fetch wrapper for offline support.
 * Bypasses network entirely if navigator is offline.
 * Provides fallback data from IndexedDB for GET requests.
 */
export async function offlineFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { fallbackToLocal?: boolean; localDataType?: 'products' | 'transactions' }
): Promise<Response> {
  const isOnline = typeof window !== 'undefined' && navigator.onLine;

  // If offline and GET request, try local cache
  if (!isOnline && (!init || init.method === 'GET' || init.method === undefined)) {
    if (options?.fallbackToLocal && options.localDataType) {
      try {
        const session = await getLocalSession();
        
        if (options.localDataType === 'products') {
          // Return products from IndexedDB for this merchant
          let localProducts: Product[] = [];
          if (session?.merchantProfileId) {
            localProducts = await offlineDb.products
              .where('merchantId')
              .equals(session.merchantProfileId)
              .toArray();
          } else {
             localProducts = await offlineDb.products.toArray();
          }
          
          return new Response(JSON.stringify({ products: localProducts }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Offline-Source': 'IndexedDB' },
          });
        }
        
        // Add other data types as needed
      } catch (err) {
        console.error('Failed to read from local cache', err);
      }
    }
    
    // Default offline response if no local data
    return new Response(JSON.stringify({ error: 'Offline mode active' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-Offline-Source': 'None' },
    });
  }

  // If online, proceed with actual fetch
  try {
    const response = await fetch(input, init);
    
    // If we fetched products successfully, cache them
    if (response.ok && (!init || init.method === 'GET') && options?.localDataType === 'products') {
      const clone = response.clone();
      const data = await clone.json();
      if (data.products && Array.isArray(data.products)) {
        await offlineDb.transaction('rw', offlineDb.products, async () => {
          // We could clear old ones first if needed, or just upsert
          await offlineDb.products.bulkPut(data.products);
        });
      }
    }
    
    return response;
  } catch (error) {
    // Network failure during fetch
    console.warn('Network fetch failed, falling back to offline mode', error);
    
    if (options?.fallbackToLocal && options.localDataType === 'products') {
      const session = await getLocalSession();
      let localProducts: Product[] = [];
      if (session?.merchantProfileId) {
        localProducts = await offlineDb.products
          .where('merchantId')
          .equals(session.merchantProfileId)
          .toArray();
      }
      return new Response(JSON.stringify({ products: localProducts }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Offline-Source': 'IndexedDB-Fallback' },
      });
    }
    
    throw error;
  }
}
