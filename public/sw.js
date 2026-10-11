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

function cacheSafeResponse(response) {
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('transfer-encoding');
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function cacheRouteAssets(response) {
  const html = await response.clone().text();
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    try {
      const assetUrl = new URL(match[1], self.location.origin);
      if (
        assetUrl.origin === self.location.origin &&
        assetUrl.pathname.startsWith('/_next/static/')
      ) {
        assets.add(assetUrl.href);
      }
    } catch {
      // Ignore malformed references in the fetched HTML.
    }
  }

  const cache = await caches.open(CACHE_NAME);
  const cachedAssets = new Set();
  let pendingAssets = Array.from(assets);
  while (pendingAssets.length > 0) {
    const batch = Array.from(new Set(pendingAssets)).filter((assetUrl) => !cachedAssets.has(assetUrl));
    pendingAssets = [];
    await Promise.all(batch.map(async (assetUrl) => {
      cachedAssets.add(assetUrl);
      try {
        const assetResponse = await fetch(assetUrl, { cache: 'no-store' });
        if (!assetResponse.ok) {
          return;
        }

        await cache.put(assetUrl, cacheSafeResponse(assetResponse));
        if (new URL(assetUrl).pathname.endsWith('.js')) {
          const javascript = await assetResponse.clone().text();
          for (const match of javascript.matchAll(/["']((?:static|_next\/static)\/chunks\/[^"']+\.(?:js|css))["']/g)) {
            const chunkPath = match[1].startsWith('_next/')
              ? `/${match[1]}`
              : `/_next/${match[1]}`;
            const chunkUrl = new URL(chunkPath, self.location.origin);
            if (chunkUrl.origin === self.location.origin) {
              pendingAssets.push(chunkUrl.href);
            }
          }
        }
      } catch (err) {
        console.warn(`SW: Failed to cache route asset ${assetUrl}`, err);
      }
    }));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Precaching app shell');
      return Promise.all(APP_SHELL.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, cacheSafeResponse(response));
          }
        } catch (err) {
          console.warn(`SW: Failed to cache ${url}`, err);
        }
      }));
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
            const expectedUrl = new URL(route, self.location.origin);
            const responseUrl = new URL(response.url);
            if (
              response.ok &&
              !response.redirected &&
              responseUrl.origin === expectedUrl.origin &&
              responseUrl.pathname === expectedUrl.pathname
            ) {
              await cache.put(request, cacheSafeResponse(response));
              await cacheRouteAssets(response);
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
        if (networkResponse.redirected) {
          return Response.redirect(networkResponse.url, 302);
        }
        const clone = networkResponse.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, cacheSafeResponse(clone)));
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
        const cachedResponse = await cache.match(event.request, { ignoreVary: true });

        // Trigger network fetch in background to update cache
        const networkFetch = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(event.request, cacheSafeResponse(networkResponse));
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
      caches.match(event.request, { ignoreSearch: true, ignoreVary: true }).then((cachedResponse) => {
        if (cachedResponse) {
          // In background, revalidate if online
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheSafeResponse(clone)));
              }
            })
            .catch(() => {}); // Ignore network errors in background
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.redirected) {
              return Response.redirect(networkResponse.url, 302);
            }
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(async () => {
            const fallbackResponse =
              (await caches.match(url.pathname, { ignoreSearch: true, ignoreVary: true })) ||
              (await caches.match('/', { ignoreSearch: true, ignoreVary: true }));
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
