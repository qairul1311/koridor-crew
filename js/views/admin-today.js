// Admin "Today": everything that needs a decision, each row fixable in place.
import { call } from '../api.js';
import { S, addDays, toDate, DOW, whenLabel, shortDate, longDate, dayInfo, person, crew, money, timeOf, shiftWindow, shiftTime } from '../store.js';
import { esc, icon, avatar, on, busy, toast } from '../ui.js';
import { after as reload, go } from '../app.js';
import { openDay } from './schedule.js';
import { nextPayday } from './me.js';
import { DOW_LONG, dow } from '../store.js';

function items() {
  const out = [];
  const t = S.today;
  const A = S.admin || {};

  // Open slots: the next 48 hours one by one, the rest of the week as one row
  const later = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(t, i); const info = dayInfo(d);
    const open = info.open_pt + info.open_ft;
    if (!open) continue;
    if (i <= 1) {
      out.push({ tone: 'berry', ic: 'calendar', title: `${whenLabel(d)}: ${open} ${open === 1 ? 'slot' : 'slots'} open`,
        sub: info.shifts.length ? `On so far: ${info.shifts.map((s) => person(s.staff_id).name).join(', ')}` : 'Nobody on yet',
        act: `data-act="today-day" data-date="${d}"`, btn: 'Fill' });
    } else later.push([d, open]);
  }
  if (later.length) {
    const n = later.reduce((s, [, o]) => s + o, 0);
    out.push({ tone: 'honey', ic: 'calendar', title: `${n} more ${n === 1 ? 'slot' : 'slots'} open this week`,
      sub: later.map(([d]) => DOW[dow(d)]).join(', '), act: 'data-act="today-go" data-to="schedule"', btn: 'Schedule' });
  }

  // Swap requests
  for (const w of S.swaps) {
    const p = person(w.staff_id);
    out.push({ tone: 'berry', ic: 'swap', title: `${p.name} can’t make ${whenLabel(w.date)}`, sub: w.reason ? `“${w.reason}”. Crew can still take it.` : 'Crew can still take it. Release if no one does.',
      act: `data-act="today-day" data-date="${w.date}"`, btn: 'Sort it' });
  }

  // Last night's close-out
  const y = addDays(t, -1);
  const yInfo = dayInfo(y);
  const closings = A.closings || [];
  if (yInfo.shifts.length && !closings.find((c) => c.date === y)) {
    out.push({ tone: 'berry', ic: 'box', title: `No close-out for ${shortDate(y)}`, sub: `On shift: ${yInfo.shifts.map((s) => person(s.staff_id).name).join(', ')}`, act: '', btn: '' });
  }
  // Tonight's close-out, only once the shift has ended
  const tInfo = dayInfo(t);
  if (tInfo.shifts.length && !S.closingToday && S.settings.require_close && Date.now() > shiftWindow(t).end.getTime() + 15 * 60000) {
    out.push({ tone: 'berry', ic: 'box', title: 'Tonight hasn’t been closed out', sub: 'The crew on shift got a reminder.', act: '', btn: '' });
  }

  // Restock from the latest count
  const recent = A.stock_recent || [];
  if (recent.length) {
    const latest = recent.reduce((m, r) => (r.date > m ? r.date : m), recent[0].date);
    const low = recent.filter((r) => r.date === latest && r.level !== 'ok');
    const onList = new Set(S.tasks.filter((k) => !k.done).map((k) => k.item.toLowerCase()));
    const need = low.map((r) => S.stockItems.find((i) => i.id === r.item_id)).filter((i) => i && !onList.has(i.name.toLowerCase()));
    if (need.length) {
      out.push({ tone: 'honey', ic: 'cart', title: `Restock: ${need.map((i) => i.name).join(', ')}`, sub: `From the ${shortDate(latest)} count`,
        act: `data-act="today-restock" data-ids="${need.map((i) => i.id).join(',')}"`, btn: 'Add to list' });
    }
  }

  // Pay owed for shifts already worked
  const owed = (A.payments || []).filter((p) => !p.paid && p.date <= t);
  if (owed.length) {
    const ppl = new Set(owed.map((p) => p.staff_id)).size;
    const total = owed.reduce((s, p) => s + Number(p.amount), 0);
    const pd = nextPayday();
    out.push({ tone: pd === t ? 'berry' : 'sky', ic: 'wallet', title: `${money(total)} owed to ${ppl} ${ppl === 1 ? 'person' : 'people'}`,
      sub: pd === t ? 'It’s payday today.' : `Payday is ${DOW_LONG[dow(pd)]}.`, act: 'data-act="today-go" data-to="pay"', btn: 'Pay run' });
  }

  // Urgent tasks
  const urgent = S.tasks.filter((k) => !k.done && k.urgent);
  if (urgent.length) out.push({ tone: 'berry', ic: 'tasks', title: `${urgent.length} urgent ${urgent.length === 1 ? 'task' : 'tasks'}`, sub: urgent.map((k) => k.item).join(', '), act: 'data-act="today-go" data-to="more/tasks"', btn: 'Open' });

  // Crew who can't log in
  const pins = new Set(A.pins || []);
  const noPin = crew().filter((p) => !pins.has(p.id));
  if (noPin.length) out.push({ tone: 'sky', ic: 'key', title: `${noPin.length} crew can’t log in yet`, sub: noPin.map((p) => p.name).join(', '), act: 'data-act="today-go" data-to="more/crew"', btn: 'Set PINs' });

  return out;
}

