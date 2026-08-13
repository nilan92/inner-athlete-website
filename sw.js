// Service Worker for PWA caching
const CACHE_NAME = 'innerathlete-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.min.css',
  '/js/bundle.min.js',
  '/site.webmanifest',
  '/img/innerathlete-modest-activewear-hero-mobile.webp',
  '/img/innerathlete-modest-activewear-hero-desktop.webp',
  // Add more critical assets
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  // Network-first for HTML: prices and copy live in index.html, so a stale
  // cached page shows customers the wrong price. Cache is fallback only.
  const isHTML = request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for static assets: they carry ?v=<hash>, so a changed file is
  // a new URL and can never be served stale.
  event.respondWith(
    caches.match(request)
      .then(response => response || fetch(request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});