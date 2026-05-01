// Crew App Service Worker
// Handles push notifications and routing when notifications are tapped

const CACHE_VERSION = 'crew-v1';
const SCOPE_PATH = '/koridor-crew/';

// ──────────────────────────────────────
// LIFECYCLE
// ──────────────────────────────────────
self.addEventListener('install', (event) => {
  // Activate immediately on first install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all open tabs immediately
  event.waitUntil(self.clients.claim());
});

// ──────────────────────────────────────
// PUSH RECEIVED
// ──────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Crew App', body: event.data ? event.data.text() : 'New notification' };
  }

  const title = payload.title || 'Crew App 🥞';
  const options = {
    body: payload.body || '',
    icon: payload.icon || 'icon-192.png',
    badge: 'icon-192.png',
    tag: payload.tag || 'crew-default', // same tag = replaces previous
    renotify: payload.renotify !== false, // re-alert even if same tag
    requireInteraction: payload.priority === 'urgent',
    data: {
      url: payload.url || SCOPE_PATH,
      type: payload.type || 'general',
      payload: payload.data || {},
      ts: Date.now()
    },
    vibrate: payload.priority === 'urgent' ? [200, 100, 200, 100, 200] : [100, 50, 100],
    actions: payload.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ──────────────────────────────────────
// NOTIFICATION TAP
// ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || SCOPE_PATH;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a Crew App window is already open, focus it and route
      for (const client of clientList) {
        if (client.url.includes(SCOPE_PATH) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_TAP',
            target: data.type,
            payload: data.payload
          });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ──────────────────────────────────────
// SUBSCRIPTION CHANGE (token rotation)
// ──────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  // The push subscription has expired or been invalidated.
  // Re-subscribe and notify the page so it can update Supabase.
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription ? event.oldSubscription.options.applicationServerKey : null
    }).then((newSub) => {
      return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SUBSCRIPTION_RENEWED',
            subscription: newSub.toJSON()
          });
        });
      });
    }).catch((err) => console.error('[SW] Re-subscribe failed:', err))
  );
});
