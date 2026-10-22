// Month schedule. Staff claim from here; the admin taps a day to manage it.
import { call } from '../api.js';
import { S, apply, monthOf, monthLabel, monthDays, shiftMonth, toDate, dow, DOW, DOW_LONG, longDate, shortDate,
  dayInfo, person, crew, isAvailable, myShift, swapFor, timeOf, addDays, MONTHS } from '../store.js';
import { esc, icon, avatar, on, openSheet, updateSheet, closeSheet, sheetHead, busy, toast, ask } from '../ui.js';
import { render as rerender, after as reload } from '../app.js';
import './sheets.js';

let ym = null;
let loadingMonth = null;

function ensureMonth() {
  if (!ym) ym = monthOf(S.today);
  const days = monthDays(ym);
  const from = days[0]; const to = days[days.length - 1];
  if (S.range && from >= S.range.from && to <= S.range.to) return true;
  if (loadingMonth !== ym) {
    loadingMonth = ym;
    call('boot', { parts: ['schedule'], from, to }).then((d) => { apply(d); loadingMonth = null; rerender(); })
      .catch((e) => { loadingMonth = null; toast(e.message, 'bad'); });
  }
  return false;
}

function chip(s) {
  const p = person(s.staff_id); const me = s.staff_id === S.me.id && !S.me.is_admin;
  const w = swapFor(s.id);
  return `<span class="chip ${me ? 'me' : ''} ${s.kind === 'ft' ? 'ft' : ''} ${w ? 'swap' : ''}" title="${w ? 'Up for grabs' : ''}">${avatar(p, 'sm')}${esc(me ? 'You' : p.name)}</span>`;
}

function dayRow(date) {
  const info = dayInfo(date);
  const d = toDate(date); const wd = d.getDay();
  const past = date < S.today; const isToday = date === S.today;
  const closed = !info.open && !info.shifts.length;
  const cls = `day ${isToday ? 'today' : ''} ${past ? 'past' : ''} ${closed ? 'closed' : ''}`;
  const dn = `<div class="dn"><div class="n">${d.getDate()}</div><div class="w ${wd === 0 || wd === 6 ? 'we' : ''}">${DOW[wd]}</div></div>`;
  let body = '';
  if (closed) body = '<div class="closed-txt">Closed</div>';
  else {
    const chips = info.shifts.map(chip);
    if (!S.me.is_admin) {
      if (!past && info.open_pt > 0 && !myShift(date)) {
        chips.push(`<button class="chip open claim" data-act="claim" data-date="${date}">${icon('plus')}Claim${info.open_pt > 1 ? ` (${info.open_pt} open)` : ''}</button>`);
      } else if (info.open_pt > 0 && !past) {
        chips.push(`<span class="chip open">${info.open_pt} open</span>`);
      }
    } else {
      const open = info.open_pt + info.open_ft;
      if (open > 0 && !past) chips.push(`<span class="chip open" style="border-color:var(--berry);color:var(--berry)">${open} open</span>`);
    }
    body = `<div class="chips">${chips.join('') || '<span class="faint small">No one yet</span>'}</div>`;
  }
  if (info.note) body += `<div class="note">${icon('megaphone')}<span>${esc(info.note)}</span></div>`;
  if (S.me.is_admin) {
    return `<button class="${cls}" data-act="day-open" data-date="${date}" aria-label="${esc(longDate(date))}">${dn}<div>${body}</div></button>`;
  }
  return `<div class="${cls}">${dn}<div>${body}</div></div>`;
}

export function render() {
  if (!ensureMonth()) return `<div class="loading"><span class="spinner"></span>Loading ${esc(monthLabel(ym))}…</div>`;
  const days = monthDays(ym);
  let open = 0; let filled = 0; let mine = 0;
  for (const d of days) {
    const i = dayInfo(d);
    filled += i.shifts.length;
    if (d >= S.today) open += S.me.is_admin ? i.open_pt + i.open_ft : i.open_pt;
    if (i.shifts.some((s) => s.staff_id === S.me.id)) mine++;
  }
  const summary = S.me.is_admin
    ? `${filled} shifts filled. ${open ? `${open} still open.` : 'Nothing open.'}`
    : `You’re on ${mine} ${mine === 1 ? 'night' : 'nights'} this month. ${open ? `${open} ${open === 1 ? 'slot' : 'slots'} still open.` : ''}`;

  // weeks start on Monday
  let html = ''; let lastWeek = null;
  for (const d of days) {
    const dt = toDate(d); const monday = addDays(d, -((dt.getDay() + 6) % 7));
    if (monday !== lastWeek) {
      lastWeek = monday;
      const m = toDate(monday);
      html += `<div class="week-label">Week of ${m.getDate()} ${MONTHS[m.getMonth()].slice(0, 3)}</div>`;
    }
    html += dayRow(d);
  }

  return `<div class="month-bar"><h1>${esc(monthLabel(ym))}</h1>
      <div class="nav-btns">
        <button class="icon-btn" data-act="month" data-d="-1" aria-label="Previous month">${icon('back')}</button>
        ${ym !== monthOf(S.today) ? `<button class="btn sm ghost" data-act="month" data-d="0">Today</button>` : ''}
        <button class="icon-btn" data-act="month" data-d="1" aria-label="Next month">${icon('next')}</button>
      </div></div>
    <p class="muted" style="margin:-6px 0 6px">${summary}</p>
    ${S.me.is_admin ? `<div class="btn-row" style="margin:12px 0 4px"><button class="btn" data-act="bulk-open">${icon('calendar')}Set up the month</button></div>` : ''}
    ${html}`;
}

