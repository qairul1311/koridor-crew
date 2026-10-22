// Team chat. Messages load on open; realtime pulses trigger a refetch.
import { call } from '../api.js';
import { S, person, timeOf, key, shortDate, setChatSeen } from '../store.js';
import { esc, icon, avatar, on, openSheet, closeSheet, sheetHead, busy, toast, ask } from '../ui.js';

export const flush = true;
let loaded = false;
let replyTo = null;
let draft = '';

const REACTIONS = ['👍', '❤️', '😂', '🔥', '🙏', '😮'];

function list() {
  if (!loaded) return '<div class="loading"><span class="spinner"></span>Loading chat…</div>';
  if (!S.messages.length) return '<div class="empty"><h3>No messages yet</h3><p>Say hi to the crew.</p></div>';
  let out = ''; let lastDay = ''; let lastWho = null; let lastTs = 0;
  for (const m of S.messages) {
    const d = key(new Date(m.created_at));
    if (d !== lastDay) {
      out += `<div class="daybreak">${d === key(new Date()) ? 'Today' : esc(shortDate(d))}</div>`;
      lastDay = d; lastWho = null;
    }
    if (m.system) { out += `<div class="sysmsg">${esc(m.text)}</div>`; lastWho = null; continue; }
    const p = person(m.staff_id);
    const mine = m.staff_id === S.me.id;
    const ts = new Date(m.created_at).getTime();
    const cont = lastWho === m.staff_id && ts - lastTs < 5 * 60 * 1000;
    lastWho = m.staff_id; lastTs = ts;
    const quoted = m.reply_to ? S.messages.find((x) => x.id === m.reply_to) : null;
    const reacts = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length);
    out += `<div class="msg ${mine ? 'mine' : ''} ${cont ? 'cont' : ''}">${avatar(p, 'sm')}
      <div class="body">${!cont && !mine ? `<div class="name" style="color:color-mix(in srgb, ${esc(p.color)} 70%, white)">${esc(p.name)}</div>` : ''}
        ${m.deleted ? '<div class="bubble gone">Message deleted</div>'
          : `<button class="bubble" data-act="msg-menu" data-id="${m.id}">${quoted ? `<span class="quote"><b>${esc(person(quoted.staff_id).name)}</b>: ${esc((quoted.text || 'deleted').slice(0, 70))}</span>` : ''}${esc(m.text)}</button>`}
        ${reacts.length ? `<div class="reacts">${reacts.map(([e, ids]) => `<button class="${ids.includes(S.me.id) ? 'mine' : ''}" data-act="react" data-id="${m.id}" data-e="${esc(e)}" aria-label="${esc(e)} ${ids.length}">${esc(e)} ${ids.length}</button>`).join('')}</div>` : ''}
        ${!cont ? `<div class="meta">${timeOf(m.created_at)}</div>` : ''}
      </div></div>`;
  }
  return out;
}

function composer() {
  const r = replyTo ? S.messages.find((m) => m.id === replyTo) : null;
  return `<div class="composer">${r ? `<div class="replying">${icon('reply')}<span>Replying to <b>${esc(person(r.staff_id).name)}</b>: ${esc(r.text)}</span>
      <button class="icon-btn" data-act="reply-cancel" aria-label="Cancel reply">${icon('x')}</button></div>` : ''}
    <form data-form="chat-send"><textarea class="input" id="chatInput" name="text" rows="1" maxlength="2000" placeholder="Message the crew" aria-label="Message">${esc(draft)}</textarea>
      <button class="send" type="submit" aria-label="Send" ${draft.trim() ? '' : 'disabled'}>${icon('send')}</button></form></div>`;
}

export function render() {
  if (!loaded) pull();
  return `<div class="chat-scroll" id="chatScroll">${list()}</div>${composer()}`;
}

export function mounted() {
  const ta = document.getElementById('chatInput');
  if (ta) {
    ta.addEventListener('input', () => {
      draft = ta.value;
      ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
      ta.form.querySelector('.send').disabled = !draft.trim();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); ta.form.requestSubmit(); }
    });
  }
  toBottom();
}

function toBottom() { requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight)); }

export async function pull() {
  try {
    const r = await call('chat_list', {});
    const wasNearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    S.messages = r.messages;
    loaded = true;
    const last = S.messages[S.messages.length - 1];
    if (last) { setChatSeen(last.id); S.chat = { last_id: last.id, unread: 0 }; }
    const box = document.getElementById('chatScroll');
    if (box) { box.innerHTML = list(); if (wasNearBottom || !box.dataset.ready) toBottom(); box.dataset.ready = '1'; }
    document.querySelectorAll('.nav a[href="#/chat"] .dot').forEach((d) => d.remove());
  } catch (e) { toast(e.message, 'bad'); }
}

on('chat-send', async (form) => {
  const text = form.text.value.trim();
  if (!text) return;
  const btn = form.querySelector('.send');
  await busy(btn, async () => {
    await call('chat_send', { text, reply_to: replyTo });
    draft = ''; replyTo = null;
    form.text.value = ''; form.text.style.height = 'auto';
    const r = document.querySelector('.composer .replying'); if (r) r.remove();
    await pull(); toBottom();
  });
});

on('msg-menu', (el) => {
  const m = S.messages.find((x) => String(x.id) === el.dataset.id);
  if (!m) return;
  const canDelete = m.staff_id === S.me.id || S.me.is_admin;
  openSheet(`${sheetHead('Message', `${person(m.staff_id).name}, ${timeOf(m.created_at)}`)}
    <div class="react-bar">${REACTIONS.map((e) => `<button data-act="react" data-id="${m.id}" data-e="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div>
    <div class="list">
      <button class="row" data-act="reply" data-id="${m.id}"><div class="lead">${icon('reply')}</div><div class="grow title">Reply</div></button>
      ${canDelete ? `<button class="row" data-act="msg-delete" data-id="${m.id}"><div class="lead berry">${icon('trash')}</div><div class="grow title">Delete</div></button>` : ''}
    </div>`);
});
on('react', async (el) => {
  closeSheet();
  await busy(null, async () => { await call('chat_react', { id: Number(el.dataset.id), emoji: el.dataset.e }); await pull(); });
});
on('reply', (el) => {
  replyTo = Number(el.dataset.id);
  closeSheet();
  const c = document.querySelector('.composer');
  if (c) { c.outerHTML = composer(); mounted(); document.getElementById('chatInput')?.focus(); }
});
on('reply-cancel', () => {
  replyTo = null;
  const c = document.querySelector('.composer');
  if (c) { c.outerHTML = composer(); mounted(); }
});
on('msg-delete', async (el) => {
  closeSheet();
  if (!(await ask('Delete this message?', 'Everyone will see it was deleted.', { yes: 'Delete', danger: true }))) return;
  await busy(null, async () => { await call('chat_delete', { id: Number(el.dataset.id) }); await pull(); });
});

export function resetChat() { loaded = false; S.messages = []; }
