// sw.js — FireOps Calc
// Goal: prevent "stuck old JS" on Android by NEVER cache-baking /js/
//
// Bump this every release:
const CACHE = 'fireops-v708';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/fireopscalc.png',
];

// INSTALL
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE_ASSETS)).catch(() => {})
  );
});

// ACTIVATE
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
    ]).catch(() => {})
  );
});

// FETCH
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ✅ NEVER cache JS — always network-first (prevents old UI)
  if (url.pathname.startsWith('/js/')) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // ✅ Network-first for HTML too (prevents old index shell)
  const isHtml = req.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html');
  if (isHtml) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for everything else (images, etc.)
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
    )
  );
});
