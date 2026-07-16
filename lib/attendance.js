import { getAppLocale, localeDateTag } from './localeRuntime.js';

export function newAttendanceId() {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeAttendanceSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const userId = raw.user_id || raw.userId;
  const checkInAt = raw.check_in_at || raw.checkInAt;
  if (!userId || !checkInAt) return null;
  return {
    id: raw.id || newAttendanceId(),
    userId,
    team: String(raw.team || '').trim(),
    checkInAt,
    checkOutAt: raw.check_out_at || raw.checkOutAt || null,
    checkInLat: raw.check_in_lat ?? raw.checkInLat ?? null,
    checkInLng: raw.check_in_lng ?? raw.checkInLng ?? null,
    checkOutLat: raw.check_out_lat ?? raw.checkOutLat ?? null,
    checkOutLng: raw.check_out_lng ?? raw.checkOutLng ?? null,
    autoCheckout: Boolean(raw.auto_checkout ?? raw.autoCheckout),
  };
}

export function attendanceFromBlocks(blocks) {
  if (!blocks || typeof blocks !== 'object' || !Array.isArray(blocks.attendance_sessions)) {
    return [];
  }
  return blocks.attendance_sessions.map(normalizeAttendanceSession).filter(Boolean);
}

export function attendanceToDb(sessions) {
  return (sessions || []).map((s) => ({
    id: s.id,
    user_id: s.userId,
    team: s.team || null,
    check_in_at: s.checkInAt,
    check_out_at: s.checkOutAt || null,
    check_in_lat: s.checkInLat,
    check_in_lng: s.checkInLng,
    check_out_lat: s.checkOutLat,
    check_out_lng: s.checkOutLng,
    auto_checkout: s.autoCheckout || false,
  }));
}

export function activeSessionForUser(sessions, userId) {
  return (sessions || []).find((s) => s.userId === userId && !s.checkOutAt) || null;
}

export function localDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sessionOnLocalDate(session, dateKey) {
  if (!session?.checkInAt || !dateKey) return false;
  return localDateKey(new Date(session.checkInAt)) === dateKey;
}

/** User đã check-out xong trong ngày (local) tại công trình này. */
export function userCompletedCheckoutToday(sessions, userId, date = new Date()) {
  const key = localDateKey(date);
  return (sessions || []).some(
    (s) => s.userId === userId && s.checkOutAt && sessionOnLocalDate(s, key),
  );
}

export function sessionDurationMinutes(session) {
  if (!session?.checkInAt) return null;
  const end = session.checkOutAt ? new Date(session.checkOutAt) : new Date();
  const ms = end - new Date(session.checkInAt);
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

export function checkoutSession(session, at = new Date(), { lat, lng, auto = false } = {}) {
  return {
    ...session,
    checkOutAt: at.toISOString(),
    checkOutLat: lat ?? session.checkOutLat,
    checkOutLng: lng ?? session.checkOutLng,
    autoCheckout: auto || session.autoCheckout,
  };
}

export function checkinSession({ userId, team, lat, lng }) {
  return {
    id: newAttendanceId(),
    userId,
    team: team || '',
    checkInAt: new Date().toISOString(),
    checkOutAt: null,
    checkInLat: lat,
    checkInLng: lng,
    checkOutLat: null,
    checkOutLng: null,
    autoCheckout: false,
  };
}

export function formatAttendanceRange(session) {
  if (!session?.checkInAt) return '';
  const en = getAppLocale() === 'en';
  const tag = localeDateTag();
  const start = new Date(session.checkInAt);
  const startStr = start.toLocaleString(tag, {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  if (!session.checkOutAt) return `${startStr} · ${en ? 'working' : 'đang làm việc'}`;
  const end = new Date(session.checkOutAt);
  const sameDay = end.toDateString() === start.toDateString();
  const endStr = sameDay
    ? end.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false })
    : end.toLocaleString(tag, {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  const auto = session.autoCheckout ? (en ? ' · auto' : ' · tự động') : '';
  return `${startStr} → ${endStr}${auto}`;
}
