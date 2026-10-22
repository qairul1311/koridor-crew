// Staff "Me": what I'm owed, my pay history, my days off, notifications.
import { call } from '../api.js';
import { S, money, shortDate, longDate, monthOf, monthLabel, DOW, DOW_LONG, addDays, dow } from '../store.js';
import { esc, icon, avatar, on, busy, toast } from '../ui.js';
import { render as rerender } from '../app.js';
import { PUSH, PREF_TYPES, enablePush, disablePush, setPref } from '../push.js';
import { APP_VERSION } from '../config.js';

let showAll = false;
on('pay-history', () => { showAll = !showAll; rerender(); });

export function nextPayday() {
  const pd = S.settings.payday ?? 6;
  for (let i = 0; i < 7; i++) { const d = addDays(S.today, i); if (dow(d) === pd) return d; }
  return S.today;
}

export function render() {
  const pay = S.myPay;
  const owed = pay.filter((p) => !p.paid && p.date <= S.today);
  const booked = pay.filter((p) => !p.paid && p.date > S.today);
  const sum = (a) => a.reduce((s, p) => s + Number(p.amount), 0);
  const ym = monthOf(S.today);
  const month = pay.filter((p) => p.date.startsWith(ym));
  const pd = nextPayday();
  const salaried = S.me.pay_type === 'salary';

  const allHistory = pay.filter((p) => p.date <= S.today);
  const history = showAll ? allHistory : allHistory.slice(0, 8);

  return `<div class="page-head" style="display:flex;align-items:center;gap:14px">${avatar(S.me, 'lg')}
      <div><h1>${esc(S.me.name)}</h1><p>${S.me.employment === 'ft' ? 'Full-time' : 'Part-time'} crew</p></div></div>

    ${salaried ? '' : `<div class="owed">
      <p class="muted">Owed to you</p>
      <div class="big">${money(sum(owed))}</div>
      <p class="muted small" style="margin-top:6px">${owed.length ? `${owed.length} ${owed.length === 1 ? 'shift' : 'shifts'}. Next payday is ${esc(pd === S.today ? 'today' : longDate(pd))}.` : 'All paid up.'}</p>
      <div class="split">
        <div><b>${money(sum(month))}</b><span>${esc(monthLabel(ym))}</span></div>
        ${booked.length ? `<div><b>${money(sum(booked))}</b><span>From ${booked.length} booked ${booked.length === 1 ? 'shift' : 'shifts'}</span></div>` : ''}
      </div></div>`}

    ${history.length ? `<section class="section"><header><h2>Pay history</h2></header><div class="list">${history.map((p) => `
      <div class="row"><div class="grow"><div class="title">${esc(shortDate(p.date))}${p.kind === 'extra' ? ` <span class="tag info">Extra</span>` : ''}</div>
        <div class="sub">${p.paid ? `Paid ${esc(shortDate(p.paid_at.slice(0, 10)))}${p.method ? ` by ${esc(p.method)}` : ''}` : 'Not paid yet'}${p.note ? `. ${esc(p.note)}` : ''}</div></div>
        <div class="end"><span class="amount ${p.paid ? '' : ''}" style="${p.paid ? 'color:var(--text-2)' : ''}">${money(p.amount)}</span>
        ${p.paid ? '<span class="tag good">Paid</span>' : '<span class="tag warn">Owed</span>'}</div></div>`).join('')}</div>
      ${allHistory.length > 8 ? `<button class="btn ghost block" style="margin-top:10px" data-act="pay-history">${showAll ? 'Show less' : `Show all ${allHistory.length}`}</button>` : ''}</section>` : ''}

    <section class="section"><header><h2>Days I can work</h2></header>
      <p class="muted small" style="margin-bottom:10px">Tap a day to mark it off. The boss sees this when filling shifts.</p>
      <div class="week-toggles">${[1, 2, 3, 4, 5, 6, 0].map((w) => {
        const ok = isAvailableDow(w);
        return `<button class="${ok ? 'on' : 'off'}" data-act="avail" data-w="${w}" aria-pressed="${ok}" aria-label="${DOW_LONG[w]}: ${ok ? 'available' : 'off'}">${DOW[w]}${icon(ok ? 'check' : 'x')}</button>`;
      }).join('')}</div>
    </section>

    <section class="section"><header><h2>Notifications</h2></header>${pushBlock()}</section>

    <section class="section"><button class="btn block ghost" data-act="logout">${icon('logout')}Sign out of this phone</button>
      <p class="faint tiny" style="text-align:center;margin-top:12px">Koridor Crew ${APP_VERSION}</p></section>`;
}

function isAvailableDow(w) {
  const a = S.availability.find((x) => x.staff_id === S.me.id && x.dow === w);
  return !a || a.available;
}

export function pushBlock() {
  if (!PUSH.supported) {
    return `<div class="panel"><p class="muted">This browser can’t show notifications. On iPhone, add Crew to your Home Screen (Share, then Add to Home Screen) and open it from there.</p></div>`;
  }
  if (!PUSH.sub || !PUSH.prefs) {
    const blocked = PUSH.permission === 'denied';
    return `<div class="panel"><p class="muted" style="margin-bottom:12px">${blocked ? 'Notifications are blocked for this app. Open your phone Settings, find Crew, and allow notifications.' : 'Get a ping for swaps, reminders before your shift, and urgent stuff, even when the app is closed.'}</p>
      <button class="btn primary block" data-act="push-on">${icon('bell')}Turn on notifications</button></div>`;
  }
  return `<div class="list">${PREF_TYPES.map((t) => `
      <label class="row"><div class="grow title">${esc(t.label)}</div>
        <span class="toggle"><input type="checkbox" data-change="push-pref" data-k="${t.key}" ${PUSH.prefs[t.key] !== false ? 'checked' : ''}><span></span></span></label>`).join('')}</div>
    <div class="btn-row" style="margin-top:10px"><button class="btn" data-act="push-test">Send a test</button><button class="btn ghost" data-act="push-off">Turn off</button></div>`;
}

on('avail', async (el) => {
  const w = Number(el.dataset.w);
  const next = !isAvailableDow(w);
  const row = S.availability.find((x) => x.staff_id === S.me.id && x.dow === w);
  if (row) row.available = next; else S.availability.push({ staff_id: S.me.id, dow: w, available: next });
  rerender();
  await busy(null, async () => { await call('avail_set', { dow: w, available: next }); });
});
on('push-on', async (el) => {
  await busy(el, async () => { await enablePush(); toast('Notifications on'); rerender(); });
});
on('push-off', async (el) => {
  await busy(el, async () => { await disablePush(); toast('Notifications off on this phone'); rerender(); });
});
on('push-pref', async (el) => {
  await busy(null, async () => { await setPref(el.dataset.k, el.checked); });
});
on('push-test', async (el) => {
  await busy(el, async () => {
    const r = await call('push_test', {});
    toast(r.live ? 'Test sent. It should arrive in a few seconds.' : 'Saved. Notifications start sending after the switch-over.');
  });
});

