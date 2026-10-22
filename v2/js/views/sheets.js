// Bottom sheets shared by several screens: close-out flow, stock, swaps, quick task.
import { call } from '../api.js';
import { S, shortDate, longDate, myShift, money, timeOf, person, shiftTime } from '../store.js';
import { esc, openSheet, updateSheet, closeSheet, sheetHead, on, busy, toast, ask } from '../ui.js';
import { after } from '../app.js';

// ── claim / swap ───────────────────────────────────────────────
on('claim', async (el) => {
  const date = el.dataset.date;
  const ok = await ask(`Claim ${shortDate(date)}?`, `${shiftTime()}. It goes on your schedule straight away.`, { yes: 'Claim shift' });
  if (!ok) return;
  await busy(el, async () => {
    await call('claim', { date });
    toast(`You’re on ${shortDate(date)}`);
    await after(['schedule', 'pay']);
  });
});

on('swap-take', async (el) => {
  const w = S.swaps.find((x) => String(x.id) === el.dataset.id);
  if (!w) return;
  const ok = await ask(`Take ${person(w.staff_id).name}’s shift?`, `${longDate(w.date)}. It becomes your shift right away.`, { yes: 'Take it' });
  if (!ok) return;
  await busy(el, async () => {
    await call('swap_take', { swap_id: w.id });
    toast(`${shortDate(w.date)} is yours`);
    await after(['schedule', 'pay']);
  });
});

on('swap-offer', (el) => {
  const shift = S.shifts.find((s) => s.id === el.dataset.id);
  if (!shift) return;
  openSheet(`${sheetHead('Can’t make it?', longDate(shift.date))}
    <form data-form="swap-offer-submit" data-id="${shift.id}">
      <p class="muted" style="margin-bottom:14px">Your crew gets a notification and anyone free can take it in one tap. You stay on the schedule until someone does, or the boss releases you.</p>
      <label class="field"><span>Reason (optional)</span>
        <input class="input" name="reason" maxlength="120" placeholder="e.g. family thing, exam" autocomplete="off"></label>
      <button class="btn primary block big" type="submit">Put it up for grabs</button>
    </form>`);
});
on('swap-offer-submit', async (form) => {
  await busy(form.querySelector('button[type=submit]'), async () => {
    await call('swap_offer', { shift_id: form.dataset.id, reason: form.reason.value });
    closeSheet();
    toast('Shift is up for grabs. Crew notified.');
    await after(['schedule']);
  });
});

on('swap-cancel', async (el) => {
  await busy(el, async () => {
    await call('swap_cancel', { swap_id: Number(el.dataset.id) });
    toast('Kept your shift');
    await after(['schedule']);
  });
});

// ── clock ──────────────────────────────────────────────────────
on('clock', async (el) => {
  const dir = el.dataset.dir;
  if (dir === 'out') {
    const ok = await ask('Clock out now?', S.closingToday ? '' : 'The stall hasn’t been closed out yet. Someone on shift still needs to do that.', { yes: 'Clock out' });
    if (!ok) return;
  }
  await busy(el, async () => {
    await call('clock', { dir });
    toast(dir === 'in' ? `Clocked in at ${timeOf(new Date())}` : 'Clocked out. Thanks!');
    await after(['schedule', 'pay']);
  });
});

// ── close-out flow ─────────────────────────────────────────────
let flow = null;
export function openCloseFlow() {
  const existing = Object.fromEntries(S.stockToday.map((c) => [c.item_id, c.level]));
  flow = {
    step: S.stockItems.length ? 1 : 2,
    levels: Object.fromEntries(S.stockItems.filter((i) => i.active).map((i) => [i.id, existing[i.id] || 'ok'])),
    sales: S.closingToday?.sales ?? '',
    notes: S.closingToday?.notes ?? '',
    clockOut: !!(myShift(S.today)?.clock_in && !myShift(S.today)?.clock_out),
  };
  openSheet(closeHtml(), { onClose: () => { flow = null; } });
}
on('close-open', () => openCloseFlow());

