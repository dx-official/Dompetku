/* ===== DompetKu – Service Worker ===== */
const CACHE = 'dompetku-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
];

// Instalasi: cache aset utama
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Aktivasi: hapus cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first untuk CDN, cache-first untuk aset lokal
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // CDN (Chart.js, Tailwind, Fonts) → network-first
  if (url.hostname !== self.location.hostname) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Aset lokal → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
