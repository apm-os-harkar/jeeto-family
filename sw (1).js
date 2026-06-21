/* Jeeto Family — service worker (v2: always-fresh)
   - Page loads bypass the HTTP cache and hit the network first, so a new
     build always shows. Falls back to cache only when offline.
   - Static icons/manifest stay cache-first for speed.
   - Supabase / Anthropic / fonts (cross-origin) and all writes pass straight
     through and are NEVER cached. */

const CACHE = 'jeeto-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: network-FIRST and bypass the HTTP cache (cache:'reload'),
  // so the newest index.html always wins. Cache only as offline fallback.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'reload' }).then(function (r) {
        const copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return r;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // Static same-origin files: cache-first for speed/offline.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        const copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      }).catch(function () { return hit; });
    })
  );
});
