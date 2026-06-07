import { combineDeadlineLocal, splitDeadlineForInput } from './deadline.js';

export function newWorkActionId() {
  return `wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeWorkAction(raw) {
  if (!raw) return null;
  const title = (raw.title || raw.description || raw.name || '').trim();
  const startedAt = raw.started_at || raw.startedAt || null;
  if (!title || !startedAt) return null;
  const note = (raw.note || raw.ghi_chu || '').trim();
  const endedAt = raw.ended_at || raw.endedAt || null;
  const rawStatus = (raw.status || '').toLowerCase();
  const status = endedAt || rawStatus === 'completed' || rawStatus === 'done'
    ? 'completed'
    : 'in_progress';
  return {
    id: raw.id || newWorkActionId(),
    title,
    note: note || '',
    startedAt,
    endedAt,
    status,
  };
}

/** Đánh dấu hoàn thành — ghi giờ kết thúc = thời điểm hoàn thành. */
export function completeWorkAction(action, at = new Date()) {
  const iso = at.toISOString();
  return {
    ...action,
    status: 'completed',
    endedAt: iso,
  };
}

export function isWorkActionInProgress(action) {
  return action?.status === 'in_progress' || !action?.endedAt;
}

export function workActionsFromBlocks(blocks) {
  if (!blocks || typeof blocks !== 'object' || !Array.isArray(blocks.work_actions)) {
    return [];
  }
  return blocks.work_actions.map(normalizeWorkAction).filter(Boolean);
}

export function workActionsToDb(actions) {
  return (actions || []).map((a) => ({
    id: a.id,
    title: a.title,
    note: (a.note || '').trim() || null,
    status: a.status === 'completed' ? 'completed' : 'in_progress',
    started_at: a.startedAt,
    ended_at: a.status === 'completed' ? (a.endedAt || null) : null,
  }));
}

export function splitActionDateTime(iso) {
  return splitDeadlineForInput(iso);
}

export function combineActionDateTime(date, time) {
  return combineDeadlineLocal(date, time);
}

export function formatWorkActionWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatWorkActionRange(action) {
  const start = formatWorkActionWhen(action.startedAt);
  if (!action.endedAt) {
    return `Bắt đầu ${start} · đang làm`;
  }
  const end = new Date(action.endedAt);
  const startD = new Date(action.startedAt);
  const sameDay = end.toDateString() === startD.toDateString();
  const endStr = sameDay
    ? end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : formatWorkActionWhen(action.endedAt);
  return `${start} → ${endStr}`;
}

export function actionDurationMinutes(action) {
  if (!action.startedAt || !action.endedAt) return null;
  const ms = new Date(action.endedAt) - new Date(action.startedAt);
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

export function formatDurationMinutes(mins) {
  if (mins == null || mins < 0) return '';
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}g ${m}p` : `${h} giờ`;
}
