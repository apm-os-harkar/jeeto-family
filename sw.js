/* Jeeto Family — service worker
   Purpose: make the app installable + a basic offline screen.
   Safe by design: only handles same-origin GET requests.
   Supabase / Anthropic / fonts (cross-origin) and all POSTs pass straight
   through to the network and are NEVER cached or intercepted. */

const CACHE = 'jeeto-v1';
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
  if (req.method !== 'GET') return;                 // never touch POST/PUT (Supabase writes)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // never touch Supabase/Anthropic/fonts

  // Page loads: network-first so new builds always show; fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        caches.open(CACHE).then(function (c) { c.put('./index.html', r.clone()); });
        return r;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // Same-origin static files (icons, manifest): cache-first for speed/offline.
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
