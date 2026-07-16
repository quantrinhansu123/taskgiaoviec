import { useMemo, useState, useCallback } from 'react';
import scheduleHtml from '../Kế Hoạch Công Trình (standalone).html?raw';
import {
  collectTeamAssignments,
  projectProgressPercent,
  teamsFromPeople,
  weekStartMonday,
  weekEndSunday,
  isoWeekNumber,
  monthStart,
  monthEnd,
  addDays,
  parseDateKey,
} from '../lib/teams.js';

const APP_SCRIPT_TAG = '<script type=\\"text/babel\\" src=\\"d172a3ff-e3f2-40e4-9d4c-cb82d3e6cf40\\">';
/** Demo data script — inject AFTER this so real payload wins. */
const DATA_SCRIPT_TAG = '<script src=\\"85a000f8-6d5b-4df4-93f7-b5acc09faa0f\\"><\\u002Fscript>';
const COLORS = ['#2f7d56', '#3a6ea5', '#b9742f', '#8a5cbf', '#4a8f8a', '#6f7f55', '#9a624a'];
const MAX_RANGE_DAYS = 62;

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function textPair(value, fallback = '') {
  const text = String(value || fallback || '').trim();
  return { vi: text, en: text };
}

function dateKey(value) {
  return value ? String(value).slice(0, 10) : '';
}

