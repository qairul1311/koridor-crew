// Admin pay run: who's owed what, mark paid, send the slip.
import { call } from '../api.js';
import { S, money, shortDate, longDate, person, crew, toDate, DOW, dow } from '../store.js';
import { esc, icon, avatar, on, openSheet, closeSheet, sheetHead, busy, toast, ask, copyText, empty } from '../ui.js';
import { render as rerender, after as reload } from '../app.js';
import { nextPayday } from './me.js';

let open = null; // staff id expanded
let showPaid = false;

const sum = (a) => a.reduce((s, p) => s + Number(p.amount), 0);

function groups() {
  const pays = (S.admin?.payments || []).filter((p) => !p.paid && p.date <= S.today);
  const by = new Map();
  for (const p of pays) { if (!by.has(p.staff_id)) by.set(p.staff_id, []); by.get(p.staff_id).push(p); }
  return [...by.entries()].map(([id, rows]) => ({ p: person(id), rows: rows.sort((a, b) => a.date.localeCompare(b.date)), total: sum(rows) }))
    .sort((a, b) => b.total - a.total);
}

function slip(g) {
  const lines = g.rows.map((p) => `• ${DOW[dow(p.date)]} ${toDate(p.date).getDate()}/${toDate(p.date).getMonth() + 1}${p.kind === 'extra' ? ` (${p.note || 'extra'})` : ''}: ${money(p.amount)}`).join('\n');
  return `Hi ${g.p.name}, your pay from Koridor:\n\n${lines}\n\nTotal: *${money(g.total)}* for ${g.rows.length} ${g.rows.length === 1 ? 'shift' : 'shifts'}.\nSent by DuitNow. Thanks for your hard work! 🥞`;
}

export function render() {
  const gs = groups();
  const total = sum(gs.flatMap((g) => g.rows));
  const booked = (S.admin?.payments || []).filter((p) => !p.paid && p.date > S.today);
  const paid = (S.admin?.payments || []).filter((p) => p.paid).sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const pd = nextPayday();

  return `<div class="page-head bar"><div><h1>Pay</h1><p>${pd === S.today ? 'Payday is today' : `Next payday: ${longDate(pd)}`}</p></div>
      <button class="btn sm" data-act="pay-extra">${icon('plus')}Extra pay</button></div>
    <div class="owed"><p class="muted">Owed for shifts already worked</p><div class="big">${money(total)}</div>
      <div class="split"><div><b>${gs.length}</b><span>${gs.length === 1 ? 'person' : 'people'}</span></div>
      <div><b>${money(sum(booked))}</b><span>Coming from ${booked.length} booked ${booked.length === 1 ? 'shift' : 'shifts'}</span></div></div></div>

    <section class="section"><header><h2>Pay run</h2></header>
    ${gs.length ? `<div class="list">${gs.map((g) => `
      <button class="row" data-act="pay-open" data-id="${g.p.id}" aria-expanded="${open === g.p.id}">${avatar(g.p)}
        <div class="grow"><div class="title">${esc(g.p.name)}</div><div class="sub">${g.rows.length} ${g.rows.length === 1 ? 'shift' : 'shifts'}, since ${esc(shortDate(g.rows[0].date))}</div></div>
        <div class="end"><span class="amount">${money(g.total)}</span>${icon(open === g.p.id ? 'minus' : 'next', 'chev')}</div></button>
      ${open === g.p.id ? `<div style="padding:4px 14px 14px;border-bottom:1px solid var(--line-soft)">
        <div class="chips" style="margin-bottom:12px">${g.rows.map((p) => `<span class="chip" style="padding:0 10px">${esc(shortDate(p.date))}${p.kind === 'extra' ? ' extra' : ''} ${money(p.amount)}</span>`).join('')}</div>
        <div class="btn-row"><button class="btn primary" data-act="pay-mark" data-id="${g.p.id}">${icon('check')}Mark ${money(g.total)} paid</button>
          <button class="btn" data-act="pay-slip" data-id="${g.p.id}">${icon('copy')}Copy slip</button></div></div>` : ''}`).join('')}</div>`
      : `<div class="allclear">${icon('check')}<div><b>Everyone’s paid.</b><p class="muted small">New shifts show up here once they’re worked.</p></div></div>`}
    </section>

    <section class="section"><header><h2>Recently paid</h2><button class="link" data-act="pay-toggle-paid">${showPaid ? 'Hide' : `Show ${paid.length}`}</button></header>
      ${showPaid ? (paid.length ? `<div class="list">${paid.slice(0, 60).map((p) => `
        <div class="row">${avatar(person(p.staff_id), 'sm')}<div class="grow"><div class="title">${esc(person(p.staff_id).name)}, ${esc(shortDate(p.date))}</div>
          <div class="sub">Paid ${esc(shortDate(p.paid_at.slice(0, 10)))}${p.method ? ` by ${esc(p.method)}` : ''}${p.reference ? `, ref ${esc(p.reference)}` : ''}</div></div>
          <div class="end"><span class="amount" style="font-size:16px">${money(p.amount)}</span>
          <button class="icon-btn" data-act="pay-undo" data-id="${p.id}" aria-label="Undo payment">${icon('back')}</button></div></div>`).join('')}</div>`
        : empty('wallet', 'Nothing paid in the last 45 days', '')) : ''}
    </section>`;
}

