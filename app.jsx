// Main App — Check Lỗi Việc

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchAppData,
  saveNodePatch,
  saveNodeFull,
  savePersonProfile,
  saveTaskPhotos,
  saveTaskWorkActions,
  saveFeatureDocLinks,
  saveProjectDocLinks,
  completeNode,
  deleteNode,
  createChildNode,
  createProduct,
  getLoggedInPersonId,
  saveProjectSiteLocation,
  saveProjectAttendance,
  saveProjectTeamSchedules,
  saveProjectStartedAt,
  canAddChildren,
  addChildLabels,
  resolveAddChildParent,
  resolveListParent,
  resolveProjectFromStack,
} from './lib/api.js';
import {
  buildPersonPath,
  buildProductPath,
  normalizeProductStack,
  stacksEqual,
  productPathForNode,
  parseAppPath,
  pathForTab,
} from './lib/routes.js';
import { RouteLinks } from './lib/RouteLinks.jsx';
import { DesktopShell } from './components/DesktopShell.jsx';
import { swapLayoutPath } from './lib/routes.js';
import { useEffectiveLayout } from './lib/useEffectiveLayout.js';
import { combineDeadlineLocal, splitDeadlineForInput, formatScheduleRange } from './lib/deadline.js';
import { filesToPhotos, getImageFilesFromClipboard } from './lib/photos.js';
import {
  newWorkActionId,
  splitActionDateTime,
  formatWorkActionRange,
  formatDurationMinutes,
  actionDurationMinutes,
  completeWorkAction,
  isWorkActionInProgress,
} from './lib/workActions.js';
import { formatCompletedAt } from './lib/nodeCompletion.js';
import {
  resolveAccessRole,
  isAdmin,
  canDeleteNode,
  canDeleteWorkAction,
  canEditWorkAction,
  filterProductsForUser,
  readStoredAccessRole,
  writeStoredAccessRole,
  ACCESS_ROLE,
} from './lib/permissions.js';
import { checkoutSession } from './lib/attendance.js';
import { newTeamScheduleId } from './lib/siteLocation.js';
import { teamsFromPeople } from './lib/teams.js';
import { AttendancePanel } from './components/AttendancePanel.jsx';
import { SiteLocationSheet, TeamScheduleSheet, ProjectStartedAtSheet } from './components/FieldOpsSheets.jsx';
import { FieldOpsScreen } from './components/FieldOpsScreen.jsx';
import { DateTimeFields } from './components/DateTimeFields.jsx';
import { AttendanceEmbedView } from './components/AttendanceEmbedView.jsx';
import {
  PEOPLE,
  setPeople,
  setPathIndex,
  pathIndex,
  LEVEL_LABEL,
  STATUS_META,
  aggregate,
  formatDeadline,
  deadlineTone,
  personStats,
  findAssignmentsFor,
  findAssignedSubtasksFor,
  personSubtaskStats,
} from './lib/data.js';
import {
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
} from './components.jsx';
import { IOSDevice } from './ios-frame.jsx';
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakColor,
  TweakRadio,
  TweakToggle,
  TweakButton,
} from './tweaks-panel.jsx';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#C8553D",
  "density": "comfy",
  "showProgressBar": true,
  "showStats": true
}/*EDITMODE-END*/;

const CURRENT_USER_STORAGE_KEY = 'taskApp.currentUserId';

