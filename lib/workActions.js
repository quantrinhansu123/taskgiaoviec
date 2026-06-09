import { combineDeadlineLocal, splitDeadlineForInput } from './deadline.js';

export const WORK_ACTION_KINDS = ['note', 'evaluation', 'discussion'];

const WORK_ACTION_KIND_SET = new Set(WORK_ACTION_KINDS);

export function normalizeWorkActionKind(kind) {
  const value = (kind || 'note').toLowerCase();
  return WORK_ACTION_KIND_SET.has(value) ? value : 'note';
}

/** Ghi chú thuần — không tính giờ, không thẻ đang làm. */
export function isSimpleNoteAction(action) {
  const kind = normalizeWorkActionKind(action?.kind);
  return kind === 'note' || kind === 'evaluation';
}

/** Trao đổi dạng chat — không tính giờ. */
export function isDiscussionAction(action) {
  return normalizeWorkActionKind(action?.kind) === 'discussion';
}

export function isEvaluationAction(action) {
  return normalizeWorkActionKind(action?.kind) === 'evaluation';
}

export function newWorkActionId() {
  return `wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveWorkActionKind(raw) {
  if (raw?.kind || raw?.type) return normalizeWorkActionKind(raw.kind || raw.type);
  const endedAt = raw?.ended_at || raw?.endedAt || null;
  const rawStatus = (raw?.status || '').toLowerCase();
  const inProgress = !endedAt && rawStatus !== 'completed' && rawStatus !== 'done';
  return inProgress ? 'evaluation' : 'note';
}

export function normalizeWorkAction(raw) {
  if (!raw) return null;
  const kind = resolveWorkActionKind(raw);
  const title = (raw.title || raw.description || raw.name || '').trim();
  const note = (raw.note || raw.ghi_chu || '').trim();
  const startedAt = raw.started_at || raw.startedAt || null;
  const endedAt = raw.ended_at || raw.endedAt || null;

  if (kind === 'note' || kind === 'evaluation') {
    const content = note || title;
    if (!content) return null;
    const stamp = startedAt || endedAt || new Date().toISOString();
    return {
      id: raw.id || newWorkActionId(),
      kind,
      title: title || content.split('\n')[0].slice(0, 120),
      note: content,
      startedAt: stamp,
      endedAt: endedAt || stamp,
      status: 'completed',
    };
  }

  if (kind === 'discussion') {
    const content = note || title;
    if (!content) return null;
    const stamp = startedAt || endedAt || new Date().toISOString();
    const mentions = Array.isArray(raw.mentions)
      ? raw.mentions.filter(Boolean)
      : [];
    return {
      id: raw.id || newWorkActionId(),
      kind: 'discussion',
      title: title || '',
      note: content,
      authorId: raw.author_id || raw.authorId || null,
      mentions,
      startedAt: stamp,
      endedAt: endedAt || stamp,
      status: 'completed',
    };
  }

  if (!title || !startedAt) return null;
  const rawStatus = (raw.status || '').toLowerCase();
  const status = endedAt || rawStatus === 'completed' || rawStatus === 'done'
    ? 'completed'
    : 'in_progress';
  return {
    id: raw.id || newWorkActionId(),
    kind,
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
  if (isSimpleNoteAction(action) || isDiscussionAction(action)) return false;
  return action?.status === 'in_progress' || !action?.endedAt;
}

export function newDiscussionMessage({ text, authorId, authorName = '', mentions = [] }) {
  const body = (text || '').trim();
  if (!body) return null;
  const iso = new Date().toISOString();
  return {
    id: newWorkActionId(),
    kind: 'discussion',
    title: authorName || '',
    note: body,
    authorId: authorId || null,
    mentions: [...new Set((mentions || []).filter(Boolean))],
    startedAt: iso,
    endedAt: iso,
    status: 'completed',
  };
}

export function extractMentionIds(text, people = []) {
  const ids = new Set();
  const body = text || '';
  people.forEach((person) => {
    if (!person?.name) return;
    const escaped = person.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`@${escaped}(?=\\s|$|[.,!?;:])`, 'iu');
    if (pattern.test(body)) ids.add(person.id);
  });
  return [...ids];
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
    kind: normalizeWorkActionKind(a.kind),
    title: a.title,
    note: (a.note || '').trim() || null,
    author_id: a.authorId || null,
    mentions: Array.isArray(a.mentions) && a.mentions.length > 0 ? a.mentions : null,
    status: a.status === 'completed' ? 'completed' : 'in_progress',
    started_at: a.startedAt,
    ended_at: a.status === 'completed' ? (a.endedAt || null) : null,
  }));
}

export function groupWorkActionsByKind(actions = []) {
  const grouped = Object.fromEntries(WORK_ACTION_KINDS.map((kind) => [kind, []]));
  actions.forEach((action) => {
    const kind = normalizeWorkActionKind(action?.kind);
    grouped[kind].push(action);
  });
  return grouped;
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
  if (isSimpleNoteAction(action) || isDiscussionAction(action)) {
    return formatWorkActionWhen(action.startedAt);
  }
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
  if (isSimpleNoteAction(action) || isDiscussionAction(action)) return null;
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