on('pay-open', (el) => { open = open === el.dataset.id ? null : el.dataset.id; rerender(); });
on('pay-toggle-paid', () => { showPaid = !showPaid; rerender(); });
on('pay-slip', async (el) => {
  const g = groups().find((x) => x.p.id === el.dataset.id);
  if (!g) return;
  await copyText(slip(g));
  toast(`Slip for ${g.p.name} copied`);
});
on('pay-mark', (el) => {
  const g = groups().find((x) => x.p.id === el.dataset.id);
  if (!g) return;
  openSheet(`${sheetHead(`Pay ${g.p.name}`, `${g.rows.length} ${g.rows.length === 1 ? 'shift' : 'shifts'}, ${money(g.total)}`)}
    <form data-form="pay-mark-submit" data-id="${g.p.id}">
      <div class="field"><span>Paid by</span>
        <div class="seg" role="radiogroup">${['DuitNow', 'Bank transfer', 'Cash'].map((m, i) => `
          <label style="flex:1;display:flex"><input class="sr" type="radio" name="method" value="${m}" ${i === 0 ? 'checked' : ''}><span class="btn sm ghost" style="flex:1;border:0">${m}</span></label>`).join('')}</div></div>
      <label class="field"><span>Reference (optional)</span><input class="input" name="reference" maxlength="60" autocomplete="off" placeholder="Transfer ref"></label>
      <label class="row" style="padding:6px 0 14px;border:0"><div class="grow"><div class="title">Copy the pay slip too</div><div class="sub">Paste it into WhatsApp after</div></div>
        <span class="toggle"><input type="checkbox" name="copy" checked><span></span></span></label>
      <button class="btn primary block big" type="submit">Mark ${money(g.total)} paid</button>
    </form>`);
  document.querySelectorAll('#sheet input[name=method]').forEach((r) => {
    const paint = () => document.querySelectorAll('#sheet input[name=method]').forEach((x) => { x.nextElementSibling.classList.toggle('primary', x.checked); x.nextElementSibling.classList.toggle('ghost', !x.checked); });
    r.addEventListener('change', paint); paint();
  });
});
on('pay-mark-submit', async (form) => {
  const g = groups().find((x) => x.p.id === form.dataset.id);
  if (!g) return;
  await busy(form.querySelector('button[type=submit]'), async () => {
    if (form.copy.checked) await copyText(slip(g));
    await call('pay_mark', { ids: g.rows.map((p) => p.id), method: form.method.value, reference: form.reference.value });
    closeSheet(); open = null;
    toast(form.copy.checked ? `${g.p.name} paid. Slip copied.` : `${g.p.name} paid`);
    await reload(['admin', 'pay']);
  });
});
on('pay-undo', async (el) => {
  if (!(await ask('Undo this payment?', 'It goes back to owed.', { yes: 'Undo' }))) return;
  await busy(el, async () => { await call('pay_undo', { id: Number(el.dataset.id) }); await reload(['admin', 'pay']); });
});
on('pay-extra', () => {
  openSheet(`${sheetHead('Extra pay', 'Bonus, overtime, catering help, transport')}
    <form data-form="pay-extra-submit">
      <label class="field"><span>Who</span><select class="input" name="staff" required>
        <option value="">Choose crew</option>${crew().map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Amount</span><div class="money-field"><em>RM</em><input class="input huge" name="amount" inputmode="decimal" required placeholder="0" autocomplete="off"></div></label>
      <label class="field"><span>What for</span><input class="input" name="note" maxlength="80" required placeholder="e.g. Catering on Sunday" autocomplete="off"></label>
      <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${S.today}" max="${S.today}"></label>
      <button class="btn primary block big" type="submit">Add to pay run</button>
    </form>`);
});
on('pay-extra-submit', async (form) => {
  const amount = Number(form.amount.value.replace(/[^0-9.]/g, ''));
  if (!amount) { toast('Enter an amount in RM.', 'bad'); return; }
  await busy(form.querySelector('button[type=submit]'), async () => {
    await call('pay_add', { staff_id: form.staff.value, amount, note: form.note.value, date: form.date.value });
    closeSheet(); toast('Added to the pay run');
    await reload(['admin', 'pay']);
  });
});