function readStoredCurrentUserId() {
  try {
    return window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredCurrentUserId(userId) {
  try {
    if (userId) window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
  } catch {
    // Ignore storage errors; the app can still infer a user for this session.
  }
}

function resolveCurrentUserId(people, products, preferredId = null) {
  if (!people?.length) return null;
  const validIds = new Set(people.map((p) => p.id));

  if (preferredId && validIds.has(preferredId)) return preferredId;

  const storedId = readStoredCurrentUserId();
  if (storedId && validIds.has(storedId)) return storedId;

  const withAssignedSubtasks = people
    .map((p) => ({
      id: p.id,
      count: findAssignedSubtasksFor(p.id, products).length,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  return withAssignedSubtasks[0]?.id || people[0].id;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizePrintLineBreaks(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function escapeHtmlWithBreaks(value) {
  return normalizePrintLineBreaks(value)
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>');
}

function printSubtaskReport({ person, items }) {
  if (!items?.length) return;
  const printedAt = new Date().toLocaleString('vi-VN');
  const rows = items.map((it, index) => {
    const status = STATUS_META[it.node.status]?.label || it.node.status || '';
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(it.customerName || '')}</td>
        <td>${escapeHtml(it.productName || '')}</td>
        <td>${escapeHtml(it.featureName || it.parentName || '')}</td>
        <td>${escapeHtml(it.parentTaskName || '')}</td>
        <td>${escapeHtml(it.node.name || '')}</td>
        <td>${escapeHtml(formatDeadline(it.node.deadline) || '')}</td>
        <td>${escapeHtml(status)}</td>
        <td class="note-cell">${escapeHtmlWithBreaks(it.node.note || '')}</td>
      </tr>
    `;
  }).join('');

  const report = window.open('', '_blank', 'width=1200,height=800');
  if (!report) return;

  report.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Báo cáo sub-task</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #1f2428; margin: 24px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          .meta { color: #666; font-size: 12px; margin-bottom: 18px; display: flex; gap: 16px; flex-wrap: wrap; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d8d8d8; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; font-weight: 700; }
          .note-cell { white-space: normal; overflow-wrap: anywhere; line-height: 1.4; }
          .note-cell br { display: block; content: ""; margin: 0 0 4px; }
          td:first-child, th:first-child { width: 38px; text-align: center; }
          @page { size: A4 landscape; margin: 12mm; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>Báo cáo sub-task</h1>
        <div class="meta">
          <span>Nhân sự: <strong>${escapeHtml(person?.name || '')}</strong></span>
          <span>Số lượng: <strong>${items.length}</strong></span>
          <span>Thời gian in: ${escapeHtml(printedAt)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Khách hàng</th>
              <th>Dự án</th>
              <th>Hạng mục</th>
              <th>Task</th>
              <th>Sub-task</th>
              <th>Deadline</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`);
  report.document.close();
  report.focus();
  report.print();
}

function openDocUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return;
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  window.open(href, '_blank', 'noopener,noreferrer');
}

function collectDocLinksFromTree(node) {
  if (!node) return [];
  const out = [];
  const seen = new Set();
  const walk = (cur) => {
    (cur.docLinks || []).forEach((d) => {
      if (!d?.id) return;
      const key = `${cur.id}:${d.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        ...d,
        sourceNodeId: cur.id,
        sourceName: cur.name || 'Mục',
        sourceTable: cur._source?.table,
      });
    });
    (cur.children || []).forEach(walk);
  };
  walk(node);
  return out;
}

function directSubtasksOf(task) {
  if (task?._source?.table !== 'tasks') return [];
  return (task.children || []).filter((child) => child?._source?.parentTaskId);
}

function collectSubtasksForFeature(feature) {
  if (feature?._source?.table !== 'features') return [];
  return (feature.children || []).flatMap((task) => directSubtasksOf(task));
}

function collectAllSubtaskItems(products) {
  const out = [];
  function walk(node, productRoot, featureNode, parentTaskNode) {
    const table = node?._source?.table;
    const nextFeature = table === 'features' ? node : featureNode;
    const nextParentTask = table === 'tasks' && !node._source?.parentTaskId ? node : parentTaskNode;

    if (table === 'tasks' && node._source?.parentTaskId) {
      out.push({
        node,
        productId: productRoot.id,
        productName: productRoot.name,
        customerName: productRoot.customerName || null,
        featureName: nextFeature?.name || '',
        parentTaskName: parentTaskNode?.name || '',
      });
    }

    (node.children || []).forEach((child) => walk(child, productRoot, nextFeature, nextParentTask));
  }
  products.forEach((product) => walk(product, product, null, null));
  return out;
}

function progressForSubtaskItems(items) {
  const total = items.length;
  const done = items.filter((it) => it.node.status === 'done' || it.node.completedAt).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

function taskProgressLabel(item, allItems) {
  const siblings = allItems.filter((it) => (
    it.productId === item.productId
    && it.featureName === item.featureName
    && it.parentTaskName === item.parentTaskName
  ));
  return progressForSubtaskItems(siblings);
}

function priorityForWorkItem(node) {
  if (node.status === 'fail') return { label: 'Cao', tone: 'high' };
  const tone = deadlineTone(node.deadline, node.status);
  if (tone === 'overdue' || tone === 'urgent') return { label: 'Cao', tone: 'high' };
  if (tone === 'soon') return { label: 'Trung bình', tone: 'medium' };
  return { label: 'Thấp', tone: 'low' };
}

function isWithinDateRange(iso, from, to) {
  if (!from && !to) return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (d < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (d > end) return false;
  }
  return true;
}

function totalWorkMinutesFor(node) {
  return (node?.workActions || []).reduce((sum, action) => {
    const mins = actionDurationMinutes(action);
    return sum + (mins || 0);
  }, 0);
}

function DesktopSubtaskPanel({
  title, items, activeId, selectedIds, allSelected, selectedCount,
  onToggleSelected, onSelectAll, onClearSelected, onPrintSelected,
  onOpen, onOpenActions, onComplete,
}) {
  return (
    <div className="desktop-subtask-panel">
      <div className="section">
        <div className="section-head">
          <div className="section-title">
            {title} {items.length > 0 && `· ${items.length}`}
          </div>
          {items.length > 0 && (
            <div className="desktop-subtask-panel-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={allSelected ? onClearSelected : onSelectAll}
              >
                {allSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedCount === 0}
                onClick={onPrintSelected}
              >
                In ({selectedCount})
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="desktop-subtask-panel-list">
        {items.length === 0 ? (
          <div className="empty">Chưa có sub-task.</div>
        ) : (
          items.map((item) => {
            const selected = selectedIds?.has(item.id);
            return (
              <div key={item.id} className="desktop-subtask-panel-row">
                <button
                  type="button"
                  className={`subtask-select ${selected ? 'checked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelected?.(item.id);
                  }}
                  aria-pressed={selected}
                  aria-label={`${selected ? 'Bỏ chọn' : 'Chọn'} sub-task ${item.name}`}
                >
                  {selected && <Icon.check/>}
                </button>
                <ItemCard
                  node={item}
                  depth={3}
                  active={item.id === activeId}
                  onOpen={() => onOpen?.(item)}
                  onOpenActions={onOpenActions ? (e) => { e.stopPropagation(); onOpenActions(item); } : undefined}
                  onComplete={onComplete}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function collectPhotosFromTree(node) {
  if (!node) return [];
  const out = [];
  const seen = new Set();
  const walk = (cur, ownerName) => {
    (cur.photos || []).forEach((ph, idx) => {
      const key = ph.id || `${ph.url || ownerName}-${idx}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        ...ph,
        id: key,
        sourceNodeId: cur.id,
        sourceName: ownerName || cur.name || 'Mục',
        label: ph.label || ownerName || cur.name || 'Tài liệu',
      });
    });
    (cur.children || []).forEach((child) => walk(child, child.name || ownerName));
  };
  walk(node, node.name);
  return out;
}

// ─── NodeDetail screen ────────────────────────────────────────────
function NodeDetail({
  node, depth, parent, t = {}, onOpenChild, onBack, onOpenPhoto, onViewPhoto, onEditNote, onEditDeadline,
  onOpenAssignees, onCycleStatus, onAddChild, onAddFeature, onOpenActions, onChildActions,
  onPastePhotos, onOpenWorkAction, onCompleteWorkAction, onDeletePhoto, onOpenDocLink, onCompleteNode,
  onEditStartedAt,
  embedded = false, showBack = true, hideChildrenList = false,
  projectNode = null, subtaskSupported = true, docLinksSupported = true, projectDocLinksSupported = true,
  subtaskPanel = null,
  currentUserId = null, accessRole = 'worker', people = [],
  onAttendanceCheckIn, onAttendanceCheckOut, onOpenSiteSettings, onOpenTeamSchedule,
  projectFieldSettingsSupported = true,
}) {
  const stats = aggregate(node);
  const listParent = resolveListParent(node, parent);
  const childNodes = listParent ? (listParent.children || []) : (node.children || []);
  const hasChildren = childNodes.length > 0;
  const { child: addChildLabel, section: childrenLabel } = addChildLabels(listParent || node);
  const myLabel = LEVEL_LABEL[depth] || 'Mục';
  const canAddChild = listParent && typeof onAddChild === 'function';
  const showSiblingList = listParent && listParent.id !== node.id;
  const canPastePhoto = node?._source?.table === 'tasks' && typeof onPastePhotos === 'function';
  const canAddPhoto = node?._source?.table === 'tasks';
  const canLogWork = node?._source?.table === 'tasks' && typeof onOpenWorkAction === 'function';
  const canCompleteNode = typeof onCompleteNode === 'function';
  const showCompleteNodeBtn = canCompleteNode && !node.completedAt;
  const isNodeDone = node.status === 'done' || Boolean(node.completedAt);
  const nodeTable = node?._source?.table;
  const isProject = nodeTable === 'projects';
  const isFeature = nodeTable === 'features';
  const canShowDocLinks = (isProject || isFeature) && docLinksSupported && typeof onOpenDocLink === 'function';
  const canAddDocLink = canShowDocLinks && (
    (isFeature && docLinksSupported) || (isProject && projectDocLinksSupported)
  );
  const docLinks = useMemo(() => {
    if (isProject) return collectDocLinksFromTree(node);
    if (isFeature) return node.docLinks || [];
    return [];
  }, [node, isProject, isFeature]);
  const workActions = useMemo(() => {
    const list = node.workActions || [];
    return [...list].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }, [node.workActions]);
  const displayPhotos = useMemo(() => (
    node?._source?.table === 'tasks' ? (node.photos || []) : collectPhotosFromTree(node)
  ), [node]);

  useEffect(() => {
    if (!canPastePhoto) return undefined;
    const onPaste = (e) => {
      const files = getImageFilesFromClipboard(e);
      if (!files.length) return;
      e.preventDefault();
      onPastePhotos(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [canPastePhoto, onPastePhotos]);

  const [filter, setFilter] = useState('all'); // all | fail | doing | todo | done
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = useMemo(() => {
    if (!hasChildren) return [];
    if (filter === 'all') return childNodes;
    return childNodes.filter(c => c.status === filter);
  }, [childNodes, filter, hasChildren]);

  const counts = useMemo(() => {
    if (!hasChildren) return null;
    const c = { all: childNodes.length, fail: 0, doing: 0, todo: 0, done: 0 };
    childNodes.forEach(ch => { c[ch.status] = (c[ch.status]||0) + 1; });
    return c;
  }, [childNodes, hasChildren]);

  return (
    <div className={`screen ${embedded ? 'screen--embedded' : ''}`}>
      {/* TopBar */}
      <div className={`topbar ${scrolled ? 'scrolled' : ''} ${embedded ? 'topbar--embedded' : ''}`}>
        {showBack ? (
          <button className="icon-btn" onClick={onBack} aria-label="Quay lại">
            <Icon.back/>
          </button>
        ) : (
          <div className="icon-btn icon-btn--spacer" aria-hidden/>
        )}
        <div className="title-wrap">
          <div className="crumb">
            {parent ? `${LEVEL_LABEL[depth-1]} · ${parent.name}` : 'Tất cả sản phẩm'}
          </div>
          <div className="title">{scrolled ? node.name : myLabel}</div>
        </div>
        <button className="icon-btn" aria-label="Tìm"><Icon.search/></button>
        <button className="icon-btn" aria-label="Tùy chọn" onClick={() => onOpenActions?.(node)}><Icon.more/></button>
      </div>

      <div className="scroll" ref={scrollRef}>
        {/* Hero */}
        <div className="hero">
          <h1 className="hero-title-line">
            {depth === 0 && node.customerName && (
              <>
                <span className="hero-customer">{node.customerName}</span>
                <span className="hero-title-sep" aria-hidden>·</span>
              </>
            )}
            <span className="hero-title-name">{node.name}</span>
          </h1>

          <div className="meta-row">
            <button onClick={onCycleStatus} style={{ border:0, background:'none', padding:0, cursor:'pointer' }}>
              <StatusChip status={node.status}/>
            </button>
            <DeadlineChip iso={node.deadline} status={node.status} onClick={onEditDeadline}/>
            {isProject && typeof onEditStartedAt === 'function' && (
              <DeadlineChip
                iso={node.startedAt}
                status={node.status}
                onClick={onEditStartedAt}
                emptyLabel="Ngày giờ bắt đầu"
              />
            )}
            {node.issues > 0 && (
              <span className="chip count has-issue">
                <Icon.warn/> {node.issues} lỗi
              </span>
            )}
          </div>

          {canCompleteNode && (
            <div className={`node-completion${isNodeDone ? ' node-completion--done' : ''}`}>
              {node.completedAt ? (
                <>
                  <span className="work-action-badge">Hoàn thành</span>
                  <span className="node-completion-time">
                    Thời gian hoàn thành: {formatCompletedAt(node.completedAt)}
                  </span>
                </>
              ) : (
                <>
                  <p className="node-completion-hint">
                    Ghi nhận trạng thái hoàn thành và thời điểm kết thúc cho {myLabel.toLowerCase()} này.
                  </p>
                  {showCompleteNodeBtn && (
                    <button
                      type="button"
                      className="work-action-complete-btn node-completion-btn"
                      onClick={() => onCompleteNode()}
                    >
                      <Icon.check/>
                      Hoàn thành
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Assignees row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 12 }}>
            <button type="button" className="assignee-row-btn" onClick={onOpenAssignees}>
              {node.assignees.length > 0 ? (
                <>
                  <Avatars ids={node.assignees} size="lg" max={5}/>
                  <span style={{ fontSize:12, color:'var(--muted)', fontWeight:500 }}>
                    {node.assignees.length} người · Thêm
                  </span>
                </>
              ) : (
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'var(--accent)', fontWeight:600 }}>
                  <Icon.user/> Giao việc cho ai?
                </span>
              )}
            </button>
            <button className="icon-btn" aria-label="Báo" style={{ width: 32, height: 32 }}><Icon.bell/></button>
          </div>

          {/* Progress */}
          {hasChildren && stats.total > 0 && t.showProgressBar !== false && (
            <ProgressBar stats={stats}/>
          )}
          {!subtaskSupported && node._source?.table === 'tasks' && !node._source?.parentTaskId && (
            <p className="field-note" style={{ margin: '0 0 12px', padding: '10px 12px', background: 'var(--warn-soft)', borderRadius: 10 }}>
              Sub-task cần cột <code>parent_task_id</code> trên Supabase. Chạy file{' '}
              <code>supabase/migrations/20250525000000_add_parent_task_id.sql</code> rồi tải lại trang.
            </p>
          )}
          {hasChildren && stats.total > 0 && t.showStats !== false && (
            <div className="stats">
                <div className="stat"><div className="num">{stats.total}</div><div className="lbl">Tổng việc</div></div>
                <div className="stat"><div className="num" style={{color:'var(--good)'}}>{stats.done}</div><div className="lbl">Đạt</div></div>
                <div className="stat"><div className="num" style={{color:'#5A4A1F'}}>{stats.doing}</div><div className="lbl">Đang làm</div></div>
                <div className={`stat fail`}><div className="num">{stats.fail}</div><div className="lbl">Có lỗi</div></div>
              </div>
          )}
        </div>

        {/* General note */}
        {node.note && (
          <NoteBlock text={node.note} onEdit={onEditNote}/>
        )}
        {!node.note && (
          <div style={{ padding: '0 16px' }}>
            <button type="button" className="note-add-btn" onClick={onEditNote}>
              <Icon.note/> Thêm ghi chú chung cho {myLabel.toLowerCase()}…
            </button>
          </div>
        )}

        {subtaskPanel}

        {isProject && projectFieldSettingsSupported && (
          <>
            <AttendancePanel
              project={node}
              currentUserId={currentUserId}
              people={people}
              accessRole={accessRole}
              onCheckIn={onAttendanceCheckIn}
              onCheckOut={onAttendanceCheckOut}
              onOpenSiteSettings={isAdmin(accessRole) ? onOpenSiteSettings : undefined}
            />
            {isAdmin(accessRole) && (
              <div className="field-ops-section">
                <div className="section-head">
                  <h3>Lịch đội trên công trình</h3>
                  <button type="button" className="section-action" onClick={() => onOpenTeamSchedule?.(null)}>
                    + Gán đội
                  </button>
                </div>
                {(node.teamSchedules || []).length === 0 ? (
                  <p className="field-note">Chưa gán đội. Gán đội để hiển thị trên Timeline.</p>
                ) : (
                  <div className="team-schedule-list">
                    {(node.teamSchedules || []).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="team-schedule-row"
                        onClick={() => onOpenTeamSchedule?.(s)}
                      >
                        <strong>{s.team}</strong>
                        <span>{formatScheduleRange(s.startAt, s.endAt) || `${s.startDate} → ${s.endDate}`}</span>
                        {s.note && <span className="team-schedule-note">{s.note}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {canShowDocLinks && (
          <>
            <div className="section">
              <div className="section-head">
                <div className="section-title">
                  Link tài liệu {docLinks.length > 0 && `· ${docLinks.length}`}
                </div>
              </div>
            </div>
            {canAddDocLink && (
              <div className="doc-links-toolbar">
                <button
                  type="button"
                  className="btn btn-primary doc-links-add-btn"
                  onClick={() => onOpenDocLink(null)}
                >
                  <Icon.plus/>
                  Thêm
                </button>
              </div>
            )}
            {docLinks.length > 0 ? (
              <div className="doc-links">
                {docLinks.map((d) => (
                  <div key={`${d.sourceNodeId || node.id}:${d.id}`} className="doc-link-row">
                    <div className="doc-link-main">
                      <div className="doc-link-title">{d.title}</div>
                      {isProject && d.sourceName && d.sourceNodeId !== node.id && (
                        <div className="doc-link-source">{d.sourceName}</div>
                      )}
                      <div className="doc-link-url">{d.url}</div>
                      {d.note && <div className="doc-link-note">{d.note}</div>}
                    </div>
                    <div className="doc-link-actions">
                      <button
                        type="button"
                        className="doc-link-btn doc-link-btn--view"
                        onClick={() => openDocUrl(d.url)}
                      >
                        <Icon.eye/>
                        Xem link
                      </button>
                      <button
                        type="button"
                        className="doc-link-btn"
                        onClick={() => onOpenDocLink(d)}
                      >
                        Sửa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="doc-links-empty">
                {canAddDocLink ? (
                  <p className="field-note">Chưa có link tài liệu. Bấm <strong>Thêm</strong> để lưu link Drive/Doc/Spec.</p>
                ) : (
                  <p className="field-note" style={{ margin: 0 }}>
                    Chưa có link. Thêm link tại từng hạng mục hoặc cập nhật cột{' '}
                    <code>documents</code> trên bảng <code>projects</code> trong Supabase.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {canLogWork && (
          <>
            <div className="section">
              <div className="section-head">
                <div className="section-title">
                  Hành động tôi đã làm {workActions.length > 0 && `· ${workActions.length}`}
                </div>
                <button type="button" className="section-action" onClick={() => onOpenWorkAction(null)}>
                  + Ghi nhận
                </button>
              </div>
            </div>
            {workActions.length > 0 ? (
              <div className="work-actions-list">
                {workActions.map((action) => {
                  const mins = actionDurationMinutes(action);
                  const inProgress = isWorkActionInProgress(action);
                  const completed = action.status === 'completed';
                  return (
                    <div
                      key={action.id}
                      className={`work-action-card${inProgress ? ' work-action-card--active' : ''}${completed ? ' work-action-card--done' : ''}`}
                    >
                      <button
                        type="button"
                        className="work-action-main"
                        onClick={() => onOpenWorkAction(action)}
                      >
                        <span className="work-action-icon" aria-hidden>
                          {inProgress ? '◐' : <Icon.check/>}
                        </span>
                        <span className="work-action-body">
                          <span className="work-action-title-row">
                            <span className="work-action-title">{action.title}</span>
                            {completed && (
                              <span className="work-action-badge">Hoàn thành</span>
                            )}
                          </span>
                          {action.note && (
                            <span className="work-action-note">{action.note.replace(/\r\n/g, '\n')}</span>
                          )}
                          <span className="work-action-time">{formatWorkActionRange(action)}</span>
                          {mins != null && (
                            <span className="work-action-duration">{formatDurationMinutes(mins)}</span>
                          )}
                        </span>
                        <Icon.chev className="work-action-chev"/>
                      </button>
                      {inProgress && typeof onCompleteWorkAction === 'function' && (
                        <button
                          type="button"
                          className="work-action-complete-btn"
                          onClick={() => onCompleteWorkAction(action)}
                        >
                          Hoàn thành
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '0 16px 12px' }}>
                <button type="button" className="note-add-btn" onClick={() => onOpenWorkAction(null)}>
                  <Icon.check style={{ opacity: 0.7 }}/> Ghi lại việc bạn vừa làm và thời gian bắt đầu / kết thúc…
                </button>
              </div>
            )}
          </>
        )}

        {/* Photos */}
        <div className="section">
          <div className="section-head">
            <div className="section-title">
              {canAddPhoto ? 'Ảnh đính kèm' : 'Tài liệu'} {displayPhotos.length > 0 && `· ${displayPhotos.length}`}
            </div>
            {canAddPhoto && (
              <button className="section-action" onClick={() => onOpenPhoto(null)}>+ Thêm ảnh</button>
            )}
          </div>
        </div>
        <div
          className={`photos ${canPastePhoto ? 'photos--paste' : ''}`}
          tabIndex={canPastePhoto ? 0 : undefined}
          role={canPastePhoto ? 'group' : undefined}
          aria-label={canPastePhoto ? 'Ảnh đính kèm — Ctrl+V để dán' : undefined}
        >
          {displayPhotos.map(ph => (
            <PhotoThumb
              key={ph.id}
              photo={ph}
              onClick={() => onOpenPhoto(ph)}
              onView={() => (onViewPhoto || onOpenPhoto)(ph)}
            />
          ))}
          {canPastePhoto && (
            <div className="photo add photo-paste-target" onClick={() => onOpenPhoto(null)}>
              <div className="thumb">
                <div style={{ textAlign:'center', fontSize:11 }}>
                  <Icon.cam style={{ display:'block', margin:'0 auto 4px' }}/>
                  Dán ảnh (Ctrl+V)
                </div>
              </div>
              <div className="cap" style={{ color:'var(--muted)' }}>hoặc bấm để chọn file</div>
            </div>
          )}
          {!canPastePhoto && canAddPhoto && (
            <div className="photo add" onClick={() => onOpenPhoto(null)}>
              <div className="thumb">
                <div style={{ textAlign:'center', fontSize:11 }}>
                  <Icon.cam style={{ display:'block', margin:'0 auto 4px' }}/>
                  Tải ảnh
                </div>
              </div>
              <div className="cap" style={{ color:'var(--muted)' }}>Chụp hoặc chọn từ thư viện</div>
            </div>
          )}
        </div>
        {!canAddPhoto && displayPhotos.length === 0 && (
          <div style={{ padding: '0 16px 10px', color: 'var(--muted)', fontSize: 12 }}>
            Chưa có tài liệu ảnh ở các mục con.
          </div>
        )}
        {!canAddPhoto && displayPhotos.length > 0 && (
          <div className="doc-list">
            {displayPhotos.map((ph, idx) => (
              <div key={`doc-${ph.id}`} className="doc-row">
                <button
                  type="button"
                  className="doc-row-main"
                  onClick={() => onOpenPhoto(ph)}
                >
                  <span className="doc-row-index">{idx + 1}.</span>
                  <span className="doc-row-text">
                    <strong>{ph.sourceName}</strong> · {ph.label}
                  </span>
                </button>
                <button
                  type="button"
                  className="doc-row-view"
                  aria-label="Xem ảnh full"
                  onClick={() => (onViewPhoto || onOpenPhoto)(ph)}
                >
                  <Icon.eye />
                </button>
                {typeof onDeletePhoto === 'function' && (
                  <button
                    type="button"
                    className="doc-row-delete"
                    onClick={() => onDeletePhoto(ph)}
                  >
                    Xóa
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Children — ẩn khi desktop split có danh sách ở cột trái */}
        {(!hideChildrenList) && (hasChildren || canAddChild) && (
          <div style={{ marginTop: 14 }}>
            <div className="section">
              <div className="section-head">
                <div className="section-title">
                  {childrenLabel}{hasChildren ? ` · ${childNodes.length}` : ''}
                </div>
                {canAddChild && (
                  <button type="button" className="section-action" onClick={onAddChild}>
                    + Thêm {addChildLabel}
                  </button>
                )}
              </div>
            </div>

            {hasChildren && (
              <>
                <div className="filter-row">
                  <FilterPill active={filter==='all'}     onClick={() => setFilter('all')}>Tất cả <span className="count-mini">{counts.all}</span></FilterPill>
                  {counts.fail > 0 && (
                    <FilterPill active={filter==='fail'} onClick={() => setFilter('fail')} tone="fail">Có lỗi <span className="count-mini">{counts.fail}</span></FilterPill>
                  )}
                  <FilterPill active={filter==='doing'}   onClick={() => setFilter('doing')}>Đang làm <span className="count-mini">{counts.doing}</span></FilterPill>
                  <FilterPill active={filter==='todo'}    onClick={() => setFilter('todo')}>Chờ <span className="count-mini">{counts.todo}</span></FilterPill>
                  <FilterPill active={filter==='done'}    onClick={() => setFilter('done')}>Đạt <span className="count-mini">{counts.done}</span></FilterPill>
                </div>

                <div className="list">
                  {filtered.length === 0 && (
                    <div className="empty">Không có {childrenLabel.toLowerCase()} nào ở mục này.</div>
                  )}
                  {filtered.map(child => (
                    <ItemCard
                      key={child.id}
                      node={child}
                      depth={depth + 1}
                      active={showSiblingList && child.id === node.id}
                      onOpen={() => onOpenChild(child)}
                      onOpenActions={onChildActions ? (e) => { e.stopPropagation(); onChildActions(child); } : undefined}
                      onComplete={onCompleteNode}
                    />
                  ))}
                </div>
              </>
            )}

            {!hasChildren && canAddChild && (
              <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={onAddChild}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: '14px 16px',
                    background: '#fff', border: '1px dashed var(--line)', borderRadius: 14,
                    color: 'var(--accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <Icon.plus/> Thêm {addChildLabel} đầu tiên
                </button>
              </div>
            )}
          </div>
        )}

        {!hasChildren && !canAddChild && (
          <div className="section">
            <div className="section-head">
              <div className="section-title">Chi tiết</div>
            </div>
            <div className="list">
              <button onClick={onCycleStatus} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#fff', border:'1px solid var(--line)', borderRadius:14, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, color:'var(--ink)', textAlign:'left' }}>
                <Icon.check style={{ color:'var(--good)' }}/>
                <span style={{flex:1}}>Đổi trạng thái</span>
                <StatusChip status={node.status}/>
              </button>
              <button style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#fff', border:'1px solid var(--line)', borderRadius:14, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, color:'var(--ink)', textAlign:'left' }}>
                <Icon.warn style={{ color:'var(--bad)' }}/>
                <span style={{flex:1}}>Báo phát sinh lỗi mới</span>
                <Icon.chev style={{color:'var(--muted-2)'}}/>
              </button>
            </div>
          </div>
        )}

        <div style={{ height: 100 }}/>
      </div>

      {/* FAB */}
      {canAddChild && !embedded && (
        <button type="button" className="fab" aria-label="Thêm" onClick={onAddChild}>
          <Icon.plus/> Thêm {addChildLabel}
        </button>
      )}
    </div>
  );
}

// ─── People Home ──────────────────────────────────────────────────
function PeopleHome({ products, onOpenPerson }) {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('all');
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const [statusTab, setStatusTab] = useState('all');

  const enriched = useMemo(() => {
    return PEOPLE.map(p => ({ p, stats: personStats(p.id, products) }));
  }, [products]);

  const statusTabs = useMemo(() => [
    { key: 'all', label: 'Tất cả' },
    ...Object.entries(STATUS_META).map(([key, meta]) => ({ key, label: meta.label })),
  ], []);

  const tableRows = useMemo(() => {
    return enriched.filter(({ stats }) => {
      if (statusTab === 'all') return true;
      return stats[statusTab] > 0;
    });
  }, [enriched, statusTab]);

  const depts = useMemo(() => {
    const set = new Set(PEOPLE.map(p => p.dept));
    return ['all', ...set];
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ p }) => {
      if (dept !== 'all' && p.dept !== dept) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [enriched, search, dept]);

  const teamStats = useMemo(() => {
    let total = 0, overdue = 0;
    enriched.forEach(({ stats }) => { total += stats.total; overdue += stats.overdue; });
    return { totalWork: total, overdue, online: PEOPLE.filter(p => p.status === 'online').length };
  }, [enriched]);

  return (
    <div className="screen has-nav">
      <div className={`topbar ${scrolled ? 'scrolled' : ''}`}>
        <button className="icon-btn" aria-label="Menu" style={{ pointerEvents:'none' }}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <div className="title-wrap">
          <div className="crumb">Check Lỗi Việc</div>
          <div className="title">Nhân sự</div>
        </div>
        <button className="icon-btn" aria-label="Lọc"><Icon.filter/></button>
        <button className="icon-btn" aria-label="Thêm"><Icon.plus/></button>
      </div>

      <div className="scroll" ref={scrollRef}>
        <div className="home-hero">
          <div className="h-eyebrow">Đội ngũ</div>
          <h1>{PEOPLE.length} thành viên</h1>
          <div className="home-stats">
            <div className="s"><div className="n">{teamStats.online}</div><div className="l">Đang online</div></div>
            <div className="s"><div className="n">{teamStats.totalWork}</div><div className="l">Tổng việc</div></div>
            <div className={`s ${teamStats.overdue > 0 ? 'alert' : ''}`}><div className="n">{teamStats.overdue}</div><div className="l">Việc trễ hạn</div></div>
          </div>
        </div>

        <div className="home-search" style={{ marginTop: 6 }}>
          <Icon.search style={{ color: 'var(--muted-2)' }}/>
          <input
            placeholder="Tìm theo tên, vai trò…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="people-status-table">
          <div className="people-status-tabs">
            {statusTabs.map((tabItem) => (
              <button
                key={tabItem.key}
                type="button"
                className={`people-status-tab ${statusTab === tabItem.key ? 'active' : ''}`}
                onClick={() => setStatusTab(tabItem.key)}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
          <div className="people-status-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nhân sự</th>
                  <th>Tổng</th>
                  <th>Chờ</th>
                  <th>Đang làm</th>
                  <th>Đạt</th>
                  <th>Có lỗi</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(({ p, stats }) => (
                  <tr key={p.id} onClick={() => onOpenPerson(p.id)}>
                    <td className="person-name">{p.name}</td>
                    <td>{stats.total}</td>
                    <td>{stats.todo || 0}</td>
                    <td>{stats.doing || 0}</td>
                    <td>{stats.done || 0}</td>
                    <td>{stats.fail || 0}</td>
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-row">Không có nhân sự phù hợp.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="filter-row" style={{ padding: '12px 16px 8px' }}>
          {depts.map(d => (
            <button
              key={d}
              className={`filter-pill ${dept===d ? 'active' : ''}`}
              onClick={() => setDept(d)}
            >
              {d === 'all' ? 'Tất cả' : d}
              {d !== 'all' && (
                <span className="count-mini">
                  {PEOPLE.filter(p => p.dept === d).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="people-list">
          {filtered.length === 0 && (
            <div className="empty">Không tìm thấy nhân sự nào.</div>
          )}
          {filtered.map(({ p, stats }) => (
            <div
              key={p.id}
              className={`person-card ${stats.overdue > 0 ? 'has-overdue' : ''}`}
              onClick={() => onOpenPerson(p.id)}
            >
              <div className="av-big" style={{ background: p.color }}>
                {p.initials}
                <span className={`presence ${p.status}`}/>
              </div>
              <div className="info">
                <div className="p-name">{p.name}</div>
                <div className="p-role">
                  <span className="p-dept-pill">{p.dept}</span>
                  {p.role}
                </div>
                <div className="p-stats">
                  <span><b>{stats.total}</b> việc</span>
                  {stats.fail > 0 && <span><b>{stats.fail}</b> lỗi</span>}
                  {stats.overdue > 0 && <span className="has-overdue-text">{stats.overdue} trễ</span>}
                  {stats.total > 0 && stats.fail === 0 && stats.overdue === 0 && (
                    <span style={{color:'var(--good)'}}>Đúng tiến độ</span>
                  )}
                  {stats.total === 0 && <span style={{color:'var(--muted-2)'}}>Đang rảnh</span>}
                </div>
              </div>
              <Icon.chev className="chev"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Person Detail ────────────────────────────────────────────────
function PersonDetail({ personId, products, onBack, onOpenNode, onOpenActions, onEditPerson, variant = 'person' }) {
  const isMe = variant === 'me';
  const person = PEOPLE.find(p => p.id === personId);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);
  const [groupBy, setGroupBy] = useState('product'); // product | status
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubtaskIds, setSelectedSubtaskIds] = useState(() => new Set());

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const items = useMemo(() => (
    isMe
      ? findAssignedSubtasksFor(personId, products)
      : findAssignmentsFor(personId, products)
  ), [isMe, personId, products]);

  const stats = useMemo(() => (
    isMe
      ? personSubtaskStats(personId, products)
      : personStats(personId, products)
  ), [isMe, personId, products]);

  useEffect(() => {
    if (!isMe) return;
    const currentIds = new Set(items.map((it) => it.node.id));
    setSelectedSubtaskIds((prev) => {
      const next = new Set([...prev].filter((id) => currentIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [isMe, items]);

  const selectedSubtaskItems = useMemo(() => {
    if (!isMe || selectedSubtaskIds.size === 0) return [];
    return items.filter((it) => selectedSubtaskIds.has(it.node.id));
  }, [isMe, items, selectedSubtaskIds]);

  const allSubtasksSelected = isMe && items.length > 0 && selectedSubtaskIds.size === items.length;

  const statusFilterOptions = useMemo(() => {
    const order = ['todo', 'doing', 'fail', 'done'];
    return [
      { key: 'all', label: 'Tất cả', count: items.length },
      ...order.map((key) => ({
        key,
        label: STATUS_META[key].label,
        count: items.filter((it) => it.node.status === key).length,
      })),
    ];
  }, [items]);

  const toggleSubtaskSelection = useCallback((nodeId) => {
    setSelectedSubtaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const selectAllSubtasks = useCallback(() => {
    setSelectedSubtaskIds(new Set(items.map((it) => it.node.id)));
  }, [items]);

  const clearSelectedSubtasks = useCallback(() => {
    setSelectedSubtaskIds(new Set());
  }, []);

  const grouped = useMemo(() => {
    if (isMe) {
      const order = ['todo', 'doing', 'fail', 'done'];
      return order
        .filter((statusKey) => statusFilter === 'all' || statusFilter === statusKey)
        .map((statusKey) => ({
          title: STATUS_META[statusKey].label,
          status: statusKey,
          items: items.filter((it) => it.node.status === statusKey),
        }));
    }
    if (groupBy === 'product') {
      const map = new Map();
      items.forEach(it => {
        if (!map.has(it.productId)) {
          map.set(it.productId, {
            title: it.productName,
            customerName: it.customerName,
            items: [],
          });
        }
        map.get(it.productId).items.push(it);
      });
      return [...map.values()];
    }
    // by status
    const order = ['fail', 'doing', 'todo', 'done'];
    const groups = order.map(s => ({
      title: STATUS_META[s].label,
      status: s,
      items: items.filter(it => it.node.status === s),
    })).filter(g => g.items.length > 0);
    return groups;
  }, [items, groupBy, isMe, statusFilter]);

  if (!person) return null;

  return (
    <div className="screen has-nav">
      <div className={`topbar ${scrolled ? 'scrolled' : ''}`}>
        <button className="icon-btn" onClick={onBack} aria-label="Quay lại"><Icon.back/></button>
        <div className="title-wrap">
          <div className="crumb">{isMe ? 'Tôi' : 'Nhân sự'}</div>
          <div className="title">{scrolled ? person.name : (isMe ? 'Việc của tôi' : 'Chi tiết nhân sự')}</div>
        </div>
        <button className="icon-btn" aria-label="Gọi">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
        </button>
        <button className="icon-btn" aria-label="Sửa nhân sự" onClick={() => onEditPerson?.(person)}>
          <Icon.edit/>
        </button>
      </div>

      <div className="scroll" ref={scrollRef}>
        <div className="person-hero">
          <div className="av-hero" style={{ background: person.color }}>
            {person.initials}
            <span className={`presence ${person.status}`} style={{ background: person.status === 'online' ? 'var(--good)' : person.status === 'busy' ? 'var(--warn)' : 'var(--muted-2)' }}/>
          </div>
          <h1>{person.name}</h1>
          <div className="p-role-2">
            <span className="p-dept-pill">{person.dept}</span>
            {person.role}
            <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--muted-2)' }}/>
            <span style={{ color: person.status === 'online' ? 'var(--good)' : person.status === 'busy' ? '#5A4A1F' : 'var(--muted)', fontWeight: 600 }}>
              {person.status === 'online' ? 'Online' : person.status === 'busy' ? 'Bận' : 'Offline'}
            </span>
          </div>
          <div className="p-summary">
            <div className="s"><div className="n">{stats.total}</div><div className="l">Việc</div></div>
            <div className="s good"><div className="n">{stats.done}</div><div className="l">Đạt</div></div>
            <div className="s"><div className="n" style={{color:'#5A4A1F'}}>{stats.doing}</div><div className="l">Đang</div></div>
            <div className={`s ${stats.fail + stats.overdue > 0 ? 'fail' : ''}`}>
              <div className="n">{stats.fail + stats.overdue}</div>
              <div className="l">Lỗi/Trễ</div>
            </div>
          </div>
        </div>

        {/* Contact strip */}
        <div style={{ display:'flex', gap:8, padding:'0 16px 14px' }}>
          <button style={{ flex:1, height:40, borderRadius:10, background:'var(--ink)', color:'#fff', border:0, fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'var(--font-body)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6l9 6 9-6M3 6v12h18V6M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
            Nhắn tin
          </button>
          <button style={{ width:40, height:40, borderRadius:10, background:'#fff', border:'1px solid var(--line)', cursor:'pointer', display:'grid', placeItems:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
          </button>
          <button style={{ width:40, height:40, borderRadius:10, background:'#fff', border:'1px solid var(--line)', cursor:'pointer', display:'grid', placeItems:'center' }}>
            <Icon.cal/>
          </button>
        </div>

        {/* Toggle group */}
        <div style={{ padding:'4px 16px 8px' }}>
          <div className="section-title" style={{padding:0, marginBottom: 8}}>
            {isMe ? 'Sub-task được phân công' : 'Việc đang phụ trách'} · {items.length}
          </div>
          {isMe && items.length > 0 && (
            <div className="my-work-controls">
              <div className="my-status-filter" aria-label="Lọc theo trạng thái">
                {statusFilterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`my-status-filter-btn ${statusFilter === option.key ? 'active' : ''}`}
                    onClick={() => setStatusFilter(option.key)}
                  >
                    {option.label}
                    <span>{option.count}</span>
                  </button>
                ))}
              </div>
              <div className="subtask-report-toolbar">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={allSubtasksSelected ? clearSelectedSubtasks : selectAllSubtasks}
                >
                  {allSubtasksSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selectedSubtaskItems.length === 0}
                  onClick={() => printSubtaskReport({ person, items: selectedSubtaskItems })}
                >
                  In ({selectedSubtaskItems.length})
                </button>
              </div>
            </div>
          )}
          {!isMe && (
          <div style={{ display:'flex', gap:2, background:'var(--line-2)', borderRadius:8, padding:2, width:'fit-content' }}>
            <button
              onClick={() => setGroupBy('product')}
              style={{
                height:26, padding:'0 12px', borderRadius:6, border:0,
                background: groupBy==='product' ? '#fff' : 'transparent',
                fontFamily:'var(--font-body)', fontSize:11.5, fontWeight:600,
                color: groupBy==='product' ? 'var(--ink)' : 'var(--muted)',
                cursor:'pointer', whiteSpace:'nowrap',
                boxShadow: groupBy==='product' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >Theo sản phẩm</button>
            <button
              onClick={() => setGroupBy('status')}
              style={{
                height:26, padding:'0 12px', borderRadius:6, border:0,
                background: groupBy==='status' ? '#fff' : 'transparent',
                fontFamily:'var(--font-body)', fontSize:11.5, fontWeight:600,
                color: groupBy==='status' ? 'var(--ink)' : 'var(--muted)',
                cursor:'pointer', whiteSpace:'nowrap',
                boxShadow: groupBy==='status' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >Theo trạng thái</button>
          </div>
          )}
        </div>

        <div className={isMe ? 'my-kanban-board-wrap' : ''} style={{ padding: '0 16px 110px' }}>
          {(!isMe && grouped.length === 0) && (
            <div className="empty">
              Không có việc nào đang phụ trách.
            </div>
          )}
          <div className={isMe ? 'my-kanban-board' : ''}>
          {grouped.map((g, gi) => (
            <div key={gi} className={isMe ? 'my-kanban-column' : ''} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize:11, fontWeight:700, color:'var(--muted)',
                letterSpacing:'0.06em', textTransform:'uppercase',
                margin:'4px 4px 6px',
                display:'flex', alignItems:'center', gap:8,
              }}>
                {g.status && <span className={`dot`} style={{
                  width:6, height:6, borderRadius:'50%',
                  background: STATUS_META[g.status].dot,
                  display:'inline-block',
                }}/>}
                <span style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                  {g.customerName && (
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--ink-2)', textTransform:'none', letterSpacing:0 }}>
                      {g.customerName}
                    </span>
                  )}
                  <span>{g.title}</span>
                </span>
                <span style={{ background:'var(--line-2)', padding:'1px 6px', borderRadius:999, fontSize:10, color:'var(--ink-2)' }}>
                  {g.items.length}
                </span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {isMe && g.items.length === 0 && (
                  <div className="my-kanban-empty">Không có sub-task.</div>
                )}
                {g.items.map((it, i) => {
                  const { node, productName, customerName, parentName, featureName, parentTaskName } = it;
                  const pathCrumb = [
                    customerName,
                    productName,
                    featureName || parentName,
                    parentTaskName,
                  ].filter(Boolean);
                  const selected = selectedSubtaskIds.has(node.id);
                  return (
                  <div
                    key={node.id + i}
                    className={`task-item-stack ${node.status === 'fail' ? 'fail' : ''} ${selected ? 'selected' : ''}`}
                    onClick={() => onOpenNode(node.id)}
                  >
                    {isMe && (
                      <button
                        type="button"
                        className={`subtask-select ${selected ? 'checked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSubtaskSelection(node.id);
                        }}
                        aria-pressed={selected}
                        aria-label={`${selected ? 'Bỏ chọn' : 'Chọn'} sub-task ${node.name}`}
                      >
                        {selected && <Icon.check/>}
                      </button>
                    )}
                    <StatusBlob status={node.status}/>
                    <div className="body">
                      {isMe || groupBy === 'status' ? (
                        <div className="crumb-mini">
                          {pathCrumb.map((part, idx) => (
                            <span key={idx}>
                              {idx > 0 && <span className="sep">›</span>}
                              <span>{part}</span>
                            </span>
                          ))}
                          {isMe && (
                            <span className="subtask-pill">Sub-task</span>
                          )}
                        </div>
                      ) : parentName && (
                        <div className="crumb-mini">{parentName}</div>
                      )}
                      <div className={`name ${node.status === 'done' ? 'strike' : ''}`}>{node.name}</div>
                      <div className="meta">
                        <DeadlineChip iso={node.deadline} status={node.status}/>
                        {node.issues > 0 && (
                          <span className="chip count has-issue" style={{height:20, padding:'0 7px', fontSize:10}}>
                            <Icon.warn/> {node.issues}
                          </span>
                        )}
                      </div>
                    </div>
                    {onOpenActions ? (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Sửa ${node.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenActions(node);
                        }}
                        style={{ width:30, height:30, borderRadius:8 }}
                      >
                        <Icon.more/>
                      </button>
                    ) : (
                      <Icon.chev style={{ color:'var(--muted-2)' }}/>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────
function SubtasksDashboard({ products, onOpenNode }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assigneeId, setAssigneeId] = useState('all');
  const [projectId, setProjectId] = useState('all');
  const [status, setStatus] = useState('all');

  const allItems = useMemo(() => collectAllSubtaskItems(products), [products]);
  const projectOptions = useMemo(() => (
    products.map((p) => ({ id: p.id, name: p.name, customerName: p.customerName }))
  ), [products]);

  const filtered = useMemo(() => {
    const list = allItems.filter((it) => {
      if (projectId !== 'all' && it.productId !== projectId) return false;
      if (assigneeId !== 'all' && !(it.node.assignees || []).includes(assigneeId)) return false;
      if (status !== 'all' && it.node.status !== status) return false;
      if (!isWithinDateRange(it.node.completedAt, dateFrom, dateTo)) return false;
      return true;
    });
    return list.sort((a, b) => {
      const aPath = [a.customerName || '', a.productName || '', a.featureName || '', a.parentTaskName || '', a.node.name || ''].join('\u0000');
      const bPath = [b.customerName || '', b.productName || '', b.featureName || '', b.parentTaskName || '', b.node.name || ''].join('\u0000');
      return aPath.localeCompare(bPath, 'vi', { sensitivity: 'base' });
    });
  }, [allItems, projectId, assigneeId, status, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const projectSet = new Set(filtered.map((it) => it.productId));
    const minutes = filtered.reduce((sum, it) => sum + totalWorkMinutesFor(it.node), 0);
    const progress = progressForSubtaskItems(filtered);
    const byStatus = filtered.reduce((acc, it) => {
      acc[it.node.status] = (acc[it.node.status] || 0) + 1;
      return acc;
    }, { todo: 0, doing: 0, fail: 0, done: 0 });
    const taskSet = new Set(filtered.map((it) => `${it.productId}|${it.featureName}|${it.parentTaskName}`));
    return { projects: projectSet.size, minutes, subtasks: filtered.length, tasks: taskSet.size, progress, byStatus };
  }, [filtered]);

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setAssigneeId('all');
    setProjectId('all');
    setStatus('all');
  };

  return (
    <div className="screen subtasks-screen">
      <div className="subtasks-topbar">
        <div>
          <div className="crumb">Team work</div>
          <h1>Bảng tổng hợp công việc toàn team</h1>
        </div>
        <button type="button" className="btn btn-secondary" onClick={resetFilters}>Xóa lọc</button>
      </div>

      <div className="scroll subtasks-scroll">
        <div className="subtasks-summary">
          <div className="subtasks-summary-card"><div className="num">{totals.projects}</div><div className="lbl">Dự án</div></div>
          <div className="subtasks-summary-card"><div className="num">{totals.tasks}</div><div className="lbl">Task chính</div></div>
          <div className="subtasks-summary-card"><div className="num">{totals.subtasks}</div><div className="lbl">Sub task</div></div>
          <div className="subtasks-summary-card"><div className="num">{totals.progress.pct}%</div><div className="lbl">Tiến độ chung</div></div>
          <div className="subtasks-summary-card"><div className="num">{totals.byStatus.doing}</div><div className="lbl">Đang làm</div></div>
          <div className="subtasks-summary-card"><div className="num">{totals.byStatus.fail}</div><div className="lbl">Đang vướng</div></div>
        </div>

        <div className="subtasks-filters">
          <div className="field">
            <label className="field-label" htmlFor="subtask-date-from">Hoàn thành từ ngày</label>
            <input id="subtask-date-from" className="field-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="subtask-date-to">Đến ngày</label>
            <input id="subtask-date-to" className="field-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="subtask-assignee">Nhân sự</label>
            <select id="subtask-assignee" className="field-input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="all">Tất cả nhân sự</option>
              {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="subtask-project">Dự án</label>
            <select id="subtask-project" className="field-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="all">Tất cả dự án</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{[p.customerName, p.name].filter(Boolean).join(' · ')}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="subtask-status">Trạng thái</label>
            <select id="subtask-status" className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </div>
        </div>

        <div className="subtasks-table-wrap">
          {filtered.length === 0 ? (
            <div className="empty">Không có sub-task phù hợp bộ lọc.</div>
          ) : (
            <table className="subtasks-table">
              <thead>
                <tr>
                  <th>Dự án</th>
                  <th>Hạng mục</th>
                  <th>Công việc</th>
                  <th>Sub task</th>
                  <th>Người phụ trách</th>
                  <th>Ưu tiên</th>
                  <th>Deadline</th>
                  <th>Tiến độ công việc</th>
                  <th>Thời gian làm</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const assignees = (it.node.assignees || []).map((id) => PEOPLE.find((p) => p.id === id)?.name || id).join(', ');
                  const mins = totalWorkMinutesFor(it.node);
                  const taskProgress = taskProgressLabel(it, allItems);
                  const priority = priorityForWorkItem(it.node);
                  return (
                    <tr key={it.node.id} onClick={() => onOpenNode(it.node.id)}>
                      <td><div>{it.productName}</div>{it.customerName && <div className="subtasks-table-sub">{it.customerName}</div>}</td>
                      <td><div className="subtasks-table-title">{it.featureName || 'Chưa có hạng mục'}</div></td>
                      <td><div className="subtasks-table-title">{it.parentTaskName || 'Chưa có công việc'}</div></td>
                      <td><div className="subtasks-table-title">{it.node.name}</div>{it.node.completedAt && <div className="subtasks-table-sub">Hoàn thành: {formatCompletedAt(it.node.completedAt)}</div>}</td>
                      <td>{assignees || 'Chưa gán'}</td>
                      <td><span className={`priority-chip priority-chip--${priority.tone}`}>{priority.label}</span></td>
                      <td><DeadlineChip iso={it.node.deadline} status={it.node.status} emptyLabel="Chưa có" /></td>
                      <td>
                        <div className="task-progress-cell">
                          <div className="task-progress-text">{taskProgress.pct}%</div>
                          <div className="task-progress-track"><span style={{ width: `${taskProgress.pct}%` }} /></div>
                          <div className="subtasks-table-sub">{taskProgress.done}/{taskProgress.total} sub task xong</div>
                        </div>
                      </td>
                      <td>{formatDurationMinutes(mins) || '0 phút'}</td>
                      <td><StatusChip status={it.node.status}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ tab, onChange, alertCount }) {
  const items = [
    { id: 'products', label: 'Sản phẩm', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>
    ) },
    { id: 'subtasks', label: 'Sub-task', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 6h14M7 12h14M7 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ) },
    { id: 'schedule', label: 'Lịch', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    ) },
    { id: 'people', label: 'Nhân sự', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="17" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M3 19a6 6 0 0112 0M14 18a5 5 0 017 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    ) },
    { id: 'me', label: 'Tôi', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M4.5 20a7.5 7.5 0 0115 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    ), badge: alertCount },
  ];
  return (
    <div className="bottom-nav">
      {items.map(it => (
        <button key={it.id} className={tab === it.id ? 'active' : ''} onClick={() => onChange(it.id)}>
          <div className="nav-ico">
            {it.icon}
            {it.badge > 0 && <span className="nav-badge">{it.badge}</span>}
          </div>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function FilterPill({ children, active, onClick, tone }) {
  return (
    <button
      className={`filter-pill ${active ? 'active' : ''}`}
      onClick={onClick}
      style={tone === 'fail' && !active ? { color: 'var(--accent-ink)', borderColor: 'var(--bad-soft)', background: 'var(--bad-soft)' } : null}
    >
      {children}
    </button>
  );
}

// ─── Product Card (richer top-level card) ─────────────────────────
function ProductCard({ product, onOpen, onOpenActions, onComplete, selectable = false, selected = false, onToggleSelected }) {
  const stats = aggregate(product);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const tone = deadlineTone(product.deadline, product.status);
  const modules = (product.children || []).length;
  return (
    <div className={`product-card ${product.status === 'fail' ? 'fail' : ''} ${product.status === 'done' ? 'done' : ''} ${selected ? 'selected' : ''}`} onClick={onOpen}>
      {selectable && (
        <button
          type="button"
          className={`product-select-box ${selected ? 'checked' : ''}`}
          aria-pressed={selected}
          aria-label={`${selected ? 'Bỏ chọn' : 'Chọn'} ${product.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelected?.(product.id);
          }}
        >
          {selected && <Icon.check/>}
        </button>
      )}
      {onOpenActions && (
        <button
          type="button"
          className="product-card-more icon-btn"
          aria-label="Tùy chọn"
          onClick={(e) => { e.stopPropagation(); onOpenActions(product); }}
        >
          <Icon.more/>
        </button>
      )}
      <div className="product-card-assignees" onClick={(e) => e.stopPropagation()}>
        <Avatars ids={product.assignees} size="sm" max={4} alwaysShow/>
      </div>
      <div className="pc-row1">
        <div className="pc-head">
          {product.customerName && (
            <div className="pc-customer">{product.customerName}</div>
          )}
          <div className="pc-title">{product.name}</div>
        </div>
      </div>
      <div className="pc-meta">
        <StatusChip status={product.status}/>
        {product.issues > 0 && (
          <span className="pc-issue-pill">
            <Icon.warn/> {product.issues}
          </span>
        )}
        <span className={`chip deadline ${tone !== 'neutral' ? tone : ''}`}>
          <Icon.cal/>{formatDeadline(product.deadline)}
        </span>
      </div>
      <div className="pc-progress-row">
        <ProgressBar stats={stats}/>
        <div className="pct">{pct}%</div>
      </div>
      <div className="pc-foot">
        <div className="pc-counts">
          <span><b>{modules}</b> hạng mục</span>
          <span className="dot-sep"/>
          <span><b>{stats.done}</b>/{stats.total} việc</span>
          {stats.fail > 0 && (
            <>
              <span className="dot-sep"/>
              <span style={{color:'var(--accent-ink)', fontWeight:600}}>{stats.fail} lỗi</span>
            </>
          )}
          {product.completedAt && (
            <>
              <span className="dot-sep"/>
              <span className="item-completed-at">HT {formatCompletedAt(product.completedAt)}</span>
            </>
          )}
        </div>
        {typeof onComplete === 'function' && !product.completedAt && (
          <button
            type="button"
            className="work-action-complete-btn product-card-complete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onComplete(product);
            }}
          >
            <Icon.check/>
            Hoàn thành
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Products Home ────────────────────────────────────────────────
function productMatchesSearch(product, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [product.name, product.customerName].filter(Boolean);
  return parts.some((s) => String(s).toLowerCase().includes(q));
}

function ProductsHome({
  products, onOpen, onOpenActions, onComplete, onAddProduct, onDeleteSelected,
  panel = false, currentUserId = null, canBulkDelete = false,
}) {
  const [tab, setTab] = useState('active'); // active | done | all
  const [search, setSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { layout } = parseAppPath(location.pathname);
  const currentUser = useMemo(
    () => PEOPLE.find((p) => p.id === currentUserId) || PEOPLE[0] || null,
    [currentUserId],
  );
  const todayText = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString('vi-VN', { weekday: 'long' });
    const prettyWeekday = weekday.slice(0, 1).toUpperCase() + weekday.slice(1);
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${prettyWeekday} · ${dd} / ${mm}`;
  }, []);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const counts = useMemo(() => {
    const c = { all: products.length, active: 0, done: 0, alert: 0 };
    let totalIssues = 0, totalDone = 0, totalTotal = 0;
    products.forEach(p => {
      if (p.status === 'done') c.done++;
      else c.active++;
      const s = aggregate(p);
      totalDone += s.done; totalTotal += s.total;
      totalIssues += s.fail;
      if (p.status === 'fail' || (p.issues || 0) > 0) c.alert++;
    });
    return { ...c, totalIssues, totalDone, totalTotal };
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (tab === 'done') list = list.filter((p) => p.status === 'done');
    else if (tab === 'alert') list = list.filter((p) => p.status === 'fail' || (p.issues || 0) > 0);
    else if (tab === 'active') list = list.filter((p) => p.status !== 'done');
    if (search.trim()) {
      list = list.filter((p) => productMatchesSearch(p, search));
    }
    return list;
  }, [products, tab, search]);

  useEffect(() => {
    const visibleIds = new Set(filtered.map((p) => p.id));
    setSelectedProductIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  const selectedVisibleCount = useMemo(() => (
    filtered.reduce((count, p) => count + (selectedProductIds.has(p.id) ? 1 : 0), 0)
  ), [filtered, selectedProductIds]);
  const allVisibleSelected = filtered.length > 0 && selectedVisibleCount === filtered.length;

  const toggleProductSelection = useCallback((productId) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const toggleAllVisibleProducts = useCallback(() => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((p) => next.delete(p.id));
      } else {
        filtered.forEach((p) => next.add(p.id));
      }
      return next;
    });
  }, [allVisibleSelected, filtered]);

  const clearProductSelection = useCallback(() => {
    setSelectedProductIds(new Set());
  }, []);

  const deleteSelectedProducts = useCallback(async () => {
    if (!onDeleteSelected || selectedProductIds.size === 0) return;
    const selectedNames = products
      .filter((p) => selectedProductIds.has(p.id))
      .map((p) => p.name);
    const ok = window.confirm(`Xóa ${selectedNames.length} sản phẩm đã chọn? Toàn bộ hạng mục, công việc và sub-task bên trong cũng sẽ bị xóa.`);
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await onDeleteSelected([...selectedProductIds]);
      clearProductSelection();
    } finally {
      setBulkDeleting(false);
    }
  }, [clearProductSelection, onDeleteSelected, products, selectedProductIds]);

  return (
    <div className={`screen ${panel ? 'screen--panel' : 'has-nav'}`}>
      <div className={`topbar ${scrolled ? 'scrolled' : ''} ${panel ? 'topbar--panel' : ''}`}>
        {!panel && (
          <button className="icon-btn" aria-label="Menu" style={{ pointerEvents:'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        )}
        <div className="title-wrap">
          <div className="crumb">{panel ? 'Danh sách' : 'Check Lỗi Việc'}</div>
          <div className="title">Tất cả sản phẩm</div>
        </div>
        <button className="icon-btn" aria-label="Tìm"><Icon.search/></button>
        {!panel && (
          <div
            style={{
              width: 32,
              height: 32,
              marginLeft: 4,
              borderRadius: '50%',
              background: currentUser?.color || '#7B6BA0',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {currentUser?.initials || 'TV'}
          </div>
        )}
      </div>

      <div className="scroll" ref={scrollRef}>
        {!panel && (
        <div className="home-hero">
          <div className="h-eyebrow">{todayText}</div>
          <h1>Chào, {currentUser?.name || 'cả nhà'} 👋</h1>
          <div className="home-stats">
            <div className="s"><div className="n">{counts.active}</div><div className="l">Đang chạy</div></div>
            <div className={`s ${counts.totalIssues > 0 ? 'alert' : ''}`}><div className="n">{counts.totalIssues}</div><div className="l">Lỗi mở</div></div>
            <div className="s"><div className="n">{counts.totalDone}<span style={{fontSize:13, color:'var(--muted)', fontWeight:500}}>/{counts.totalTotal}</span></div><div className="l">Việc đạt</div></div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', marginTop: 10 }}>
            <button
              type="button"
              onClick={() => navigate(pathForTab('people', layout))}
              style={{
                minWidth: 120,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid var(--line)',
                background: '#fff',
                color: 'var(--ink)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Xem Nhân sự
            </button>
          </div>
        </div>
        )}

        <div className="home-search" style={{ marginTop: panel ? 8 : 6 }}>
          <Icon.search style={{ color: 'var(--muted-2)' }}/>
          <input
            type="search"
            placeholder="Tìm theo tên khách hàng hoặc dự án…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm sản phẩm"
          />
          {!panel && <span className="kbd">⌘ K</span>}
        </div>

        <div className="home-tabs">
          <button className={`home-tab ${tab==='active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            Đang chạy <span className="pill">{counts.active}</span>
          </button>
          <button className={`home-tab alert ${tab==='alert' ? 'active' : ''}`} onClick={() => setTab('alert')}>
            Có lỗi {counts.alert > 0 && <span className="pill">{counts.alert}</span>}
          </button>
          <button className={`home-tab ${tab==='done' ? 'active' : ''}`} onClick={() => setTab('done')}>
            Đã xong <span className="pill">{counts.done}</span>
          </button>
          <button className={`home-tab ${tab==='all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            Tất cả <span className="pill">{counts.all}</span>
          </button>
        </div>

        {canBulkDelete && (
          <div className="product-bulk-toolbar">
            <button
              type="button"
              className={`product-bulk-check ${allVisibleSelected ? 'checked' : ''}`}
              aria-pressed={allVisibleSelected}
              disabled={filtered.length === 0}
              onClick={toggleAllVisibleProducts}
            >
              <span className="product-bulk-check-box">{allVisibleSelected && <Icon.check/>}</span>
              {allVisibleSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả đang hiển thị'}
            </button>
            <span className="product-bulk-count">{selectedVisibleCount} đã chọn</span>
            {selectedVisibleCount > 0 && (
              <button type="button" className="product-bulk-clear" onClick={clearProductSelection}>
                Bỏ chọn
              </button>
            )}
            <button
              type="button"
              className="product-bulk-delete"
              disabled={selectedVisibleCount === 0 || bulkDeleting}
              onClick={deleteSelectedProducts}
            >
              <Icon.trash/>
              {bulkDeleting ? 'Đang xóa…' : 'Xóa đã chọn'}
            </button>
          </div>
        )}

        <div className={`product-list ${panel ? 'product-list--panel' : ''}`}>
          {filtered.length === 0 && (
            <div className="empty">
              {search.trim()
                ? 'Không tìm thấy sản phẩm theo tên khách hàng hoặc dự án.'
                : 'Không có sản phẩm nào ở mục này.'}
            </div>
          )}
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onOpen={() => onOpen(p)}
              onOpenActions={onOpenActions}
              onComplete={onComplete}
              selectable={canBulkDelete}
              selected={selectedProductIds.has(p.id)}
              onToggleSelected={toggleProductSelection}
            />
          ))}
        </div>
      </div>

      {!panel && (
        <button className="fab" aria-label="Thêm sản phẩm" onClick={onAddProduct}>
          <Icon.plus/> Thêm sản phẩm
        </button>
      )}
    </div>
  );
}

function DesktopProductsSplit({
  products, stack, currentNode, parentNode, depth, t, projectNode, subtaskSupported,
  openProduct, openChild, back, openNodeActions, onAddChild, onAddFeature, currentUserId,
  onCompleteNode, ...detailProps
}) {
  const [selectedAsideSubtaskIds, setSelectedAsideSubtaskIds] = useState(() => new Set());
  const [selectedMainSubtaskIds, setSelectedMainSubtaskIds] = useState(() => new Set());
  const shouldKeepFeatureTaskList = currentNode?._source?.table === 'tasks'
    && !currentNode?._source?.parentTaskId
    && parentNode?._source?.table === 'features';
  const listParent = shouldKeepFeatureTaskList ? parentNode : resolveListParent(currentNode, parentNode);
  const listItems = listParent?.children || [];
  const listLabel = addChildLabels(listParent).section || LEVEL_LABEL[depth] || 'Mục';
  const activeId = currentNode?.id;
  const showAsideAdd = listParent && canAddChildren(listParent);
  const asideAddLabel = addChildLabels(listParent).child;
  const hideChildrenInMain = listItems.length > 0;
  const isFeatureTaskList = listParent?._source?.table === 'features'
    && listItems.some((item) => item?._source?.table === 'tasks' && !item?._source?.parentTaskId);
  const allFeatureSubtasks = useMemo(() => (
    isFeatureTaskList ? collectSubtasksForFeature(listParent) : []
  ), [isFeatureTaskList, listParent]);
  const mainSubtaskItems = useMemo(() => {
    if (currentNode?._source?.table === 'features') return collectSubtasksForFeature(currentNode);
    if (currentNode?._source?.table === 'tasks' && !currentNode?._source?.parentTaskId) return directSubtasksOf(currentNode);
    return [];
  }, [currentNode]);
  const showMainSubtaskPanel = currentNode?._source?.table === 'features'
    || (currentNode?._source?.table === 'tasks' && !currentNode?._source?.parentTaskId);
  const mainSubtaskTitle = currentNode?._source?.table === 'features'
    ? 'Tất cả sub-task'
    : `Sub-task của ${currentNode?.name || 'công việc'}`;
  const isAsideSubtaskList = listParent?._source?.table === 'tasks'
    && listItems.some((item) => item._source?.parentTaskId);
  const featureNameById = useMemo(() => {
    const map = new Map();
    function walk(node) {
      if (node?._source?.table === 'features') map.set(node._source.id, node.name);
      (node.children || []).forEach(walk);
    }
    products.forEach(walk);
    return map;
  }, [products]);
  const mainSubtaskParentNameById = useMemo(() => {
    const map = new Map();
    if (currentNode?._source?.table === 'features') {
      (currentNode.children || []).forEach((task) => {
        directSubtasksOf(task).forEach((subtask) => map.set(subtask.id, task.name));
      });
    } else if (currentNode?._source?.table === 'tasks') {
      directSubtasksOf(currentNode).forEach((subtask) => map.set(subtask.id, currentNode.name));
    }
    return map;
  }, [currentNode]);
  const selectedMainSubtaskItems = useMemo(() => (
    mainSubtaskItems
      .filter((item) => selectedMainSubtaskIds.has(item.id))
      .map((item) => {
        const featureName = featureNameById.get(item._source?.featureId) || parentNode?.name || '';
        return {
          node: item,
          customerName: projectNode?.customerName || null,
          productName: projectNode?.name || '',
          featureName,
          parentName: featureName,
          parentTaskName: mainSubtaskParentNameById.get(item.id) || '',
        };
      })
  ), [mainSubtaskItems, selectedMainSubtaskIds, featureNameById, parentNode, projectNode, mainSubtaskParentNameById]);
  const allMainSubtasksSelected = mainSubtaskItems.length > 0
    && selectedMainSubtaskIds.size === mainSubtaskItems.length;
  const selectedAsideSubtaskItems = useMemo(() => (
    listItems
      .filter((item) => selectedAsideSubtaskIds.has(item.id))
      .map((item) => {
        const featureName = featureNameById.get(item._source?.featureId) || '';
        return {
          node: item,
          customerName: projectNode?.customerName || null,
          productName: projectNode?.name || '',
          featureName,
          parentName: featureName,
          parentTaskName: listParent?.name || '',
        };
      })
  ), [listItems, selectedAsideSubtaskIds, featureNameById, projectNode, listParent]);
  const allAsideSubtasksSelected = isAsideSubtaskList
    && listItems.length > 0
    && selectedAsideSubtaskIds.size === listItems.length;

  useEffect(() => {
    const currentIds = new Set(mainSubtaskItems.map((item) => item.id));
    setSelectedMainSubtaskIds((prev) => {
      const next = new Set([...prev].filter((id) => currentIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [mainSubtaskItems]);

  useEffect(() => {
    if (!isAsideSubtaskList) {
      setSelectedAsideSubtaskIds(new Set());
      return;
    }
    const currentIds = new Set(listItems.map((item) => item.id));
    setSelectedAsideSubtaskIds((prev) => {
      const next = new Set([...prev].filter((id) => currentIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [isAsideSubtaskList, listItems]);

  const toggleAsideSubtaskSelection = useCallback((nodeId) => {
    setSelectedAsideSubtaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const selectAllAsideSubtasks = useCallback(() => {
    setSelectedAsideSubtaskIds(new Set(listItems.map((item) => item.id)));
  }, [listItems]);

  const clearAsideSubtasks = useCallback(() => {
    setSelectedAsideSubtaskIds(new Set());
  }, []);

  const toggleMainSubtaskSelection = useCallback((nodeId) => {
    setSelectedMainSubtaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const selectAllMainSubtasks = useCallback(() => {
    setSelectedMainSubtaskIds(new Set(mainSubtaskItems.map((item) => item.id)));
  }, [mainSubtaskItems]);

  const clearMainSubtasks = useCallback(() => {
    setSelectedMainSubtaskIds(new Set());
  }, []);

  return (
    <div className="desktop-products-split">
      <aside className="desktop-split-aside">
        {stack.length === 0 ? (
          <ProductsHome
            products={products}
            onOpen={openProduct}
            onOpenActions={openNodeActions}
            onComplete={handleCompleteNode}
            panel
            currentUserId={currentUserId}
          />
        ) : (
          <div className="screen screen--panel">
            <div className="topbar topbar--panel">
              <button type="button" className="icon-btn" onClick={back} aria-label="Quay lại">
                <Icon.back/>
              </button>
              <div className="title-wrap">
                <div className="crumb">{listLabel}</div>
                <div className="title">{listParent?.name}</div>
              </div>
            </div>
            <div className="scroll desktop-split-scroll">
              {isAsideSubtaskList && listItems.length > 0 && (
                <div className="desktop-subtask-report-bar">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={allAsideSubtasksSelected ? clearAsideSubtasks : selectAllAsideSubtasks}
                  >
                    {allAsideSubtasksSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={selectedAsideSubtaskItems.length === 0}
                    onClick={() => printSubtaskReport({ person: null, items: selectedAsideSubtaskItems })}
                  >
                    In ({selectedAsideSubtaskItems.length})
                  </button>
                </div>
              )}
              <div className="desktop-split-list">
                {isFeatureTaskList && (
                  <button
                    type="button"
                    className={`desktop-all-subtasks-row ${currentNode?.id === listParent?.id ? 'active' : ''}`}
                    onClick={() => openChild(listParent)}
                  >
                    <span className="desktop-all-subtasks-icon"><Icon.check/></span>
                    <span className="desktop-all-subtasks-text">
                      <span>Tất cả</span>
                      <span>{allFeatureSubtasks.length} sub-task</span>
                    </span>
                  </button>
                )}
                {listItems.length === 0 && (
                  <div className="empty">Chưa có mục con.</div>
                )}
                {listItems.map((child) => {
                  const selected = selectedAsideSubtaskIds.has(child.id);
                  return (
                    <div
                      key={child.id}
                      className={`desktop-subtask-select-row ${isAsideSubtaskList ? 'has-select' : ''}`}
                    >
                      {isAsideSubtaskList && (
                        <button
                          type="button"
                          className={`subtask-select ${selected ? 'checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAsideSubtaskSelection(child.id);
                          }}
                          aria-pressed={selected}
                          aria-label={`${selected ? 'Bỏ chọn' : 'Chọn'} sub-task ${child.name}`}
                        >
                          {selected && <Icon.check/>}
                        </button>
                      )}
                      <ItemCard
                        node={child}
                        depth={depth + 1}
                        onOpen={() => openChild(child)}
                        onOpenActions={(e) => { e.stopPropagation(); openNodeActions(child); }}
                        onComplete={onCompleteNode}
                        active={child.id === activeId}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {showAsideAdd && onAddChild && (
              <div className="desktop-split-aside-foot desktop-split-aside-foot--stack">
                <button type="button" className="btn btn-primary btn-block" onClick={onAddChild}>
                  <Icon.plus/> Thêm {asideAddLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
      <main className="desktop-split-main">
        {currentNode ? (
          <NodeDetail
            node={currentNode}
            depth={depth}
            parent={parentNode}
            t={t}
            embedded
            hideChildrenList={hideChildrenInMain}
            showBack={false}
            onOpenChild={openChild}
            onBack={back}
            onOpenActions={openNodeActions}
            onChildActions={openNodeActions}
            onAddChild={onAddChild}
            onAddFeature={onAddFeature}
            projectNode={projectNode}
            subtaskSupported={subtaskSupported}
            subtaskPanel={showMainSubtaskPanel ? (
              <DesktopSubtaskPanel
                title={mainSubtaskTitle}
                items={mainSubtaskItems}
                activeId={activeId}
                selectedIds={selectedMainSubtaskIds}
                allSelected={allMainSubtasksSelected}
                selectedCount={selectedMainSubtaskItems.length}
                onToggleSelected={toggleMainSubtaskSelection}
                onSelectAll={selectAllMainSubtasks}
                onClearSelected={clearMainSubtasks}
                onPrintSelected={() => printSubtaskReport({ person: null, items: selectedMainSubtaskItems })}
                onOpen={openChild}
                onOpenActions={openNodeActions}
                onComplete={onCompleteNode}
              />
            ) : null}
            {...detailProps}
          />
        ) : (
          <div className="desktop-split-empty">
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Không tìm thấy mục trong đường dẫn.</p>
            <button type="button" className="btn btn-secondary" onClick={back}>
              Quay lại
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function ActionDateTimeFields({
  label, dateId, timeId, date, time, onDateChange, onTimeChange, note,
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-datetime-row">
        <input
          id={dateId}
          className="field-input"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
        <input
          id={timeId}
          className="field-input field-input--time"
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          step={60}
        />
      </div>
      {note && <p className="field-note">{note}</p>}
    </div>
  );
}

function WorkActionSheet({ action, onClose, onSave, onComplete, onDelete, canDelete = true }) {
  const nowFields = () => splitDeadlineForInput(new Date().toISOString());
  const startInit = action
    ? splitActionDateTime(action.startedAt)
    : nowFields();

  const [title, setTitle] = useState(action?.title || '');
  const [note, setNote] = useState(action?.note || '');
  const [startDate, setStartDate] = useState(startInit.date);
  const [startTime, setStartTime] = useState(startInit.time);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const resolveTime = (date, time, fallbackNow = false) => {
    if (time) return time;
    if (!fallbackNow) return '';
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  };

  const buildEntry = (markComplete = false) => {
    const trimmed = title.trim();
    if (!trimmed) {
      setErr('Nhập mô tả hành động.');
      return null;
    }
    if (!startDate) {
      setErr('Chọn ngày bắt đầu.');
      return null;
    }
    const startedAt = combineDeadlineLocal(startDate, resolveTime(startDate, startTime, true));
    if (!startedAt) {
      setErr('Giờ bắt đầu không hợp lệ.');
      return null;
    }
    const status = markComplete ? 'completed' : (action?.status || 'in_progress');
    const endedAt = markComplete ? new Date().toISOString() : (action?.endedAt || null);
    return {
      id: action?.id || newWorkActionId(),
      title: trimmed,
      note: note.trim(),
      startedAt,
      endedAt,
      status,
    };
  };

  const persistEntry = async (entry) => {
    setErr('');
    setSaving(true);
    try {
      await onSave(entry);
      onClose();
    } catch (e) {
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const entry = buildEntry(false);
    if (entry) await persistEntry(entry);
  };

  const handleComplete = async () => {
    const entry = buildEntry(true);
    if (!entry) return;
    if (onComplete) {
      setErr('');
      setSaving(true);
      try {
        await onComplete(completeWorkAction(entry));
        onClose();
      } catch (e) {
        setErr(e.message || 'Không lưu được');
      } finally {
        setSaving(false);
      }
    } else {
      await persistEntry(completeWorkAction(entry));
    }
  };

  const stampNowStart = () => {
    const s = nowFields();
    setStartDate(s.date);
    setStartTime(s.time);
  };

  return (
    <Sheet title={action ? 'Sửa hành động' : 'Hành động tôi đã làm'} onClose={onClose}>
      <div className="form-stack">
        <div className="field">
          <label className="field-label" htmlFor="work-action-title">Bạn đã làm gì?</label>
          <input
            id="work-action-title"
            className="field-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Đồng bộ data lên excel…"
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="work-action-note">Ghi chú</label>
          <textarea
            id="work-action-note"
            className="field-input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Chi tiết thêm, kết quả, lưu ý… (tuỳ chọn)"
          />
        </div>

        <ActionDateTimeFields
          label="Giờ bắt đầu"
          dateId="work-action-start-date"
          timeId="work-action-start-time"
          date={startDate}
          time={startTime}
          onDateChange={setStartDate}
          onTimeChange={setStartTime}
          note="Bấm «Bây giờ» để lấy thời điểm hiện tại."
        />
        <div className="btn-row btn-row--tight">
          <button type="button" className="btn btn-secondary btn-sm" onClick={stampNowStart}>
            Bây giờ (bắt đầu)
          </button>
        </div>

        {action?.endedAt && (
          <p className="field-note">
            Giờ kết thúc: <strong>{formatWorkActionWhen(action.endedAt)}</strong>
          </p>
        )}
        {!action?.endedAt && (
          <p className="field-note">
            Giờ kết thúc sẽ được ghi nhận khi bạn bấm <strong>Hoàn thành</strong>.
          </p>
        )}

        {err && <p className="form-error">{err}</p>}

        {(!action || isWorkActionInProgress(action)) && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={saving}
            onClick={handleComplete}
          >
            {saving ? 'Đang lưu…' : 'Hoàn thành'}
          </button>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={handleSave}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
          {action && onDelete && canDelete && (
            <button
              type="button"
              className="btn btn-ghost-danger"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onDelete();
                  onClose();
                } catch (e) {
                  setErr(e.message || 'Không xóa được');
                  setSaving(false);
                }
              }}
              aria-label="Xóa hành động"
            >
              <Icon.trash/>
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

// ─── Sheets content ────────────────────────────────────────────────
function PhotoSheet({
  photo, onClose, onUpdatePhoto, onDeletePhoto, onAddFiles, canEdit = true, viewOnly = false,
}) {
  const [cap, setCap] = useState(photo ? photo.label : '');
  const [isBad, setIsBad] = useState(photo?.kind === 'bad');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const pasteRef = useRef(null);

  useEffect(() => {
    if (photo) return undefined;
    const onPaste = async (e) => {
      const files = getImageFilesFromClipboard(e);
      if (!files.length) return;
      e.preventDefault();
      await handleFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [photo]);

  const handleFiles = async (files) => {
    if (!onAddFiles || !files.length) return;
    setErr('');
    setUploading(true);
    try {
      await onAddFiles(files);
      onClose();
    } catch (e) {
      setErr(e.message || 'Không tải được ảnh');
    } finally {
      setUploading(false);
    }
  };

  const previewStyle = photo?.url
    ? { backgroundImage: `url(${photo.url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: photo.tint }
    : { background: photoBg(photo?.tint || '#E8D5C4') };

  const canEditPhotoMeta = photo && canEdit;
  const showBadToggle = canEditPhotoMeta && !viewOnly;

  return (
    <Sheet
      title={photo ? (viewOnly ? 'Xem ảnh' : 'Chi tiết ảnh') : 'Thêm ảnh'}
      onClose={onClose}
      className={viewOnly ? 'sheet--photo-viewer' : ''}
    >
      <div className="form-stack">
        {photo ? (
          <>
            {photo.url && viewOnly ? (
              <div className="photo-modal-viewer">
                <img
                  src={photo.url}
                  alt={photo.label || 'Ảnh đính kèm'}
                  className="photo-modal-img-full"
                />
                {photo.kind === 'bad' && (
                  <span className="photo-modal-badge">Ảnh lỗi</span>
                )}
              </div>
            ) : (
              <div className="photo-modal-img" style={previewStyle}>
                {photo.kind === 'bad' && (
                  <span className="photo-modal-badge">Ảnh lỗi</span>
                )}
              </div>
            )}
            {canEditPhotoMeta && (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="photo-cap">Ghi chú cho ảnh</label>
                  <textarea
                    id="photo-cap"
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                    rows={3}
                    placeholder="Mô tả: lỗi gì, ở đâu, cần làm gì…"
                  />
                </div>
                {!showBadToggle && (
                  <p className="field-note photo-modal-caption">Ghi chú này sẽ hiển thị dưới ảnh trong danh sách.</p>
                )}
              </>
            )}
            {showBadToggle && (
              <>
                <label className="photo-bad-check">
                  <input
                    type="checkbox"
                    checked={isBad}
                    onChange={(e) => setIsBad(e.target.checked)}
                  />
                  Đánh dấu là ảnh lỗi
                </label>
              </>
            )}
            {canEditPhotoMeta && (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onUpdatePhoto({ label: cap, kind: isBad ? 'bad' : 'good' });
                    onClose();
                  }}
                >
                  {viewOnly ? 'Lưu ghi chú' : 'Lưu'}
                </button>
                {!viewOnly && (
                  <button
                    type="button"
                    className="btn btn-ghost-danger"
                    onClick={() => { onDeletePhoto(); onClose(); }}
                    aria-label="Xóa ảnh"
                  >
                    <Icon.trash/>
                  </button>
                )}
              </div>
            )}
          </>
        ) : canEdit ? (
          <>
            <div
              ref={pasteRef}
              className="photo-paste-zone"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
            >
              <Icon.cam style={{ width: 32, height: 32, marginBottom: 8, color: 'var(--muted)' }}/>
              <div className="photo-paste-title">Dán ảnh bằng Ctrl+V</div>
              <div className="photo-paste-sub">hoặc bấm để chọn file · nhiều ảnh cùng lúc</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = [...(e.target.files || [])];
                e.target.value = '';
                handleFiles(files);
              }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              Chọn ảnh từ máy
            </button>
          </>
        ) : (
          <p className="field-note">Chỉ công việc / sub-task mới đính kèm ảnh.</p>
        )}
        {err && <p className="form-error">{err}</p>}
        {uploading && <p className="field-note">Đang xử lý ảnh…</p>}
      </div>
    </Sheet>
  );
}

function SheetHint({ label, name }) {
  return (
    <p className="sheet-hint">
      {label}: <strong>{name}</strong>
    </p>
  );
}

function currentDateTimeForInput() {
  return splitDeadlineForInput(new Date().toISOString());
}

function DeadlineDateTimeFields({
  dateId,
  timeId,
  date,
  time,
  onDateChange,
  onTimeChange,
  currentIso,
}) {
  return (
    <div className="field">
      <span className="field-label">Hạn hoàn thành</span>
      <div className="field-datetime-row">
        <input
          id={dateId}
          className="field-input"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label="Ngày hoàn thành"
        />
        <input
          id={timeId}
          className="field-input field-input--time"
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          step={60}
          aria-label="Giờ hoàn thành"
        />
      </div>
      <p className="field-note">
        {time
          ? 'Ngày và giờ theo múi giờ máy bạn.'
          : 'Chỉ chọn ngày → mặc định 23:59 cùng ngày.'}
      </p>
      {currentIso && (
        <p className="field-note">
          Hiện tại: <strong>{formatDeadline(currentIso)}</strong>
        </p>
      )}
    </div>
  );
}

function DeadlineSheet({ node, onClose, onSave }) {
  const initial = splitDeadlineForInput(node.deadline);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const persist = async (value) => {
    setErr('');
    setSaving(true);
    try {
      await onSave(value || null);
      onClose();
    } catch (e) {
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!date) {
      setErr('Chọn ngày hoàn thành.');
      return;
    }
    const iso = combineDeadlineLocal(date, time);
    if (!iso) {
      setErr('Ngày hoặc giờ không hợp lệ.');
      return;
    }
    persist(iso);
  };

  return (
    <Sheet title="Hạn hoàn thành" onClose={onClose}>
      <div className="form-stack">
        <SheetHint label="Áp dụng cho" name={node.name} />
        <DeadlineDateTimeFields
          dateId="deadline-date"
          timeId="deadline-time"
          date={date}
          time={time}
          onDateChange={setDate}
          onTimeChange={setTime}
          currentIso={node.deadline}
        />
        {err && <p className="form-error">{err}</p>}
        <div className="btn-col">
          <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving || !date}>
            {saving ? 'Đang lưu…' : 'Lưu hạn hoàn thành'}
          </button>
          {node.deadline && (
            <button type="button" className="btn btn-ghost-danger btn-block" onClick={() => persist(null)} disabled={saving}>
              Xóa hạn hoàn thành
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
            Hủy
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function NoteSheet({ node, onClose, onSave }) {
  const [val, setVal] = useState(node.note || '');
  return (
    <Sheet title="Ghi chú chung" onClose={onClose}>
      <div className="form-stack">
        <SheetHint label="Áp dụng cho" name={node.name} />
        <div className="field">
          <label className="field-label" htmlFor="note-text">Nội dung</label>
          <textarea
            id="note-text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={6}
            placeholder="Viết ghi chú, lưu ý, hoặc context cho cả team…"
            autoFocus
          />
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => { onSave(val); onClose(); }}>Lưu</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </div>
    </Sheet>
  );
}

function AssigneePicker({ value, onChange, hint }) {
  return (
    <>
      {hint && <p className="field-note">{hint}</p>}
      <div className="assignee-picker-list">
        {PEOPLE.map((p) => {
          const on = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(on ? '' : p.id)}
              className={`assignee-picker-item ${on ? 'active' : ''}`}
            >
              <div className="assignee-picker-av" style={{ background: p.color }}>{p.initials}</div>
              <span className="assignee-picker-name">{p.name}</span>
              <div className={`assignee-picker-check ${on ? 'on' : ''}`}>
                {on && <Icon.check />}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function MultiAssigneePicker({ values, onChange, hint }) {
  const selected = new Set(values || []);
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <>
      {hint && <p className="field-note">{hint}</p>}
      <div className="assignee-picker-list">
        {PEOPLE.map((p) => {
          const on = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`assignee-picker-item ${on ? 'active' : ''}`}
            >
              <div className="assignee-picker-av" style={{ background: p.color }}>{p.initials}</div>
              <span className="assignee-picker-name">{p.name}</span>
              <div className={`assignee-picker-check ${on ? 'on' : ''}`}>
                {on && <Icon.check />}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function newDocLinkId() {
  return `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function DocLinkSheet({ doc, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(doc?.title || '');
  const [url, setUrl] = useState(doc?.url || '');
  const [note, setNote] = useState(doc?.note || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    const t = title.trim();
    const u = normalizeUrl(url);
    if (!t) { setErr('Nhập tiêu đề.'); return; }
    if (!u) { setErr('Nhập link.'); return; }
    setErr('');
    setSaving(true);
    try {
      await onSave({
        id: doc?.id || newDocLinkId(),
        title: t,
        url: u,
        note: note.trim(),
        createdAt: doc?.createdAt || new Date().toISOString(),
      });
      onClose();
    } catch (e) {
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={doc ? 'Sửa link tài liệu' : 'Thêm link tài liệu'} onClose={onClose}>
      <div className="form-stack">
        <div className="field">
          <label className="field-label" htmlFor="doclink-title">Tiêu đề</label>
          <input
            id="doclink-title"
            className="field-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: File yêu cầu, Link drive, Spec…"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="doclink-url">Link</label>
          <input
            id="doclink-url"
            className="field-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="doclink-note">Ghi chú</label>
          <textarea
            id="doclink-note"
            className="field-input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tuỳ chọn…"
          />
        </div>
        {err && <p className="form-error">{err}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
          {doc && onDelete && (
            <button
              type="button"
              className="btn btn-ghost-danger"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try { await onDelete(); onClose(); }
                catch (e) { setErr(e.message || 'Không xóa được'); setSaving(false); }
              }}
              aria-label="Xóa link"
            >
              <Icon.trash/>
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function AddChildSheet({ parentNode, childLabel, onClose, onSave }) {
  const isFeature = parentNode?._source?.table === 'projects';
  const isTaskLike = parentNode?._source?.table === 'features' || parentNode?._source?.table === 'tasks';
  const startInitial = useMemo(() => currentDateTimeForInput(), []);
  const [name, setName] = useState('');
  const [startedDate, setStartedDate] = useState(startInitial.date);
  const [startedTime, setStartedTime] = useState(startInitial.time);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setErr('');
    setSaving(true);
    try {
      const startedAt = startedDate ? combineDeadlineLocal(startedDate, startedTime) : null;
      const deadlineIso = deadlineDate ? combineDeadlineLocal(deadlineDate, deadlineTime) : null;
      await onSave({
        name,
        startedAt,
        deadline: deadlineIso,
        assignees: (isTaskLike || isFeature)
          ? assigneeIds
          : (assigneeId ? [assigneeId] : []),
      });
      onClose();
    } catch (e) {
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={`Thêm ${childLabel}`} onClose={onClose}>
      <div className="form-stack">
        <SheetHint label="Thuộc" name={parentNode?.name} />
        <div className="field">
          <label className="field-label" htmlFor="add-child-name">Tên {childLabel}</label>
          <input
            id="add-child-name"
            className="field-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nhập tên ${childLabel}…`}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>
        <DateTimeFields
          label="Ngày giờ bắt đầu"
          dateId="add-child-started-date"
          timeId="add-child-started-time"
          date={startedDate}
          time={startedTime}
          onDateChange={setStartedDate}
          onTimeChange={setStartedTime}
          note="Điền sẵn thời điểm hiện tại, có thể chỉnh lại trước khi tạo."
        />
        <DeadlineDateTimeFields
          dateId="add-child-deadline-date"
          timeId="add-child-deadline-time"
          date={deadlineDate}
          time={deadlineTime}
          onDateChange={setDeadlineDate}
          onTimeChange={setDeadlineTime}
        />
        <div className="field">
          <label className="field-label">Nhân sự phụ trách</label>
          {(isTaskLike || isFeature) ? (
            <MultiAssigneePicker
              values={assigneeIds}
              onChange={setAssigneeIds}
              hint={isFeature
                ? 'Có thể chọn nhiều người cho cùng một hạng mục.'
                : 'Có thể chọn nhiều người cho cùng một công việc.'}
            />
          ) : (
            <AssigneePicker
              value={assigneeId}
              onChange={setAssigneeId}
              hint={isFeature
                ? 'Tùy chọn — gán phụ trách cho hạng mục.'
                : 'Tùy chọn — gán trực tiếp cho công việc.'}
            />
          )}
        </div>
        {err && <p className="form-error">{err}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Đang lưu…' : 'Tạo mới'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </div>
    </Sheet>
  );
}

function EditPersonSheet({ person, onClose, onSave, showAccessRole = false }) {
  const [name, setName] = useState(person.name || '');
  const [role, setRole] = useState(person.role || '');
  const [dept, setDept] = useState(person.dept || '');
  const [status, setStatus] = useState(person.status === 'online' ? 'online' : 'off');
  const [accessRole, setAccessRole] = useState(
    person.accessRole || readStoredAccessRole(person.id) || ACCESS_ROLE.WORKER,
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setErr('');
    setSaving(true);
    try {
      await onSave({ name, role, dept, status, accessRole: showAccessRole ? accessRole : undefined });
      onClose();
    } catch (e) {
      setErr(e.message || 'Không lưu được nhân sự');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Sửa nhân sự" onClose={onClose}>
      <div className="form-stack">
        <div className="field">
          <label className="field-label" htmlFor="edit-person-name">Tên nhân sự</label>
          <input
            id="edit-person-name"
            className="field-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="edit-person-role">Vai trò</label>
          <input
            id="edit-person-role"
            className="field-input"
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="edit-person-dept">Phòng ban</label>
          <input
            id="edit-person-dept"
            className="field-input"
            type="text"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="edit-person-status">Trạng thái</label>
          <select
            id="edit-person-status"
            className="field-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="online">Online</option>
            <option value="off">Offline</option>
          </select>
        </div>
        {showAccessRole && (
          <div className="field">
            <label className="field-label" htmlFor="edit-person-access">Quyền truy cập</label>
            <select
              id="edit-person-access"
              className="field-input"
              value={accessRole}
              onChange={(e) => setAccessRole(e.target.value)}
            >
              <option value={ACCESS_ROLE.ADMIN}>Admin — toàn quyền</option>
              <option value={ACCESS_ROLE.WORKER}>Thợ hiện trường</option>
            </select>
            <p className="field-note">Admin: xóa/sửa mọi Job, xem báo cáo. Thợ: chỉ Job được giao.</p>
          </div>
        )}
        {err && <p className="form-error">{err}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </div>
    </Sheet>
  );
}

function AddProductSheet({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setErr('');
    setSaving(true);
    try {
      const deadlineIso = deadlineDate ? combineDeadlineLocal(deadlineDate, deadlineTime) : null;
      await onSave({ name, customerName, deadline: deadlineIso });
      onClose();
    } catch (e) {
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Thêm sản phẩm" onClose={onClose}>
      <div className="form-stack">
        <div className="field">
          <label className="field-label" htmlFor="add-product-name">Tên sản phẩm</label>
          <input
            id="add-product-name"
            className="field-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên sản phẩm..."
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="add-product-customer">Khách hàng</label>
          <input
            id="add-product-customer"
            className="field-input"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Tên khách hàng..."
          />
        </div>
        <DeadlineDateTimeFields
          dateId="add-product-deadline-date"
          timeId="add-product-deadline-time"
          date={deadlineDate}
          time={deadlineTime}
          onDateChange={setDeadlineDate}
          onTimeChange={setDeadlineTime}
        />
        {err && <p className="form-error">{err}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Đang lưu...' : 'Tạo mới'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </div>
    </Sheet>
  );
}

function nodeLevelLabel(node) {
  const table = node?._source?.table;
  if (table === 'projects') return 'sản phẩm';
  if (table === 'features') return 'hạng mục';
  if (table === 'tasks') {
    return node._source?.parentTaskId ? 'sub-task' : 'công việc';
  }
  return 'mục';
}

function resolveEditAssigneeId(node) {
  if (node?._source?.table === 'tasks') return node.assignees?.[0] || '';
  if (node?._source?.table === 'features') return node.assignees?.[0] || '';
  return '';
}

function deleteImpactText(node) {
  const table = node?._source?.table;
  if (table === 'tasks') {
    const sub = (node.children || []).length;
    if (sub > 0) {
      return `Công việc «${node.name}» và ${sub} sub-task bên trong sẽ bị xóa vĩnh viễn.`;
    }
    return 'Công việc này sẽ bị xóa vĩnh viễn.';
  }
  if (table === 'features') {
    const n = node.children?.length || 0;
    return `Hạng mục «${node.name}» và ${n} công việc bên trong sẽ bị xóa vĩnh viễn.`;
  }
  const features = node.children?.length || 0;
  let tasks = 0;
  (node.children || []).forEach((f) => { tasks += (f.children || []).length; });
  return `Sản phẩm «${node.name}», ${features} hạng mục và ${tasks} công việc sẽ bị xóa vĩnh viễn.`;
}

function NodeActionsSheet({ node, onClose, onView, onAddDocLink, onEdit, onDelete, canDelete = true }) {
  const label = nodeLevelLabel(node);
  const table = node?._source?.table;
  return (
    <Sheet title="Tùy chọn" onClose={onClose}>
      <div className="form-stack">
      <SheetHint label={label.charAt(0).toUpperCase() + label.slice(1)} name={node.name} />
      <div className="node-actions-list">
        <button type="button" className="node-action-btn" onClick={onView}>
          <Icon.eye />
          <span>Xem chi tiết {label}</span>
        </button>
        {(table === 'features' || table === 'projects') && typeof onAddDocLink === 'function' && (
          <button type="button" className="node-action-btn" onClick={onAddDocLink}>
            <Icon.note />
            <span>Thêm link tài liệu</span>
          </button>
        )}
        <button type="button" className="node-action-btn" onClick={onEdit}>
          <Icon.edit />
          <span>Sửa {label}</span>
        </button>
        {canDelete && (
          <button type="button" className="node-action-btn danger" onClick={onDelete}>
            <Icon.trash />
            <span>Xóa {label}</span>
          </button>
        )}
      </div>
      </div>
    </Sheet>
  );
}

function EditNodeSheet({ node, onClose, onSave }) {
  const label = nodeLevelLabel(node);
  const showStatus = node?._source?.table === 'projects';
  const showAssignee = node?._source?.table === 'tasks';
  const [name, setName] = useState(node.name || '');
  const [status, setStatus] = useState(node.status || 'todo');
  const [deadlineDate, setDeadlineDate] = useState(() => splitDeadlineForInput(node.deadline).date);
  const [deadlineTime, setDeadlineTime] = useState(() => splitDeadlineForInput(node.deadline).time);
  const [assigneeId, setAssigneeId] = useState(() => resolveEditAssigneeId(node));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setErr('');
    setSaving(true);
    try {
      const deadlineIso = deadlineDate ? combineDeadlineLocal(deadlineDate, deadlineTime) : null;
      await onSave({
        name,
        ...(showStatus ? { status } : {}),
        deadline: deadlineIso,
        assignees: assigneeId ? [assigneeId] : [],
      });
      onClose();
    } catch (e) {
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={`Sửa ${label}`} onClose={onClose}>
      <div className="form-stack">
        <div className="field">
          <label className="field-label" htmlFor="edit-name">Tên</label>
          <input
            id="edit-name"
            className="field-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        {showStatus && (
          <div className="field">
            <label className="field-label" htmlFor="edit-status">Tráº¡ng thÃ¡i</label>
            <div className="status-choice-group" role="group" aria-label="Đổi trạng thái">
              {Object.entries(STATUS_META).map(([value, meta]) => (
                <button
                  key={value}
                  type="button"
                  className={`status-choice-btn status-choice-btn--${value} ${status === value ? 'active' : ''}`}
                  onClick={() => setStatus(value)}
                >
                  <span className="status-choice-dot" style={{ background: meta.dot }} />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <DeadlineDateTimeFields
          dateId="edit-deadline-date"
          timeId="edit-deadline-time"
          date={deadlineDate}
          time={deadlineTime}
          onDateChange={setDeadlineDate}
          onTimeChange={setDeadlineTime}
          currentIso={node.deadline}
        />
        {showAssignee && (
          <div className="field">
            <label className="field-label">Nhân sự phụ trách</label>
            <AssigneePicker
              value={assigneeId}
              onChange={setAssigneeId}
              hint="Gán trực tiếp cho công việc."
            />
          </div>
        )}
        {err && <p className="form-error">{err}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        </div>
      </div>
    </Sheet>
  );
}

function ConfirmDeleteSheet({ node, onClose, onConfirm }) {
  const label = nodeLevelLabel(node);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const handleDelete = async () => {
    setErr('');
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setErr(e.message || 'Không xóa được');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet title={`Xóa ${label}?`} onClose={onClose}>
      <div className="form-stack">
        <p className="sheet-hint sheet-hint--body">{deleteImpactText(node)}</p>
        <p className="field-note">Hành động này không thể hoàn tác.</p>
        {err && <p className="form-error">{err}</p>}
        <div className="btn-col">
          <button type="button" className="btn btn-danger btn-block" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Đang xóa…' : `Xóa ${label}`}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose} disabled={deleting}>
            Hủy
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function AssigneeSheet({ node, onClose, onSave }) {
  const [selected, setSelected] = useState(new Set(node.assignees));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  return (
    <Sheet title="Giao việc" onClose={onClose}>
      <div className="form-stack">
        <SheetHint label="Phụ trách" name={node.name} />
        <div className="assignee-picker-list">
          {PEOPLE.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`assignee-picker-item ${on ? 'active' : ''}`}
              >
                <div className="assignee-picker-av" style={{ background: p.color }}>{p.initials}</div>
                <span className="assignee-picker-name">{p.name}</span>
                <div className={`assignee-picker-check ${on ? 'on' : ''}`}>
                  {on && <Icon.check />}
                </div>
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => { onSave([...selected]); onClose(); }}>
          Lưu ({selected.size})
        </button>
      </div>
    </Sheet>
  );
}

// ─── Root App ─────────────────────────────────────────────────────
function App({ t }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tab, stack, personId } = useMemo(
    () => parseAppPath(location.pathname),
    [location.pathname],
  );
  const { effectiveLayout, useSplitProducts: layoutAllowsSplit } = useEffectiveLayout(location.pathname);
  /** Split 2 cột: trái = hạng mục/công việc con, phải = chi tiết */
  const useSplitProducts = layoutAllowsSplit && stack.length >= 1;
  const isDesktop = effectiveLayout === 'desktop';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [subtaskSupported, setSubtaskSupported] = useState(true);
  const [docLinksSupported, setDocLinksSupported] = useState(true);
  const [projectDocLinksSupported, setProjectDocLinksSupported] = useState(true);
  const [projectFieldSettingsSupported, setProjectFieldSettingsSupported] = useState(true);
  const [accessRoleSupported, setAccessRoleSupported] = useState(false);

  const accessRole = useMemo(() => {
    const person = PEOPLE.find((p) => p.id === currentUserId);
    const stored = currentUserId ? readStoredAccessRole(currentUserId) : null;
    return resolveAccessRole(person, stored);
  }, [currentUserId, products]);

  const visibleProducts = useMemo(
    () => filterProductsForUser(products, currentUserId, accessRole),
    [products, currentUserId, accessRole],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const {
          products: nextProducts,
          people,
          subtaskSupported: subOk,
          docLinksSupported: docOk,
          projectDocLinksSupported: projDocOk,
          projectFieldSettingsSupported: fieldOk,
          accessRoleSupported: roleOk,
        } = await fetchAppData();
        if (cancelled) return;
        setPeople(people);
        setPathIndex(nextProducts);
        setProducts(nextProducts);
        setSubtaskSupported(subOk !== false);
        setDocLinksSupported(docOk !== false);
        setProjectDocLinksSupported(projDocOk !== false);
        setProjectFieldSettingsSupported(fieldOk !== false);
        setAccessRoleSupported(roleOk === true);
        const loggedInPersonId = await getLoggedInPersonId(people);
        const nextCurrentUserId = resolveCurrentUserId(people, nextProducts, loggedInPersonId);
        setCurrentUserId(nextCurrentUserId);
        writeStoredCurrentUserId(nextCurrentUserId);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'Không tải được dữ liệu từ Supabase');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // helpers walk all products
  function findNodeIn(id, root) {
    if (root.id === id) return root;
    for (const c of (root.children || [])) {
      const r = findNodeIn(id, c);
      if (r) return r;
    }
    return null;
  }
  function findNode(id) {
    for (const p of products) {
      const r = findNodeIn(id, p);
      if (r) return r;
    }
    return null;
  }
  function updateNode(id, mutator, patchForDb) {
    setProducts((prev) => {
      const next = structuredClone(prev);
      let target = null;
      for (const p of next) {
        target = findNodeIn(id, p);
        if (target) {
          mutator(target);
          break;
        }
      }
      if (target && patchForDb) {
        saveNodePatch(target, patchForDb).catch((err) => {
          console.error('[Supabase] Lưu thất bại:', err);
        });
      }
      setPathIndex(next);
      return next;
    });
  }

  const currentId = stack[stack.length - 1];
  const currentNode = currentId ? findNode(currentId) : null;
  const depth = stack.length - 1;
  const parentNode = stack.length > 1 ? findNode(stack[stack.length - 2]) : null;
  const addChildParentNode = resolveAddChildParent(currentNode, parentNode);
  const projectNode = useMemo(
    () => resolveProjectFromStack(stack, findNode),
    [stack, products],
  );

  const sheetNodeId = sheet?.nodeId ?? currentId;
  const sheetNode = sheetNodeId ? findNode(sheetNodeId) : null;

  const openNodeActions = useCallback((node) => {
    if (!node?.id) return;
    setSheet({ type: 'actions', nodeId: node.id });
  }, []);

  const openAddChild = useCallback(() => {
    if (!addChildParentNode?.id) return;
    setSheet({ type: 'addChild', parentId: addChildParentNode.id });
  }, [addChildParentNode]);

  const openAddFeature = useCallback(() => {
    if (!projectNode?.id) return;
    setSheet({ type: 'addChild', parentId: projectNode.id });
  }, [projectNode]);

  const openAddProduct = useCallback(() => {
    setSheet({ type: 'addProduct' });
  }, []);

  const reloadData = useCallback(async () => {
    const {
      products: nextProducts,
      people,
      subtaskSupported: subOk,
      docLinksSupported: docOk,
      projectDocLinksSupported: projDocOk,
      projectFieldSettingsSupported: fieldOk,
      accessRoleSupported: roleOk,
    } = await fetchAppData();
    setPeople(people);
    setPathIndex(nextProducts);
    setProducts(nextProducts);
    setSubtaskSupported(subOk !== false);
    setDocLinksSupported(docOk !== false);
    setProjectDocLinksSupported(projDocOk !== false);
    setProjectFieldSettingsSupported(fieldOk !== false);
    setAccessRoleSupported(roleOk === true);
    const loggedInPersonId = await getLoggedInPersonId(people);
    setCurrentUserId((prev) => {
      const nextCurrentUserId = resolveCurrentUserId(people, nextProducts, loggedInPersonId || prev);
      writeStoredCurrentUserId(nextCurrentUserId);
      return nextCurrentUserId;
    });
  }, []);

  const handleDeleteNode = useCallback(async (nodeId) => {
    if (!canDeleteNode(accessRole)) return;
    const node = findNode(nodeId);
    if (!node) return;
    await deleteNode(node);
    await reloadData();
    const idx = stack.indexOf(nodeId);
    if (idx >= 0) {
      navigate(buildProductPath(stack.slice(0, idx), effectiveLayout));
    }
  }, [reloadData, stack, navigate, effectiveLayout, accessRole]);

  const handleDeleteProducts = useCallback(async (productIds) => {
    const ids = new Set(productIds || []);
    const nodes = products.filter((p) => ids.has(p.id));
    for (const node of nodes) {
      await deleteNode(node);
    }
    await reloadData();
    if (stack.length > 0 && ids.has(stack[0])) {
      navigate(pathForTab('products', effectiveLayout));
    }
  }, [effectiveLayout, navigate, products, reloadData, stack]);

  const persistAttendanceForProject = useCallback(async (projectNode, sessions) => {
    await saveProjectAttendance(projectNode, sessions);
    await reloadData();
  }, [reloadData]);

  const handleAttendanceCheckIn = useCallback(async (projectNode, session) => {
    const list = [...(projectNode.attendanceSessions || []), session];
    await persistAttendanceForProject(projectNode, list);
  }, [persistAttendanceForProject]);

  const handleAttendanceCheckOut = useCallback(async (projectNode, activeSession, pos, auto = false) => {
    const updated = checkoutSession(activeSession, new Date(), {
      lat: pos?.lat,
      lng: pos?.lng,
      auto,
    });
    const list = (projectNode.attendanceSessions || []).map((s) => (
      s.id === updated.id ? updated : s
    ));
    await persistAttendanceForProject(projectNode, list);
  }, [persistAttendanceForProject]);

  const fieldOpsHandlers = {
    currentUserId,
    accessRole,
    people: PEOPLE,
    projectFieldSettingsSupported,
    onAttendanceCheckIn: async (session) => {
      const proj = projectNode || (currentNode?._source?.table === 'projects' ? currentNode : null);
      if (!proj) return;
      await handleAttendanceCheckIn(proj, session);
    },
    onAttendanceCheckOut: async (activeSession, pos, auto) => {
      const proj = projectNode || (currentNode?._source?.table === 'projects' ? currentNode : null);
      if (!proj) return;
      await handleAttendanceCheckOut(proj, activeSession, pos, auto);
    },
    onOpenSiteSettings: () => {
      const proj = projectNode || currentNode;
      if (proj?._source?.table === 'projects') {
        setSheet({ type: 'siteLocation', nodeId: proj.id });
      }
    },
    onOpenTeamSchedule: (schedule) => {
      const proj = projectNode || currentNode;
      if (proj?._source?.table === 'projects') {
        setSheet({ type: 'teamSchedule', schedule, nodeId: proj.id });
      }
    },
  };

  const openProduct = useCallback(
    (node) => navigate(productPathForNode(node.id, pathIndex, effectiveLayout)),
    [navigate, effectiveLayout, pathIndex],
  );
  const openChild = useCallback(
    (node) => navigate(productPathForNode(node.id, pathIndex, effectiveLayout)),
    [navigate, effectiveLayout, pathIndex],
  );

  useEffect(() => {
    if (tab !== 'products' || stack.length === 0) return;
    const normalized = normalizeProductStack(stack);
    if (!stacksEqual(normalized, stack)) {
      navigate(buildProductPath(normalized, effectiveLayout), { replace: true });
    }
  }, [tab, stack, navigate, effectiveLayout]);
  const back = useCallback(() => {
    if (stack.length === 0) return;
    navigate(buildProductPath(stack.slice(0, -1), effectiveLayout));
  }, [navigate, stack, effectiveLayout]);

  const cycleStatus = () => {
    const cycle = { todo: 'doing', doing: 'done', done: 'fail', fail: 'todo' };
    const nextStatus = cycle[currentNode?.status] || 'todo';
    updateNode(currentId, (n) => {
      n.status = nextStatus;
    }, { status: nextStatus });
  };

  const jumpToNode = useCallback((nodeId) => {
    const ancestors = pathIndex.paths[nodeId];
    if (!ancestors) return;
    navigate(buildProductPath([...ancestors, nodeId], effectiveLayout));
  }, [navigate, effectiveLayout]);

  const myStats = useMemo(
    () => (currentUserId ? personSubtaskStats(currentUserId, products) : { fail: 0, overdue: 0 }),
    [currentUserId, products]
  );

  const persistPhotosForNode = useCallback(async (node, photos) => {
    if (!node?._source || node._source.table !== 'tasks') return;
    await saveTaskPhotos(node, photos);
    updateNode(node.id, (n) => { n.photos = [...photos]; });
  }, []);

  const persistWorkActionsForNode = useCallback(async (node, actions) => {
    if (!node?._source || node._source.table !== 'tasks') return;
    await saveTaskWorkActions(node, actions);
    updateNode(node.id, (n) => { n.workActions = [...actions]; });
  }, []);

  const handleCompleteNode = useCallback(async (targetNode) => {
    const node = targetNode || findNode(currentId);
    if (!node?._source) return;
    try {
      await completeNode(node);
      updateNode(node.id, (n) => {
        n.status = 'done';
        n.completedAt = new Date().toISOString();
      });
    } catch (err) {
      console.error('[Supabase] Hoàn thành:', err);
      window.alert(err.message || 'Không ghi nhận được hoàn thành');
    }
  }, [currentId, products]);

  const persistDocLinksForNode = useCallback(async (node, docLinks) => {
    if (!node?._source) return;
    const table = node._source.table;
    if (table === 'features') {
      await saveFeatureDocLinks(node, docLinks);
      updateNode(node.id, (n) => { n.docLinks = [...docLinks]; });
      return;
    }
    if (table === 'projects') {
      await saveProjectDocLinks(node, docLinks);
      updateNode(node.id, (n) => { n.docLinks = [...docLinks]; });
    }
  }, []);

  const addPhotosFromFiles = useCallback(async (node, files) => {
    if (!node || !files?.length) return;
    const added = await filesToPhotos(files);
    const next = [...(node.photos || []), ...added];
    await persistPhotosForNode(node, next);
  }, [persistPhotosForNode]);

  const findPhotoOwnerIn = useCallback((root, photoId) => {
    if (!root) return null;
    if (root._source?.table === 'tasks' && (root.photos || []).some((p) => p.id === photoId)) {
      return root;
    }
    for (const child of (root.children || [])) {
      const hit = findPhotoOwnerIn(child, photoId);
      if (hit) return hit;
    }
    return null;
  }, []);

  const handleDeleteAnyPhoto = useCallback(async (photo) => {
    if (!photo?.id) return;
    const root = currentNode;
    if (!root) return;
    const owner = findPhotoOwnerIn(root, photo.id);
    if (!owner) return;
    const next = (owner.photos || []).filter((p) => p.id !== photo.id);
    await persistPhotosForNode(owner, next);
  }, [currentNode, findPhotoOwnerIn, persistPhotosForNode]);

  const handlePastePhotos = useCallback(async (files) => {
    const node = sheet?.type === 'photo' ? sheetNode : currentNode;
    if (!node) return;
    await addPhotosFromFiles(node, files);
  }, [sheet, sheetNode, currentNode, addPhotosFromFiles]);

  if (loading) {
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Đang tải dữ liệu…</div>
          <div style={{ fontSize: 13 }}>Kết nối Supabase</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-ink)', marginBottom: 8 }}>Lỗi kết nối</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{loadError}</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              height: 40, padding: '0 16px', borderRadius: 10, border: 0,
              background: 'var(--ink)', color: '#fff', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const detailHandlers = {
    onCycleStatus: cycleStatus,
    onOpenPhoto: (ph) => setSheet({ type: 'photo', photo: ph, nodeId: currentId, viewOnly: false }),
    onViewPhoto: (ph) => setSheet({ type: 'photo', photo: ph, nodeId: currentId, viewOnly: true }),
    onEditNote: () => setSheet({ type: 'note' }),
    onEditDeadline: () => setSheet({ type: 'deadline' }),
    onEditStartedAt: () => {
      const proj = projectNode || (currentNode?._source?.table === 'projects' ? currentNode : null);
      if (proj) setSheet({ type: 'startedAt', nodeId: proj.id });
    },
    onOpenAssignees: () => setSheet({ type: 'assignees' }),
    onAddChild: openAddChild,
    onAddFeature: openAddFeature,
    onPastePhotos: handlePastePhotos,
    onDeletePhoto: handleDeleteAnyPhoto,
    onOpenDocLink: docLinksSupported
      ? (doc) => {
          const targetId = doc?.sourceNodeId || currentId;
          setSheet({ type: 'docLink', doc: doc || null, nodeId: targetId });
        }
      : undefined,
    docLinksSupported,
    projectDocLinksSupported,
    onOpenWorkAction: (action) => setSheet({
      type: 'workAction',
      action: action || null,
      nodeId: currentId,
    }),
    onCompleteWorkAction: async (action) => {
      const node = findNode(currentId);
      if (!node || !action) return;
      const list = (node.workActions || []).map((a) => (
        a.id === action.id ? completeWorkAction(a) : a
      ));
      await persistWorkActionsForNode(node, list);
    },
    onCompleteNode: handleCompleteNode,
    ...fieldOpsHandlers,
  };

  const scheduleDefaultTab = tab === 'labor' ? 'labor' : 'schedule';

  // Decide which screen to render
  let screen;
  if (tab === 'attendance') {
    screen = <AttendanceEmbedView />;
  } else if (tab === 'schedule' || tab === 'labor') {
    screen = (
      <FieldOpsScreen
        products={isAdmin(accessRole) ? products : visibleProducts}
        people={PEOPLE}
        accessRole={accessRole}
        defaultTab={scheduleDefaultTab}
        onOpenNode={openChild}
      />
    );
  } else if (tab === 'products') {
    if (useSplitProducts) {
      screen = (
        <DesktopProductsSplit
          products={visibleProducts}
          stack={stack}
          currentNode={currentNode}
          parentNode={parentNode}
          projectNode={projectNode}
          subtaskSupported={subtaskSupported}
          currentUserId={currentUserId}
          depth={depth}
          t={t}
          openProduct={openProduct}
          openChild={openChild}
          back={back}
          openNodeActions={openNodeActions}
          {...detailHandlers}
        />
      );
    } else if (stack.length === 0) {
      screen = (
        <ProductsHome
          products={visibleProducts}
          onOpen={openProduct}
          onOpenActions={openNodeActions}
          onComplete={handleCompleteNode}
          onAddProduct={openAddProduct}
          currentUserId={currentUserId}
          canBulkDelete
          onDeleteSelected={handleDeleteProducts}
        />
      );
    } else if (!currentNode) {
      screen = (
        <div className="screen" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Không tìm thấy mục trong đường dẫn.</p>
            <button
              type="button"
              onClick={() => navigate(pathForTab('products', effectiveLayout))}
              style={{
                height: 40, padding: '0 16px', borderRadius: 10, border: 0,
                background: 'var(--ink)', color: '#fff', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Về /san-pham
            </button>
          </div>
        </div>
      );
    } else {
      screen = (
        <NodeDetail
          node={currentNode}
          depth={depth}
          parent={parentNode}
          projectNode={projectNode}
          subtaskSupported={subtaskSupported}
          t={t}
          onOpenChild={openChild}
          onBack={back}
          onOpenActions={openNodeActions}
          onChildActions={openNodeActions}
          {...detailHandlers}
        />
      );
    }
  } else if (tab === 'subtasks') {
    screen = (
      <SubtasksDashboard
        products={visibleProducts}
        onOpenNode={jumpToNode}
      />
    );
  } else if (tab === 'people') {
    if (personId) {
      screen = <PersonDetail
        personId={personId} products={visibleProducts}
        onBack={() => navigate(pathForTab('people', effectiveLayout))}
        onOpenNode={jumpToNode}
        onOpenActions={openNodeActions}
        onEditPerson={(person) => setSheet({ type: 'editPerson', personId: person.id })}
      />;
    } else {
      screen = <PeopleHome products={visibleProducts} onOpenPerson={(id) => navigate(buildPersonPath(id, effectiveLayout))}/>;
    }
  } else if (tab === 'me' && currentUserId) {
    screen = <PersonDetail
      personId={currentUserId}
      products={visibleProducts}
      variant="me"
      onBack={() => navigate(pathForTab('products', effectiveLayout))}
      onOpenNode={jumpToNode}
      onOpenActions={openNodeActions}
      onEditPerson={(person) => setSheet({ type: 'editPerson', personId: person.id })}
    />;
  }

  // Hide bottom nav while drilled into product detail tree
  const showBottomNav = !isDesktop && (
    (tab === 'products' && stack.length === 0)
    || (tab === 'subtasks')
    || (tab === 'schedule' || tab === 'labor' || tab === 'attendance')
    || (tab === 'people' && !personId)
    || (tab === 'me')
  );

  const view = (
    <div className={`app-viewport ${isDesktop ? 'app-viewport--desktop' : ''}`}>
      {screen}
      {showBottomNav && (
        <BottomNav
          tab={tab === 'labor' ? 'schedule' : tab}
          onChange={(id) => navigate(pathForTab(id, effectiveLayout))}
          alertCount={myStats.fail + myStats.overdue}
        />
      )}

      {sheet && sheet.type === 'photo' && sheetNode && (
        <PhotoSheet
          photo={sheet.photo}
          viewOnly={sheet.viewOnly}
          canEdit={sheetNode._source?.table === 'tasks'}
          onClose={() => setSheet(null)}
          onAddFiles={(files) => addPhotosFromFiles(sheetNode, files)}
          onUpdatePhoto={({ label, kind }) => {
            if (!sheet.photo) return;
            const next = sheetNode.photos.map((p) => (
              p.id === sheet.photo.id ? { ...p, label, kind } : p
            ));
            persistPhotosForNode(sheetNode, next);
          }}
          onDeletePhoto={() => {
            if (!sheet.photo) return;
            const next = sheetNode.photos.filter((p) => p.id !== sheet.photo.id);
            persistPhotosForNode(sheetNode, next);
          }}
        />
      )}
      {sheet && sheet.type === 'workAction' && sheetNode && (
        <WorkActionSheet
          action={sheet.action}
          onClose={() => setSheet(null)}
          canDelete={canDeleteWorkAction(accessRole, sheet.action, sheetNode, currentUserId)}
          onSave={async (entry) => {
            const list = [...(sheetNode.workActions || [])];
            const idx = list.findIndex((a) => a.id === entry.id);
            if (idx >= 0) list[idx] = entry;
            else list.push(entry);
            await persistWorkActionsForNode(sheetNode, list);
          }}
          onComplete={async (entry) => {
            const list = [...(sheetNode.workActions || [])];
            const idx = list.findIndex((a) => a.id === entry.id);
            if (idx >= 0) list[idx] = entry;
            else list.push(entry);
            await persistWorkActionsForNode(sheetNode, list);
          }}
          onDelete={sheet.action ? async () => {
            const next = (sheetNode.workActions || []).filter((a) => a.id !== sheet.action.id);
            await persistWorkActionsForNode(sheetNode, next);
          } : undefined}
        />
      )}
      {sheet && sheet.type === 'docLink' && sheetNode && (
        <DocLinkSheet
          doc={sheet.doc}
          onClose={() => setSheet(null)}
          onSave={async (entry) => {
            const list = [...(sheetNode.docLinks || [])];
            const idx = list.findIndex((d) => d.id === entry.id);
            if (idx >= 0) list[idx] = entry;
            else list.push(entry);
            await persistDocLinksForNode(sheetNode, list);
          }}
          onDelete={sheet.doc ? async () => {
            const next = (sheetNode.docLinks || []).filter((d) => d.id !== sheet.doc.id);
            await persistDocLinksForNode(sheetNode, next);
          } : undefined}
        />
      )}
      {sheet && sheet.type === 'note' && (
        <NoteSheet
          node={currentNode}
          onClose={() => setSheet(null)}
          onSave={(text) => updateNode(currentId, (n) => { n.note = text; }, { note: text })}
        />
      )}
      {sheet && sheet.type === 'deadline' && currentNode && (
        <DeadlineSheet
          node={currentNode}
          onClose={() => setSheet(null)}
          onSave={(date) => updateNode(currentId, (n) => { n.deadline = date; }, { deadline: date })}
        />
      )}
      {sheet && sheet.type === 'assignees' && (
        <AssigneeSheet
          node={currentNode}
          onClose={() => setSheet(null)}
          onSave={(ids) => updateNode(currentId, (n) => { n.assignees = ids; }, { assignees: ids })}
        />
      )}
      {sheet && sheet.type === 'addProduct' && (
        <AddProductSheet
          onClose={() => setSheet(null)}
          onSave={async ({ name, customerName, deadline }) => {
            const row = await createProduct({ name, customerName, deadline, ownerUserId: currentUserId });
            await reloadData();
            if (row?.project_id) {
              navigate(buildProductPath([row.project_id], effectiveLayout));
            }
          }}
        />
      )}
      {sheet && sheet.type === 'addChild' && (() => {
        const parentForAdd = sheet.parentId ? findNode(sheet.parentId) : addChildParentNode;
        if (!parentForAdd) return null;
        return (
          <AddChildSheet
            parentNode={parentForAdd}
            childLabel={addChildLabels(parentForAdd).child}
            onClose={() => setSheet(null)}
            onSave={async ({ name, startedAt, deadline, assignees }) => {
              const { table, row } = await createChildNode(parentForAdd, { name, startedAt, deadline, assignees });
              await reloadData();
              const newId = table === 'features' ? row.feature_id : row.task_id;
              navigate(productPathForNode(newId, pathIndex, effectiveLayout));
            }}
          />
        );
      })()}
      {sheet && sheet.type === 'actions' && sheetNode && (
        <NodeActionsSheet
          node={sheetNode}
          onClose={() => setSheet(null)}
          onView={() => {
            const ancestors = pathIndex.paths[sheetNode.id] || [];
            navigate(buildProductPath([...ancestors, sheetNode.id], effectiveLayout));
            setSheet(null);
          }}
          onAddDocLink={
            (sheetNode?._source?.table === 'features' && docLinksSupported)
            || (sheetNode?._source?.table === 'projects' && projectDocLinksSupported)
              ? () => setSheet({ type: 'docLink', doc: null, nodeId: sheetNode.id })
              : undefined
          }
          onEdit={() => setSheet({ type: 'edit', nodeId: sheetNode.id })}
          onDelete={() => setSheet({ type: 'delete', nodeId: sheetNode.id })}
          canDelete={canDeleteNode(accessRole)}
        />
      )}
      {sheet && sheet.type === 'startedAt' && sheetNode && (
        <ProjectStartedAtSheet
          project={sheetNode}
          onClose={() => setSheet(null)}
          onSave={async (iso) => {
            await saveProjectStartedAt(sheetNode, iso);
            await reloadData();
          }}
        />
      )}
      {sheet && sheet.type === 'siteLocation' && sheetNode && (
        <SiteLocationSheet
          project={sheetNode}
          onClose={() => setSheet(null)}
          onSave={async (site) => {
            await saveProjectSiteLocation(sheetNode, site);
            await reloadData();
          }}
        />
      )}
      {sheet && sheet.type === 'teamSchedule' && sheetNode && (
        <TeamScheduleSheet
          project={sheetNode}
          teams={teamsFromPeople(PEOPLE)}
          schedule={sheet.schedule}
          onClose={() => setSheet(null)}
          onSave={async (entry) => {
            const list = [...(sheetNode.teamSchedules || [])];
            const idx = list.findIndex((s) => s.id === entry.id);
            const row = { ...entry, id: entry.id || newTeamScheduleId() };
            if (idx >= 0) list[idx] = row;
            else list.push(row);
            await saveProjectTeamSchedules(sheetNode, list);
            await reloadData();
          }}
          onDelete={sheet.schedule ? async () => {
            const next = (sheetNode.teamSchedules || []).filter((s) => s.id !== sheet.schedule.id);
            await saveProjectTeamSchedules(sheetNode, next);
            await reloadData();
          } : undefined}
        />
      )}
      {sheet && sheet.type === 'edit' && sheetNode && (
        <EditNodeSheet
          node={sheetNode}
          onClose={() => setSheet(null)}
          onSave={async (payload) => {
            await saveNodeFull(sheetNode, payload);
            await reloadData();
          }}
        />
      )}
      {sheet && sheet.type === 'editPerson' && (() => {
        const person = PEOPLE.find((p) => p.id === sheet.personId);
        if (!person) return null;
        return (
          <EditPersonSheet
            person={person}
            onClose={() => setSheet(null)}
            showAccessRole={isAdmin(accessRole)}
            onSave={async (payload) => {
              await savePersonProfile(person.id, payload);
              if (payload.accessRole) {
                writeStoredAccessRole(person.id, payload.accessRole);
              }
              await reloadData();
            }}
          />
        );
      })()}
      {sheet && sheet.type === 'delete' && sheetNode && (
        <ConfirmDeleteSheet
          node={sheetNode}
          onClose={() => setSheet(null)}
          onConfirm={() => handleDeleteNode(sheetNode.id)}
        />
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <DesktopShell alertCount={myStats.fail + myStats.overdue}>
        {view}
      </DesktopShell>
    );
  }
  return view;
}

// Mount in iOS frame (mobile) hoặc full màn (desktop) + Tweaks panel
function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const { effectiveLayout, showIOSFrame, isNativeMobile, urlLayout } = useEffectiveLayout(location.pathname);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--bad', t.accent);
    const root = document.documentElement;
    root.classList.toggle('layout-desktop', effectiveLayout === 'desktop');
    root.classList.toggle('layout-mobile', effectiveLayout === 'mobile');
    root.classList.toggle('layout-native-mobile', isNativeMobile);
    root.classList.toggle('layout-preview-mobile', showIOSFrame);
    return () => {
      root.classList.remove('layout-desktop', 'layout-mobile', 'layout-native-mobile', 'layout-preview-mobile');
    };
  }, [t.accent, effectiveLayout, isNativeMobile, showIOSFrame]);

  const desktopHref = swapLayoutPath(location.pathname, 'desktop');
  const mobileHref = swapLayoutPath(location.pathname, 'mobile');
  const tweaks = (
      <TweaksPanel>
        <TweakSection label="Giao diện"/>
        <TweakColor label="Màu nhấn"
          value={t.accent}
          options={['#C8553D', '#D97757', '#3D6B8C', '#7B6BA0', '#4A8F6B', '#B07F3F']}
          onChange={(v) => setTweak('accent', v)}/>
        <TweakRadio label="Mật độ"
          value={t.density}
          options={['compact', 'comfy']}
          onChange={(v) => setTweak('density', v)}/>
        <TweakSection label="Hiển thị"/>
        <TweakToggle label="Thanh tiến độ" value={t.showProgressBar}
          onChange={(v) => setTweak('showProgressBar', v)}/>
        <TweakToggle label="Khối số liệu" value={t.showStats}
          onChange={(v) => setTweak('showStats', v)}/>
        <TweakSection label="Đường dẫn (URL)"/>
        <RouteLinks/>
        {effectiveLayout === 'mobile' && (
          <TweakButton
            label="Mở giao diện máy tính (full màn)"
            onClick={() => navigate(desktopHref)}
          />
        )}
        {effectiveLayout === 'desktop' && urlLayout === 'desktop' && (
          <TweakButton
            label="Mở giao diện điện thoại (khung preview)"
            onClick={() => navigate(mobileHref)}
          />
        )}
      </TweaksPanel>
  );

  const app = <App t={t}/>;

  if (effectiveLayout === 'desktop') {
    return (
      <>
        {app}
        {tweaks}
      </>
    );
  }

  if (showIOSFrame) {
    return (
      <>
        <IOSDevice width={402} height={874}>
          {app}
        </IOSDevice>
        {tweaks}
      </>
    );
  }

  return (
    <>
      {app}
      {tweaks}
    </>
  );
}

export { Root };
