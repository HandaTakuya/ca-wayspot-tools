const CACHE_NAME = 'wayspot-cache-v3.0.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './style.css?v=3.0.0',
  './app.js?v=3.0.0',
  './js/i18n-data.js?v=3.0.0',
  './js/storage-manager.js?v=3.0.0',
  './js/sync-provider.js?v=3.0.0',
  './js/map-manager.js?v=3.0.0',
  './js/ui-controller.js?v=3.0.0',
  './js/collab-manager.js?v=3.0.0'
];

// Install Event
self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache v3.0.0');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate Event - Cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all clients immediately
  );
});

// Fetch Event - Stale-while-revalidate strategy for better performance and updates
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          // Trigger a background update
          fetch(event.request).then(networkResponse => {
             if (networkResponse && networkResponse.status === 200) {
               caches.open(CACHE_NAME).then(cache => {
                 cache.put(event.request, networkResponse);
               });
             }
          }).catch(() => {});
          
          return response;
        }

        // Not in cache - fetch from network
        return fetch(event.request);
      })
  );
});
