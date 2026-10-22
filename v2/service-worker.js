// Koridor Crew v2 service worker: push notifications + offline app shell.
const CACHE = 'crew-v2-1';
const SHELL = [
  './', 'index.html', 'app.css', 'manifest.json', 'icon-192.png',
  'js/app.js', 'js/api.js', 'js/store.js', 'js/ui.js', 'js/push.js', 'js/config.js',
  'js/views/home.js', 'js/views/schedule.js', 'js/views/tasks.js', 'js/views/chat.js', 'js/views/me.js',
  'js/views/sheets.js', 'js/views/admin-today.js', 'js/views/admin-pay.js', 'js/views/admin-more.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network first for our own files, so updates land immediately; cache when offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res.ok) { const c = await caches.open(CACHE); c.put(e.request, res.clone()); }
      return res;
    } catch {
      return (await caches.match(e.request)) || (await caches.match('index.html')) || Response.error();
    }
  })());
});

const ROUTES = { chat: 'chat', tasks: 'tasks', swap: 'schedule', reminder: '', stock: '', announce: '', test: '' };

self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { title: 'Koridor Crew', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(p.title || 'Koridor Crew', {
    body: p.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: p.tag || p.type || 'crew',
    renotify: true,
    requireInteraction: !!p.urgent,
    vibrate: p.urgent ? [200, 100, 200, 100, 200] : [80, 40, 80],
    data: { type: p.type || '' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const route = ROUTES[e.notification.data?.type] ?? '';
  const target = new URL(`./#/${route}`, self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        w.postMessage({ type: 'open', route });
        return w.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});

// If the browser rotates the push subscription, the app re-registers it on next open.
self.addEventListener('pushsubscriptionchange', () => {});
