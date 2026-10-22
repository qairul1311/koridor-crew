// Staff home: the one thing to do next, then quick ways to grab shifts.
import { S, toDate, relDay, whenLabel, shortDate, shiftTime, timeOf, myShift, myUpcoming, shiftsOn, person, claimableDays,
  swapFor, isAvailable, diffDays, DOW, money } from '../store.js';
import { esc, icon, avatar } from '../ui.js';
import './sheets.js';

function chipFor(s) {
  const p = person(s.staff_id);
  const me = s.staff_id === S.me.id;
  return `<span class="chip ${me ? 'me' : ''} ${s.kind === 'ft' ? 'ft' : ''}">${avatar(p, 'sm')}${esc(me ? 'You' : p.name)}</span>`;
}

function ticket() {
  const t = S.today;
  const mine = myShift(t);
  const next = myUpcoming().find((s) => s.date !== t);

  if (mine) {
    const others = shiftsOn(t).sort((a, b) => (a.staff_id === S.me.id ? -1 : b.staff_id === S.me.id ? 1 : 0));
    const closing = S.closingToday;
    let state = ''; let actions = '';
    if (closing) {
      state = `<p class="state">${icon('check')}Stall closed at ${timeOf(closing.submitted_at)}${closing.sales != null ? `, ${money(closing.sales)}` : ''}</p>`;
      actions = mine.clock_in && !mine.clock_out
        ? `<button class="btn primary big" data-act="clock" data-dir="out">Clock out</button>`
        : `<p class="muted">Done for tonight. Thanks!</p>`;
    } else if (!mine.clock_in) {
      state = `<p class="state idle">${icon('today')}Not clocked in yet</p>`;
      actions = `<button class="btn primary big" data-act="clock" data-dir="in">Clock in</button>
        ${swapFor(mine.id) ? `<button class="btn ghost" data-act="swap-cancel" data-id="${swapFor(mine.id).id}">Keep my shift (it’s up for grabs)</button>`
          : `<button class="btn ghost" data-act="swap-offer" data-id="${mine.id}">Can’t make it</button>`}`;
    } else {
      state = `<p class="state">${icon('check')}Clocked in at ${timeOf(mine.clock_in)}${mine.clock_out ? `, out at ${timeOf(mine.clock_out)}` : ''}</p>`;
      actions = `<button class="btn primary big" data-act="close-open">Close the stall</button>
        ${!mine.clock_out ? '<button class="btn ghost" data-act="clock" data-dir="out">Clock out without closing</button>' : ''}`;
    }
    return `<article class="ticket" aria-label="Tonight's shift">
      <div class="stub"><div class="date-num">${toDate(t).getDate()}</div>
        <div class="date-meta"><div class="kicker">You’re on</div><div class="when">Tonight</div><div class="hours">${shiftTime()}</div></div></div>
      <div class="perf"></div>
      <div class="crew-on">${others.map(chipFor).join('')}</div>
      ${state}<div class="actions">${actions}</div></article>`;
  }

  if (next) {
    const n = diffDays(t, next.date);
    const w = swapFor(next.id);
    const crewOn = shiftsOn(next.date);
    return `<article class="ticket" aria-label="Next shift">
      <div class="stub"><div class="date-num">${toDate(next.date).getDate()}</div>
        <div class="date-meta"><div class="kicker">${n === 1 ? 'Next shift' : `Next shift, in ${n} days`}</div>
        <div class="when">${esc(relDay(next.date))}</div><div class="hours">${shiftTime()}</div></div></div>
      <div class="perf"></div>
      <div class="crew-on">${crewOn.map(chipFor).join('')}</div>
      <div class="actions">${w
        ? `<p class="state" style="color:var(--berry)">${icon('swap')}Up for grabs. Waiting for someone to take it.</p>
           <button class="btn" data-act="swap-cancel" data-id="${w.id}">Keep my shift</button>`
        : `<button class="btn ghost" data-act="swap-offer" data-id="${next.id}">Can’t make it</button>`}</div>
    </article>`;
  }

  return `<article class="ticket quiet" aria-label="No shifts">
    <div class="stub"><div class="date-num">${toDate(t).getDate()}</div>
      <div class="date-meta"><div class="kicker">Nothing booked</div><div class="when">Grab a shift</div><div class="hours">${shiftTime()}</div></div></div>
    <div class="perf"></div>
    <div class="actions"><a class="btn primary big" href="#/schedule">See the schedule</a></div>
  </article>`;
}

