const CACHE_NAME = 'wayspot-cache-v2.0.2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './style.css?v=2.0.2',
  './app.js?v=2.0.2'
];

// Install Event
self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
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
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cacheName);
          }
        })
      );
    })
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
