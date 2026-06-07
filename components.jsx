// Components for Check Lỗi Việc

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  PEOPLE,
  STATUS_META,
  aggregate,
  formatDeadline,
  deadlineTone,
} from './lib/data.js';
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
  const list = (ids || []).map((id) => PEOPLE.find((p) => p.id === id)).filter(Boolean);
  const sizeClass = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : '';

  if (list.length === 0) {
    if (!alwaysShow) return null;
    return (
      <div className={`avatars avatars--empty ${sizeClass}`} title="Chưa giao việc">
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
  const m = STATUS_META[status] || STATUS_META.todo;
  return (
    <span className={`chip status-${status}`}>
      <span className="dot"/>{m.label}
    </span>
  );
}

function DeadlineChip({ iso, status, onClick, emptyLabel = 'Ghi deadline' }) {
  const tone = deadlineTone(iso, status);
  const label = iso ? formatDeadline(iso) : emptyLabel;
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
function ProgressBar({ stats }) {
  const { total, done, doing, fail } = stats;
  if (total === 0) return null;
  const pct = n => `${(n / total) * 100}%`;
  return (
    <div className="progress" aria-label={`${done}/${total} đạt`}>
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

function PhotoThumb({ photo, onClick }) {
  const thumbStyle = photo.url
    ? {
        backgroundImage: `url(${photo.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: photo.tint || '#E8D5C4',
      }
    : { background: photoBg(photo.tint) };

  return (
    <div className="photo" onClick={onClick}>
      <div className="thumb" style={thumbStyle}>
        {photo.kind === 'bad' && <span className="badge-bad">Lỗi</span>}
      </div>
      <div className="cap">{photo.label}</div>
    </div>
  );
}

// ─── Compact item (child card) ────────────────────────────────────
function ItemCard({ node, depth, onOpen, onOpenActions, onComplete, active = false }) {
  const stats = aggregate(node);
  const hasChildren = node.children && node.children.length > 0;
  const isFeature = node?._source?.table === 'features';
  const showProgress = isFeature && hasChildren && stats.total > 0;
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const tone = deadlineTone(node.deadline, node.status);

  return (
    <div
      className={`item ${node.status === 'fail' ? 'fail' : ''} ${node.status === 'done' ? 'done' : ''} ${active ? 'item--active' : ''}`}
      onClick={onOpen}
    >
      <StatusBlob status={node.status} />
      <div className="item-main">
        <div className={`item-title ${node.status === 'done' ? 'strike' : ''}`}>{node.name}</div>
        {showProgress && (
          <div className="item-progress" onClick={(e) => e.stopPropagation()}>
            <ProgressBar stats={stats}/>
            <span className="item-progress-pct">{pct}%</span>
          </div>
        )}
        <div className="item-foot">
          <div className="item-sub">
            {node.deadline && (
              <span className={tone !== 'neutral' ? `deadline-tone-${tone}` : ''}>
                {formatDeadline(node.deadline)}
              </span>
            )}
            {showProgress && (
              <>
                <span className="sep"/>
                <span><b>{stats.done}</b>/{stats.total} việc</span>
                {stats.fail > 0 && (
                  <>
                    <span className="sep"/>
                    <span className="item-progress-fail">{stats.fail} lỗi</span>
                  </>
                )}
              </>
            )}
            {hasChildren && !showProgress && (
              <>
                <span className="sep"/>
                <span><b>{stats.done}</b>/{stats.total}</span>
              </>
            )}
            {node.photos && node.photos.length > 0 && (
              <>
                <span className="sep"/>
                <span>{node.photos.length} ảnh</span>
              </>
            )}
            {node.note && (
              <>
                <span className="sep"/>
                <Icon.note style={{ opacity: 0.6 }}/>
              </>
            )}
            {node.completedAt && (
              <>
                <span className="sep"/>
                <span className="item-completed-at">HT {formatCompletedAt(node.completedAt)}</span>
              </>
            )}
          </div>
          <div className="item-actions">
            {typeof onComplete === 'function' && !node.completedAt && (
              <button
                type="button"
                className="item-complete-btn"
                aria-label="Hoàn thành"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(node);
                }}
              >
                <Icon.check/>
              </button>
            )}
            {node.issues > 0 && <div className="mini-issue">{node.issues}</div>}
            <Avatars ids={node.assignees} size="sm" max={3} alwaysShow/>
            {onOpenActions && (
              <button type="button" className="item-more icon-btn" aria-label="Tùy chọn" onClick={onOpenActions}>
                <Icon.more/>
              </button>
            )}
            <Icon.chev className="chev"/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Note block ──────────────────────────────────────────────────
function NoteBlock({ text, onEdit }) {
  if (!text) return null;
  const displayText = String(text).replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
  return (
    <div className="note-block">
      <Icon.note className="note-icon"/>
      <div className="note-text">{displayText}</div>
      <button className="note-edit" onClick={onEdit}>Sửa</button>
    </div>
  );
}

// ─── Sheet (bottom modal) ────────────────────────────────────────
function Sheet({ title, onClose, children, actions }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose}/>
      <div className="sheet">
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
