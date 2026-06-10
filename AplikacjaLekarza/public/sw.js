const CACHE = 'clinic-v2';
const API_ORIGINS = ['192.168.0.31:3001', '192.168.0.31:1234'];

const isApi = (url) => API_ORIGINS.some((o) => url.includes(o));
const isNav = (req) => req.mode === 'navigate';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(['/index.html', '/']).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // API — pass through, JS-level offline cache handles it
  if (isApi(request.url)) return;

  // Navigation (page loads) — return cached index.html (SPA shell)
  if (isNav(request)) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets — cache first
  e.respondWith(
    caches.match(request).then((cached) => {
      const net = fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
