// Components for Check Lỗi Việc

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  PEOPLE,
  aggregate,
  formatDeadline,
  deadlineTone,
} from './lib/data.js';
import { useI18n } from './lib/i18n.jsx';
import { formatCompletedAt } from './lib/nodeCompletion.js';

// ─── Icons (inline SVG, stroke-based) ─────────────────────────────
const Icon = {
  back:   (p={}) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  more:   (p={}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>,
  chev:   (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  plus:   (p={}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  close:  (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  check:  (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  warn:   (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M12 2L2 21h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 10v5M12 18v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  bell:   (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M6 8a6 6 0 0112 0v5l2 3H4l2-3V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  cal:    (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  cam:    (p={}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><path d="M4 8h3l2-2h6l2 2h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2"/></svg>,
  note:   (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M8 11h8M8 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  user:   (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4 21a8 8 0 0116 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  search: (p={}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  filter: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M4 5h16M7 12h10M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  trash:  (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  edit:   (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>,
  eye:    (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}><path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>,
};

// ─── Avatars ──────────────────────────────────────────────────────
function Avatars({ ids = [], max = 4, size = 'md', alwaysShow = false }) {
  const { t } = useI18n();
  const list = (ids || []).map((id) => PEOPLE.find((p) => p.id === id)).filter(Boolean);
  const sizeClass = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : '';

  if (list.length === 0) {
    if (!alwaysShow) return null;
    return (
      <div className={`avatars avatars--empty ${sizeClass}`} title={t('notAssigned')}>
        <div className="av av-placeholder">
          <Icon.user/>
        </div>
      </div>
    );
  }

  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return (
    <div className={`avatars ${sizeClass}`}>
      {shown.map((p) => (
        <div key={p.id} className="av" style={{ background: p.color }} title={p.name}>{p.initials}</div>
      ))}
      {rest > 0 && <div className="more">+{rest}</div>}
    </div>
  );
}

// ─── Status chip ──────────────────────────────────────────────────
function StatusChip({ status }) {
  const { statusMeta } = useI18n();
  const m = statusMeta[status] || statusMeta.todo;
  return (
    <span className={`chip status-${status}`}>
      <span className="dot"/>{m.label}
    </span>
  );
}

function DeadlineChip({ iso, status, onClick, emptyLabel }) {
  const { t } = useI18n();
  const resolvedEmpty = emptyLabel ?? t('deadlineEmpty');
  const tone = deadlineTone(iso, status);
  const label = iso ? formatDeadline(iso) : resolvedEmpty;
  const className = `chip deadline ${tone !== 'neutral' ? tone : ''} ${!iso ? 'deadline-empty' : ''} ${onClick ? 'deadline-btn' : ''}`;

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <Icon.cal />
        {label}
      </button>
    );
  }

  return (
    <span className={className}>
      <Icon.cal />
      {label}
    </span>
  );
}

// ─── Status blob (left of list item) ──────────────────────────────
function StatusBlob({ status }) {
  return (
    <div className={`status-blob ${status}`}>
      {status === 'done' && <Icon.check />}
      {status === 'fail' && <Icon.warn />}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────
function ProgressBar({ stats, percent = null }) {
  const { t } = useI18n();
  const { total, done, doing, fail } = stats;
  const manualPercent = percent === null || percent === undefined || percent === '' ? null : Number(percent);
  if (Number.isFinite(manualPercent)) {
    const value = Math.max(0, Math.min(100, Math.round(manualPercent)));
    return (
      <div className="progress" aria-label={`${value}%`}>
        {value > 0 && <span className="seg-done" style={{ width: `${value}%` }}/>}
      </div>
    );
  }
  if (total === 0) return null;
  const pct = n => `${(n / total) * 100}%`;
  return (
    <div className="progress" aria-label={t('progressAchieved', { done, total })}>
      {done > 0 && <span className="seg-done" style={{ width: pct(done) }}/>}
      {fail > 0 && <span className="seg-fail" style={{ width: pct(fail) }}/>}
      {doing > 0 && <span className="seg-doing" style={{ width: pct(doing) }}/>}
    </div>
  );
}

// ─── Photo thumb (uses tint placeholder) ──────────────────────────
function photoBg(tint) {
  // Subtle radial pattern over tint
  return `
    radial-gradient(circle at 25% 30%, rgba(255,255,255,0.35) 0%, transparent 35%),
    radial-gradient(circle at 75% 70%, rgba(0,0,0,0.08) 0%, transparent 40%),
    linear-gradient(135deg, ${tint} 0%, ${shade(tint, -12)} 100%)
  `;
}
function shade(hex, pct) {
  // shift each channel
  const c = hex.replace('#','');
  const r = Math.max(0, Math.min(255, parseInt(c.slice(0,2),16) + pct));
  const g = Math.max(0, Math.min(255, parseInt(c.slice(2,4),16) + pct));
  const b = Math.max(0, Math.min(255, parseInt(c.slice(4,6),16) + pct));
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function PhotoThumb({ photo, onClick, onView }) {
  const thumbStyle = photo.url
    ? {
        backgroundImage: `url(${photo.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: photo.tint || '#E8D5C4',
      }
    : { background: photoBg(photo.tint) };

  const handleView = (e) => {
    e.stopPropagation();
    (onView || onClick)?.(photo);
  };

  return (
    <div className="photo" onClick={onClick}>
      <div className="thumb" style={thumbStyle}>
        {photo.kind === 'bad' && <span className="badge-bad">Lỗi</span>}
        {photo.url && (onView || onClick) && (
          <button
            type="button"
            className="photo-view-btn"
            aria-label="Xem ảnh full"
            title="Xem ảnh full"
            onClick={handleView}
          >
            <Icon.eye />
          </button>
        )}
      </div>
      <div className="cap">{photo.label}</div>
    </div>
  );
}

// ─── Compact item (child card — same layout as product card) ───────
function ItemCard({ node, depth, onOpen, onOpenActions, onComplete, onEditGoodsPercent, active = false }) {
  const { t } = useI18n();
  const stats = aggregate(node);
  const hasChildren = node.children && node.children.length > 0;
  const isFeature = node?._source?.table === 'features';
  const isSubtask = node?._source?.table === 'tasks' && Boolean(node?._source?.parentTaskId);
  const childCount = (node.children || []).length;
  const manualPct = node.goodsPercent !== null && node.goodsPercent !== undefined ? Number(node.goodsPercent) : null;
  const pct = Number.isFinite(manualPct)
    ? Math.max(0, Math.min(100, Math.round(manualPct)))
    : (stats.total ? Math.round((stats.done / stats.total) * 100) : 0);
  const tone = deadlineTone(node.deadline, node.status);

  return (
    <div
      className={`product-card item-card item ${node.status === 'fail' ? 'fail' : ''} ${node.status === 'done' ? 'done' : ''} ${active ? 'item--active' : ''}`}
      onClick={onOpen}
    >
      <div className="pc-row1">
        <div className="pc-head">
          <div className="pc-title-line">
            <span className={`pc-title ${node.status === 'done' ? 'strike' : ''}`}>{node.name}</span>
          </div>
        </div>
        <div className="product-card-assignees" onClick={(e) => e.stopPropagation()}>
          <Avatars ids={node.assignees} size="sm" max={3} alwaysShow/>
        </div>
        {onOpenActions && (
          <button
            type="button"
            className="product-card-more icon-btn"
            aria-label={t('options')}
            onClick={(e) => { e.stopPropagation(); onOpenActions(node); }}
          >
            <Icon.more/>
          </button>
        )}
      </div>
      <div className="pc-meta">
        <StatusChip status={node.status}/>
        {node.goodsPercent !== null && node.goodsPercent !== undefined && (
          <span className="pc-goods-percent">{node.goodsPercent}% hoàn thành</span>
        )}
        {node.deadline && (
          <span className={`chip deadline ${tone !== 'neutral' ? tone : ''}`}>
            <Icon.cal/>{formatDeadline(node.deadline)}
          </span>
        )}
        {node.issues > 0 && (
          <span className="pc-issue-pill">
            <Icon.warn/> {node.issues}
          </span>
        )}
      </div>
      <div className="pc-foot">
        <div className="pc-counts">
          {isFeature && hasChildren && (
            <span><b>{childCount}</b> {t('labelWorkItems')}</span>
          )}
          {stats.total > 0 && (
            <>
              {isFeature && hasChildren && <span className="dot-sep"/>}
              <span><b>{stats.done}</b>/{stats.total} {t('labelTasks')}</span>
            </>
          )}
          {stats.fail > 0 && (
            <>
              <span className="dot-sep"/>
              <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>{stats.fail} {t('labelErrors')}</span>
            </>
          )}
          {node.photos && node.photos.length > 0 && (
            <>
              <span className="dot-sep"/>
              <span>{node.photos.length} {t('labelPhotos')}</span>
            </>
          )}
          {node.note && (
            <>
              <span className="dot-sep"/>
              <Icon.note style={{ opacity: 0.6 }}/>
            </>
          )}
          {node.completedAt && (
            <>
              <span className="dot-sep"/>
              <span className="item-completed-at">{t('completedAtShort')} {formatCompletedAt(node.completedAt)}</span>
            </>
          )}
        </div>
        <div className="pc-progress-row">
          <ProgressBar stats={stats}/>
          <div className="pct">{pct}%</div>
        </div>
        {typeof onComplete === 'function' && !node.completedAt && (
          <button
            type="button"
            className="work-action-complete-btn product-card-complete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onComplete(node);
            }}
          >
            <Icon.check/>
            {t('workComplete')}
          </button>
        )}
        {isSubtask && typeof onEditGoodsPercent === 'function' && (
          <button
            type="button"
            className="product-card-percent-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEditGoodsPercent(node);
            }}
          >
            <Icon.edit/>
            Tỉ lệ hoàn thành
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Note block ──────────────────────────────────────────────────
function NoteBlock({ text, onEdit, label }) {
  if (!text) return null;
  const displayText = String(text).replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
  return (
    <div className="note-block">
      <Icon.note className="note-icon"/>
      <div className="note-text">
        {label && (
          <>
            <span className="note-label">{label}</span>
            <br />
          </>
        )}
        {displayText}
      </div>
      <button className="note-edit" onClick={onEdit}>Sửa</button>
    </div>
  );
}

// ─── Sheet (bottom modal) ────────────────────────────────────────
function Sheet({ title, onClose, children, actions, className = '' }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose}/>
      <div className={`sheet ${className}`.trim()}>
        <div className="grab"/>
        <div className="sheet-head">
          <h3>{title}</h3>
          {actions}
          <button className="sheet-close" onClick={onClose}><Icon.close/></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

export {
  Icon,
  Avatars,
  StatusChip,
  DeadlineChip,
  StatusBlob,
  ProgressBar,
  PhotoThumb,
  ItemCard,
  NoteBlock,
  Sheet,
  photoBg,
};