export function mounted() {
  if (ym === monthOf(S.today)) {
    const el = document.querySelector('.day.today');
    if (el && window.scrollY === 0) el.scrollIntoView({ block: 'center' });
  }
}

on('month', (el) => {
  const d = Number(el.dataset.d);
  ym = d === 0 ? monthOf(S.today) : shiftMonth(ym, d);
  rerender({ keepScroll: false });
  window.scrollTo(0, 0);
});

// ── admin: one day ─────────────────────────────────────────────
let openDate = null;
function daySheet() {
  const info = dayInfo(openDate);
  const onDay = new Set(info.shifts.map((s) => s.staff_id));
  const people = crew().filter((p) => !onDay.has(p.id))
    .sort((a, b) => (isAvailable(b.id, openDate) - isAvailable(a.id, openDate)) || a.name.localeCompare(b.name));
  const total = info.pt + info.ft;
  const past = openDate < S.today;
  const stepper = (kind, val, min) => `<div class="stepper">
      <button type="button" data-act="day-slots" data-kind="${kind}" data-v="${val - 1}" ${val <= min ? 'disabled' : ''} aria-label="Fewer">${icon('minus')}</button>
      <output>${val}</output>
      <button type="button" data-act="day-slots" data-kind="${kind}" data-v="${val + 1}" ${val >= 6 ? 'disabled' : ''} aria-label="More">${icon('plus')}</button></div>`;

  return `${sheetHead(longDate(openDate), total ? `${info.shifts.length} of ${total} filled` : 'Closed')}
    <div class="list">
      <div class="row"><div class="grow"><div class="title">Part-time slots</div><div class="sub">Crew can claim these</div></div>${stepper('pt', info.pt, info.pt_shifts.length)}</div>
      <div class="row"><div class="grow"><div class="title">Full-time slots</div><div class="sub">You assign these</div></div>${stepper('ft', info.ft, info.ft_shifts.length)}</div>
    </div>

    <section class="section"><header><h2>On this day</h2></header>
    ${info.shifts.length ? `<div class="list">${info.shifts.map((s) => {
      const p = person(s.staff_id); const w = swapFor(s.id);
      const times = s.clock_in ? `In ${timeOf(s.clock_in)}${s.clock_out ? `, out ${timeOf(s.clock_out)}` : ''}` : (past ? 'No clock-in' : '');
      return `<div class="row">${avatar(p)}<div class="grow"><div class="title">${esc(p.name)} <span class="tag">${s.kind === 'ft' ? 'FT' : 'PT'}</span>${w ? ' <span class="tag bad">Wants off</span>' : ''}</div>
        ${times || w?.reason ? `<div class="sub">${esc([times, w?.reason].filter(Boolean).join('. '))}</div>` : ''}</div>
        <div class="end">${w ? `<button class="btn sm" data-act="swap-release" data-id="${w.id}">Release</button>` : ''}
        <button class="icon-btn" data-act="unassign" data-id="${s.id}" aria-label="Remove ${esc(p.name)}">${icon('x')}</button></div></div>`;
    }).join('')}</div>` : '<p class="muted">No one yet.</p>'}
    </section>

    <section class="section"><header><h2>Add someone</h2></header>
    ${people.length ? `<div class="list">${people.map((p) => {
      const off = !isAvailable(p.id, openDate);
      return `<button class="row" data-act="assign" data-id="${p.id}">${avatar(p)}<div class="grow"><div class="title">${esc(p.name)}</div>
        <div class="sub">${p.employment === 'ft' ? 'Full-time' : 'Part-time'}${off ? `. Usually off on ${DOW_LONG[dow(openDate)]}s` : ''}</div></div>
        <div class="end">${off ? '<span class="tag warn">Day off</span>' : ''}${icon('plus', 'chev')}</div></button>`;
    }).join('')}</div>` : '<p class="muted">Everyone’s already on.</p>'}
    </section>

    <section class="section"><header><h2>Note for the crew</h2></header>
      <form data-form="day-note" class="inline-form">
        <input class="input" name="note" maxlength="200" value="${esc(info.note || '')}" placeholder="e.g. Event at Boomtown, expect a rush" autocomplete="off">
        <button class="btn" type="submit">Save</button>
      </form></section>`;
}
function redrawDay() {
  const panel = document.querySelector('#sheet .sheet-panel');
  const y = panel ? panel.scrollTop : 0;
  updateSheet(daySheet());
  const p2 = document.querySelector('#sheet .sheet-panel'); if (p2) p2.scrollTop = y;
}
on('day-open', (el) => { openDate = el.dataset.date; openSheet(daySheet(), { onClose: () => { openDate = null; rerender(); } }); });
export function openDay(date) { openDate = date; openSheet(daySheet(), { onClose: () => { openDate = null; rerender(); } }); }

