import { initial } from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── icons (24px stroke) ────────────────────────────────────────
const P = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  tasks: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="m3.5 7 1.5 1.5L7.5 6M3.5 12.2l1.5 1.5 2.5-2.5"/><circle cx="5" cy="17" r="1.2"/>',
  chat: '<path d="M5 17.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.5L5 19.5z"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M16 14.5h1.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  today: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  swap: '<path d="M6 8.5h11l-3-3M18 15.5H7l3 3"/>',
  box: '<path d="m12 3.5 8 4v9l-8 4-8-4v-9z"/><path d="m4 7.5 8 4 8-4M12 11.5v9"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  send: '<path d="m4.5 12 15-7-5 15-2.5-6z"/><path d="m12 14 7.5-9"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  logout: '<path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"/><path d="M14 8.5 17.5 12 14 15.5M17.5 12H9.5"/>',
  cart: '<path d="M3.5 5h2l2.2 9.5h9.6l2-7H7"/><circle cx="9.5" cy="18.5" r="1.3"/><circle cx="16.5" cy="18.5" r="1.3"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L11 18.8a2 2 0 0 1-2.8-2.8l8.4-8.4"/>',
  moon: '<path d="M18.5 14.5A7 7 0 0 1 9.5 5.5a7 7 0 1 0 9 9z"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  reply: '<path d="M10 7 5 12l5 5"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/>',
  key: '<circle cx="8" cy="14" r="3.5"/><path d="m10.5 11.5 8-8M15.5 6.5l2 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
  megaphone: '<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',
  chart: '<path d="M5 19V9M10 19V5M15 19v-7M20 19v-4"/>',
  people: '<circle cx="9" cy="9" r="3"/><path d="M3.5 18.5c.9-2.8 3-4 5.5-4s4.6 1.2 5.5 4"/><path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.7c1.4.6 2.4 1.8 3 3.8"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function avatar(p, size = 'md') {
  return `<span class="av av-${size}" style="--c:${esc(p.color || '#8C8FAD')}" aria-hidden="true">${esc(initial(p.name))}</span>`;
}

// ── toast ──────────────────────────────────────────────────────
let toastTimer;
export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

// ── sheets (bottom modal) ──────────────────────────────────────
let sheetClose = null;
let lastFocus = null;
let sheetOpen = false;
export function openSheet(html, { onClose, wide = false } = {}) {
  const layer = document.getElementById('sheet');
  lastFocus = document.activeElement;
  layer.innerHTML = `<div class="sheet-backdrop" data-act="sheet-close"></div>
    <div class="sheet-panel ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  layer.hidden = false;
  sheetOpen = true;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => layer.classList.add('open'));
  sheetClose = onClose || null;
  const first = layer.querySelector('[autofocus], input, textarea, select, button:not([data-act="sheet-close"])');
  if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
}
export function updateSheet(html) {
  const panel = document.querySelector('#sheet .sheet-panel');
  if (panel) panel.innerHTML = html;
}
export function closeSheet() {
  const layer = document.getElementById('sheet');
  if (!sheetOpen) return;
  sheetOpen = false;
  layer.classList.remove('open');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { if (!sheetOpen) { layer.hidden = true; layer.innerHTML = ''; } }, 180);
  const cb = sheetClose; sheetClose = null;
  if (cb) cb();
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
export function sheetIsOpen() { return sheetOpen; }
export function sheetHead(title, sub = '') {
  return `<div class="sheet-head"><div><h2>${esc(title)}</h2>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>
    <button class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>`;
}

// Promise-based confirm, styled like the app.
export function ask(title, body, { yes = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const layer = document.getElementById('dialog');
    layer.innerHTML = `<div class="dialog-backdrop"></div><div class="dialog" role="alertdialog" aria-modal="true">
      <h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
      <div class="dialog-actions"><button class="btn ghost" data-r="0">Cancel</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(yes)}</button></div></div>`;
    layer.hidden = false;
    const done = (v) => { layer.hidden = true; layer.innerHTML = ''; resolve(v); };
    layer.querySelector('[data-r="1"]').focus();
    layer.onclick = (e) => {
      const b = e.target.closest('[data-r]');
      if (b) done(b.dataset.r === '1');
      else if (e.target.classList.contains('dialog-backdrop')) done(false);
    };
  });
}

// ── actions ────────────────────────────────────────────────────
const handlers = {};
export function on(name, fn) { handlers[name] = fn; }

// Wrap an async action so the button shows progress and errors become toasts.
export async function busy(btn, fn) {
  if (btn?.dataset.busy) return;
  if (btn) { btn.dataset.busy = '1'; btn.classList.add('is-busy'); btn.disabled = true; }
  try {
    return await fn();
  } catch (e) {
    toast(e.message || 'Something went wrong.', 'bad');
    return undefined;
  } finally {
    if (btn && btn.isConnected) { delete btn.dataset.busy; btn.classList.remove('is-busy'); btn.disabled = false; }
  }
}

export function wireEvents(root = document) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = handlers[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  root.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fn = handlers[form.dataset.form];
    if (fn) fn(form, e);
  });
  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    const fn = handlers[el.dataset.change];
    if (fn) fn(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetIsOpen()) closeSheet();
  });
  on('sheet-close', () => closeSheet());
}

export function copyText(t) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t).then(() => true, () => fallback());
  return Promise.resolve(fallback());
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
}

export function empty(iconName, title, text, action = '') {
  return `<div class="empty">${icon(iconName, 'empty-ic')}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}
