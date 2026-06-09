import { useMemo, useState } from 'react';
import {
  buildGanttData,
  barSpansDays,
  barSpansMonths,
  barColorForIndex,
  buildScheduleKpis,
  formatColumnLabel,
  weekStartMonday,
  monthStart,
  monthEnd,
  monthLabel,
  yearLabel,
  yearMonthKeys,
  addDays,
  teamsFromPeople,
} from '../lib/teams.js';
import { currentLocalDateTimeForInput, formatScheduleRange } from '../lib/deadline.js';
import { useI18n } from '../lib/i18n.jsx';

function KpiCard({ label, value, suffix, ring }) {
  return (
    <div className="gantt-kpi-card">
      <div className="gantt-kpi-label">{label}</div>
      <div className="gantt-kpi-value-row">
        <span className="gantt-kpi-value">{value}</span>
        {suffix && <span className="gantt-kpi-suffix">{suffix}</span>}
        {ring != null && (
          <svg className="gantt-kpi-ring" viewBox="0 0 36 36" aria-hidden>
            <circle className="gantt-kpi-ring-bg" cx="18" cy="18" r="15" />
            <circle
              className="gantt-kpi-ring-fill"
              cx="18"
              cy="18"
              r="15"
              strokeDasharray={`${ring * 94.2 / 100} 94.2`}
            />
          </svg>
        )}
      </div>
    </div>
  );
}

function GanttProgressBar({ bar, span, color, lane = 0 }) {
  const progress = bar.progress ?? 0;
  const isDone = bar.status === 'done' || progress >= 100;
  const isFail = bar.status === 'fail';
  const showLabel = span.span >= 3;
  const showPct = span.span >= 2;

  return (
    <div
      className={`gantt-chart-bar ${isDone ? 'done' : ''} ${isFail ? 'fail' : ''}`}
      style={{
        '--bar-start': span.start + 1,
        '--bar-span': span.span,
        '--bar-color': color,
        '--bar-fill': `${isDone ? 100 : progress}%`,
        '--bar-lane': lane,
      }}
      title={`${bar.projectName}\n${formatScheduleRange(bar.startAt, bar.endAt) || `${bar.startDate} → ${bar.endDate}`}\nTiến độ: ${progress}%`}
    >
      <div className="gantt-chart-bar-track" aria-hidden>
        <div className="gantt-chart-bar-fill" />
      </div>
      {(showLabel || showPct) && (
        <div className="gantt-chart-bar-label">
          {showLabel && <span className="gantt-chart-bar-text">{bar.projectName}</span>}
          {showPct && (
            <span className="gantt-chart-bar-pct">{progress}%</span>
          )}
        </div>
      )}
    </div>
  );
}

export function TeamScheduleView({ products, people, embedded = false, showControls = true }) {
  const { t } = useI18n();
  const teams = useMemo(() => teamsFromPeople(people), [people]);
  const [viewMode, setViewMode] = useState('month');
  const [teamFilter, setTeamFilter] = useState('');
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  const kpis = useMemo(() => buildScheduleKpis(products), [products]);

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
      return { rangeStart: start, rangeEnd: end, columns: days, timelineLabel: 'Tuần' };
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

  const gantt = useMemo(
    () => buildGanttData(products, people, rangeStart, rangeEnd, teamFilter || null),
    [products, people, rangeStart, rangeEnd, teamFilter],
  );

  const displayTeams = gantt.teams.length ? gantt.teams : teams;

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
      {!embedded && (
        <div className="screen-head">
          <h1 className="screen-title">{t('scheduleTitle')}</h1>
          <p className="screen-sub">{t('scheduleSub')}</p>
        </div>
      )}

      {showControls && (
      <div className="gantt-toolbar">
        <div className="gantt-toolbar-group gantt-toolbar-nav">
          <button type="button" className="gantt-tool-btn" onClick={() => shiftRange(-1)} aria-label="Trước">←</button>
          <button type="button" className="gantt-tool-btn" onClick={() => setAnchorDate(new Date())}>Hôm nay</button>
          <button type="button" className="gantt-tool-btn" onClick={() => shiftRange(1)} aria-label="Sau">→</button>
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
              {mode === 'week' ? 'Tuần' : mode === 'month' ? 'Tháng' : 'Năm'}
            </button>
          ))}
        </div>
        <div className="gantt-toolbar-group gantt-toolbar-filter">
          <select
            className="gantt-team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="">Tất cả đội</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      )}

      <div className="gantt-panel">
        <h2 className="gantt-panel-title">KẾ HOẠCH CÔNG TRÌNH</h2>

        <div className="gantt-table-wrap">
          <table className="gantt-table" style={{ '--gantt-cols': columns.length }}>
            <thead>
              <tr>
                <th className="gantt-th-rowhead">Đội thợ</th>
                <th className="gantt-th-timeline" colSpan={columns.length}>
                  {viewMode === 'year' ? 'Tháng' : viewMode === 'month' ? 'Ngày' : 'Tuần'}
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
              {displayTeams.map((team, ti) => {
                const bars = gantt.barsByTeam[team] || [];
                const colCount = columns.length;
                const visibleBarCount = bars.reduce((count, bar) => {
                  const span = viewMode === 'year'
                    ? barSpansMonths(bar, columns)
                    : barSpansDays(bar, columns);
                  return span ? count + 1 : count;
                }, 0);
                let visibleBarIndex = 0;
                return (
                  <tr key={team} className="gantt-tr">
                    <td className="gantt-td-team">{team}</td>
                    <td className="gantt-td-chart" colSpan={colCount}>
                      <div
                        className="gantt-chart-row"
                        style={{
                          '--gantt-cols': colCount,
                          '--gantt-row-height': `${Math.max(visibleBarCount, 1) * 46 + 16}px`,
                        }}
                      >
                        {columns.map((col) => (
                          <div key={col} className="gantt-chart-cell" />
                        ))}
                        {bars.map((bar, bi) => {
                          const span = viewMode === 'year'
                            ? barSpansMonths(bar, columns)
                            : barSpansDays(bar, columns);
                          if (!span) return null;
                          const lane = visibleBarIndex;
                          visibleBarIndex += 1;
                          const color = barColorForIndex(ti + lane);
                          return (
                            <GanttProgressBar
                              key={`${bar.projectId}-${bi}`}
                              bar={bar}
                              span={span}
                              color={color}
                              lane={lane}
                            />
                          );
                        })}
                        {visibleBarCount === 0 && (
                          <span className="gantt-empty-row">Trống lịch</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="gantt-kpi-grid">
        <KpiCard label="TỔNG CÔNG TRÌNH" value={kpis.total} />
        <KpiCard label="ĐANG THỰC HIỆN" value={kpis.inProgress} />
        <KpiCard label="HOÀN THÀNH" value={kpis.done} />
        <KpiCard label="TỶ LỆ HOÀN THÀNH" value={kpis.rate} suffix="%" ring={kpis.rate} />
      </div>
    </div>
  );
}
