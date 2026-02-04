// sw.js — FIXED for Capacitor / Android WebView

const CACHE = 'fireops-v707'; // ⬅️ CHANGE THIS EVERY RELEASE

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/js/app.js',
  '/js/store.js',
  '/fireopscalc.png',
];

// INSTALL
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE_ASSETS))
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
    ])
  );
});

// FETCH
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 🔥 NEVER cache JS — always network-first
  if (url.pathname.startsWith('/js/')) {
    e.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
    )
  );
});