async function refreshDay() {
  await reload(['schedule', 'admin']);
  if (openDate) redrawDay();
}
on('day-slots', async (el) => {
  const info = dayInfo(openDate);
  const args = { date: openDate, pt: info.pt, ft: info.ft };
  args[el.dataset.kind] = Number(el.dataset.v);
  await busy(el, async () => { await call('day_set', args); await refreshDay(); });
});
on('assign', async (el) => {
  const p = person(el.dataset.id);
  await busy(el, async () => {
    await call('assign', { date: openDate, staff_id: p.id, kind: p.employment === 'ft' ? 'ft' : 'pt' });
    toast(`${p.name} is on ${shortDate(openDate)}`);
    await refreshDay();
  });
});
on('unassign', async (el) => {
  const s = S.shifts.find((x) => x.id === el.dataset.id);
  if (!s) return;
  const p = person(s.staff_id);
  if (!(await ask(`Take ${p.name} off ${shortDate(s.date)}?`, 'Any unpaid pay for that shift is removed too.', { yes: 'Remove', danger: true }))) return;
  await busy(el, async () => { await call('unassign', { shift_id: s.id }); toast(`${p.name} removed`); await refreshDay(); });
});
on('swap-release', async (el) => {
  const w = S.swaps.find((x) => String(x.id) === el.dataset.id);
  if (!w) return;
  const p = person(w.staff_id);
  if (!(await ask(`Release ${p.name}?`, `${shortDate(w.date)} becomes an open slot and the crew is told.`, { yes: 'Release' }))) return;
  await busy(el, async () => { await call('swap_release', { swap_id: w.id }); toast(`${p.name} is off ${shortDate(w.date)}`); await refreshDay(); });
});
on('day-note', async (form) => {
  const info = dayInfo(openDate);
  await busy(form.querySelector('button'), async () => {
    await call('day_set', { date: openDate, pt: info.pt, ft: info.ft, note: form.note.value });
    toast('Note saved'); await refreshDay();
  });
});

// ── admin: bulk month setup ────────────────────────────────────
let bulk = null;
function bulkSheet() {
  const days = monthDays(bulk.ym).filter((d) => d >= S.today);
  const hit = days.filter((d) => bulk.dows.has(dow(d)));
  const st = (kind) => `<div class="stepper">
    <button type="button" data-act="bulk-step" data-kind="${kind}" data-d="-1" ${bulk[kind] <= 0 ? 'disabled' : ''} aria-label="Fewer">${icon('minus')}</button>
    <output>${bulk[kind]}</output>
    <button type="button" data-act="bulk-step" data-kind="${kind}" data-d="1" ${bulk[kind] >= 6 ? 'disabled' : ''} aria-label="More">${icon('plus')}</button></div>`;
  return `${sheetHead('Set up the month', monthLabel(bulk.ym))}
    <p class="muted small" style="margin-bottom:12px">Pick which days, then how many people. Days already past are left alone. Setting both to 0 marks the day closed.</p>
    <div class="field"><span>Which days</span>
      <div class="week-toggles">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<button type="button" class="${bulk.dows.has(w) ? 'on' : ''}" data-act="bulk-dow" data-w="${w}" aria-pressed="${bulk.dows.has(w)}">${DOW[w]}</button>`).join('')}</div></div>
    <div class="list">
      <div class="row"><div class="grow"><div class="title">Part-time slots</div></div>${st('pt')}</div>
      <div class="row"><div class="grow"><div class="title">Full-time slots</div></div>${st('ft')}</div>
    </div>
    <div class="sheet-foot"><button class="btn primary block big" data-act="bulk-apply" ${hit.length ? '' : 'disabled'}>Apply to ${hit.length} ${hit.length === 1 ? 'day' : 'days'}</button></div>`;
}
on('bulk-open', () => {
  bulk = { ym, dows: new Set([0, 1, 2, 4, 5, 6]), pt: 1, ft: 1 };
  openSheet(bulkSheet(), { onClose: () => { bulk = null; } });
});
on('bulk-dow', (el) => { const w = Number(el.dataset.w); bulk.dows.has(w) ? bulk.dows.delete(w) : bulk.dows.add(w); updateSheet(bulkSheet()); });
on('bulk-step', (el) => { bulk[el.dataset.kind] = Math.max(0, Math.min(6, bulk[el.dataset.kind] + Number(el.dataset.d))); updateSheet(bulkSheet()); });
on('bulk-apply', async (el) => {
  const days = monthDays(bulk.ym);
  const from = days[0] < S.today ? S.today : days[0];
  await busy(el, async () => {
    const r = await call('days_bulk', { from, to: days[days.length - 1], dows: [...bulk.dows], pt: bulk.pt, ft: bulk.ft });
    closeSheet();
    toast(r.skipped ? `Updated ${r.updated} days. ${r.skipped} kept their slots because people are already on.` : `Updated ${r.updated} days`);
    await reload(['schedule', 'admin']);
  });
});
