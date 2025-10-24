/* global self, caches, fetch */ 
const CACHE_NAME = 'tcnm-shell-v2';
const RUNTIME_CACHE = 'tcnm-runtime-v1';
const APP_SHELL = [
  './',
  './index.html',
  './main.js',
  './styles.css',
  './manifest.json',
  './icons/icon-32.png',
  './icons/icon-64.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/boston_bigbelly.sample.geojson'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
        return caches.delete(key);
      }
      return Promise.resolve();
    }));
    self.clients.claim();
  })());
});

// Basic runtime caching: cache-first for same-origin, network-first for Overpass/data tiles
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Cache-first for same-origin assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((resp) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resp.clone());
            return resp;
          });
        });
      })
    );
    return;
  }

  // Network-first for API/tiles
  event.respondWith((async () => {
    try {
      if (event.request.method !== 'GET') {
        return fetch(event.request);
      }
      const fresh = await fetch(event.request, { cache: 'no-store' });
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(event.request, fresh.clone());
      return fresh;
    } catch (err) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw err;
    }
  })());
});