function closeHtml() {
  const items = S.stockItems.filter((i) => i.active);
  const hasStock = items.length > 0;
  const steps = hasStock ? `<div class="steps"><i class="on"></i><i class="${flow.step >= 2 ? 'on' : ''}"></i></div>` : '';
  if (flow.step === 1) {
    const flagged = Object.values(flow.levels).filter((v) => v !== 'ok').length;
    return `${sheetHead('Close the stall', 'Step 1 of 2: what’s running low?')}${steps}
      <p class="muted small" style="margin-bottom:12px">Everything starts as OK. Only tap what’s low or finished.</p>
      <div class="list">${items.map((i) => `
        <div class="row"><div class="grow"><div class="title">${esc(i.name)}</div>${i.unit ? `<div class="sub">${esc(i.unit)}</div>` : ''}</div>
          <div class="lvl" role="group" aria-label="${esc(i.name)} level">
            ${['ok', 'low', 'out'].map((l) => `<button type="button" class="${l} ${flow.levels[i.id] === l ? 'on' : ''}" data-act="close-lvl" data-id="${i.id}" data-l="${l}" aria-pressed="${flow.levels[i.id] === l}">${l === 'ok' ? 'OK' : l === 'low' ? 'Low' : 'Out'}</button>`).join('')}
          </div></div>`).join('')}</div>
      <div class="sheet-foot"><button class="btn primary block big" data-act="close-next">${flagged ? `Next: sales (${flagged} to restock)` : 'Next: sales'}</button></div>`;
  }
  return `${sheetHead('Close the stall', hasStock ? 'Step 2 of 2: tonight’s sales' : 'Tonight’s sales')}${steps}
    ${hasStock ? '' : '<p class="muted small" style="margin-bottom:12px">The stock list isn’t set up yet, so it’s just sales tonight.</p>'}
    <form data-form="close-submit">
      <label class="field"><span>Total sales</span>
        <div class="money-field"><em>RM</em><input class="input huge" name="sales" inputmode="decimal" autocomplete="off" required placeholder="0" value="${esc(flow.sales)}"></div></label>
      <label class="field"><span>Anything the boss should know? (optional)</span>
        <textarea class="input" name="notes" maxlength="500" placeholder="Broken stuff, weird night, cash short…">${esc(flow.notes || '')}</textarea></label>
      ${myShift(S.today)?.clock_in && !myShift(S.today)?.clock_out ? `
      <label class="row" style="padding:12px 0;border:0"><div class="grow"><div class="title">Clock me out too</div><div class="sub">Clocked in at ${timeOf(myShift(S.today).clock_in)}</div></div>
        <span class="toggle"><input type="checkbox" name="clock_out" ${flow.clockOut ? 'checked' : ''}><span></span></span></label>` : ''}
      <div class="sheet-foot">
        ${hasStock ? '<div class="btn-row"><button type="button" class="btn ghost" data-act="close-back">Back</button><button class="btn primary big" type="submit">Close the stall</button></div>'
          : '<button class="btn primary block big" type="submit">Close the stall</button>'}
      </div>
    </form>`;
}
on('close-lvl', (el) => {
  flow.levels[el.dataset.id] = el.dataset.l;
  const scroll = document.querySelector('#sheet .sheet-panel').scrollTop;
  updateSheet(closeHtml());
  document.querySelector('#sheet .sheet-panel').scrollTop = scroll;
});
on('close-next', () => { flow.step = 2; updateSheet(closeHtml()); });
on('close-back', () => {
  const f = document.querySelector('form[data-form="close-submit"]');
  if (f) { flow.sales = f.sales.value; flow.notes = f.notes.value; }
  flow.step = 1; updateSheet(closeHtml());
});
on('close-submit', async (form) => {
  const raw = form.sales.value.replace(/[^0-9.]/g, '');
  const sales = Number(raw);
  if (!raw || !Number.isFinite(sales)) { toast('Enter tonight’s sales as a number.', 'bad'); form.sales.focus(); return; }
  await busy(form.querySelector('button[type=submit]'), async () => {
    await call('close_submit', {
      sales,
      notes: form.notes.value,
      clock_out: !!form.clock_out?.checked,
      counts: Object.entries(flow.levels).map(([item_id, level]) => ({ item_id: Number(item_id), level })),
    });
    closeSheet();
    toast(`Stall closed: ${money(sales)}`);
    await after(['stock', 'schedule', 'pay', 'admin']);
  });
});

