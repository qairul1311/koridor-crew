// Shopping list + things to fix. Shared by crew and admin.
import { call } from '../api.js';
import { S, person, ago } from '../store.js';
import { esc, icon, on, busy, toast, empty, copyText, ask } from '../ui.js';
import { render as rerender, after as reload } from '../app.js';

let tab = 'shopping';
let showDone = false;

function card(t) {
  const p = person(t.added_by);
  const canDelete = t.added_by === S.me.id || S.me.is_admin;
  return `<div class="task ${t.done ? 'done' : ''} ${t.urgent && !t.done ? 'urgent' : ''}">
    <button class="check" data-act="task-toggle" data-id="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}: ${esc(t.item)}">${icon('check')}</button>
    <div class="grow" style="flex:1;min-width:0"><div class="t">${esc(t.item)}</div>${t.note ? `<div class="n">${esc(t.note)}</div>` : ''}
      <div class="m">${t.urgent && !t.done ? '<span class="tag bad">Urgent</span>' : ''}
        <span>${t.done ? `Done by ${esc(person(t.done_by).name)} ${ago(t.done_at)}` : `${esc(p.name)}, ${ago(t.created_at)}`}</span></div></div>
    ${canDelete ? `<button class="icon-btn" data-act="task-delete" data-id="${t.id}" aria-label="Delete ${esc(t.item)}">${icon('trash')}</button>` : ''}
  </div>`;
}

export function render() {
  const of = (type) => S.tasks.filter((t) => t.type === type);
  const open = of(tab).filter((t) => !t.done).sort((a, b) => (b.urgent - a.urgent) || b.created_at.localeCompare(a.created_at));
  const done = of(tab).filter((t) => t.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''));
  const count = (type) => of(type).filter((t) => !t.done).length;
  const shopping = tab === 'shopping';
  return `<div class="page-head bar"><h1>Tasks</h1>
      ${S.me.is_admin ? `<button class="btn sm ghost" data-act="tasks-copy">${icon('copy')}Copy list</button>` : ''}</div>
    <div class="seg" role="tablist">
      <button role="tab" class="${shopping ? 'on' : ''}" aria-selected="${shopping}" data-act="tasks-tab" data-t="shopping">${icon('cart')}To buy <span class="count">${count('shopping')}</span></button>
      <button role="tab" class="${!shopping ? 'on' : ''}" aria-selected="${!shopping}" data-act="tasks-tab" data-t="fix">${icon('wrench')}To fix <span class="count">${count('fix')}</span></button>
    </div>
    <form data-form="task-add" class="inline-form" style="margin:14px 0">
      <input class="input" name="item" maxlength="120" autocomplete="off" required placeholder="${shopping ? 'Add something to buy' : 'Report something broken'}" aria-label="New task">
      <button class="btn primary" type="submit" aria-label="Add">${icon('plus')}</button>
    </form>
    <label class="pill-note" style="margin:-4px 0 14px;display:flex;align-items:center;gap:10px">
      <span class="toggle"><input type="checkbox" id="taskUrgent"><span></span></span>Urgent, ping everyone</label>
    ${open.length ? `<div class="list">${open.map(card).join('')}</div>`
      : empty(shopping ? 'cart' : 'wrench', shopping ? 'Nothing to buy' : 'Nothing broken', shopping ? 'Add anything the stall is running out of.' : 'Report anything that needs fixing at the stall.')}
    ${done.length ? `<div class="section"><header><h2>Done</h2>
        <span>${S.me.is_admin ? `<button class="link" data-act="tasks-clear">Clear all</button> ` : ''}<button class="link" data-act="tasks-done">${showDone ? 'Hide' : `Show ${done.length}`}</button></span></header>
        ${showDone ? `<div class="list">${done.map(card).join('')}</div>` : ''}</div>` : ''}`;
}

on('tasks-tab', (el) => { tab = el.dataset.t; rerender(); });
on('tasks-done', () => { showDone = !showDone; rerender(); });
on('task-add', async (form) => {
  const urgent = document.getElementById('taskUrgent')?.checked;
  await busy(form.querySelector('button'), async () => {
    await call('task_add', { type: tab, item: form.item.value, urgent });
    form.reset();
    toast(urgent ? 'Added. Everyone pinged.' : 'Added');
    await reload(['tasks']);
  });
});
on('task-toggle', async (el) => {
  const t = S.tasks.find((x) => String(x.id) === el.dataset.id);
  if (t) { t.done = !t.done; t.done_by = S.me.id; t.done_at = new Date().toISOString(); rerender(); }
  await busy(null, async () => { await call('task_toggle', { id: Number(el.dataset.id) }); await reload(['tasks']); });
});
on('task-delete', async (el) => {
  if (!(await ask('Delete this task?', '', { yes: 'Delete', danger: true }))) return;
  await busy(el, async () => { await call('task_delete', { id: Number(el.dataset.id) }); await reload(['tasks']); });
});
on('tasks-clear', async (el) => {
  const ids = S.tasks.filter((t) => t.done).map((t) => t.id);
  if (!(await ask(`Clear ${ids.length} done ${ids.length === 1 ? 'task' : 'tasks'}?`, '', { yes: 'Clear' }))) return;
  await busy(el, async () => { await call('task_clear_done', { ids }); await reload(['tasks']); });
});
on('tasks-copy', async () => {
  const lines = (type) => S.tasks.filter((t) => t.type === type && !t.done)
    .map((t) => `${t.urgent ? '🚨' : '•'} ${t.item}${t.note ? ` (${t.note})` : ''}`).join('\n');
  const buy = lines('shopping'); const fix = lines('fix');
  const text = [buy && `🛒 To buy\n${buy}`, fix && `🔧 To fix\n${fix}`].filter(Boolean).join('\n\n') || 'Nothing on the list ✅';
  await copyText(text);
  toast('Copied for WhatsApp');
});
