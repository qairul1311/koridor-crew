// Admin "More": crew, stock list, close-out history, announcements, settings, exports.
import { call } from '../api.js';
import { S, apply, person, crew, money, shortDate, monthOf, monthLabel, monthDays, dayInfo, DOW, toDate, addDays, clock } from '../store.js';
import { esc, icon, avatar, on, openSheet, updateSheet, closeSheet, sheetHead, busy, toast, ask, copyText, empty } from '../ui.js';
import { render as rerender, after as reload } from '../app.js';
import * as tasks from './tasks.js';
import { pushBlock } from './me.js';
import { APP_VERSION } from '../config.js';

const PAGES = [
  { k: 'crew', ic: 'people', t: 'Crew and PINs', s: 'Add people, set PINs, mark who has left' },
  { k: 'tasks', ic: 'tasks', t: 'Tasks', s: 'Shopping list and things to fix' },
  { k: 'stock', ic: 'box', t: 'Stock list', s: 'What the crew counts at closing' },
  { k: 'sales', ic: 'chart', t: 'Close-outs', s: 'Nightly sales and restock flags' },
  { k: 'comms', ic: 'megaphone', t: 'Announce', s: 'Pinned notice and push messages' },
  { k: 'export', ic: 'copy', t: 'WhatsApp copies', s: 'Schedule and earnings, ready to paste' },
  { k: 'settings', ic: 'gear', t: 'Shift and pay settings', s: 'Hours, rates, payday' },
  { k: 'me', ic: 'user', t: 'My admin account', s: 'Admin PIN, notifications, sign out' },
];

export function render(sub) {
  const page = sub.split('/')[0];
  const back = `<a class="backlink" href="#/more">${icon('back')}More</a>`;
  switch (page) {
    case 'crew': return back + crewPage();
    case 'tasks': return back + tasks.render();
    case 'stock': return back + stockPage();
    case 'sales': return back + salesPage();
    case 'comms': return back + commsPage();
    case 'export': return back + exportPage();
    case 'settings': return back + settingsPage();
    case 'me': return back + mePage();
    default:
      return `<div class="page-head"><h1>More</h1></div><div class="list">${PAGES.map((p) => `
        <a class="row" href="#/more/${p.k}"><div class="lead">${icon(p.ic)}</div><div class="grow"><div class="title">${p.t}</div><div class="sub">${p.s}</div></div>${icon('next', 'chev')}</a>`).join('')}</div>`;
  }
}

// ── crew ───────────────────────────────────────────────────────
function crewPage() {
  const pins = new Set(S.admin?.pins || []);
  const push = new Map((S.admin?.push || []).map((p) => [p.staff_id, p]));
  const people = S.staff.filter((p) => !p.is_admin);
  const active = people.filter((p) => p.active); const gone = people.filter((p) => !p.active);
  const row = (p) => `<button class="row" data-act="crew-edit" data-id="${p.id}">${avatar(p)}
      <div class="grow"><div class="title">${esc(p.name)}</div>
        <div class="sub">${p.employment === 'ft' ? 'Full-time' : 'Part-time'}${p.pay_type === 'salary' ? ', salary' : ''}${push.has(p.id) ? ', notifications on' : ''}</div></div>
      <div class="end">${pins.has(p.id) ? '' : '<span class="tag bad">No PIN</span>'}${icon('next', 'chev')}</div></button>`;
  const noPin = active.filter((p) => !pins.has(p.id));
  return `<div class="page-head bar"><h1>Crew</h1><button class="btn sm primary" data-act="crew-add">${icon('plus')}Add</button></div>
    ${noPin.length ? `<div class="panel" style="margin-bottom:14px"><p><b>${noPin.length} can’t log in yet.</b> <span class="muted">Give everyone a PIN in one go, then send them each theirs.</span></p>
      <button class="btn block" style="margin-top:12px" data-act="crew-autopin">${icon('key')}Make PINs for all ${noPin.length}</button></div>` : ''}
    <div class="list">${active.map(row).join('')}</div>
    ${gone.length ? `<section class="section"><header><h2>No longer working</h2></header><div class="list">${gone.map(row).join('')}</div></section>` : ''}`;
}