// ── quick stock report ─────────────────────────────────────────
function stockHtml() {
  const items = S.stockItems.filter((i) => i.active);
  const lv = Object.fromEntries(S.stockToday.map((c) => [c.item_id, c.level]));
  if (!items.length) {
    return `${sheetHead('Running low?')}<p class="muted">The boss hasn’t set up the stock list yet. Add it to the shopping list instead.</p>
      <div class="sheet-foot"><button class="btn primary block" data-act="task-quick" data-type="shopping">Add to shopping list</button></div>`;
  }
  return `${sheetHead('Running low?', 'Tap once. Marking something Out alerts the crew.')}
    <div class="list">${items.map((i) => {
      const cur = lv[i.id] || 'ok';
      return `<div class="row"><div class="grow"><div class="title">${esc(i.name)}</div></div>
        <div class="lvl">${['ok', 'low', 'out'].map((l) => `<button type="button" class="${l} ${cur === l ? 'on' : ''}" data-act="stock-set" data-id="${i.id}" data-l="${l}" aria-pressed="${cur === l}">${l === 'ok' ? 'OK' : l === 'low' ? 'Low' : 'Out'}</button>`).join('')}</div></div>`;
    }).join('')}</div>`;
}
on('stock-open', () => openSheet(stockHtml()));
on('stock-set', async (el) => {
  await busy(el, async () => {
    await call('stock_save', { counts: [{ item_id: Number(el.dataset.id), level: el.dataset.l }] });
    const item = S.stockItems.find((i) => String(i.id) === el.dataset.id);
    const existing = S.stockToday.find((c) => String(c.item_id) === el.dataset.id);
    if (existing) existing.level = el.dataset.l; else S.stockToday.push({ item_id: Number(el.dataset.id), level: el.dataset.l });
    updateSheet(stockHtml());
    toast(el.dataset.l === 'out' ? `${item?.name} marked out. Crew alerted.` : 'Saved');
  });
});

// ── quick task ─────────────────────────────────────────────────
export function taskSheet(type = 'shopping', prefill = '') {
  openSheet(`${sheetHead(type === 'shopping' ? 'Add to shopping list' : 'Report something to fix')}
    <form data-form="task-quick-submit" data-type="${type}">
      <label class="field"><span>${type === 'shopping' ? 'What do we need?' : 'What’s broken?'}</span>
        <input class="input" name="item" maxlength="120" required autocomplete="off" value="${esc(prefill)}" placeholder="${type === 'shopping' ? 'e.g. Nutella, paper cups' : 'e.g. left burner won’t light'}"></label>
      <label class="field"><span>Note (optional)</span><input class="input" name="note" maxlength="200" autocomplete="off"></label>
      <label class="row" style="padding:8px 0 14px;border:0"><div class="grow"><div class="title">Urgent</div><div class="sub">Pings everyone right away</div></div>
        <span class="toggle"><input type="checkbox" name="urgent"><span></span></span></label>
      <button class="btn primary block big" type="submit">${type === 'shopping' ? 'Add to list' : 'Report it'}</button>
    </form>`);
}
on('task-quick', (el) => taskSheet(el.dataset.type || 'shopping', el.dataset.prefill || ''));
on('task-quick-submit', async (form) => {
  await busy(form.querySelector('button[type=submit]'), async () => {
    await call('task_add', { type: form.dataset.type, item: form.item.value, note: form.note.value, urgent: form.urgent.checked });
    closeSheet();
    toast(form.urgent.checked ? 'Added. Everyone pinged.' : 'Added');
    await after(['tasks']);
  });
});

