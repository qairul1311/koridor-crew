// App state + pure helpers. Dates are always 'YYYY-MM-DD' strings handled in
// local time — never toISOString(), which is what shifted v1's dates by a day.

export const S = {
  me: null,
  today: null,
  settings: {},
  staff: [],
  days: {},          // date -> { pt, ft, note }
  shifts: [],
  swaps: [],
  availability: [],
  tasks: [],
  stockItems: [],
  stockToday: [],
  closingToday: null,
  myPay: [],
  chat: { last_id: 0, unread: 0 },
  messages: [],
  admin: null,
  range: null,
  loaded: false,
};

// ── dates ──────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function toDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function key(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function addDays(s, n) { const d = toDate(s); d.setDate(d.getDate() + n); return key(d); }
export function dow(s) { return toDate(s).getDay(); }
export function diffDays(a, b) { return Math.round((toDate(b) - toDate(a)) / 86400000); }
export function shortDate(s) { const d = toDate(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; }
export function longDate(s) { const d = toDate(s); return `${DOW_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
export function monthOf(s) { return s.slice(0, 7); }
export function monthLabel(ym) { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; }
export function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number);
  const out = []; const d = new Date(y, m - 1, 1);
  while (d.getMonth() === m - 1) { out.push(key(d)); d.setDate(d.getDate() + 1); }
  return out;
}
export function shiftMonth(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return key(d).slice(0, 7); }

export function relDay(s) {
  const n = diffDays(S.today, s);
  if (n === 0) return 'Tonight';
  if (n === 1) return 'Tomorrow';
  if (n > 1 && n < 7) return DOW_LONG[dow(s)];
  return shortDate(s);
}

// "Tonight", "Tomorrow, Fri 16 Oct", or "Sat 17 Oct"
export function whenLabel(s) {
  const n = diffDays(S.today, s);
  if (n === 0) return 'Tonight';
  if (n === 1) return `Tomorrow, ${shortDate(s)}`;
  return shortDate(s);
}

export function clock(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const hh = h % 12 || 12;
  return `${hh}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
export function shiftTime() { return `${clock(S.settings.shift_start)} – ${clock(S.settings.shift_end)}`; }
export function timeOf(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const h = d.getHours(); const hh = h % 12 || 12;
  return `${hh}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}
export function ago(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return shortDate(key(new Date(ts)));
}

export function money(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? `RM${v.toLocaleString('en-MY')}` : `RM${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── people ─────────────────────────────────────────────────────
export function person(id) { return S.staff.find((p) => p.id === id) || { id, name: 'Unknown', color: '#8C8FAD', active: false }; }
export function crew() { return S.staff.filter((p) => p.active && !p.is_admin); }
export function initial(name) { return (name || '?').trim().charAt(0).toUpperCase(); }

// ── schedule ───────────────────────────────────────────────────
export function day(date) { return S.days[date] || { pt: 0, ft: 0, note: '' }; }
export function shiftsOn(date) { return S.shifts.filter((s) => s.date === date); }
export function dayInfo(date) {
  const d = day(date); const sh = shiftsOn(date);
  const pt = sh.filter((s) => s.kind === 'pt'); const ft = sh.filter((s) => s.kind === 'ft');
  return { ...d, date, shifts: sh, pt_shifts: pt, ft_shifts: ft, open_pt: Math.max(d.pt - pt.length, 0), open_ft: Math.max(d.ft - ft.length, 0), open: d.pt + d.ft > 0 };
}
export function myShift(date) { return S.shifts.find((s) => s.date === date && s.staff_id === S.me?.id); }
export function myUpcoming() { return S.shifts.filter((s) => s.staff_id === S.me?.id && s.date >= S.today).sort((a, b) => a.date.localeCompare(b.date)); }
export function swapFor(shiftId) { return S.swaps.find((w) => w.shift_id === shiftId); }
export function isAvailable(staffId, date) {
  const a = S.availability.find((x) => x.staff_id === staffId && x.dow === dow(date));
  return !a || a.available;
}
export function claimableDays(n = 21) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(S.today, i); const info = dayInfo(d);
    if (info.open_pt > 0 && !myShift(d)) out.push(info);
  }
  return out;
}
export function shiftWindow(date) {
  const [sh, sm] = (S.settings.shift_start || '19:30').split(':').map(Number);
  const [eh, em] = (S.settings.shift_end || '00:30').split(':').map(Number);
  const start = toDate(date); start.setHours(sh, sm, 0, 0);
  const end = toDate(date); end.setHours(eh, em, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

export function mergeSchedule(data) {
  if (!data.days) return;
  const { from, to } = data.range;
  for (const k of Object.keys(S.days)) if (k >= from && k <= to) delete S.days[k];
  for (const d of data.days) S.days[d.date] = { pt: d.pt, ft: d.ft, note: d.note };
  S.shifts = S.shifts.filter((s) => s.date < from || s.date > to).concat(data.shifts);
  S.swaps = data.swaps;
  S.availability = data.availability;
  S.range = S.range ? { from: S.range.from < from ? S.range.from : from, to: S.range.to > to ? S.range.to : to } : { from, to };
}

export function apply(data) {
  if (data.me) S.me = data.me;
  if (data.today) S.today = data.today;
  if (data.settings) S.settings = data.settings;
  if (data.staff) S.staff = data.staff;
  if (data.days) mergeSchedule(data);
  if (data.tasks) S.tasks = data.tasks;
  if (data.stock_items) S.stockItems = data.stock_items;
  if (data.stock_today) S.stockToday = data.stock_today;
  if ('closing_today' in data) S.closingToday = data.closing_today;
  if (data.my_pay) S.myPay = data.my_pay;
  if (data.chat) S.chat = data.chat;
  if (data.admin) S.admin = data.admin;
  S.loaded = true;
}

// ── chat seen marker (per device) ──────────────────────────────
export function chatSeen() { try { return Number(localStorage.getItem('kc2.chatSeen') || 0); } catch { return 0; } }
export function setChatSeen(id) { try { localStorage.setItem('kc2.chatSeen', String(id)); } catch { /* ignore */ } }
