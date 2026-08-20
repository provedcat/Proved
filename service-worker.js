const CACHE_NAME = 'proved-pwa-20260820-feed-reading-v1';
const CORE_ASSETS = [
  './',
  './manifest.json',
  './service-worker.js',
  './css/styles.css',
  './css/proved-shell.css',
  './css/proved-header.css',
  './css/proved-colors.css',
  './css/feed-reading.css',
  './css/food-list.css',
  './css/food-compare.css',
  './css/food-detail-refinements.css',
  './css/food-mobile-nutrition-v2.css',
  './js/proved-header.js',
  './js/proved-shell.js',
  './js/pwa-install.js',
  './js/calculator.js',
  './js/feed-search.js',
  './js/food-list.js',
  './js/food-compare.js',
  './js/food-detail-refinements.js',
  './js/food-mobile-nutrition-v2.js',
  './js/calculator-session.js',
  './js/feed-registration.js',
  './js/recent-feed.js',
  './js/saved-cats.js',
  './js/auth.js',
  './js/share-card.js',
  './js/weight-trend.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './cat-food-calculator/',
  './dog-food-calculator/',
  './feed-registration/',
  './food/',
  './food/compare/',
  './guide/calculation-method/',
  './guide/feed-reading/',
  './guide/feed-reading/sources/',
  './guide/feed-reading/nutrition-label/',
  './guide/feed-reading/comparison/',
  './guide/feed-reading/standards/',
  // Legacy archive URL remains precached only as a compatibility redirect.
  './archive/'
];

const IMAGE_DESTINATIONS = new Set(['image']);
const NETWORK_FIRST_DESTINATIONS = new Set(['document', 'script', 'style']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        CORE_ASSETS.map((asset) => cache.add(asset).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function shouldCacheResponse(response) {
  return response && response.status === 200 && response.type === 'basic';
}

async function cacheResponse(request, response) {
  if (!shouldCacheResponse(response)) return;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function matchCached(request) {
  const exactMatch = await caches.match(request);
  if (exactMatch) return exactMatch;
  return caches.match(request, { ignoreSearch: true });
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    await cacheResponse(request, networkResponse);
    return networkResponse;
  } catch (error) {
    const cachedResponse = await matchCached(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

async function cacheFirst(request) {
  const cachedResponse = await matchCached(request);
  if (cachedResponse) return cachedResponse;

  const networkResponse = await fetch(request);
  await cacheResponse(request, networkResponse);
  return networkResponse;
}

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === 'navigate' || NETWORK_FIRST_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (IMAGE_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
