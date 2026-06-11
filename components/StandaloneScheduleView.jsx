import { useMemo } from 'react';
import scheduleHtml from '../Kế Hoạch Công Trình (standalone).html?raw';
import { collectTeamAssignments, projectProgressPercent, teamsFromPeople } from '../lib/teams.js';

const APP_SCRIPT_TAG = '<script type=\\"text/babel\\" src=\\"d172a3ff-e3f2-40e4-9d4c-cb82d3e6cf40\\">';
const COLORS = ['#2f7d56', '#3a6ea5', '#b9742f', '#8a5cbf', '#4a8f8a', '#6f7f55', '#9a624a'];

function textPair(value, fallback = '') {
  const text = String(value || fallback || '').trim();
  return { vi: text, en: text };
}

function dateKey(value) {
  return value ? String(value).slice(0, 10) : '';
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
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

function buildGanttPayload(products = [], people = []) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayKey = now.toISOString().slice(0, 10);
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
  const tasks = assignments.map((assignment, index) => {
    const project = projectById.get(assignment.projectId);
    const startDate = dateKey(assignment.startDate || assignment.startAt);
    const endDate = dateKey(assignment.endDate || assignment.endAt || startDate);
    const start = startDate ? new Date(`${startDate}T00:00:00`) : now;
    const end = endDate ? new Date(`${endDate}T00:00:00`) : start;
    const startDay = start.getFullYear() === year && start.getMonth() === month ? start.getDate() : 1;
    const endDay = end.getFullYear() === year && end.getMonth() === month ? end.getDate() : daysInMonth(year, month);
    const teamName = assignment.team || peopleById.get(assignment.assigneeIds?.[0])?.dept || teamNames[0] || 'Chung';
    const assigneeIds = assignment.assigneeIds?.length
      ? assignment.assigneeIds
      : [...collectAssigneeIds(project)].filter((id) => peopleById.get(id)?.dept === teamName);

    return {
      id: safeId(`${assignment.projectId}-${assignment.team || index}`, `task-${index + 1}`),
      teamId: teamIds.get(teamName) || safeId(teamName, 'team-1'),
      start: Math.max(1, Math.min(daysInMonth(year, month), Math.min(startDay, endDay))),
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
  });

  return {
    MONTH: {
      vi: `Tháng ${month + 1}, ${year}`,
      en: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      days: daysInMonth(year, month),
      today: now.getDate(),
      year,
      m: month,
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
  const injection = `<script>window.GANTT=Object.assign({},window.GANTT||{},${json},{T:(window.GANTT||{}).T});</script>\n`;
  return scheduleHtml.replace(APP_SCRIPT_TAG, `${encodeTemplateFragment(injection)}${APP_SCRIPT_TAG}`);
}

export function StandaloneScheduleView({ products, people }) {
  const srcDoc = useMemo(() => htmlWithData(buildGanttPayload(products, people)), [products, people]);

  return (
    <div className="standalone-schedule-view">
      <iframe
        className="standalone-schedule-frame"
        title="Lịch đội"
        srcDoc={srcDoc}
      />
    </div>
  );
}