export function attentionCount() {
  if (!S.admin) return 0;
  return items().filter((i) => i.tone === 'berry').length;
}

function tonight() {
  const t = S.today; const info = dayInfo(t);
  if (!info.open && !info.shifts.length) return `<div class="panel"><p class="muted">The stall is closed tonight.</p></div>`;
  const c = S.closingToday;
  return `<div class="list">${info.shifts.map((s) => {
      const p = person(s.staff_id);
      const st = s.clock_out ? `Out at ${timeOf(s.clock_out)}` : s.clock_in ? `In since ${timeOf(s.clock_in)}` : 'Not clocked in';
      return `<div class="row">${avatar(p)}<div class="grow"><div class="title">${esc(p.name)}</div><div class="sub">${st}</div></div>
        ${s.clock_in && !s.clock_out ? '<span class="tag good">Working</span>' : ''}</div>`;
    }).join('') || '<div class="row"><div class="grow muted">Nobody on tonight</div></div>'}
    <div class="row"><div class="lead ${c ? 'pandan' : ''}">${icon(c ? 'check' : 'box')}</div><div class="grow">
      <div class="title">${c ? `Closed: ${money(c.sales)}` : 'Not closed yet'}</div>
      <div class="sub">${c ? `By ${esc(person(c.staff_id).name)} at ${timeOf(c.submitted_at)}${c.notes ? `. “${esc(c.notes)}”` : ''}` : `Shift is ${shiftTime()}`}</div></div></div>
  </div>`;
}

function week() {
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(S.today, i); const info = dayInfo(d); const dt = toDate(d);
    const open = info.open_pt + info.open_ft; const total = info.pt + info.ft;
    const f = !total ? '<span class="f shut">Shut</span>' : open ? `<span class="f gap">${open} open</span>` : '<span class="f">Full</span>';
    html += `<button class="${i === 0 ? 'today' : ''}" data-act="today-day" data-date="${d}" aria-label="${esc(shortDate(d))}"><span class="w">${DOW[dt.getDay()]}</span><span class="n">${dt.getDate()}</span>${f}</button>`;
  }
  return `<div class="week-strip">${html}</div>`;
}

export function render() {
  const list = items();
  return `${S.settings.push_live ? '' : '<div class="testbar" style="margin:0 0 16px">Test mode: notifications are held, and anything you change here is reset when you switch over from the old app.</div>'}
    <div class="page-head"><h1>Today</h1><p>${esc(longDate(S.today))}</p></div>
    <section><header class="sr"><h2>Needs you</h2></header>
    ${list.length ? `<div class="list">${list.map((i) => `
      <div class="row"><div class="lead ${i.tone}">${icon(i.ic)}</div>
        <div class="grow"><div class="title">${esc(i.title)}</div>${i.sub ? `<div class="sub">${esc(i.sub)}</div>` : ''}</div>
        ${i.btn ? `<div class="end"><button class="btn sm ${i.tone === 'berry' ? 'primary' : ''}" ${i.act}>${esc(i.btn)}</button></div>` : ''}</div>`).join('')}</div>`
      : `<div class="allclear">${icon('check')}<div><b>Nothing needs you right now.</b><p class="muted small">Shifts are covered and pay is up to date.</p></div></div>`}
    </section>
    <section class="section"><header><h2>Tonight</h2></header>${tonight()}</section>
    <section class="section"><header><h2>Next 7 days</h2><a class="link" href="#/schedule">Schedule</a></header>${week()}</section>`;
}

on('today-day', (el) => openDay(el.dataset.date));
on('today-go', (el) => go(el.dataset.to));
on('today-restock', async (el) => {
  const ids = el.dataset.ids.split(',').map(Number);
  await busy(el, async () => {
    for (const id of ids) {
      const it = S.stockItems.find((i) => i.id === id);
      if (it) await call('task_add', { type: 'shopping', item: it.name, note: 'From the close-out count' });
    }
    toast('Added to the shopping list');
    await reload(['tasks']);
  });
});
