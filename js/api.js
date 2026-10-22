import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPA_URL, SUPA_KEY } from './config.js';

const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const TOKEN_KEY = 'kc2.token';

function store(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ }
}
function read(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}

export const session = {
  get token() { return read(TOKEN_KEY); },
  set token(v) { store(TOKEN_KEY, v); },
};

// Plain-English messages for every error code the server can raise.
const MESSAGES = {
  auth: 'You were signed out. Enter your PIN again.',
  admin_only: 'Only the admin can do that.',
  bad_request: 'Something was missing. Try again.',
  past_date: 'That day has already passed.',
  no_slots: 'There are no part-time slots that day.',
  already_on_day: 'Already on the schedule that day.',
  slot_full: 'Someone just took that slot.',
  not_your_shift: 'That isn’t your shift.',
  already_offered: 'You already put this shift up for grabs.',
  swap_gone: 'Someone already took that shift.',
  own_swap: 'You can’t take your own shift.',
  not_yours: 'Only the person who added it (or the admin) can do that.',
  no_shift_today: 'You’re not on the schedule today.',
  already_clocked_in: 'You’re already clocked in.',
  too_early: 'Too early to clock in. Try closer to your shift.',
  not_clocked_in: 'Clock in first.',
  already_clocked_out: 'You already clocked out.',
  bad_sales: 'Enter tonight’s sales as a number.',
  already_closed: 'Someone already closed the stall tonight.',
  empty: 'Type something first.',
  not_found: 'That no longer exists.',
  slots_below_assigned: 'Remove someone from that day first, then lower the slots.',
  unknown_staff: 'Pick someone from the crew list.',
  bad_amount: 'Enter an amount in RM.',
  pin_format: 'PINs are exactly 4 digits.',
  pin_too_easy: 'Pick a less obvious PIN.',
  pin_taken: 'Someone else already uses that PIN. Pick another.',
  pin_space_full: 'Couldn’t find a free PIN. Try again.',
  name_taken: 'Someone on the crew already has that name.',
  cant_deactivate_self: 'You can’t remove your own account.',
  unknown_action: 'This version of the app is out of date. Reload it.',
  network: 'No connection. Check your internet and try again.',
};

export class ApiError extends Error {
  constructor(code) {
    super(MESSAGES[code] || 'That didn’t go through. Check your connection and try again.');
    this.code = code;
  }
}

export async function login(pin) {
  const { data, error } = await db.rpc('crew_login', {
    p_pin: pin,
    p_device: navigator.userAgent.slice(0, 200),
  });
  if (error) throw new ApiError(error.message?.includes('fetch') ? 'network' : error.message);
  if (data?.ok) session.token = data.token;
  return data;
}

let onSignedOut = () => {};
export function whenSignedOut(fn) { onSignedOut = fn; }

export async function call(action, args = {}) {
  let res;
  try {
    res = await db.rpc('crew_api', { p_token: session.token, p_action: action, p_args: args });
  } catch {
    throw new ApiError('network');
  }
  const { data, error } = res;
  if (error) {
    const code = error.message && MESSAGES[error.message] ? error.message
      : (error.message || '').toLowerCase().includes('fetch') ? 'network' : error.message;
    if (code === 'auth') { session.token = null; onSignedOut(); }
    throw new ApiError(code);
  }
  return data;
}

export async function logout() {
  const t = session.token;
  session.token = null;
  if (t) { try { await db.rpc('crew_api', { p_token: t, p_action: 'logout', p_args: {} }); } catch { /* ignore */ } }
}

// Realtime: the server bumps a counter per topic; we refetch through crew_api.
let channel = null;
export function watchPulse(onTopic) {
  if (channel) db.removeChannel(channel);
  channel = db.channel('crew-pulse')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crew_pulse' }, (p) => {
      if (p.new?.topic) onTopic(p.new.topic);
    })
    .subscribe();
}
export function stopPulse() {
  if (channel) { db.removeChannel(channel); channel = null; }
}