function upForGrabs() {
  const list = S.swaps.filter((w) => w.staff_id !== S.me.id && w.date >= S.today);
  if (!list.length) return '';
  return `<section class="section"><header><h2>Up for grabs</h2></header><div class="list">${list.map((w) => {
    const p = person(w.staff_id);
    const busy = !!myShift(w.date);
    return `<div class="row">${avatar(p)}<div class="grow"><div class="title">${esc(whenLabel(w.date))}</div>
      <div class="sub">${esc(p.name)} can’t make it${w.reason ? `: ${esc(w.reason)}` : ''}</div></div>
      <div class="end">${busy ? '<span class="tag">You’re on</span>' : `<button class="btn primary sm" data-act="swap-take" data-id="${w.id}">Take it</button>`}</div></div>`;
  }).join('')}</div></section>`;
}

function openSlots() {
  const days = claimableDays(21);
  if (!days.length) return '';
  return `<section class="section"><header><h2>Open slots</h2><a class="link" href="#/schedule">Full schedule</a></header>
    <div class="rail">${days.map((d) => {
      const dt = toDate(d.date); const off = !isAvailable(S.me.id, d.date);
      return `<button class="slot-tile ${off ? 'off' : ''}" data-act="claim" data-date="${d.date}" aria-label="Claim ${esc(shortDate(d.date))}">
        <div class="d">${DOW[dt.getDay()]}</div><div class="n">${dt.getDate()}</div>
        <div class="o">${off ? 'Your day off' : `${d.open_pt} open`}</div></button>`;
    }).join('')}</div></section>`;
}

function upcoming() {
  const t = S.today; const first = myShift(t) ? null : myUpcoming().find((s) => s.date !== t);
  const list = myUpcoming().filter((s) => s.date !== t && s !== first).slice(0, 6);
  if (!list.length) return '';
  return `<section class="section"><header><h2>Your other shifts</h2></header><div class="list">${list.map((s) => {
    const w = swapFor(s.id); const dt = toDate(s.date);
    return `<div class="row"><div class="lead honey"><b style="font-family:var(--display)">${dt.getDate()}</b></div>
      <div class="grow"><div class="title">${esc(whenLabel(s.date))}</div>
      <div class="sub">${shiftTime()}${s.kind === 'ft' ? ', full-time' : ''}</div></div>
      <div class="end">${w ? `<button class="btn sm" data-act="swap-cancel" data-id="${w.id}">Keep it</button>`
        : `<button class="icon-btn" data-act="swap-offer" data-id="${s.id}" aria-label="Can't make ${esc(shortDate(s.date))}">${icon('swap')}</button>`}</div></div>`;
  }).join('')}</div></section>`;
}

export function render() {
  const h = new Date().getHours();
  const hi = h < 12 ? 'Morning' : h < 17 ? 'Hey' : h < 20 ? 'Evening' : 'Night';
  return `<div class="page-head"><h1>${hi}, ${esc(S.me.name)}</h1></div>
    ${ticket()}
    ${upForGrabs()}
    ${openSlots()}
    ${upcoming()}
    <section class="section"><header><h2>Quick</h2></header><div class="quick">
      <button data-act="stock-open">${icon('box')}<span>Something’s running low</span></button>
      <button data-act="task-quick" data-type="shopping">${icon('cart')}<span>Add to shopping list</span></button>
    </div></section>`;
}
