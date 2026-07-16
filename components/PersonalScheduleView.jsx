import { useMemo, useState } from 'react';
import {
  addDays,
  barSpansDays,
  barSpansMonths,
  formatColumnLabel,
  monthEnd,
  monthLabel,
  monthStart,
  parseDateKey,
  weekStartMonday,
  yearLabel,
  yearMonthKeys,
} from '../lib/teams.js';
import { aggregate } from '../lib/data.js';
import { currentLocalDateTimeForInput, formatScheduleRange } from '../lib/deadline.js';
import { useI18n, tGlobal } from '../lib/i18n.jsx';

function taskProgress(node) {
  if (!node) return 0;
  if (node.status === 'done') return 100;
  if (node.status === 'fail') return 0;
  const stats = aggregate(node);
  if (stats.total > 0) return Math.round((stats.done / stats.total) * 100);
  if (node.status === 'doing') return 45;
  return 5;
}

function personColor(person, index) {
  return person?.color || ['#3FA66E', '#3D79A8', '#7B61A8', '#D05A45', '#C99A2E', '#4A9B8F'][index % 6];
}

function collectPersonalBars(products = [], people = []) {
  const personById = new Map(people.map((p, index) => [p.id, { ...p, color: personColor(p, index) }]));
  const barsByPerson = {};
  for (const person of personById.values()) barsByPerson[person.id] = [];

  function walk(node, project, parent = null) {
    const isTask = node?._source?.table === 'tasks';
    const assignees = node?.assignees || [];
    const hasSubtasks = (node?.children || []).length > 0;
    const shouldShow = isTask && assignees.length > 0 && (hasSubtasks || parent?._source?.table === 'tasks');

    if (shouldShow) {
      const startAt = node.startedAt || parent?.startedAt || project.startedAt || project.createdAt || null;
      const endAt = node.deadline || parent?.deadline || project.deadline || startAt;
      const startDate = parseDateKey(startAt) || parseDateKey(new Date());
      const endDate = parseDateKey(endAt) || startDate;

      for (const personId of assignees) {
        if (!personById.has(personId)) continue;
        barsByPerson[personId].push({
          id: `${personId}-${node.id}`,
          node,
          personId,
          projectName: project.name,
          taskName: node.name,
          parentName: parent?.name || project.name,
          startAt,
          endAt,
          startDate: startDate <= endDate ? startDate : endDate,
          endDate: endDate >= startDate ? endDate : startDate,
          status: node.status,
          progress: taskProgress(node),
        });
      }
    }

    (node.children || []).forEach((child) => walk(child, project, node));
  }

  products.forEach((project) => walk(project, project, null));
  return { people: [...personById.values()], barsByPerson };
}

function PersonalBar({ bar, span, color, lane, onOpenNode }) {
  const progress = bar.progress ?? 0;
  const isDone = bar.status === 'done' || progress >= 100;
  const isFail = bar.status === 'fail';

  return (
    <button
      type="button"
      className={`gantt-chart-bar personal-chart-bar ${isDone ? 'done' : ''} ${isFail ? 'fail' : ''}`}
      style={{
        '--bar-start': span.start + 1,
        '--bar-span': span.span,
        '--bar-color': color,
        '--bar-fill': `${isDone ? 100 : progress}%`,
        '--bar-lane': lane,
      }}
      title={`${bar.taskName}\n${bar.projectName}\n${formatScheduleRange(bar.startAt, bar.endAt) || `${bar.startDate} -> ${bar.endDate}`}\n${tGlobal('progress')}: ${progress}%`}
      onClick={() => onOpenNode?.(bar.node)}
    >
      <div className="gantt-chart-bar-track" aria-hidden>
        <div className="gantt-chart-bar-fill" />
      </div>
      <div className="gantt-chart-bar-label">
        <span className="gantt-chart-bar-text">{bar.taskName}</span>
        <span className="gantt-chart-bar-pct">{progress}%</span>
      </div>
    </button>
  );
}