function crewForm(p) {
  const pins = new Set(S.admin?.pins || []);
  const isNew = !p;
  p = p || { name: '', employment: 'pt', pay_type: 'per_shift', active: true };
  return `${sheetHead(isNew ? 'Add crew' : p.name, isNew ? 'They can log in once they have a PIN' : (pins.has(p.id) ? 'Has a PIN' : 'No PIN yet'))}
    <form data-form="crew-save" data-id="${p.id || ''}">
      <label class="field"><span>Name</span><input class="input" name="name" maxlength="40" required value="${esc(p.name)}" autocomplete="off"></label>
      <div class="field"><span>Works as</span><div class="seg">
        ${[['pt', 'Part-time'], ['ft', 'Full-time']].map(([v, l]) => `<label style="flex:1;display:flex"><input class="sr" type="radio" name="employment" value="${v}" ${p.employment === v ? 'checked' : ''}><span class="btn sm ${p.employment === v ? 'primary' : 'ghost'}" style="flex:1;border:0">${l}</span></label>`).join('')}</div></div>
      <div class="field"><span>Paid</span><div class="seg">
        ${[['per_shift', 'Per shift'], ['salary', 'Monthly salary']].map(([v, l]) => `<label style="flex:1;display:flex"><input class="sr" type="radio" name="pay_type" value="${v}" ${p.pay_type === v ? 'checked' : ''}><span class="btn sm ${p.pay_type === v ? 'primary' : 'ghost'}" style="flex:1;border:0">${l}</span></label>`).join('')}</div>
        <small>Salary people don’t show up in the pay run.</small></div>
      <button class="btn primary block big" type="submit">${isNew ? 'Add and make a PIN' : 'Save'}</button>
    </form>
    ${isNew ? '' : `<div class="hr"></div>
      <div class="list">
        <button class="row" data-act="crew-pin" data-id="${p.id}"><div class="lead honey">${icon('key')}</div><div class="grow"><div class="title">${pins.has(p.id) ? 'Make a new PIN' : 'Make a PIN'}</div><div class="sub">${pins.has(p.id) ? 'Their old PIN stops working' : 'So they can log in'}</div></div></button>
        <button class="row" data-act="crew-pin-custom" data-id="${p.id}"><div class="lead">${icon('key')}</div><div class="grow"><div class="title">Set a specific PIN</div></div></button>
        <button class="row" data-act="crew-active" data-id="${p.id}" data-v="${!p.active}"><div class="lead ${p.active ? 'berry' : 'pandan'}">${icon(p.active ? 'logout' : 'check')}</div>
          <div class="grow"><div class="title">${p.active ? 'Mark as left' : 'Bring back'}</div><div class="sub">${p.active ? 'Removes their upcoming shifts and logs them out' : 'They can log in again'}</div></div></button>
      </div>`}`;
}
function paintSegs() {
  document.querySelectorAll('#sheet .seg').forEach((seg) => {
    const radios = seg.querySelectorAll('input[type=radio]');
    const paint = () => radios.forEach((x) => { x.nextElementSibling.classList.toggle('primary', x.checked); x.nextElementSibling.classList.toggle('ghost', !x.checked); });
    radios.forEach((r) => r.addEventListener('change', paint));
  });
}
function showPin(name, pin) {
  openSheet(`${sheetHead(`${name}’s PIN`, 'Shown once. Send it to them now.')}
    <div class="pin-reveal">${esc(pin)}</div>
    <button class="btn primary block big" data-act="copy-pin" data-text="${esc(`Hi ${name}! Your Koridor Crew PIN is ${pin}. Open the Crew app and tap it in. Don't share it 🙏`)}">${icon('copy')}Copy message for WhatsApp</button>`);
}
on('copy-pin', async (el) => { await copyText(el.dataset.text); toast('Copied'); });
on('crew-add', () => { openSheet(crewForm(null)); paintSegs(); });
on('crew-edit', (el) => { openSheet(crewForm(person(el.dataset.id))); paintSegs(); });
on('crew-save', async (form) => {
  const id = form.dataset.id || null;
  await busy(form.querySelector('button[type=submit]'), async () => {
    const r = await call('staff_save', { id, name: form.name.value, employment: form.employment.value, pay_type: form.pay_type.value });
    if (!id) {
      const pin = await call('staff_pin', { id: r.id });
      await reload(['settings', 'admin']);
      showPin(form.name.value.trim(), pin.pin);
    } else {
      closeSheet(); toast('Saved'); await reload(['settings', 'admin']);
    }
  });
});
on('crew-pin', async (el) => {
  const p = person(el.dataset.id);
  const pins = new Set(S.admin?.pins || []);
  if (pins.has(p.id) && !(await ask(`New PIN for ${p.name}?`, 'Their current PIN stops working right away.', { yes: 'Make new PIN' }))) return;
  await busy(el, async () => { const r = await call('staff_pin', { id: p.id }); await reload(['admin']); showPin(p.name, r.pin); });
});
on('crew-pin-custom', (el) => {
  const p = person(el.dataset.id);
  updateSheet(`${sheetHead(`PIN for ${p.name}`, 'Exactly 4 digits, not used by anyone else')}
    <form data-form="crew-pin-set" data-id="${p.id}">
      <input class="input huge" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off" style="text-align:center;letter-spacing:.3em" aria-label="PIN">
      <button class="btn primary block big" style="margin-top:14px" type="submit">Set PIN</button></form>`);
});
on('crew-pin-set', async (form) => {
  const p = person(form.dataset.id);
  await busy(form.querySelector('button'), async () => { const r = await call('staff_pin', { id: p.id, pin: form.pin.value }); await reload(['admin']); showPin(p.name, r.pin); });
});
on('crew-active', async (el) => {
  const p = person(el.dataset.id); const v = el.dataset.v === 'true';
  if (!v && !(await ask(`Mark ${p.name} as left?`, 'Their upcoming shifts are removed and they’re logged out. Past shifts and pay stay.', { yes: 'Mark as left', danger: true }))) return;
  await busy(el, async () => { await call('staff_save', { id: p.id, active: v }); closeSheet(); toast(v ? `${p.name} is back` : `${p.name} marked as left`); await reload(['settings', 'schedule', 'admin']); });
});
on('crew-autopin', async (el) => {
  const pins = new Set(S.admin?.pins || []);
  const list = crew().filter((p) => !pins.has(p.id));
  await busy(el, async () => {
    const out = [];
    for (const p of list) { const r = await call('staff_pin', { id: p.id }); out.push([p.name, r.pin]); }
    await reload(['admin']);
    const text = out.map(([n, pin]) => `${n}: ${pin}`).join('\n');
    openSheet(`${sheetHead('New PINs', 'Shown once. Send each person theirs privately.')}
      <pre class="wa">${esc(text)}</pre>
      <button class="btn primary block" data-act="copy-pin" data-text="${esc(text)}">${icon('copy')}Copy all</button>`);
  });
});

// ── stock list ─────────────────────────────────────────────────
let stockDraft = null;
function stockPage() {
  if (!stockDraft) stockDraft = S.stockItems.map((i) => ({ ...i }));
  const rows = stockDraft.filter((i) => i.active !== false);
  const hidden = stockDraft.filter((i) => i.active === false);
  return `<div class="page-head"><h1>Stock list</h1><p>What the crew checks at closing. Keep it short: only things that run out.</p></div>
    <div class="list">${rows.map((i) => {
      const idx = stockDraft.indexOf(i);
      return `<div class="row"><div class="grow" style="display:flex;gap:8px">
        <input class="input" value="${esc(i.name)}" data-change="stock-edit" data-i="${idx}" data-f="name" maxlength="60" aria-label="Item name">
        <input class="input" style="max-width:76px" value="${esc(i.unit || '')}" data-change="stock-edit" data-i="${idx}" data-f="unit" maxlength="20" placeholder="unit" aria-label="Unit"></div>
        <div class="end"><button class="icon-btn" data-act="stock-move" data-i="${idx}" data-d="-1" aria-label="Move up">${icon('up')}</button>
        <button class="icon-btn" data-act="stock-hide" data-i="${idx}" aria-label="Remove ${esc(i.name)}">${icon('x')}</button></div></div>`;
    }).join('') || `<div class="row"><div class="grow muted">No items yet. Add the things that run out, like batter, eggs, Nutella, cups.</div></div>`}</div>
    <form data-form="stock-add" class="inline-form" style="margin-top:10px">
      <input class="input" name="name" maxlength="60" placeholder="Add an item" autocomplete="off" required aria-label="New item">
      <button class="btn" type="submit" aria-label="Add">${icon('plus')}</button></form>
    ${hidden.length ? `<p class="muted small" style="margin-top:14px">Removed: ${hidden.map((i) => `<button class="link" style="background:none;border:0;color:var(--honey);padding:4px" data-act="stock-unhide" data-i="${stockDraft.indexOf(i)}">${esc(i.name)}</button>`).join(', ')}</p>` : ''}
    <div class="section"><button class="btn primary block big" data-act="stock-save">Save stock list</button></div>`;
}
on('stock-edit', (el) => { stockDraft[Number(el.dataset.i)][el.dataset.f] = el.value; });
on('stock-add', (form) => { stockDraft.push({ name: form.name.value.trim(), unit: '', active: true }); rerender(); setTimeout(() => document.querySelector('form[data-form=stock-add] input')?.focus(), 0); });
on('stock-hide', (el) => { const it = stockDraft[Number(el.dataset.i)]; if (it.id) it.active = false; else stockDraft.splice(Number(el.dataset.i), 1); rerender(); });
on('stock-unhide', (el) => { stockDraft[Number(el.dataset.i)].active = true; rerender(); });
on('stock-move', (el) => {
  const i = Number(el.dataset.i); const vis = stockDraft.filter((x) => x.active !== false);
  const pos = vis.indexOf(stockDraft[i]); if (pos <= 0) return;
  const j = stockDraft.indexOf(vis[pos - 1]);
  [stockDraft[i], stockDraft[j]] = [stockDraft[j], stockDraft[i]]; rerender();
});
on('stock-save', async (el) => {
  await busy(el, async () => {
    const items = stockDraft.map((it, i) => ({ id: it.id ?? null, name: it.name, unit: it.unit || '', sort: i + 1, active: it.active !== false }));
    await call('stock_items_save', { items });
    stockDraft = null; toast('Stock list saved');
    await reload(['stock', 'admin']);
  });
});

// ── close-outs ─────────────────────────────────────────────────
function salesPage() {
  const cl = (S.admin?.closings || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  if (!cl.length) return `<div class="page-head"><h1>Close-outs</h1></div>${empty('chart', 'No close-outs yet', 'They show up here after the crew closes the stall each night.')}`;
  const max = Math.max(...cl.map((c) => Number(c.sales)), 1);
  const wk = cl.filter((c) => c.date > addDays(S.today, -7));
  const recent = S.admin?.stock_recent || [];
  return `<div class="page-head"><h1>Close-outs</h1><p>Last 7 days: ${money(wk.reduce((s, c) => s + Number(c.sales), 0))} over ${wk.length} ${wk.length === 1 ? 'night' : 'nights'}</p></div>
    <div class="panel bar-list">${cl.map((c) => {
      const flags = recent.filter((r) => r.date === c.date && r.level !== 'ok').map((r) => S.stockItems.find((i) => i.id === r.item_id)?.name).filter(Boolean);
      return `<div class="bar-row"><span>${esc(shortDate(c.date))}</span><div class="track"><div class="fill" style="width:${(Number(c.sales) / max) * 100}%"></div></div><span class="v">${money(c.sales)}</span></div>
        ${c.notes || flags.length ? `<p class="small muted" style="margin:-2px 0 8px 96px">${esc([person(c.staff_id).name, c.notes && `“${c.notes}”`, flags.length && `Low: ${flags.join(', ')}`].filter(Boolean).join('. '))}</p>` : ''}`;
    }).join('')}</div>`;
}

// ── announcements & broadcast ──────────────────────────────────
function commsPage() {
  return `<div class="page-head"><h1>Announce</h1></div>
    <section><header><h2>Pinned notice</h2></header>
      <form data-form="announce" class="panel">
        <label class="field"><span>Shows at the top of everyone’s app. Posting it also sends a notification.</span>
        <textarea class="input" name="text" maxlength="280" placeholder="e.g. Stall closed Wednesday for Deepavali">${esc(S.settings.announcement || '')}</textarea></label>
        <div class="btn-row"><button class="btn primary" type="submit">Post notice</button>${S.settings.announcement ? '<button class="btn ghost" type="button" data-act="announce-clear">Take it down</button>' : ''}</div>
      </form></section>
    <section class="section"><header><h2>Send a notification</h2></header>
      <form data-form="broadcast" class="panel">
        <label class="field"><span>Title</span><input class="input" name="title" maxlength="80" required placeholder="e.g. Need one more person tonight" autocomplete="off"></label>
        <label class="field"><span>Message (optional)</span><textarea class="input" name="body" maxlength="180"></textarea></label>
        <div class="field"><span>Send to</span><div class="chips">${crew().map((p) => `
          <label class="chip" style="cursor:pointer"><input type="checkbox" name="to" value="${p.id}" class="sr" data-change="bc-pick">${avatar(p, 'sm')}${esc(p.name)}</label>`).join('')}</div>
          <small>Leave everyone unticked to send to the whole crew.</small></div>
        <label class="row" style="padding:6px 0 14px;border:0"><div class="grow"><div class="title">Urgent</div><div class="sub">Rings even if they turned this type off</div></div>
          <span class="toggle"><input type="checkbox" name="urgent"><span></span></span></label>
        <button class="btn primary block" type="submit">${icon('send')}Send</button>
      </form></section>`;
}
on('bc-pick', (el) => el.closest('.chip').classList.toggle('me', el.checked));
on('announce', async (form) => {
  await busy(form.querySelector('button[type=submit]'), async () => { await call('announce', { text: form.text.value }); toast('Notice posted'); await reload(['settings']); });
});
on('announce-clear', async (el) => {
  await busy(el, async () => { await call('announce', { text: '' }); toast('Notice taken down'); await reload(['settings']); });
});
on('broadcast', async (form) => {
  const to = [...form.querySelectorAll('input[name=to]:checked')].map((x) => x.value);
  await busy(form.querySelector('button[type=submit]'), async () => {
    const r = await call('broadcast', { title: form.title.value, body: form.body.value, urgent: form.urgent.checked, staff_ids: to.length ? to : null });
    form.reset(); form.querySelectorAll('.chip.me').forEach((c) => c.classList.remove('me'));
    toast(r.live ? `Sent to ${to.length || 'everyone'}${to.length ? ` ${to.length === 1 ? 'person' : 'people'}` : ''}` : 'Saved. It sends once you switch over from the old app.');
  });
});

// ── WhatsApp exports ───────────────────────────────────────────
let exportYm = null;
function exportPage() {
  if (!exportYm) exportYm = monthOf(S.today);
  const days = monthDays(exportYm);
  let sched = `📅 *Schedule, ${monthLabel(exportYm)}*\n⏰ ${clock(S.settings.shift_start)} to ${clock(S.settings.shift_end)}\n`;
  let lastWeek = null;
  for (const d of days) {
    const info = dayInfo(d); const dt = toDate(d);
    if (!info.open && !info.shifts.length) continue;
    const wk = addDays(d, -((dt.getDay() + 6) % 7));
    if (wk !== lastWeek) { sched += '\n'; lastWeek = wk; }
    const names = info.shifts.map((s) => person(s.staff_id).name);
    for (let i = 0; i < info.open_pt + info.open_ft; i++) names.push('(open)');
    sched += `${DOW[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1}: ${names.join(', ')}\n`;
  }
  const counts = new Map();
  for (const d of days) for (const s of dayInfo(d).shifts) counts.set(s.staff_id, (counts.get(s.staff_id) || 0) + 1);
  const rows = [...counts.entries()].map(([id, n]) => [person(id), n]).filter(([p]) => p.pay_type !== 'salary').sort((a, b) => b[1] - a[1]);
  const rate = Number(S.settings.shift_rate);
  let earn = `💰 *Earnings, ${monthLabel(exportYm)}*\n\n`;
  rows.forEach(([p, n]) => { earn += `${p.name}: ${n} ${n === 1 ? 'shift' : 'shifts'} = ${money(n * rate)}\n`; });
  const tot = rows.reduce((s, [, n]) => s + n, 0);
  earn += `\nTotal: ${tot} shifts, ${money(tot * rate)}`;
  return `<div class="page-head bar"><h1>WhatsApp copies</h1>
      <div class="nav-btns" style="display:flex;gap:4px"><button class="icon-btn" data-act="exp-month" data-d="-1" aria-label="Previous month">${icon('back')}</button><button class="icon-btn" data-act="exp-month" data-d="1" aria-label="Next month">${icon('next')}</button></div></div>
    <section><header><h2>Schedule</h2></header><pre class="wa">${esc(sched.trim())}</pre>
      <button class="btn block" data-act="copy-pin" data-text="${esc(sched.trim())}">${icon('copy')}Copy schedule</button></section>
    <section class="section"><header><h2>Earnings estimate</h2></header><pre class="wa">${esc(earn)}</pre>
      <button class="btn block" data-act="copy-pin" data-text="${esc(earn)}">${icon('copy')}Copy earnings</button></section>`;
}
on('exp-month', async (el) => {
  const [y, m] = exportYm.split('-').map(Number); const d = new Date(y, m - 1 + Number(el.dataset.d), 1);
  exportYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const days = monthDays(exportYm);
  if (!S.range || days[0] < S.range.from || days[days.length - 1] > S.range.to) {
    await busy(el, async () => { apply(await call('boot', { parts: ['schedule'], from: days[0], to: days[days.length - 1] })); });
  }
  rerender();
});

// ── settings ───────────────────────────────────────────────────
function settingsPage() {
  const s = S.settings;
  const t = (v) => (v || '').slice(0, 5);
  return `<div class="page-head"><h1>Shift and pay</h1></div>
    <form data-form="settings-save">
      <div class="grid-2">
        <label class="field"><span>Shift starts</span><input class="input" type="time" name="shift_start" value="${t(s.shift_start)}" required></label>
        <label class="field"><span>Shift ends</span><input class="input" type="time" name="shift_end" value="${t(s.shift_end)}" required></label>
      </div>
      <div class="field"><span>How crew are paid</span><div class="seg">
        ${[['per_shift', 'Flat per shift'], ['hourly', 'By hours clocked']].map(([v, l]) => `<label style="flex:1;display:flex"><input class="sr" type="radio" name="pay_mode" value="${v}" ${s.pay_mode === v ? 'checked' : ''}><span class="btn sm ${s.pay_mode === v ? 'primary' : 'ghost'}" style="flex:1;border:0">${l}</span></label>`).join('')}</div>
        <small>Hourly uses each person’s clock-in and clock-out times. New shifts start at the full-shift amount until they clock out.</small></div>
      <div class="grid-2">
        <label class="field"><span>Per shift (RM)</span><input class="input" name="shift_rate" inputmode="decimal" value="${esc(s.shift_rate)}" required></label>
        <label class="field"><span>Per hour (RM)</span><input class="input" name="hourly_rate" inputmode="decimal" value="${esc(s.hourly_rate)}" required></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>Hours per shift</span><input class="input" name="shift_hours" inputmode="decimal" value="${esc(s.shift_hours)}" required></label>
        <label class="field"><span>Payday</span><select class="input" name="payday">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<option value="${w}" ${Number(s.payday) === w ? 'selected' : ''}>${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][w]}</option>`).join('')}</select></label>
      </div>
      <label class="row" style="padding:6px 0 16px;border:0"><div class="grow"><div class="title">Close-out every night</div><div class="sub">Crew on shift get reminded if nobody logs sales and stock</div></div>
        <span class="toggle"><input type="checkbox" name="require_close" ${s.require_close ? 'checked' : ''}><span></span></span></label>
      <button class="btn primary block big" type="submit">Save settings</button>
    </form>`;
}
on('settings-save', async (form) => {
  const num = (v) => Number(String(v).replace(/[^0-9.]/g, ''));
  await busy(form.querySelector('button[type=submit]'), async () => {
    await call('settings_save', {
      shift_start: form.shift_start.value, shift_end: form.shift_end.value, pay_mode: form.pay_mode.value,
      shift_rate: num(form.shift_rate.value), hourly_rate: num(form.hourly_rate.value), shift_hours: num(form.shift_hours.value),
      payday: Number(form.payday.value), require_close: form.require_close.checked,
    });
    toast('Settings saved'); await reload(['settings']);
  });
});

// ── admin account ──────────────────────────────────────────────
function mePage() {
  return `<div class="page-head"><h1>My admin account</h1></div>
    <section><header><h2>Admin PIN</h2></header>
      <form data-form="admin-pin" class="panel"><label class="field"><span>New 4-digit PIN</span>
        <input class="input" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off"></label>
        <button class="btn primary block" type="submit">Change my PIN</button></form></section>
    <section class="section"><header><h2>Notifications on this phone</h2></header>${pushBlock()}</section>
    <section class="section"><button class="btn block ghost" data-act="logout">${icon('logout')}Sign out of this phone</button>
      <p class="faint tiny" style="text-align:center;margin-top:12px">Koridor Crew ${APP_VERSION}</p></section>`;
}
on('admin-pin', async (form) => {
  await busy(form.querySelector('button'), async () => { await call('staff_pin', { id: S.me.id, pin: form.pin.value }); form.reset(); toast('Admin PIN changed'); });
});

export function mounted(sub) {
  if (sub.startsWith('crew') || sub.startsWith('settings')) {
    document.querySelectorAll('#view .seg').forEach((seg) => {
      const radios = seg.querySelectorAll('input[type=radio]');
      radios.forEach((r) => r.addEventListener('change', () => radios.forEach((x) => { x.nextElementSibling.classList.toggle('primary', x.checked); x.nextElementSibling.classList.toggle('ghost', !x.checked); })));
    });
  }
  if (!sub.startsWith('stock')) stockDraft = null;
}
