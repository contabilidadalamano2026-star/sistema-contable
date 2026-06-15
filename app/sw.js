const CACHE_NAME = 'contabilidad-cr-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Para asegurar actualizaciones, usamos "Network First" en lugar de "Cache First"
    if (e.request.method === 'GET' && !e.request.url.includes('/api/')) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
    }
});