export function PersonalScheduleView({ products, people, embedded = false, onOpenNode, showControls = true }) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [personFilter, setPersonFilter] = useState('');

  const { rangeStart, rangeEnd, columns, timelineLabel } = useMemo(() => {
    if (viewMode === 'year') {
      const cols = yearMonthKeys(anchorDate);
      return {
        rangeStart: cols[0],
        rangeEnd: `${anchorDate.getFullYear()}-12-31`,
        columns: cols,
        timelineLabel: yearLabel(anchorDate),
      };
    }
    if (viewMode === 'week') {
      const start = weekStartMonday(anchorDate);
      const end = addDays(start, 6);
      const days = [];
      let cur = start;
      while (cur <= end) {
        days.push(cur);
        cur = addDays(cur, 1);
      }
      return { rangeStart: start, rangeEnd: end, columns: days, timelineLabel: tGlobal('weekShort') };
    }
    const start = monthStart(anchorDate);
    const end = monthEnd(anchorDate);
    const days = [];
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return { rangeStart: start, rangeEnd: end, columns: days, timelineLabel: monthLabel(anchorDate) };
  }, [viewMode, anchorDate]);

  const personal = useMemo(() => collectPersonalBars(products, people), [products, people]);
  const displayRows = useMemo(() => {
    const sourcePeople = personFilter
      ? personal.people.filter((p) => p.id === personFilter)
      : personal.people;

    return sourcePeople
      .map((person) => {
        const bars = personal.barsByPerson[person.id] || [];
        const visible = bars
          .map((bar) => ({
            bar,
            span: viewMode === 'year'
              ? barSpansMonths(bar, columns)
              : barSpansDays(bar, columns),
          }))
          .filter((item) => item.span);
        return { person, visible };
      })
      .filter((row) => personFilter || row.visible.length > 0);
  }, [columns, personFilter, personal, viewMode]);

  const shiftRange = (delta) => {
    setAnchorDate((d) => {
      const next = new Date(d);
      if (viewMode === 'year') next.setFullYear(next.getFullYear() + delta);
      else if (viewMode === 'month') next.setMonth(next.getMonth() + delta);
      else next.setDate(next.getDate() + delta * 7);
      return next;
    });
  };

  const todayKey = currentLocalDateTimeForInput().date;

  return (
    <div className={`screen has-nav gantt-screen ${embedded ? 'screen--embedded' : ''}`}>
      {showControls && (
      <div className="gantt-toolbar">
        <div className="gantt-toolbar-group gantt-toolbar-nav">
          <button type="button" className="gantt-tool-btn" onClick={() => shiftRange(-1)} aria-label={t('prevAria')}>←</button>
          <button type="button" className="gantt-tool-btn" onClick={() => setAnchorDate(new Date())}>{t('today')}</button>
          <button type="button" className="gantt-tool-btn" onClick={() => shiftRange(1)} aria-label={t('nextAria')}>→</button>
          <span className="gantt-period-label">{timelineLabel}</span>
        </div>
        <div className="gantt-toolbar-group gantt-view-switcher">
          {['week', 'month', 'year'].map((mode) => (
            <button
              key={mode}
              type="button"
              className={`gantt-tool-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'week' ? t('weekShort') : mode === 'month' ? t('monthShort') : t('yearShort')}
            </button>
          ))}
        </div>
        <div className="gantt-toolbar-group gantt-toolbar-filter">
          <select
            className="gantt-team-filter"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
          >
            <option value="">{t('allPeople')}</option>
            {personal.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      )}

      <div className="gantt-panel">
        <h2 className="gantt-panel-title">{t('personalScheduleTitle')}</h2>
        <div className="gantt-table-wrap personal-gantt-wrap">
          <table className="gantt-table personal-gantt-table" style={{ '--gantt-cols': columns.length }}>
            <thead>
              <tr>
                <th className="gantt-th-rowhead">{t('navPeople')}</th>
                <th className="gantt-th-timeline" colSpan={columns.length}>
                  {viewMode === 'year' ? t('monthShort') : viewMode === 'month' ? t('dayShort') : t('weekShort')}
                </th>
              </tr>
              <tr>
                <th className="gantt-th-rowhead gantt-th-sub" />
                {columns.map((col) => {
                  const isToday = col === todayKey
                    || (viewMode === 'year' && col.slice(0, 7) === todayKey.slice(0, 7));
                  return (
                    <th key={col} className={`gantt-th-col ${isToday ? 'today' : ''}`}>
                      {formatColumnLabel(col, viewMode)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ person, visible }) => {
                const colCount = columns.length;

                return (
                  <tr key={person.id} className="gantt-tr">
                    <td className="gantt-td-team personal-td-person">
                      <span className="personal-color-dot" style={{ background: person.color }} />
                      <span>{person.name}</span>
                    </td>
                    <td className="gantt-td-chart" colSpan={colCount}>
                      <div
                        className="gantt-chart-row"
                        style={{
                          '--gantt-cols': colCount,
                          '--gantt-row-height': `${Math.max(visible.length, 1) * 46 + 16}px`,
                        }}
                      >
                        {columns.map((col) => (
                          <div key={col} className="gantt-chart-cell" />
                        ))}
                        {visible.map(({ bar, span }, lane) => (
                          <PersonalBar
                            key={bar.id}
                            bar={bar}
                            span={span}
                            color={person.color}
                            lane={lane}
                            onOpenNode={onOpenNode}
                          />
                        ))}
                        {visible.length === 0 && (
                          <span className="gantt-empty-row">{t('emptyScheduleCell')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayRows.length === 0 && (
                <tr className="gantt-tr">
                  <td className="gantt-td-team">{t('noWorkRow')}</td>
                  <td className="gantt-td-chart" colSpan={columns.length}>
                    <div
                      className="gantt-chart-row"
                      style={{ '--gantt-cols': columns.length, '--gantt-row-height': '50px' }}
                    >
                      {columns.map((col) => (
                        <div key={col} className="gantt-chart-cell" />
                      ))}
                      <span className="gantt-empty-row">{t('emptyScheduleCell')}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
