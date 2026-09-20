const CACHE_NAME = 'nopay-cache-v4';
const DYNAMIC_CACHE = 'nopay-dynamic-v4';

/**
 * SECURITY: Only the PUBLIC app shell is precached at install time.
 * Authenticated pages (customer/merchant) are runtime-cached only after
 * an authorized user has actually visited them (see navigation handler).
 */
const APP_SHELL = [
  '/',
  '/login',
  '/register',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Precaching app shell');
      // We use map and catch to ensure failure of one doesn't crash the whole precache
      return Promise.all(
        APP_SHELL.map(url => 
          cache.add(url).catch(err => console.warn(`SW: Failed to cache ${url}`, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('SW: Clearing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_ROUTES' || !Array.isArray(event.data.routes)) {
    return;
  }

  event.waitUntil(
    caches.open(DYNAMIC_CACHE).then(async (cache) => {
      await Promise.all(
        event.data.routes.map(async (route) => {
          try {
            const request = new Request(new URL(route, self.location.origin).toString(), {
              credentials: 'include',
            });
            const response = await fetch(request);
            if (response.ok) {
              await cache.put(request, response);
            }
          } catch {
            // Route caching is best effort; online navigation remains available.
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API requests, let them fail naturally or be caught by api.ts wrapper
  if (url.pathname.startsWith('/api/')) {
    return; // Standard network request
  }

  // Next.js Data requests (Network First, fallback to cache)
  if (url.pathname.startsWith('/_next/data/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } });
        })
    );
    return;
  }

  // Next.js Static Assets (Stale-While-Revalidate)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|woff2?|css|js)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);

        // Trigger network fetch in background to update cache
        const networkFetch = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {});

        // Return cached response if available, otherwise wait for network
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // Navigation Requests (App Shell Navigation - Stale-While-Revalidate / Cache First with fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // In background, revalidate if online
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
              }
            })
            .catch(() => {}); // Ignore network errors in background
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(async () => {
            const fallbackResponse = await caches.match(url.pathname) || await caches.match('/');
            if (fallbackResponse) return fallbackResponse;

            return new Response('<!DOCTYPE html><html><body><h2>Offline Mode</h2><p>Please connect to the internet once to cache the full app shell.</p></body></html>', {
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            });
          });
      })
    );
    return;
  }
});
