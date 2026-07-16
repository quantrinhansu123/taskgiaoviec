import { useMemo, useState } from 'react';
import {
  buildGanttData,
  barColorForIndex,
  buildScheduleKpis,
  monthStart,
  monthEnd,
  monthLabel,
  addDays,
  teamsFromPeople,
} from '../lib/teams.js';
import { currentLocalDateTimeForInput, formatScheduleRange } from '../lib/deadline.js';
import { useI18n, tGlobal } from '../lib/i18n.jsx';

const LABEL_W = 120;
const COL_W = 41;
const HEADER_H = 60;
const LANE_H = 46;
const BAR_H = 32;
const GROUP_PAD = 14;

const levelOptions = () => [
  ['product', tGlobal('csLevelProduct')],
  ['task', tGlobal('levelTask')],
  ['subtask', 'Sub-task'],
];

const statusOptions = () => [
  ['all', tGlobal('all')],
  ['active', tGlobal('csActive')],
  ['planned', tGlobal('csPlanned')],
  ['done', tGlobal('csDone')],
  ['delayed', tGlobal('csDelayed')],
];

const STATUS_COLORS = {
  done: { color: '#3D8B5F', soft: '#E6F5EC' },
  active: { color: '#4A9A6A', soft: '#EAF6EE' },
  planned: { color: '#6AA5BF', soft: '#E9F4FA' },
  delayed: { color: '#C85D48', soft: '#FCECE8' },
};

