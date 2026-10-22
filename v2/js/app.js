import { call, login, logout, session, watchPulse, stopPulse, whenSignedOut } from './api.js';
import { S, apply, chatSeen, setChatSeen } from './store.js';
import { esc, icon, avatar, toast, wireEvents, on, closeSheet, sheetIsOpen } from './ui.js';
import { initPush } from './push.js';
import * as home from './views/home.js';
import * as schedule from './views/schedule.js';
import * as tasks from './views/tasks.js';
import * as chat from './views/chat.js';
import * as me from './views/me.js';
import * as today from './views/admin-today.js';
import * as pay from './views/admin-pay.js';
import * as more from './views/admin-more.js';

const STAFF_NAV = [
  { r: 'home', label: 'Tonight', ic: 'moon', view: home },
  { r: 'schedule', label: 'Schedule', ic: 'calendar', view: schedule },
  { r: 'tasks', label: 'Tasks', ic: 'tasks', view: tasks },
  { r: 'chat', label: 'Chat', ic: 'chat', view: chat },
  { r: 'me', label: 'Me', ic: 'user', view: me },
];
const ADMIN_NAV = [
  { r: 'today', label: 'Today', ic: 'today', view: today },
  { r: 'schedule', label: 'Schedule', ic: 'calendar', view: schedule },
  { r: 'pay', label: 'Pay', ic: 'wallet', view: pay },
  { r: 'chat', label: 'Chat', ic: 'chat', view: chat },
  { r: 'more', label: 'More', ic: 'grid', view: more },
];

const navItems = () => (S.me?.is_admin ? ADMIN_NAV : STAFF_NAV);
export function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [r, ...rest] = h.split('/');
  const items = navItems();
  const hit = items.find((i) => i.r === r) || items[0];
  return { item: hit, sub: rest.join('/') };
}
export function go(path) {
  if (location.hash === `#/${path}`) render();
  else location.hash = `#/${path}`;
}

// ── rendering ──────────────────────────────────────────────────
let current = null;
export function render({ keepScroll = true } = {}) {
  if (!S.loaded) return;
  const { item, sub } = route();
  const view = document.getElementById('view');
  const switched = current !== item.r + '/' + sub;
  const y = window.scrollY;
  current = item.r + '/' + sub;
  view.className = item.view.flush ? 'flush' : '';
  view.innerHTML = item.view.render(sub);
  if (item.view.mounted) item.view.mounted(sub);
  renderNav(item.r);
  renderChrome();
  if (switched) window.scrollTo(0, 0);
  else if (keepScroll) window.scrollTo(0, y);
}

function renderNav(active) {
  const unread = S.chat?.unread || 0;
  const urgent = S.tasks.filter((t) => !t.done && t.urgent).length;
  document.getElementById('nav').innerHTML = `<div class="nav-inner">${navItems().map((i) => {
    let dot = '';
    if (i.r === 'chat' && unread && active !== 'chat') dot = `<span class="dot">${unread > 9 ? '9+' : unread}</span>`;
    if (i.r === 'tasks' && urgent) dot = `<span class="dot">${urgent}</span>`;
    if (i.r === 'today' && S.me.is_admin) { const n = today.attentionCount(); if (n) dot = `<span class="dot">${n}</span>`; }
    return `<a href="#/${i.r}" class="${i.r === active ? 'on' : ''}" ${i.r === active ? 'aria-current="page"' : ''}>${icon(i.ic)}<span>${i.label}</span>${dot}</a>`;
  }).join('')}</div>`;
}

function renderChrome() {
  const m = S.me;
  document.getElementById('who').innerHTML = `${avatar(m)}<div><b>${esc(m.name)}</b><span>${m.is_admin ? 'Admin' : m.employment === 'ft' ? 'Full-time crew' : 'Crew'}</span></div>`;
  const ann = S.settings.announcement;
  let html = '';
  if (ann) html += `<div class="announce" role="note">${icon('megaphone')}<p>${esc(ann)}</p></div>`;
  document.getElementById('banners').innerHTML = html;
}

// ── data ───────────────────────────────────────────────────────
let refreshTimer = null;
let pendingParts = new Set();
let lastRefresh = 0;

export async function refresh(parts) {
  const args = { chat_seen: chatSeen() };
  if (parts && !parts.includes('all')) args.parts = parts;
  const data = await call('boot', args);
  // First time on this device: don't count the whole chat history as unread.
  if (!args.chat_seen && data.chat) { setChatSeen(data.chat.last_id); data.chat.unread = 0; }
  apply(data);
  lastRefresh = Date.now();
  if (!sheetIsOpen()) render();
  else renderNav(route().item.r);
  return data;
}