function formatDateVi(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function formatDate(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return `${m}/${d}/${y}`;
}

function formatShort(key) {
  if (!key) return '';
  const [, m, d] = key.split('-');
  return `${m}/${d}`;
}
function safeId(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || fallback;
}

function collectAssigneeIds(node, out = new Set()) {
  (node?.assignees || []).forEach((id) => out.add(id));
  (node?.children || []).forEach((child) => collectAssigneeIds(child, out));
  return out;
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

function statusFor(project, endDate, todayKey) {
  if (project?.status === 'done') return 'done';
  if (project?.status === 'fail') return 'delayed';
  if (endDate && endDate < todayKey && project?.status !== 'done') return 'delayed';
  if (project?.status === 'doing') return 'active';
  return 'planned';
}

function dayIndexInRange(key, rangeStart, daysCount) {
  if (!key || !rangeStart || daysCount < 1) return 1;
  if (key < rangeStart) return 1;
  const a = new Date(`${rangeStart}T12:00:00`);
  const b = new Date(`${key}T12:00:00`);
  const idx = Math.floor((b - a) / 86400000) + 1;
  return Math.max(1, Math.min(daysCount, idx));
}

function daysBetween(startKey, endKey) {
  if (!startKey || !endKey) return 1;
  const a = new Date(`${startKey}T12:00:00`);
  const b = new Date(`${endKey}T12:00:00`);
  return Math.max(1, Math.floor((b - a) / 86400000) + 1);
}

function parseLocalDate(key) {
  if (!key) return new Date();
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function buildGanttPayload(products = [], people = [], rangeStart, rangeEnd) {
  const now = new Date();
  const todayKey = parseDateKey(now);
  const days = daysBetween(rangeStart, rangeEnd);
  const startDateObj = parseLocalDate(rangeStart);
  const year = startDateObj.getFullYear();
  const month = startDateObj.getMonth();
  const teamNames = teamsFromPeople(people);
  const teamIds = new Map(teamNames.map((team, index) => [team, safeId(team, `team-${index + 1}`)]));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const projectById = new Map(products.map((project) => [project.id, project]));

  const teams = teamNames.map((team, index) => ({
    id: teamIds.get(team),
    color: COLORS[index % COLORS.length],
    name: textPair(team || 'Chung'),
    trade: textPair(team || 'Chung'),
  }));

  const assignments = collectTeamAssignments(products, 'product');
  const tasks = assignments
    .map((assignment, index) => {
      const project = projectById.get(assignment.projectId);
      const startDate = dateKey(assignment.startDate || assignment.startAt);
      const endDate = dateKey(assignment.endDate || assignment.endAt || startDate);
      if (!startDate || !endDate) return null;
      if (endDate < rangeStart || startDate > rangeEnd) return null;

      const startDay = dayIndexInRange(startDate, rangeStart, days);
      const endDay = dayIndexInRange(endDate, rangeStart, days);
      const teamName = assignment.team || peopleById.get(assignment.assigneeIds?.[0])?.dept || teamNames[0] || 'Chung';
      const assigneeIds = assignment.assigneeIds?.length
        ? assignment.assigneeIds
        : [...collectAssigneeIds(project)].filter((id) => peopleById.get(id)?.dept === teamName);

      return {
        id: safeId(`${assignment.projectId}-${assignment.team || index}`, `task-${index + 1}`),
        teamId: teamIds.get(teamName) || safeId(teamName, 'team-1'),
        start: Math.min(startDay, endDay),
        dur: Math.max(1, Math.abs(endDay - startDay) + 1),
        progress: projectProgressPercent(project),
        status: statusFor(project, endDate, todayKey),
        deps: [],
        name: textPair(project?.name || assignment.projectName || assignment.note || 'Công trình'),
        assignees: assigneeIds.slice(0, 4).map((id, assigneeIndex) => {
          const person = peopleById.get(id);
          const name = person?.name || id;
          return {
            i: person?.initials || initials(name),
            c: person?.color || COLORS[(index + assigneeIndex) % COLORS.length],
            n: textPair(name),
          };
        }),
      };
    })
    .filter(Boolean);

  const todayInRange = todayKey >= rangeStart && todayKey <= rangeEnd
    ? dayIndexInRange(todayKey, rangeStart, days)
    : 0;

  const labelVi = rangeStart === rangeEnd
    ? formatDateVi(rangeStart)
    : `${formatDateVi(rangeStart)} – ${formatDateVi(rangeEnd)}`;
  const labelEn = rangeStart === rangeEnd
    ? formatDate(rangeStart)
    : `${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`;

  return {
    MONTH: {
      vi: labelVi,
      en: labelEn,
      days,
      today: todayInRange,
      year,
      m: month,
      rangeStart,
    },
    PROJECT: {
      vi: products[0]?.name || 'Lịch công trình',
      en: products[0]?.name || 'Construction schedule',
      code: products[0]?.id ? String(products[0].id).slice(0, 8).toUpperCase() : 'SUPABASE',
    },
    teams: teams.length ? teams : [{ id: 'chung', color: COLORS[0], name: textPair('Chung'), trade: textPair('Chung') }],
    tasks,
  };
}

function encodeTemplateFragment(fragment) {
  return JSON.stringify(fragment)
    .slice(1, -1)
    .replace(/<\/script>/gi, '<\\u002Fscript>');
}

function htmlWithData(payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  // Ghi đè demo GANTT (script 85a000f8) — inject ngay sau data script.
  const injection = `<script>window.GANTT=Object.assign({},window.GANTT||{},${json});</script>`;
  const encoded = encodeTemplateFragment(injection);
  if (scheduleHtml.includes(DATA_SCRIPT_TAG)) {
    return scheduleHtml.replace(DATA_SCRIPT_TAG, `${DATA_SCRIPT_TAG}${encoded}`);
  }
  // Fallback: trước babel app
  return scheduleHtml.replace(APP_SCRIPT_TAG, `${encoded}${APP_SCRIPT_TAG}`);
}

function clampRange(from, to) {
  let start = from;
  let end = to;
  if (!start && !end) {
    const now = new Date();
    start = monthStart(now);
    end = monthEnd(now);
  } else if (start && !end) {
    end = start;
  } else if (!start && end) {
    start = end;
  }
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  // Always show full weeks Mon–Sun so the grid starts on Monday.
  start = weekStartMonday(parseLocalDate(start));
  end = weekEndSunday(parseLocalDate(end));
  if (daysBetween(start, end) > MAX_RANGE_DAYS) {
    end = weekEndSunday(parseLocalDate(addDays(start, MAX_RANGE_DAYS - 1)));
    if (daysBetween(start, end) > MAX_RANGE_DAYS) {
      end = addDays(start, MAX_RANGE_DAYS - 1);
    }
  }
  return { start, end };
}

export function StandaloneScheduleView({ products, people }) {
  const today = useMemo(() => new Date(), []);
  const [mode, setMode] = useState('month'); // range | week | month
  const [fromDate, setFromDate] = useState(() => monthStart(today));
  const [toDate, setToDate] = useState(() => monthEnd(today));
  const [weekAnchor, setWeekAnchor] = useState(() => weekStartMonday(today));
  const [monthAnchor, setMonthAnchor] = useState(() => monthStart(today));

  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (mode === 'week') {
      return { start: weekAnchor, end: addDays(weekAnchor, 6) };
    }
    if (mode === 'month') {
      const anchor = parseLocalDate(monthAnchor);
      return clampRange(monthStart(anchor), monthEnd(anchor));
    }
    return clampRange(fromDate, toDate);
  }, [mode, fromDate, toDate, weekAnchor, monthAnchor]);

  const weekNum = useMemo(() => isoWeekNumber(parseLocalDate(weekAnchor)), [weekAnchor]);
  const weekYear = useMemo(() => parseLocalDate(weekAnchor).getFullYear(), [weekAnchor]);
  const monthAnchorDate = useMemo(() => parseLocalDate(monthAnchor), [monthAnchor]);
  const monthLabel = useMemo(
    () => `${EN_MONTHS[monthAnchorDate.getMonth()]} ${monthAnchorDate.getFullYear()}`,
    [monthAnchorDate],
  );
  const monthRangeStart = useMemo(() => monthStart(monthAnchorDate), [monthAnchorDate]);
  const monthRangeEnd = useMemo(() => monthEnd(monthAnchorDate), [monthAnchorDate]);
  const weekRangeEnd = useMemo(() => addDays(weekAnchor, 6), [weekAnchor]);
  const rangeDays = daysBetween(rangeStart, rangeEnd);

  const srcDoc = useMemo(
    () => htmlWithData(buildGanttPayload(products, people, rangeStart, rangeEnd)),
    [products, people, rangeStart, rangeEnd],
  );
  const frameKey = `${mode}:${rangeStart}:${rangeEnd}:${(products || []).length}`;

  const applyWeek = useCallback((startKey) => {
    const start = weekStartMonday(startKey ? parseLocalDate(startKey) : new Date());
    setMode('week');
    setWeekAnchor(start);
    setFromDate(start);
    setToDate(addDays(start, 6));
  }, []);

  const applyMonth = useCallback((anchorKey) => {
    const anchor = parseLocalDate(anchorKey || monthStart(new Date()));
    const start = monthStart(anchor);
    const end = monthEnd(anchor);
    setMode('month');
    setMonthAnchor(start);
    setFromDate(start);
    setToDate(end);
  }, []);

  const selectThisWeek = useCallback(() => {
    applyWeek(weekStartMonday(new Date()));
  }, [applyWeek]);

  const selectThisMonth = useCallback(() => {
    applyMonth(monthStart(new Date()));
  }, [applyMonth]);

  const shiftWeek = (delta) => {
    applyWeek(addDays(weekAnchor, delta * 7));
  };

  const shiftMonth = (delta) => {
    const d = parseLocalDate(monthAnchor);
    d.setMonth(d.getMonth() + delta);
    applyMonth(monthStart(d));
  };

  const onFromChange = (value) => {
    setFromDate(value);
    setMode('range');
    if (toDate && value && value > toDate) setToDate(value);
  };

  const onToChange = (value) => {
    setToDate(value);
    setMode('range');
    if (fromDate && value && value < fromDate) setFromDate(value);
  };

  return (
    <div className="standalone-schedule-view">
      <div className="schedule-date-filters">
        <div className="schedule-date-filters-row">
          <span className="schedule-date-filters-label">From date — to date</span>
          <div className="schedule-date-range-inputs">
            <label className="schedule-date-field">
              <span>From</span>
              <input
                type="date"
                className="field-input"
                value={mode === 'range' ? fromDate : rangeStart}
                onChange={(e) => onFromChange(e.target.value)}
              />
            </label>
            <label className="schedule-date-field">
              <span>To</span>
              <input
                type="date"
                className="field-input"
                value={mode === 'range' ? toDate : rangeEnd}
                onChange={(e) => onToChange(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="schedule-date-filters-row schedule-date-filters-row--quick">
          <span className="schedule-date-filters-label">Quick filters</span>
          <div className="schedule-quick-filters" role="group" aria-label="Quick filters">
            <div
              className={`schedule-quick-card ${mode === 'week' ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => applyWeek(weekAnchor)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') applyWeek(weekAnchor); }}
            >
              <div className="schedule-quick-card-head">
                <strong>By week</strong>
                <span>Week {weekNum}/{weekYear}</span>
              </div>
              <p className="schedule-quick-card-range">
                {formatShort(weekAnchor)} – {formatShort(weekRangeEnd)}
              </p>
              <div className="schedule-quick-card-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn btn-secondary" onClick={() => shiftWeek(-1)} aria-label="Previous week">‹</button>
                <button type="button" className={`btn ${mode === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={selectThisWeek}>
                  This week
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => shiftWeek(1)} aria-label="Next week">›</button>
              </div>
            </div>

            <div
              className={`schedule-quick-card ${mode === 'month' ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => applyMonth(monthAnchor)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') applyMonth(monthAnchor); }}
            >
              <div className="schedule-quick-card-head">
                <strong>By month</strong>
                <span>{monthLabel}</span>
              </div>
              <p className="schedule-quick-card-range">
                {formatShort(monthRangeStart)} – {formatShort(monthRangeEnd)}
              </p>
              <div className="schedule-quick-card-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn btn-secondary" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
                <button type="button" className={`btn ${mode === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={selectThisMonth}>
                  This month
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
              </div>
            </div>
          </div>
        </div>

        <p className="schedule-date-filters-hint">
          Viewing <strong>{rangeDays} days</strong>
          {' · '}
          {formatDate(rangeStart)} → {formatDate(rangeEnd)}
          {rangeDays >= MAX_RANGE_DAYS ? ` (max ${MAX_RANGE_DAYS} days)` : ''}
        </p>
      </div>

      <iframe
        key={frameKey}
        className="standalone-schedule-frame"
        title="Team schedule"
        srcDoc={srcDoc}
      />
    </div>
  );
}
