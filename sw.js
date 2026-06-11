// Service worker — maakt Duizenden installeerbaar en offline speelbaar.
// Strategie: network-first voor navigatie (zo komen updates direct door),
// cache-first voor al het overige. De app-shell wordt bij install gecached;
// CDN-modules (three/cannon-es via unpkg) en fonts worden bij het eerste
// gebruik in de runtime-cache gezet (opaque responses zijn prima).
const CACHE = 'duizenden-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './sounds/win-jackpot.ogg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const isNav = e.request.mode === 'navigate'
    || new URL(e.request.url).pathname.endsWith('/index.html');
  if (isNav) {
    // Network-first: nieuwe versies komen direct door; offline valt
    // terug op de gecachte shell.
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then((hit) => hit || caches.match('./index.html'))
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