function queueRefresh(parts) {
  parts.forEach((p) => pendingParts.add(p));
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const list = [...pendingParts]; pendingParts = new Set();
    try { await refresh(list); setSync(''); } catch { setSync('off'); }
  }, 350);
}

const TOPIC_PARTS = {
  schedule: ['schedule', 'pay', 'admin'],
  chat: ['chat'],
  tasks: ['tasks'],
  stock: ['stock', 'admin'],
  pay: ['pay', 'admin'],
  settings: ['settings', 'admin'],
};
function onPulse(topic) {
  if (topic === 'chat' && route().item.r === 'chat') { chat.pull(); return; }
  queueRefresh(TOPIC_PARTS[topic] || ['all']);
}

function setSync(state) {
  const el = document.getElementById('sync');
  if (el) el.className = `sync ${state}`;
}

// After any change we refetch just what it touches. Realtime covers other people.
export async function after(parts = ['all']) {
  try { await refresh(parts); } catch (e) { toast(e.message, 'bad'); }
}

// ── login ──────────────────────────────────────────────────────
let pin = '';
function showLogin(msg = '') {
  stopPulse();
  document.getElementById('app').hidden = true;
  document.getElementById('login').hidden = false;
  closeSheet();
  pin = ''; drawDots();
  document.getElementById('loginMsg').textContent = msg;
  const h = new Date().getHours();
  document.getElementById('loginGreet').textContent =
    `${h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 20 ? 'Evening' : 'Night shift'} — enter your 4-digit PIN`;
}
function drawDots() {
  document.querySelectorAll('#pinDots i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
}
async function pressKey(k) {
  if (k === 'del') { pin = pin.slice(0, -1); drawDots(); return; }
  if (pin.length >= 4) return;
  pin += k; drawDots();
  document.getElementById('loginMsg').textContent = '';
  if (pin.length === 4) {
    const keys = document.querySelectorAll('#keypad button');
    keys.forEach((b) => { b.disabled = true; });
    try {
      const res = await login(pin);
      if (res?.ok) { await start(); return; }
      const msg = res?.error === 'locked'
        ? 'Too many wrong PINs. Wait 15 minutes, or ask the boss.'
        : 'That PIN didn’t match. Try again.';
      document.getElementById('loginMsg').textContent = msg;
      const dots = document.getElementById('pinDots');
      dots.classList.add('shake');
      setTimeout(() => { dots.classList.remove('shake'); pin = ''; drawDots(); }, 380);
    } catch (e) {
      document.getElementById('loginMsg').textContent = e.message;
      pin = ''; drawDots();
    } finally {
      keys.forEach((b) => { b.disabled = false; });
    }
  }
}
document.getElementById('keypad').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-k]');
  if (b) pressKey(b.dataset.k);
});
document.addEventListener('keydown', (e) => {
  if (document.getElementById('login').hidden) return;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('del');
});

on('logout', async () => {
  await logout();
  Object.assign(S, { me: null, loaded: false, admin: null, messages: [] });
  location.hash = '';
  showLogin();
});

// ── start ──────────────────────────────────────────────────────
async function start() {
  document.getElementById('login').hidden = true;
  document.getElementById('app').hidden = false;
  document.getElementById('view').innerHTML = '<div class="loading"><span class="spinner"></span>Loading…</div>';
  try {
    await refresh(['all']);
  } catch (e) {
    if (e.code === 'auth') return;
    document.getElementById('view').innerHTML = `<div class="empty"><h3>Couldn’t load</h3><p>${esc(e.message)}</p><button class="btn primary" data-act="retry">Try again</button></div>`;
    return;
  }
  watchPulse(onPulse);
  initPush();
}
on('retry', () => start());
whenSignedOut(() => showLogin('You were signed out. Enter your PIN again.'));

window.addEventListener('hashchange', () => {
  closeSheet(); render({ keepScroll: false });
  if (S.loaded && Date.now() - lastRefresh > 60000) queueRefresh(['all']);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.loaded && Date.now() - lastRefresh > 30000) {
    queueRefresh(['all']);
  }
});
window.addEventListener('online', () => { setSync(''); if (S.loaded) queueRefresh(['all']); });
window.addEventListener('offline', () => setSync('off'));

// Notification taps arrive here from the service worker.
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'open' && e.data.route) go(e.data.route);
});

wireEvents();
if (session.token) start(); else showLogin();
