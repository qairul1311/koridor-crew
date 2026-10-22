import { call } from './api.js';
import { VAPID_PUBLIC } from './config.js';

export const PUSH = { supported: false, reg: null, sub: null, prefs: null, permission: 'default' };

export const PREF_TYPES = [
  { key: 'swap', label: 'Shift changes and swaps' },
  { key: 'reminder', label: 'Reminders before my shift' },
  { key: 'tasks', label: 'Urgent tasks' },
  { key: 'stock', label: 'Out-of-stock alerts' },
  { key: 'announce', label: 'Announcements' },
  { key: 'chat', label: 'Chat messages' },
];

function b64ToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function initPush() {
  PUSH.supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!('serviceWorker' in navigator)) return;
  try {
    PUSH.reg = await navigator.serviceWorker.register('service-worker.js', { scope: './' });
  } catch { return; }
  if (!PUSH.supported) return;
  PUSH.permission = Notification.permission;
  try {
    PUSH.sub = await PUSH.reg.pushManager.getSubscription();
    if (PUSH.sub) {
      const r = await call('push_get', { endpoint: PUSH.sub.endpoint });
      if (r.found) PUSH.prefs = r.prefs;
      else await save(PUSH.sub); // device was subscribed under v1 — register it here too
    }
  } catch { /* offline is fine */ }
}

async function save(sub) {
  const j = sub.toJSON();
  const r = await call('push_save', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent });
  PUSH.prefs = r.prefs;
}

export async function enablePush() {
  if (!PUSH.supported) throw new Error('This browser can’t do notifications. On iPhone, add the app to your Home Screen first, then open it from there.');
  if (!PUSH.reg) PUSH.reg = await navigator.serviceWorker.ready;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  PUSH.permission = perm;
  if (perm !== 'granted') throw new Error('Notifications are blocked. Turn them on in your phone Settings for this app, then try again.');
  let sub = await PUSH.reg.pushManager.getSubscription();
  if (!sub) sub = await PUSH.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
  PUSH.sub = sub;
  await save(sub);
}

export async function disablePush() {
  if (!PUSH.sub) return;
  const endpoint = PUSH.sub.endpoint;
  try { await PUSH.sub.unsubscribe(); } catch { /* ignore */ }
  await call('push_remove', { endpoint });
  PUSH.sub = null; PUSH.prefs = null;
}

export async function setPref(key, value) {
  if (!PUSH.sub) return;
  await call('push_prefs', { endpoint: PUSH.sub.endpoint, prefs: { [key]: value } });
  PUSH.prefs = { ...PUSH.prefs, [key]: value };
}