function statusMetaFor(status) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.planned;
  const labelKey = { done: 'csDone', active: 'csActive', planned: 'csPlanned', delayed: 'csDelayedFull' }[status] || 'csPlanned';
  return { ...colors, label: tGlobal(labelKey) };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dayNumber(dateKey) {
  return Number(dateKey?.slice(8, 10)) || 1;
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const pick = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`;
  return pick.toUpperCase();
}

function normalizeStatus(bar, todayKey) {
  const progress = bar.progress ?? 0;
  if (bar.status === 'done' || progress >= 100) return 'done';
  if (bar.status === 'fail') return 'delayed';
  if (bar.endDate && bar.endDate < todayKey) return 'delayed';
  if (bar.status === 'doing' || progress > 0) return 'active';
  return 'planned';
}

function scheduleLevelLabel(level) {
  if (level === 'task') return tGlobal('csLevelHeadTask');
  if (level === 'subtask') return tGlobal('csLevelHeadSubtask');
  return tGlobal('csLevelHeadProject');
}

function packLanes(tasks) {
  const lanes = [];
  return tasks
    .slice()
    .sort((a, b) => a.start - b.start || b.dur - a.dur)
    .map((task) => {
      let lane = lanes.findIndex((end) => task.start > end);
      if (lane < 0) {
        lane = lanes.length;
        lanes.push(0);
      }
      lanes[lane] = task.end;
      return { ...task, lane };
    });
}

function buildTasks({ gantt, teams, people, rangeStart, rangeEnd, days, todayKey }) {
  const personById = new Map(people.map((p) => [p.id, p]));
  const tasks = [];

  for (const [teamIndex, team] of teams.entries()) {
    const bars = gantt.barsByTeam[team] || [];
    bars.forEach((bar, index) => {
      if (bar.endDate < rangeStart || bar.startDate > rangeEnd) return;
      const startKey = bar.startDate < rangeStart ? rangeStart : bar.startDate;
      const endKey = bar.endDate > rangeEnd ? rangeEnd : bar.endDate;
      const start = clamp(dayNumber(startKey), 1, days.length);
      const end = clamp(dayNumber(endKey), 1, days.length);
      const assignees = (bar.assigneeIds || [])
        .map((id) => personById.get(id))
        .filter(Boolean)
        .slice(0, 4)
        .map((person, pi) => ({
          id: person.id,
          name: person.name,
          label: initials(person.name),
          color: barColorForIndex(teamIndex + pi + 2),
        }));

      tasks.push({
        id: `${team}-${bar.projectId}-${index}`,
        nodeId: bar.projectId,
        name: bar.projectName,
        team,
        start,
        end,
        dur: Math.max(1, end - start + 1),
        progress: clamp(Math.round(bar.progress ?? 0), 0, 100),
        status: normalizeStatus(bar, todayKey),
        startAt: bar.startAt,
        endAt: bar.endAt,
        startDate: bar.startDate,
        endDate: bar.endDate,
        note: bar.note || '',
        assignees,
        color: barColorForIndex(teamIndex + index),
      });
    });
  }

  return tasks;
}

function buildGroups(viewMode, teams, tasks) {
  if (viewMode === 'project') {
    const map = new Map();
    for (const task of tasks) {
      const key = task.nodeId || task.name;
      if (!map.has(key)) map.set(key, { id: key, title: task.name, sub: task.team, tasks: [] });
      map.get(key).tasks.push(task);
    }
    return [...map.values()].map((group) => {
      const packed = packLanes(group.tasks);
      const height = Math.max(1, Math.max(...packed.map((t) => t.lane), 0) + 1) * LANE_H + GROUP_PAD * 2;
      return { ...group, tasks: packed, height };
    });
  }

  return teams.map((team) => {
    const packed = packLanes(tasks.filter((task) => task.team === team));
    const height = Math.max(1, Math.max(...packed.map((t) => t.lane), 0) + 1) * LANE_H + GROUP_PAD * 2;
    return { id: team, title: team, sub: tGlobal('csItemsCount', { count: packed.length }), tasks: packed, height };
  });
}

function Ring({ value }) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return (
    <svg className="cs-ring" viewBox="0 0 36 36" aria-hidden>
      <circle className="cs-ring-bg" cx="18" cy="18" r="15" />
      <circle className="cs-ring-fill" cx="18" cy="18" r="15" strokeDasharray={`${pct * 94.2 / 100} 94.2`} />
    </svg>
  );
}

function ScheduleStats({ kpis, totalLabel }) {
  const cards = [
    [totalLabel, kpis.total, null],
    [tGlobal('csInProgress'), kpis.inProgress, null],
    [tGlobal('csDoneUpper'), kpis.done, null],
    [tGlobal('csRate'), `${kpis.rate} %`, kpis.rate],
  ];
  return (
    <div className="cs-stats">
      {cards.map(([label, value, ring]) => (
        <div className="cs-stat" key={label}>
          <div className="cs-stat-label">{label}</div>
          <div className="cs-stat-row">
            <strong>{value}</strong>
            {ring != null && <Ring value={ring} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleBar({ task, onSelect }) {
  const meta = statusMetaFor(task.status);
  return (
    <button
      type="button"
      className={`cs-bar is-${task.status}`}
      style={{
        left: (task.start - 1) * COL_W + 6,
        top: GROUP_PAD + task.lane * LANE_H + 7,
        width: Math.max(28, task.dur * COL_W - 12),
        height: BAR_H,
        '--cs-bar-color': meta.color,
        '--cs-bar-soft': meta.soft,
        '--cs-bar-progress': `${task.progress}%`,
      }}
      title={`${task.name}\n${formatScheduleRange(task.startAt, task.endAt) || `${task.startDate} -> ${task.endDate}`}\n${tGlobal('progress')}: ${task.progress}%`}
      onClick={() => onSelect(task)}
    >
      <span className="cs-bar-fill" aria-hidden />
      <span className="cs-bar-content">
        {task.assignees.slice(0, 2).map((person) => (
          <span key={person.id} className="cs-avatar" style={{ background: person.color }}>
            {person.label}
          </span>
        ))}
        <span className="cs-bar-title">{task.name}</span>
        <strong>{task.progress}%</strong>
      </span>
    </button>
  );
}

function ScheduleBoard({ days, todayDay, groups, selectedId, onSelect }) {
  const timelineW = days.length * COL_W;
  const totalH = groups.reduce((sum, group) => sum + group.height, 0);
  let y = 0;

  return (
    <div className="cs-board">
      <div className="cs-scroll">
        <div className="cs-grid" style={{ width: LABEL_W + timelineW, minHeight: HEADER_H + totalH }}>
          <div className="cs-corner" style={{ width: LABEL_W, height: HEADER_H }}>
            <strong>{tGlobal('csTeamCrew')}</strong>
          </div>
          <div className="cs-days" style={{ left: LABEL_W, width: timelineW, height: HEADER_H }}>
            <div className="cs-days-title">{tGlobal('csDay')}</div>
            <div className="cs-day-row">
              {days.map((day) => (
                <div key={day} className={`cs-daycell ${dayNumber(day) === todayDay ? 'is-today' : ''}`}>
                  {String(dayNumber(day)).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
          <div className="cs-labels" style={{ top: HEADER_H, width: LABEL_W }}>
            {groups.map((group) => {
              const top = y;
              y += group.height;
              return (
                <div key={group.id} className="cs-group-label" style={{ top, height: group.height }}>
                  <div className="cs-group-label-inner">
                    <strong>{group.title}</strong>
                    <span>{group.sub}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cs-time" style={{ left: LABEL_W, top: HEADER_H, width: timelineW, height: totalH }}>
            {days.map((day, index) => (
              <div key={day} className="cs-col" style={{ left: index * COL_W, width: COL_W }} />
            ))}
            {todayDay ? <div className="cs-todayline" style={{ left: (todayDay - 1) * COL_W + COL_W / 2 }} /> : null}
            {(() => {
              let top = 0;
              return groups.flatMap((group) => {
                const rowTop = top;
                top += group.height;
                return [
                  <div key={`${group.id}-sep`} className="cs-row-sep" style={{ top: rowTop + group.height - 1 }} />,
                  ...group.tasks.map((task) => (
                    <div key={task.id} className={selectedId === task.id ? 'cs-task-wrap is-selected' : 'cs-task-wrap'} style={{ top: rowTop }}>
                      <ScheduleBar task={task} onSelect={onSelect} />
                    </div>
                  )),
                ];
              });
            })()}
            {!groups.some((group) => group.tasks.length) && (
              <div className="cs-empty">{tGlobal('csEmptyMonth')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleDrawer({ task, onClose }) {
  if (!task) return null;
  const meta = statusMetaFor(task.status);
  return (
    <aside className="cs-drawer" aria-label={tGlobal('csDrawerAria')}>
      <button type="button" className="cs-drawer-close" onClick={onClose} aria-label={tGlobal('close')}>×</button>
      <span className="cs-status" style={{ color: meta.color, background: meta.soft }}>{meta.label}</span>
      <h3>{task.name}</h3>
      <dl>
        <div><dt>Team</dt><dd>{task.team}</dd></div>
        <div><dt>{tGlobal('csTime')}</dt><dd>{formatScheduleRange(task.startAt, task.endAt) || `${task.startDate} -> ${task.endDate}`}</dd></div>
        <div><dt>{tGlobal('progress')}</dt><dd>{task.progress}%</dd></div>
        {task.note && <div><dt>{tGlobal('workKindNote')}</dt><dd>{task.note}</dd></div>}
      </dl>
      {!!task.assignees.length && (
        <div className="cs-drawer-people">
          {task.assignees.map((person) => (
            <span key={person.id}><i style={{ background: person.color }}>{person.label}</i>{person.name}</span>
          ))}
        </div>
      )}
    </aside>
  );
}

export function TeamScheduleView({ products, people, embedded = false }) {
  const { t } = useI18n();
  const teams = useMemo(() => teamsFromPeople(people), [people]);
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('team');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scheduleLevel, setScheduleLevel] = useState('product');
  const [selectedTask, setSelectedTask] = useState(null);

  const todayKey = currentLocalDateTimeForInput().date;
  const rangeStart = useMemo(() => monthStart(anchorDate), [anchorDate]);
  const rangeEnd = useMemo(() => monthEnd(anchorDate), [anchorDate]);
  const days = useMemo(() => {
    const out = [];
    let cur = rangeStart;
    while (cur <= rangeEnd) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [rangeStart, rangeEnd]);
  const selectedTodayDay = todayKey >= rangeStart && todayKey <= rangeEnd ? dayNumber(todayKey) : null;
  const displayTeams = teamFilter ? [teamFilter] : teams;

  const gantt = useMemo(
    () => buildGanttData(products, people, rangeStart, rangeEnd, teamFilter || null, scheduleLevel),
    [products, people, rangeStart, rangeEnd, teamFilter, scheduleLevel],
  );

  const tasks = useMemo(() => {
    const raw = buildTasks({ gantt, teams: displayTeams, people, rangeStart, rangeEnd, days, todayKey });
    return statusFilter === 'all' ? raw : raw.filter((task) => task.status === statusFilter);
  }, [gantt, displayTeams, people, rangeStart, rangeEnd, days, todayKey, statusFilter]);

  const groups = useMemo(() => buildGroups(viewMode, displayTeams, tasks), [viewMode, displayTeams, tasks]);
  const kpis = useMemo(() => buildScheduleKpis(products, scheduleLevel), [products, scheduleLevel]);
  const totalLabel = `${tGlobal('csTotalPrefix')} ${scheduleLevelLabel(scheduleLevel)}`;

  const shiftMonth = (delta) => {
    setAnchorDate((d) => {
      const next = new Date(d);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
    setSelectedTask(null);
  };

  return (
    <div className={`screen has-nav gantt-screen ${embedded ? 'screen--embedded' : ''}`}>
      {!embedded && (
        <div className="screen-head">
          <h1 className="screen-title">{t('scheduleTitle')}</h1>
          <p className="screen-sub">{t('scheduleSub')}</p>
        </div>
      )}

      <section className="construction-schedule">
        <div className="cs-shell">
          <header className="cs-phead">
            <div>
              <div className="cs-code">{scheduleLevelLabel(scheduleLevel)}</div>
              <h2>{t('csPlanTitle')}</h2>
              <p>{monthLabel(anchorDate)} · {t('csShowingCount', { count: tasks.length })}</p>
            </div>
            <div className="cs-actions">
              <div className="cs-monthnav">
                <button type="button" onClick={() => shiftMonth(-1)} aria-label={t('schedulePrevMonth')}>‹</button>
                <strong>{monthLabel(anchorDate)}</strong>
                <button type="button" onClick={() => shiftMonth(1)} aria-label={t('scheduleNextMonth')}>›</button>
              </div>
              <button type="button" className="cs-today-btn" onClick={() => setAnchorDate(new Date())}>{t('today')}</button>
            </div>
          </header>

          <div className="cs-subbar">
            <div className="cs-seg" role="group" aria-label={t('csGroupModeAria')}>
              <button type="button" className={viewMode === 'team' ? 'active' : ''} onClick={() => setViewMode('team')}>{t('csByTeam')}</button>
              <button type="button" className={viewMode === 'project' ? 'active' : ''} onClick={() => setViewMode('project')}>{t('csByProject')}</button>
            </div>
            <div className="cs-filters" role="group" aria-label={t('csFilterLevelAria')}>
              {levelOptions().map(([value, label]) => (
                <button key={value} type="button" className={scheduleLevel === value ? 'active' : ''} onClick={() => setScheduleLevel(value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="cs-filters" role="group" aria-label={t('csFilterStatusAria')}>
              {statusOptions().map(([value, label]) => (
                <button key={value} type="button" className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <select className="cs-team-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">{t('csAllTeams')}</option>
              {teams.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
          </div>

          <ScheduleBoard
            days={days}
            todayDay={selectedTodayDay}
            groups={groups}
            selectedId={selectedTask?.id}
            onSelect={setSelectedTask}
          />
        </div>

        <ScheduleStats kpis={kpis} totalLabel={totalLabel} />
        <ScheduleDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      </section>
    </div>
  );
}
