import { teamSchedulesFromBlocks } from './siteLocation.js';
import { aggregate } from './data.js';
import { getAppLocale } from './localeRuntime.js';

export function teamsFromPeople(people = []) {
  const set = new Set();
  for (const p of people) {
    const dept = (p.dept || '').trim();
    if (dept) set.add(dept);
  }
  const list = [...set].sort((a, b) => a.localeCompare(b, 'vi'));
  if (list.length === 0) return ['Đội 1', 'Đội 2', 'Đội 3'];
  return list;
}

export function parseDateKey(isoOrDate) {
  if (!isoOrDate) return null;
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + n);
  return parseDateKey(d);
}

export function dateRangeKeys(startKey, endKey) {
  const keys = [];
  let cur = startKey;
  while (cur && cur <= endKey) {
    keys.push(cur);
    cur = addDays(cur, 1);
    if (keys.length > 366) break;
  }
  return keys;
}

export function weekStartMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return parseDateKey(d);
}

export function weekEndSunday(date = new Date()) {
  const start = weekStartMonday(date);
  return addDays(start, 6);
}

/** Số tuần ISO (tuần bắt đầu Thứ Hai). */
export function isoWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function monthStart(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthEnd(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return parseDateKey(d);
}

function nodeDateRange(node) {
  const startAt = node.startedAt || null;
  const endAt = node.deadline || null;
  const start = parseDateKey(startAt) || parseDateKey(endAt) || parseDateKey(node.createdAt) || parseDateKey(new Date());
  const end = parseDateKey(endAt) || start;
  return {
    startAt,
    endAt,
    startDate: start <= end ? start : end,
    endDate: end >= start ? end : start,
  };
}

function pushAssignedNode(rows, node, source = 'node') {
  const assigneeIds = [...new Set((node.assignees || []).filter(Boolean))];
  if (!assigneeIds.length) return;
  const range = nodeDateRange(node);
  rows.push({
    team: null,
    assigneeIds,
    projectId: node.id,
    projectName: node.name,
    startAt: range.startAt,
    endAt: range.endAt,
    startDate: range.startDate,
    endDate: range.endDate,
    source,
  });
}

function collectScheduledNodes(products = [], level = 'product') {
  const rows = [];
  function walk(node) {
    const table = node?._source?.table;
    const isTopTask = table === 'tasks' && !node._source?.parentTaskId;
    const isSubtask = table === 'tasks' && !!node._source?.parentTaskId;
    if (level === 'task' && isTopTask) pushAssignedNode(rows, node, 'task');
    if (level === 'subtask' && isSubtask) pushAssignedNode(rows, node, 'subtask');
    (node.children || []).forEach(walk);
  }
  products.forEach(walk);
  return rows;
}

export function collectScheduleNodes(products = [], level = 'product') {
  if (level !== 'task' && level !== 'subtask') return products || [];
  const nodes = [];
  function walk(node) {
    const table = node?._source?.table;
    const isTopTask = table === 'tasks' && !node._source?.parentTaskId;
    const isSubtask = table === 'tasks' && !!node._source?.parentTaskId;
    if (level === 'task' && isTopTask) nodes.push(node);
    if (level === 'subtask' && isSubtask) nodes.push(node);
    (node.children || []).forEach(walk);
  }
  products.forEach(walk);
  return nodes;
}

/** Gom lịch đội từ team_schedules trên từng Job + fallback deadline. */
export function collectTeamAssignments(products = [], level = 'product') {
  if (level === 'task' || level === 'subtask') {
    return collectScheduledNodes(products, level);
  }
  const rows = [];
  for (const project of products) {
    const explicit = project.teamSchedules || teamSchedulesFromBlocks(project._rawContentBlocks);
    if (explicit.length) {
      for (const s of explicit) {
        rows.push({
          team: s.team,
          projectId: project.id,
          projectName: project.name,
          startAt: s.startAt,
          endAt: s.endAt,
          startDate: s.startDate,
          endDate: s.endDate,
          note: s.note,
          source: 'schedule',
        });
      }
      continue;
    }
    const startAt = project.startedAt || null;
    const endAt = project.deadline || null;
    const start = parseDateKey(startAt) || parseDateKey(project.createdAt) || parseDateKey(new Date());
    const end = parseDateKey(endAt) || start;
    const teams = new Set();
    function walk(n) {
      (n.assignees || []).forEach((uid) => teams.add(uid));
      (n.children || []).forEach(walk);
    }
    walk(project);
    if (!teams.size) continue;
    rows.push({
      team: null,
      assigneeIds: [...teams],
      projectId: project.id,
      projectName: project.name,
      startAt,
      endAt,
      startDate: start <= end ? start : end,
      endDate: end >= start ? end : start,
      source: 'deadline',
    });
  }
  return rows;
}

/** % hoàn thành công trình từ cây việc con. */
export function projectProgressPercent(project) {
  if (!project) return 0;
  if (project.goodsPercent !== null && project.goodsPercent !== undefined) {
    const n = Number(project.goodsPercent);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  }
  if (project.status === 'done') return 100;
  if (project.status === 'fail') return 0;
  const stats = aggregate(project);
  if (stats.total > 0) return Math.round((stats.done / stats.total) * 100);
  if (project.status === 'doing') return 35;
  return 5;
}

/** % thời gian đã trôi trong khoảng lịch (ưu tiên ngày giờ đầy đủ). */
export function scheduleTimeProgress(bar, now = new Date()) {
  const startMs = bar?.startAt
    ? new Date(bar.startAt).getTime()
    : bar?.startDate
      ? new Date(`${bar.startDate}T00:00:00`).getTime()
      : null;
  const endMs = bar?.endAt
    ? new Date(bar.endAt).getTime()
    : bar?.endDate
      ? new Date(`${bar.endDate}T23:59:59`).getTime()
      : null;
  if (startMs == null || endMs == null) return 0;
  const nowMs = now.getTime();
  if (nowMs <= startMs) return 0;
  if (nowMs >= endMs) return 100;
  const total = endMs - startMs;
  if (total <= 0) return 50;
  return Math.round(((nowMs - startMs) / total) * 100);
}

/** % lấp đầy thanh tiến trình trên Gantt. */
export function barFillPercent(bar, project) {
  return projectProgressPercent(project);
}

export function buildGanttData(products, people, rangeStart, rangeEnd, teamFilter = null, level = 'product') {
  const teams = teamsFromPeople(people);
  const days = dateRangeKeys(rangeStart, rangeEnd);
  const assignments = collectTeamAssignments(products, level);
  const personTeam = (userId) => people.find((p) => p.id === userId)?.dept || 'Chung';
  const nodeById = new Map(collectScheduleNodes(products, level).map((p) => [p.id, p]));

  const enrichBar = (bar) => {
    const node = nodeById.get(bar.projectId);
    return {
      ...bar,
      startAt: bar.startAt || null,
      endAt: bar.endAt || null,
      status: node?.status || 'todo',
      progress: barFillPercent(bar, node),
    };
  };

  const barsByTeam = {};
  for (const team of teams) {
    barsByTeam[team] = [];
  }

  for (const a of assignments) {
    if (a.team) {
      if (!barsByTeam[a.team]) barsByTeam[a.team] = [];
      if (teamFilter && a.team !== teamFilter) continue;
      barsByTeam[a.team].push(enrichBar(a));
    } else if (a.assigneeIds?.length) {
      const teamSet = new Set(a.assigneeIds.map(personTeam));
      for (const t of teamSet) {
        if (teamFilter && t !== teamFilter) continue;
        if (!barsByTeam[t]) barsByTeam[t] = [];
        barsByTeam[t].push(enrichBar({ ...a, team: t }));
      }
    }
  }

  return { teams: teamFilter ? [teamFilter] : teams, days, barsByTeam };
}

export function barSpansDays(bar, days) {
  const startIdx = days.indexOf(bar.startDate);
  const endIdx = days.indexOf(bar.endDate);
  if (startIdx < 0 && endIdx < 0) {
    const first = days.find((d) => d >= bar.startDate && d <= bar.endDate);
    if (!first) return null;
    const last = [...days].reverse().find((d) => d >= bar.startDate && d <= bar.endDate);
    const s = days.indexOf(first);
    const e = days.indexOf(last);
    return { start: s, span: e - s + 1 };
  }
  const s = startIdx >= 0 ? startIdx : 0;
  const e = endIdx >= 0 ? endIdx : days.length - 1;
  return { start: s, span: Math.max(1, e - s + 1) };
}

export function formatDayHeader(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  const wd = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return { wd, label: `${day}/${month}`, full: `${wd} ${day}/${month}` };
}

/** Nhãn cột dạng 01, 02… giống biểu đồ mẫu. */
export function formatColumnLabel(dateKey, viewMode) {
  if (viewMode === 'year') {
    const m = dateKey.slice(5, 7);
    return m;
  }
  const day = dateKey.slice(8, 10);
  return day;
}

export function yearStart(date = new Date()) {
  return `${date.getFullYear()}-01-01`;
}

export function yearEnd(date = new Date()) {
  return `${date.getFullYear()}-12-31`;
}

/** 12 cột tháng trong năm (key = YYYY-MM-01). */
export function yearMonthKeys(date = new Date()) {
  const y = date.getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
}

export function monthLabel(date = new Date()) {
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  if (getAppLocale() === 'en') {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return `Tháng ${String(m).padStart(2, '0')}/${y}`;
}

export function yearLabel(date = new Date()) {
  return getAppLocale() === 'en'
    ? `Year ${date.getFullYear()}`
    : `Năm ${date.getFullYear()}`;
}

/** KPI tổng hợp cho dashboard lịch công trình. */
export function buildScheduleKpis(products = [], level = 'product') {
  const nodes = collectScheduleNodes(products, level);
  const total = nodes.length;
  const doing = nodes.filter((p) => p.status === 'doing').length;
  const todo = nodes.filter((p) => p.status === 'todo').length;
  const done = nodes.filter((p) => p.status === 'done').length;
  const fail = nodes.filter((p) => p.status === 'fail').length;
  const inProgress = doing + todo;
  const rate = total ? Math.round(nodes.reduce((sum, node) => sum + projectProgressPercent(node), 0) / total) : 0;
  return { total, doing, todo, done, fail, inProgress, rate };
}

/** Màu thanh Gantt — xanh lá → xanh dương → vàng (giống mẫu). */
export const GANTT_BAR_COLORS = [
  '#7CB87A',
  '#6AAF78',
  '#5BA4B8',
  '#6BB5C4',
  '#F0C040',
  '#5B8FC7',
  '#8B7EC8',
  '#C8956B',
];

export function barColorForIndex(index) {
  return GANTT_BAR_COLORS[index % GANTT_BAR_COLORS.length];
}

/** Span thanh trên cột tháng (year view). */
export function barSpansMonths(bar, monthKeys) {
  const barStart = bar.startDate?.slice(0, 7);
  const barEnd = bar.endDate?.slice(0, 7);
  if (!barStart || !barEnd) return null;

  let startIdx = -1;
  let endIdx = -1;
  monthKeys.forEach((mk, i) => {
    const mkMonth = mk.slice(0, 7);
    if (barStart <= mkMonth && barEnd >= mkMonth) {
      if (startIdx < 0) startIdx = i;
      endIdx = i;
    }
  });
  if (startIdx < 0) return null;
  return { start: startIdx, span: endIdx - startIdx + 1 };
}
