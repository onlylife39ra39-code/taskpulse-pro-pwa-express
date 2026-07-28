const CACHE_NAME = 'taskpulse-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// SW Install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// SW Activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Intercept (Network First for API, Cache First for Static Resources)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .catch(() => {
          return new Response(JSON.stringify({ error: 'Network unavailable' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (!res || res.status !== 200 || res.type !== 'basic') {
            return res;
          }
          const resToCache = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resToCache));
          return res;
        });
      })
    );
  }
});