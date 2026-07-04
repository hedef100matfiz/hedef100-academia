const CACHE_NAME = 'hedef100-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './student-dashboard.html',
  './teacher-dashboard.html',
  './vip-kocluk.html',
  './sistemimiz.html',
  './soru-kutusu.html',
  './firebase-shared.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
            // Eğer çevrimdışıysa ve istek HTML sayfasına ise index veya login sayfasına yönlendirilebilir.
        });
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
