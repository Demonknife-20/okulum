// Okulum servis çalışanı: Web Push bildirimlerini gösterir ve tıklanınca ilgili sayfayı açar.
const SHELL_CACHE = 'okulum-shell-v2';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(['/', '/icon.svg', '/manifest.webmanifest'])).catch(() => {}));
  self.skipWaiting();
});

// Çevrimdışı kabuk: uygulama dosyaları ilk açılışta önbelleğe alınır, ağ yoksa oradan sunulur.
// API istekleri asla önbelleğe alınmaz (veriler her zaman güncel olmalı).
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const fresh = await fetch(req);
      const cacheable = fresh.ok && (url.pathname === '/' || /\.[A-Za-z0-9]{8,}\.(js|css)$/.test(url.pathname)
        || url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest'));
      if (cacheable) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return (await cache.match(req)) || (await cache.match('/')) || new Response('Çevrimdışısınız. Bağlantı gelince tekrar deneyin.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Okulum', {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'okulum',
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        if ('navigate' in client) client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
