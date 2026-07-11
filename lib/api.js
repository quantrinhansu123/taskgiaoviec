import { supabase } from './supabase.js';
import { inferAccessRoleFromTitle, normalizeAccessRole } from './permissions.js';
import { fromDbDeadline, toDbDeadline } from './deadline.js';
import { workActionsFromBlocks, workActionsToDb } from './workActions.js';
import { attendanceFromBlocks, attendanceToDb } from './attendance.js';
import {
  siteLocationFromBlocks,
  siteLocationToDb,
  teamSchedulesFromBlocks,
  teamSchedulesToDb,
  jobStartedAtFromBlocks,
  jobStartedAtToDb,
} from './siteLocation.js';
import {
  completionFromBlocks,
  completionFromProjectDocuments,
  completionToDb,
} from './nodeCompletion.js';

export { toDbDeadline } from './deadline.js';

const AVATAR_COLORS = ['#C8553D', '#3D6B8C', '#7B6BA0', '#4A8F6B', '#B07F3F', '#5A6E80', '#A04F6B', '#3D7A6B'];

const TASK_SELECT_FULL =
  'task_id,feature_id,parent_task_id,name,assigned_to,description,image_url,content_blocks,deadline,status';
const TASK_SELECT_LEGACY =
  'task_id,feature_id,name,assigned_to,description,image_url,content_blocks,deadline,status';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function mapDbStatus(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'done') return 'done';
  if (s === 'in_progress' || s === 'doing') return 'doing';
  if (s === 'failed' || s === 'fail' || s === 'blocked' || s === 'cancelled') return 'fail';
  return 'todo';
}

export function mapUiStatus(status) {
  if (status === 'done') return 'completed';
  if (status === 'doing') return 'in_progress';
  if (status === 'fail') return 'failed';
  return 'pending';
}

function collectAssignees(nodes) {
  const ids = new Set();
  function walk(node) {
    (node.assignees || []).forEach((id) => ids.add(id));
    (node.children || []).forEach(walk);
  }
  nodes.forEach(walk);
  return [...ids];
}

function featureAssigneesFromFeature(feature) {
  const blocks = feature?.content_blocks;
  const extras = blocks && typeof blocks === 'object' && Array.isArray(blocks.assignees)
    ? blocks.assignees
    : [];
  return [...new Set(extras.filter((id) => typeof id === 'string' && id.trim()))];
}

function normalizeDocLinkEntry(d, index = 0) {
  if (typeof d === 'string') {
    const url = d.trim();
    if (!url) return null;
    return { id: url, title: url, url, note: '', createdAt: null };
  }
  if (!d || typeof d !== 'object') return null;
  const url = String(
    d.url || d.link || d.href || d.document_url || d.file_url || d.drive_url || ''
  ).trim();
  const title = String(d.title || d.name || d.label || d.file_name || d.filename || '').trim();
  const id = String(d.id || d.document_id || '').trim()
    || (url ? `doc-${index}-${url.slice(0, 48)}` : '');
  const finalUrl = url || (title.startsWith('http') ? title : '');
  const finalTitle = title || finalUrl;
  if (!id || !finalTitle || !finalUrl) return null;
  return {
    id,
    title: finalTitle,
    url: finalUrl,
    note: String(d.note || d.description || d.desc || '').trim(),
    createdAt: d.created_at || d.createdAt || null,
  };
}

function docLinksFromList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((d, i) => normalizeDocLinkEntry(d, i)).filter(Boolean);
}

function docLinksFromContentBlocks(blocks) {
  const list = blocks && typeof blocks === 'object' && Array.isArray(blocks.doc_links)
    ? blocks.doc_links
    : [];
  return docLinksFromList(list);
}

function docLinksFromDocuments(raw) {
  if (raw == null) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) return docLinksFromList(parsed);
  if (parsed && typeof parsed === 'object') {
    const nested = parsed.doc_links || parsed.links || parsed.documents || parsed.items;
    if (Array.isArray(nested)) return docLinksFromList(nested);
  }
  return [];
}

function featureDocLinksFromFeature(feature) {
  return docLinksFromContentBlocks(feature?.content_blocks);
}

function projectDocLinksFromProject(project) {
  const fromDocuments = docLinksFromDocuments(project?.documents);
  if (fromDocuments.length) return fromDocuments;
  return docLinksFromContentBlocks(project?.content_blocks);
}

function projectCompletionFromProject(project) {
  const fromBlocks = completionFromBlocks(project?.content_blocks);
  if (fromBlocks?.completedAt) return fromBlocks;
  return completionFromProjectDocuments(project?.documents);
}

function applyCompletionToNode(node, completion, children) {
  if (completion?.completedAt) {
    node.completedAt = completion.completedAt;
    node.status = 'done';
    return;
  }
  node.completedAt = null;

  // Giữ status đã lưu thủ công (Đang làm / Có lỗi / Đạt).
  // Chỉ tự rollup từ con khi DB đang ở trạng thái Chờ (pending/todo).
  if (node.status === 'doing' || node.status === 'fail' || node.status === 'done') {
    return;
  }
  if (children?.length) {
    node.status = rollupStatus(children);
  }
}

function stripCompletionFromBlocks(blocks) {
  if (!blocks || typeof blocks !== 'object') return null;
  if (!blocks.completion) return null;
  const next = { ...blocks };
  delete next.completion;
  return Object.keys(next).length > 0 ? next : null;
}

async function clearNodeCompletion(node) {
  if (!node?._source) return;

  const { table, id } = node._source;

  if (table === 'tasks') {
    const existing = await fetchTaskContentBlocks(id);
    const nextBlocks = stripCompletionFromBlocks(existing);
    if (nextBlocks !== null || existing.completion) {
      const { error } = await supabase
        .from('tasks')
        .update({ content_blocks: nextBlocks })
        .eq('task_id', id);
      if (error) throw error;
    }
    return;
  }

  if (table === 'features') {
    if (!featuresContentBlocksAvailable) return;
    const existing = await fetchFeatureContentBlocks(id);
    const nextBlocks = stripCompletionFromBlocks(existing);
    if (nextBlocks !== null || existing.completion) {
      const { error } = await supabase
        .from('features')
        .update({ content_blocks: nextBlocks })
        .eq('feature_id', id);
      if (error) throw error;
    }
    return;
  }

  if (table === 'projects') {
    if (projectsContentBlocksAvailable) {
      const existing = await fetchProjectContentBlocks(id);
      const nextBlocks = stripCompletionFromBlocks(existing);
      if (nextBlocks !== null || existing.completion) {
        const { error } = await supabase
          .from('projects')
          .update({ content_blocks: nextBlocks })
          .eq('project_id', id);
        if (error) throw error;
      }
      return;
    }
    if (projectsDocumentsAvailable) {
      const documents = await fetchProjectDocumentsRaw(id);
      if (!documents || typeof documents !== 'object' || Array.isArray(documents) || !documents.completion) return;
      const nextDocuments = { ...documents };
      delete nextDocuments.completion;
      const { error } = await supabase
        .from('projects')
        .update({ documents: nextDocuments })
        .eq('project_id', id);
      if (error) throw error;
    }
  }
}

async function fetchProjectContentBlocks(projectId) {
  if (!projectsContentBlocksAvailable) {
    return {};
  }
  const { data, error } = await supabase
    .from('projects')
    .select('content_blocks')
    .eq('project_id', projectId)
    .single();
  if (error) throw error;
  const blocks = data?.content_blocks;
  return blocks && typeof blocks === 'object' ? { ...blocks } : {};
}

async function fetchProjectDocumentsRaw(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('documents')
    .eq('project_id', projectId)
    .single();
  if (error) throw error;
  return data?.documents;
}

function mergeCompletionIntoDocuments(documents, completion) {
  if (Array.isArray(documents)) {
    return { items: documents, completion };
  }
  if (documents && typeof documents === 'object') {
    return { ...documents, completion };
  }
  return { completion };
}

export async function completeNode(node) {
  if (!node?._source) throw new Error('Không xác định được mục cần hoàn thành');

  const { table, id } = node._source;
  const completion = completionToDb();

  if (table === 'tasks') {
    const existing = await fetchTaskContentBlocks(id);
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        content_blocks: { ...existing, completion },
      })
      .eq('task_id', id);
    if (error) throw error;
    return;
  }

  if (table === 'features') {
    if (!featuresContentBlocksAvailable) {
      throw new Error(migrationHintFeaturesContentBlocks({ message: 'features.content_blocks missing' }));
    }
    const existing = await fetchFeatureContentBlocks(id);
    const { error } = await supabase
      .from('features')
      .update({
        status: 'completed',
        content_blocks: { ...existing, completion },
      })
      .eq('feature_id', id);
    if (error) throw error;
    return;
  }

  if (table === 'projects') {
    if (projectsContentBlocksAvailable) {
      const existing = await fetchProjectContentBlocks(id);
      const { error } = await supabase
        .from('projects')
        .update({
          status: 'completed',
          content_blocks: { ...existing, completion },
        })
        .eq('project_id', id);
      if (error) throw error;
      return;
    }
    if (projectsDocumentsAvailable) {
      const documents = await fetchProjectDocumentsRaw(id);
      const nextDocuments = mergeCompletionIntoDocuments(documents, completion);
      const { error } = await supabase
        .from('projects')
        .update({ status: 'completed', documents: nextDocuments })
        .eq('project_id', id);
      if (error) throw error;
      return;
    }
    const { error } = await supabase
      .from('projects')
      .update({ status: 'completed' })
      .eq('project_id', id);
    if (error) throw error;
    return;
  }

  throw new Error('Không thể ghi nhận hoàn thành cho mục này');
}

async function fetchFeatureContentBlocks(featureId) {
  if (!featuresContentBlocksAvailable) {
    throw new Error(migrationHintFeaturesContentBlocks({ message: 'features.content_blocks missing' }));
  }
  const { data, error } = await supabase
    .from('features')
    .select('content_blocks')
    .eq('feature_id', featureId)
    .single();
  if (error) throw error;
  const blocks = data?.content_blocks;
  return blocks && typeof blocks === 'object' ? { ...blocks } : {};
}

async function saveDocLinksToContentBlocks(table, id, docLinks, fetchBlocks) {
  const existing = await fetchBlocks(id);
  const list = (docLinks || []).map((d) => ({
    id: d.id,
    title: d.title,
    url: d.url,
    note: d.note || null,
    created_at: d.createdAt || null,
  }));
  const nextBlocks = { ...existing, doc_links: list };
  const pk = table === 'features' ? 'feature_id' : 'project_id';
  const { error } = await supabase.from(table).update({ content_blocks: nextBlocks }).eq(pk, id);
  if (error) throw error;
}

export async function saveFeatureDocLinks(node, docLinks) {
  if (node?._source?.table !== 'features') {
    throw new Error('Chỉ hạng mục mới lưu link tài liệu');
  }
  if (!featuresContentBlocksAvailable) {
    throw new Error(migrationHintFeaturesContentBlocks({ message: 'features.content_blocks missing' }));
  }
  await saveDocLinksToContentBlocks('features', node._source.id, docLinks, fetchFeatureContentBlocks);
}

function docLinksToDocumentsPayload(docLinks) {
  return (docLinks || []).map((d) => ({
    id: d.id,
    title: d.title,
    url: d.url,
    note: d.note || null,
    created_at: d.createdAt || null,
  }));
}

export async function saveProjectDocLinks(node, docLinks) {
  if (node?._source?.table !== 'projects') {
    throw new Error('Chỉ dự án mới lưu link tài liệu cấp dự án');
  }
  if (!projectsDocumentsAvailable) {
    throw new Error(migrationHintProjectsDocuments({ message: 'projects.documents missing' }));
  }
  const list = docLinksToDocumentsPayload(docLinks);
  const existing = await fetchProjectDocumentsRaw(node._source.id);
  let nextDocuments = list;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const completion = existing.completion;
    nextDocuments = { ...existing, items: list, doc_links: list };
    if (completion) nextDocuments.completion = completion;
  }
  const { error } = await supabase
    .from('projects')
    .update({ documents: nextDocuments })
    .eq('project_id', node._source.id);
  if (error) throw error;
}

function countIssues(node) {
  let count = 0;
  function walk(n) {
    if (!n.children || n.children.length === 0) {
      if (n.status === 'fail') count++;
      return;
    }
    n.children.forEach(walk);
  }
  walk(node);
  return count;
}

function rollupStatus(children) {
  if (!children || children.length === 0) return 'todo';
  const statuses = children.map((c) => c.status);
  if (statuses.some((s) => s === 'fail')) return 'fail';
  if (statuses.every((s) => s === 'done')) return 'done';
  if (statuses.some((s) => s === 'doing')) return 'doing';
  if (statuses.some((s) => s === 'todo')) return 'todo';
  return 'doing';
}

function finalizeTaskNode(node) {
  if (node.children.length > 0) {
    node.children.forEach(finalizeTaskNode);
    if (!node.completedAt
      && node.status !== 'doing'
      && node.status !== 'fail'
      && node.status !== 'done') {
      node.status = rollupStatus(node.children);
    }
    node.issues = countIssues(node);
    const childAssignees = collectAssignees(node.children);
    const own = node.assignees || [];
    node.assignees = [...new Set([...own, ...childAssignees])];
  }
  return node;
}

function photosFromTask(task) {
  const seen = new Set();
  const photos = [];
  const push = (p) => {
    if (!p?.url || seen.has(p.id)) return;
    seen.add(p.id);
    photos.push({
      id: p.id,
      label: p.label || 'Ảnh đính kèm',
      tint: p.tint || '#E8D5C4',
      kind: p.kind || 'good',
      url: p.url,
    });
  };
  if (task.image_url) {
    push({
      id: `${task.task_id}-primary`,
      label: 'Ảnh đính kèm',
      url: task.image_url,
      kind: 'good',
      tint: '#E8D5C4',
    });
  }
  const blocks = task.content_blocks;
  const extra = blocks && typeof blocks === 'object' && Array.isArray(blocks.photos)
    ? blocks.photos
    : [];
  extra.forEach((p) => push(p));

  return photos;
}

function workActionsFromTask(task) {
  const blocks = task.content_blocks;
  return workActionsFromBlocks(blocks && typeof blocks === 'object' ? blocks : null);
}

function workActionsFromFeature(feature) {
  const blocks = feature.content_blocks;
  return workActionsFromBlocks(blocks && typeof blocks === 'object' ? blocks : null);
}

function taskAssigneesFromTask(task) {
  const assigned = [];
  if (task.assigned_to) assigned.push(task.assigned_to);
  const blocks = task.content_blocks;
  const extras = blocks && typeof blocks === 'object' && Array.isArray(blocks.assignees)
    ? blocks.assignees
    : [];
  extras.forEach((id) => {
    if (typeof id === 'string' && id.trim()) assigned.push(id);
  });
  return [...new Set(assigned)];
}

async function fetchTaskContentBlocks(taskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('content_blocks')
    .eq('task_id', taskId)
    .single();
  if (error) throw error;
  const blocks = data?.content_blocks;
  return blocks && typeof blocks === 'object' ? { ...blocks } : {};
}

function taskToNode(task) {
  const photos = photosFromTask(task);
  const workActions = workActionsFromTask(task);
  const assignees = taskAssigneesFromTask(task);
  const hasChildren = false;
  const completion = completionFromBlocks(task.content_blocks);
  const status = mapDbStatus(task.status);
  const blocks = task.content_blocks && typeof task.content_blocks === 'object' ? task.content_blocks : null;
  return {
    id: task.task_id,
    name: task.name,
    deadline: fromDbDeadline(task.deadline),
    startedAt: jobStartedAtFromBlocks(blocks),
    status,
    completedAt: status === 'done' ? (completion?.completedAt || null) : null,
    assignees,
    note: task.description || '',
    photos,
    workActions,
    goodsPercent: goodsPercentFromBlocks(blocks),
    children: [],
    issues: hasChildren ? 0 : (status === 'fail' ? 1 : 0),
    _source: {
      table: 'tasks',
      id: task.task_id,
      featureId: task.feature_id,
      parentTaskId: task.parent_task_id || null,
    },
  };
}

/** Cây task trong một hạng mục (bỏ Việc chung; gốc = parent_task_id null). */
function buildTaskForest(featureTasks) {
  const visible = featureTasks.filter((t) => !isLeadTaskRow(t));
  const nodes = new Map();
  for (const t of visible) {
    nodes.set(t.task_id, taskToNode(t));
  }

  const roots = [];
  for (const t of visible) {
    const node = nodes.get(t.task_id);
    const pid = t.parent_task_id;
    if (pid && nodes.has(pid)) {
      nodes.get(pid).children.push(node);
    } else if (!pid) {
      roots.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots.map(finalizeTaskNode);
}

export const FEATURE_LEAD_TASK_NAME = 'Việc chung';

function isLeadTaskRow(task) {
  return task?.name === FEATURE_LEAD_TASK_NAME;
}

function featureToNode(feature, tasks) {
  const featureTasks = tasks.filter((t) => t.feature_id === feature.feature_id);
  const lead = featureTasks.find(isLeadTaskRow);
  const children = buildTaskForest(featureTasks);
  const blocks = feature.content_blocks && typeof feature.content_blocks === 'object' ? feature.content_blocks : null;

  const assignees = [...new Set([
    ...featureAssigneesFromFeature(feature),
    ...collectAssignees(children),
  ])];
  if (lead?.assigned_to && !assignees.includes(lead.assigned_to)) {
    assignees.unshift(lead.assigned_to);
  }

  const node = {
    id: feature.feature_id,
    name: feature.name,
    deadline: fromDbDeadline(feature.deadline),
    startedAt: jobStartedAtFromBlocks(blocks),
    status: mapDbStatus(feature.status),
    completedAt: null,
    assignees,
    note: feature.description || '',
    photos: [],
    workActions: workActionsFromFeature(feature),
    docLinks: featureDocLinksFromFeature(feature),
    children,
    issues: countIssues({ children }),
    _source: { table: 'features', id: feature.feature_id },
  };

  applyCompletionToNode(node, completionFromBlocks(blocks), children);
  return node;
}

function projectFieldBlocks(project) {
  const blocks = project?.content_blocks;
  return blocks && typeof blocks === 'object' ? blocks : {};
}

function goodsPercentFromBlocks(blocks) {
  const raw = blocks?.goods_percent ?? blocks?.goodsPercent ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function projectToNode(project, features, tasks) {
  const projectFeatures = features.filter((f) => f.project_id === project.project_id);
  const children = projectFeatures.map((f) => featureToNode(f, tasks));
  const blocks = projectFieldBlocks(project);

  const projectAssignees = Array.isArray(project.assignees)
    ? project.assignees.filter((id) => typeof id === 'string' && id.trim())
    : [];
  const childAssignees = collectAssignees(children);
  const assignees = [...new Set([...projectAssignees, ...childAssignees])];

  const node = {
    id: project.project_id,
    name: project.name,
    customerId: project.customer_id || null,
    customerName: project.customers?.name || null,
    deadline: fromDbDeadline(project.deadline),
    status: mapDbStatus(project.status),
    completedAt: null,
    createdAt: project.created_at || null,
    assignees,
    note: project.description || '',
    photos: [],
    docLinks: projectDocLinksFromProject(project),
    workActions: workActionsFromBlocks(blocks),
    siteLocation: siteLocationFromBlocks(blocks),
    attendanceSessions: attendanceFromBlocks(blocks),
    teamSchedules: teamSchedulesFromBlocks(blocks),
    startedAt: jobStartedAtFromBlocks(blocks),
    goodsPercent: goodsPercentFromBlocks(blocks),
    children,
    issues: countIssues({ children }),
    _source: { table: 'projects', id: project.project_id },
  };

  applyCompletionToNode(node, projectCompletionFromProject(project), children);
  return node;
}

function mapUsers(users) {
  return users.map((u, i) => ({
    id: u.user_id,
    name: u.full_name || u.email || 'Nhân sự',
    email: u.email || null,
    initials: initials(u.full_name || u.email),
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    role: u.role || 'Nhân viên',
    dept: u.department || 'Chung',
    phone: u.phone || '',
    status: u.status === 'active' ? 'online' : 'off',
    accessRole: normalizeAccessRole(u.access_role) || null,
  }));
}

export async function getLoggedInPersonId(people = []) {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('[Supabase] Khong lay duoc user dang nhap:', error.message);
    return null;
  }

  const authUser = data?.user;
  if (!authUser) return null;

  const byId = people.find((p) => p.id === authUser.id);
  if (byId) return byId.id;

  const email = authUser.email?.toLowerCase();
  if (!email) return null;

  return people.find((p) => p.email?.toLowerCase() === email)?.id || null;
}

async function purgeLeadTasks() {
  const { error } = await supabase.from('tasks').delete().eq('name', FEATURE_LEAD_TASK_NAME);
  if (error) console.warn('[Supabase] purge Việc chung:', error.message);
}

const SCHEMA_COLUMN_CACHE_KEY = 'taskApp.schemaColumns.v2';

function readSchemaColumnCache() {
  try {
    const raw = sessionStorage.getItem(SCHEMA_COLUMN_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeSchemaColumnCache(table, column, available) {
  try {
    const cache = readSchemaColumnCache();
    cache[`${table}.${column}`] = available;
    sessionStorage.setItem(SCHEMA_COLUMN_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

/**
 * Kiểm tra cột có trên Supabase hay không mà không gọi select(cột) khi đã có dòng dữ liệu
 * (tránh 400 trên Network tab). Bảng rỗng: probe một lần rồi cache trong session.
 */
async function detectTableColumn(table, column) {
  const cacheKey = `${table}.${column}`;
  const cached = readSchemaColumnCache();
  if (cacheKey in cached) return cached[cacheKey];

  const { data, error } = await supabase.from(table).select('*').limit(1);
  let available = false;

  if (error) {
    available = false;
  } else if ((data || []).length > 0) {
    available = Object.prototype.hasOwnProperty.call(data[0], column);
  } else {
    const probe = await supabase.from(table).select(column).limit(1);
    available = !probe.error;
  }

  writeSchemaColumnCache(table, column, available);
  return available;
}

let subtaskColumnAvailable = true;

async function detectSubtaskColumn() {
  subtaskColumnAvailable = await detectTableColumn('tasks', 'parent_task_id');
  return subtaskColumnAvailable;
}

let featuresContentBlocksAvailable = true;
let projectsDocumentsAvailable = true;
let projectsContentBlocksAvailable = false;
let projectsAssigneesAvailable = false;
let accessRoleColumnAvailable = false;
let userPhoneColumnAvailable = false;
let userPasswordColumnAvailable = false;

async function detectProjectsContentBlocksColumn() {
  projectsContentBlocksAvailable = await detectTableColumn('projects', 'content_blocks');
  return projectsContentBlocksAvailable;
}

async function detectProjectsAssigneesColumn() {
  projectsAssigneesAvailable = await detectTableColumn('projects', 'assignees');
  return projectsAssigneesAvailable;
}

async function detectAccessRoleColumn() {
  accessRoleColumnAvailable = await detectTableColumn('users', 'access_role');
  return accessRoleColumnAvailable;
}

async function detectUserProfileColumns() {
  userPhoneColumnAvailable = await detectTableColumn('users', 'phone');
  userPasswordColumnAvailable = await detectTableColumn('users', 'password');
}

async function detectFeaturesContentBlocksColumn() {
  featuresContentBlocksAvailable = await detectTableColumn('features', 'content_blocks');
  return featuresContentBlocksAvailable;
}

async function detectProjectsDocumentsColumn() {
  projectsDocumentsAvailable = await detectTableColumn('projects', 'documents');
  return projectsDocumentsAvailable;
}

function migrationHintFeaturesContentBlocks(err) {
  if (err?.message?.toLowerCase?.().includes('content_blocks') && err?.message?.toLowerCase?.().includes('features')) {
    return 'Thiếu cột `features.content_blocks`. Hãy chạy file `supabase/migrations/20260527000000_add_feature_content_blocks.sql` rồi tải lại trang.';
  }
  return err?.message || 'Không lưu được';
}

function migrationHintProjectsDocuments(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('documents') && msg.includes('projects')) {
    return 'Thiếu cột `projects.documents` trên Supabase. Kiểm tra schema bảng projects rồi tải lại trang.';
  }
  if (msg.includes('assignees') && msg.includes('projects')) {
    return 'Thiếu cột `projects.assignees` trên Supabase. Hãy chạy migration thêm cột assignees rồi tải lại trang.';
  }
  return err?.message || 'Không lưu được';
}

function taskSelectColumns() {
  return subtaskColumnAvailable ? TASK_SELECT_FULL : TASK_SELECT_LEGACY;
}

export function isSubtaskSupported() {
  return subtaskColumnAvailable;
}

function userSelectColumns() {
  const base = 'user_id,full_name,email,role,department,status,avatar_url';
  return [
    base,
    accessRoleColumnAvailable ? 'access_role' : '',
    userPhoneColumnAvailable ? 'phone' : '',
  ].filter(Boolean).join(',');
}

function normalizeLoginPhone(value = '') {
  return String(value).trim().replace(/\s+/g, '');
}

export async function authenticatePersonLogin({ phone, password }) {
  const loginPhone = normalizeLoginPhone(phone);
  const loginPassword = String(password || '').trim();
  if (!loginPhone) throw new Error('Vui lòng nhập SĐT');
  if (!loginPassword) throw new Error('Vui lòng nhập password');

  await detectAccessRoleColumn();
  await detectUserProfileColumns();
  if (!userPhoneColumnAvailable || !userPasswordColumnAvailable) {
    throw new Error('Thiếu cột phone/password trong bảng users. Hãy chạy migration thêm SĐT và password.');
  }

  const selectColumns = [
    'user_id',
    'full_name',
    'phone',
    'password',
    'role',
    'status',
    accessRoleColumnAvailable ? 'access_role' : '',
  ].filter(Boolean).join(',');

  const { data, error } = await supabase
    .from('users')
    .select(selectColumns)
    .eq('phone', loginPhone)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || String(data.password || '').trim() !== loginPassword) {
    throw new Error('SĐT hoặc password không đúng');
  }
  if (data.status && data.status !== 'active') {
    throw new Error('Tài khoản này đang bị tắt');
  }

  return {
    userId: data.user_id,
    name: data.full_name || '',
    accessRole: normalizeAccessRole(data.access_role)
      || inferAccessRoleFromTitle(data.role || '')
      || null,
  };
}

export async function fetchAppData() {
  await purgeLeadTasks();
  await detectSubtaskColumn();
  await detectFeaturesContentBlocksColumn();
  await detectProjectsDocumentsColumn();
  await detectProjectsContentBlocksColumn();
  await detectProjectsAssigneesColumn();
  await detectAccessRoleColumn();
  await detectUserProfileColumns();

  const [projectsRes, featuresRes, tasksRes, usersRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*, customers(name)')
      .order('created_at', { ascending: false }),
    supabase.from('features').select('*').order('created_at', { ascending: true }),
    supabase.from('tasks').select(taskSelectColumns()).order('created_at', { ascending: true }),
    supabase.from('users').select(userSelectColumns()).order('full_name', { ascending: true }),
  ]);

  const errors = [projectsRes.error, featuresRes.error, tasksRes.error, usersRes.error].filter(Boolean);
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join(' · '));
  }

  const projects = (projectsRes.data || []).map((p) =>
    projectToNode(p, featuresRes.data || [], tasksRes.data || [])
  );
  const people = mapUsers(usersRes.data || []);

  return {
    products: projects,
    people,
    subtaskSupported: subtaskColumnAvailable,
    docLinksSupported: featuresContentBlocksAvailable,
    projectDocLinksSupported: projectsDocumentsAvailable,
    projectFieldSettingsSupported: projectsContentBlocksAvailable,
    accessRoleSupported: accessRoleColumnAvailable,
  };
}

async function fetchProjectFieldBlocks(projectId) {
  if (!projectsContentBlocksAvailable) {
    throw new Error('Thiếu cột `projects.content_blocks`. Chạy migration `20260527000002_add_project_content_blocks.sql`.');
  }
  const { data, error } = await supabase
    .from('projects')
    .select('content_blocks')
    .eq('project_id', projectId)
    .single();
  if (error) throw error;
  const blocks = data?.content_blocks;
  return blocks && typeof blocks === 'object' ? { ...blocks } : {};
}

async function saveProjectFieldBlocks(projectId, mutator) {
  const existing = await fetchProjectFieldBlocks(projectId);
  const next = mutator({ ...existing });
  const { error } = await supabase
    .from('projects')
    .update({ content_blocks: Object.keys(next).length ? next : null })
    .eq('project_id', projectId);
  if (error) throw error;
}

export async function saveProjectSiteLocation(node, siteLocation) {
  if (node?._source?.table !== 'projects') {
    throw new Error('Chỉ công trình (Job) mới cài đặt vị trí GPS');
  }
  await saveProjectFieldBlocks(node._source.id, (blocks) => {
    const next = { ...blocks };
    if (siteLocation) next.site_location = siteLocationToDb(siteLocation);
    else delete next.site_location;
    return next;
  });
}

export async function saveProjectAttendance(node, sessions) {
  if (node?._source?.table !== 'projects') {
    throw new Error('Chỉ công trình mới lưu chấm công');
  }
  await saveProjectFieldBlocks(node._source.id, (blocks) => ({
    ...blocks,
    attendance_sessions: attendanceToDb(sessions),
  }));
}

export async function saveProjectTeamSchedules(node, schedules) {
  if (node?._source?.table !== 'projects') {
    throw new Error('Chỉ công trình mới lưu lịch đội');
  }
  await saveProjectFieldBlocks(node._source.id, (blocks) => ({
    ...blocks,
    team_schedules: teamSchedulesToDb(schedules),
  }));
}

export async function saveProjectStartedAt(node, startedAt) {
  if (node?._source?.table !== 'projects') {
    throw new Error('Chỉ công trình mới lưu ngày giờ bắt đầu');
  }
  await saveProjectFieldBlocks(node._source.id, (blocks) => {
    const next = { ...blocks };
    const val = jobStartedAtToDb(startedAt);
    if (val) next.job_started_at = val;
    else delete next.job_started_at;
    return next;
  });
}

export async function saveProjectGoodsPercent(node, percent) {
  if (node?._source?.table !== 'projects') {
    throw new Error('Chỉ dự án mới lưu tỉ lệ hoàn thành');
  }
  const n = percent === null || percent === undefined || percent === '' ? null : Number(percent);
  if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) {
    throw new Error('Tỉ lệ hoàn thành phải từ 0 đến 100');
  }
  await saveProjectFieldBlocks(node._source.id, (blocks) => {
    const next = { ...blocks };
    if (n === null) delete next.goods_percent;
    else next.goods_percent = Math.round(n);
    return next;
  });
}

export async function saveTaskGoodsPercent(node, percent) {
  if (node?._source?.table !== 'tasks') {
    throw new Error('Chỉ công việc hoặc sub-task mới lưu tỉ lệ hoàn thành riêng');
  }
  const n = percent === null || percent === undefined || percent === '' ? null : Number(percent);
  if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) {
    throw new Error('Tỉ lệ hoàn thành phải từ 0 đến 100');
  }
  const existing = await fetchTaskContentBlocks(node._source.id);
  const nextBlocks = { ...existing };
  if (n === null) delete nextBlocks.goods_percent;
  else nextBlocks.goods_percent = Math.round(n);
  const { error } = await supabase
    .from('tasks')
    .update({ content_blocks: Object.keys(nextBlocks).length ? nextBlocks : null })
    .eq('task_id', node._source.id);
  if (error) throw error;
}

export function isProjectFieldSettingsSupported() {
  return projectsContentBlocksAvailable;
}

export function canAddChildren(node) {
  const table = node?._source?.table;
  if (table === 'projects' || table === 'features') return true;
  if (table === 'tasks') return subtaskColumnAvailable;
  return false;
}

export function resolveListParent(node, parent) {
  if (!node) return parent;
  if (node._source?.table !== 'tasks') return node;
  if (parent?._source?.table === 'tasks') return parent;
  return node;
}

export function resolveAddChildParent(node, parent) {
  if (parent?._source?.table === 'tasks' && node?._source?.table === 'tasks') {
    return parent;
  }
  if (node && canAddChildren(node)) return node;
  if (parent && canAddChildren(parent)) return parent;
  return null;
}

export function resolveProjectFromStack(stackIds, findNode) {
  if (!stackIds?.length || typeof findNode !== 'function') return null;
  const root = findNode(stackIds[0]);
  return root?._source?.table === 'projects' ? root : null;
}

export function addChildLabels(node) {
  const table = node?._source?.table;
  if (table === 'projects') return { child: 'hạng mục', section: 'Hạng mục' };
  if (table === 'features') return { child: 'công việc', section: 'Công việc' };
  if (table === 'tasks') return { child: 'sub-task', section: 'Sub-task' };
  return { child: 'mục con', section: 'Mục con' };
}

async function resolveOwnerUserId(ownerUserId) {
  if (ownerUserId) return ownerUserId;

  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('status', 'active')
    .order('full_name', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.user_id) return data.user_id;

  const fallback = await supabase
    .from('users')
    .select('user_id')
    .limit(1)
    .maybeSingle();
  if (fallback.error) throw fallback.error;
  if (fallback.data?.user_id) return fallback.data.user_id;

  throw new Error('Không tìm thấy user để gán khách hàng');
}

async function resolveCustomerId(customerName, ownerUserId) {
  const name = (customerName || '').trim();
  if (!name) return null;

  const { data: existing, error: findError } = await supabase
    .from('customers')
    .select('customer_id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.customer_id) return existing.customer_id;

  const resolvedOwnerUserId = await resolveOwnerUserId(ownerUserId);
  const payload = {
    name,
    user_id: resolvedOwnerUserId,
  };
  const { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('customer_id')
    .single();
  if (error) throw error;
  return data?.customer_id || null;
}

export async function createProduct({ name, customerName, deadline, ownerUserId, siteLocation }) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Vui lòng nhập tên dự án');

  const customerId = await resolveCustomerId(customerName, ownerUserId);
  const deadlineDb = toDbDeadline(deadline);
  const siteLocationDb = siteLocation ? siteLocationToDb(siteLocation) : null;
  if (siteLocationDb && !projectsContentBlocksAvailable) {
    throw new Error('Thiếu cột `projects.content_blocks`. Chạy migration `20260527000002_add_project_content_blocks.sql` để lưu vị trí GPS.');
  }
  const payload = {
    name: trimmed,
    status: 'pending',
    ...(customerId ? { customer_id: customerId } : {}),
    ...(deadlineDb ? { deadline: deadlineDb } : {}),
    ...(siteLocationDb ? { content_blocks: { site_location: siteLocationDb } } : {}),
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select('project_id')
    .single();

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    // Handle DBs that require customer_id NOT NULL by creating a fallback customer
    if (msg.includes('customer_id') || (error.code && String(error.code) === '23502')) {
      const fallbackName = 'Khách hàng chưa xác định';
      const fallbackId = await resolveCustomerId(fallbackName, ownerUserId);
      const payload2 = { ...payload, ...(fallbackId ? { customer_id: fallbackId } : {}) };
      const { data: data2, error: error2 } = await supabase
        .from('projects')
        .insert(payload2)
        .select('project_id')
        .single();
      if (error2) throw error2;
      return data2;
    }
    throw error;
  }

  return data;
}

function pkFor(table) {
  if (table === 'projects') return 'project_id';
  if (table === 'features') return 'feature_id';
  return 'task_id';
}

function migrationHint(err) {
  if (err?.message?.includes('parent_task_id')) {
    return 'Chạy migration Supabase: supabase/migrations/20250525000000_add_parent_task_id.sql';
  }
  return err?.message || 'Không lưu được';
}

async function syncFeatureAssigneesToTasks(featureId, assignees) {
  const assigneeId = assignees?.[0] || null;
  let q = supabase
    .from('tasks')
    .update({ assigned_to: assigneeId })
    .eq('feature_id', featureId)
    .neq('name', FEATURE_LEAD_TASK_NAME);
  if (subtaskColumnAvailable) {
    q = q.is('parent_task_id', null);
  }
  const { error } = await q;
  if (error) throw error;
}

export async function createChildNode(parentNode, { name, startedAt, deadline, assignees }) {
  if (!parentNode?._source) throw new Error('Không xác định được mục cha');

  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Vui lòng nhập tên');

  const { table, id } = parentNode._source;
  const startedAtDb = jobStartedAtToDb(startedAt);
  const deadlineDb = toDbDeadline(deadline);
  const assigneeList = [...new Set((assignees || []).filter(Boolean))];
  const assigneeId = assigneeList[0] || null;
  const assigneeBlocks = assigneeList.length > 1 ? { assignees: assigneeList } : null;
  const startedAtBlocks = startedAtDb ? { job_started_at: startedAtDb } : {};

  if (table === 'projects') {
    const { data, error } = await supabase
      .from('features')
      .insert({
        project_id: id,
        name: trimmed,
        status: 'pending',
        ...(deadlineDb ? { deadline: deadlineDb } : {}),
        ...((assigneeList.length || startedAtDb) ? { content_blocks: { ...startedAtBlocks, ...(assigneeList.length ? { assignees: assigneeList } : {}) } } : {}),
      })
      .select()
      .single();
    if (error) throw error;
    return { table: 'features', row: data };
  }

  if (table === 'features') {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        feature_id: id,
        name: trimmed,
        status: 'pending',
        ...(deadlineDb ? { deadline: deadlineDb } : {}),
        ...(assigneeId ? { assigned_to: assigneeId } : {}),
        ...((assigneeBlocks || startedAtDb) ? { content_blocks: { ...startedAtBlocks, ...(assigneeBlocks || {}) } } : {}),
      })
      .select()
      .single();
    if (error) throw error;
    return { table: 'tasks', row: data };
  }

  if (table === 'tasks') {
    if (!subtaskColumnAvailable) {
      throw new Error(migrationHint({ message: 'parent_task_id' }));
    }
    const featureId = parentNode._source.featureId;
    if (!featureId) throw new Error('Không xác định được hạng mục');

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        feature_id: featureId,
        parent_task_id: id,
        name: trimmed,
        status: 'pending',
        ...(deadlineDb ? { deadline: deadlineDb } : {}),
        ...(assigneeId ? { assigned_to: assigneeId } : {}),
        ...((assigneeBlocks || startedAtDb) ? { content_blocks: { ...startedAtBlocks, ...(assigneeBlocks || {}) } } : {}),
      })
      .select()
      .single();
    if (error) throw new Error(migrationHint(error));
    return { table: 'tasks', row: data };
  }

  throw new Error('Không thể thêm mục con ở cấp này');
}

export async function saveTaskPhotos(node, photos) {
  if (node?._source?.table !== 'tasks') {
    throw new Error('Chỉ công việc và sub-task mới lưu ảnh đính kèm');
  }
  const id = node._source.id;
  const list = (photos || []).map(({ id: pid, label, url, kind, tint }) => ({
    id: pid,
    label: label || 'Ảnh đính kèm',
    url,
    kind: kind || 'good',
    tint: tint || '#E8D5C4',
  }));
  const existing = await fetchTaskContentBlocks(id);
  const nextBlocks = { ...existing };
  if (list.length > 0) nextBlocks.photos = list;
  else delete nextBlocks.photos;
  const hasBlocks = Object.keys(nextBlocks).length > 0;
  const payload = {
    image_url: list[0]?.url || null,
    content_blocks: hasBlocks ? nextBlocks : null,
  };
  const { error } = await supabase.from('tasks').update(payload).eq('task_id', id);
  if (error) throw error;
}

export async function saveTaskWorkActions(node, actions) {
  if (node?._source?.table !== 'tasks') {
    throw new Error('Chỉ công việc và sub-task mới lưu hành động');
  }
  const id = node._source.id;
  const existing = await fetchTaskContentBlocks(id);
  const list = workActionsToDb(actions);
  const nextBlocks = { ...existing, work_actions: list };
  const { error } = await supabase
    .from('tasks')
    .update({ content_blocks: nextBlocks })
    .eq('task_id', id);
  if (error) throw error;
}

export async function saveNodeWorkActions(node, actions) {
  if (node?._source?.table === 'tasks') {
    return saveTaskWorkActions(node, actions);
  }
  if (node?._source?.table === 'projects') {
    if (!projectsContentBlocksAvailable) {
      throw new Error('Thiếu cột `projects.content_blocks`. Chạy migration tương ứng rồi tải lại trang.');
    }
    const id = node._source.id;
    const existing = await fetchProjectContentBlocks(id);
    const list = workActionsToDb(actions);
    const nextBlocks = { ...existing, work_actions: list };
    const { error } = await supabase
      .from('projects')
      .update({ content_blocks: nextBlocks })
      .eq('project_id', id);
    if (error) throw error;
    return;
  }
  if (node?._source?.table !== 'features') {
    throw new Error('Chỉ hạng mục, công việc và sub-task mới lưu hành động');
  }
  if (!featuresContentBlocksAvailable) {
    throw new Error(migrationHintFeaturesContentBlocks({ message: 'features.content_blocks missing' }));
  }
  const id = node._source.id;
  const existing = await fetchFeatureContentBlocks(id);
  const list = workActionsToDb(actions);
  const nextBlocks = { ...existing, work_actions: list };
  const { error } = await supabase
    .from('features')
    .update({ content_blocks: nextBlocks })
    .eq('feature_id', id);
  if (error) throw error;
}

export async function saveNodePatch(node, patch, people = []) {
  if (!node?._source) return;

  const { table, id } = node._source;
  const payload = {};
  
  const peopleMap = new Map(people.map((p) => [p.id, p.name]));

  if ('name' in patch) {
    const trimmed = (patch.name || '').trim();
    if (!trimmed) throw new Error('Vui lòng nhập tên');
    payload.name = trimmed;
  }
  if ('status' in patch) {
    payload.status = mapUiStatus(patch.status);
    if (patch.status !== 'done') {
      await clearNodeCompletion(node);
    }
  }
  if ('note' in patch) payload.description = patch.note;
  if ('deadline' in patch) payload.deadline = toDbDeadline(patch.deadline);
  if ('assignees' in patch && table === 'tasks') {
    const assigneeList = [...new Set((patch.assignees || []).filter(Boolean))];
    payload.assigned_to = assigneeList[0] || null;
    const existing = await fetchTaskContentBlocks(id);
    const nextBlocks = { ...existing };
    if (assigneeList.length > 1) nextBlocks.assignees = assigneeList;
    else delete nextBlocks.assignees;
    payload.content_blocks = Object.keys(nextBlocks).length > 0 ? nextBlocks : null;
  }

  if ('assignees' in patch && table === 'features') {
    const assigneeList = [...new Set((patch.assignees || []).filter(Boolean))];
    const existing = await fetchFeatureContentBlocks(id);
    const nextBlocks = { ...existing };
    if (assigneeList.length) nextBlocks.assignees = assigneeList;
    else delete nextBlocks.assignees;
    payload.content_blocks = Object.keys(nextBlocks).length ? nextBlocks : null;
    await syncFeatureAssigneesToTasks(id, assigneeList);
  }

  if ('assignees' in patch && table === 'projects') {
    const assigneeIds = [...new Set((patch.assignees || []).filter(Boolean))];
    const assigneeNames = assigneeIds.map((id) => peopleMap.get(id) || id).filter(Boolean);
    payload.assignees = assigneeNames.length ? assigneeNames : null;
  }

  if (Object.keys(payload).length === 0) return;

  const pk = pkFor(table);
  const { error } = await supabase.from(table).update(payload).eq(pk, id);
  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('status_check')) {
      throw new Error(
        `${msg} — chạy migration supabase/migrations/20260711000000_expand_status_check_failed.sql trên Supabase (cho phép status failed).`,
      );
    }
    throw error;
  }
}

export async function saveNodeFull(node, { name, status, deadline, assignees }) {
  if (!node?._source) throw new Error('Không xác định được mục');

  const { table, id } = node._source;

  await saveNodePatch(node, {
    ...(name !== undefined ? { name } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(deadline !== undefined ? { deadline } : {}),
    ...(table === 'tasks' && assignees !== undefined ? { assignees } : {}),
  });

  if (table === 'features' && assignees !== undefined) {
    await syncFeatureAssigneesToTasks(id, assignees);
  }
}

export async function savePersonProfile(personId, { name, email, role, dept, phone, password, status, accessRole }) {
  if (!personId) throw new Error('Không xác định được nhân sự');
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Vui lòng nhập tên nhân sự');

  const payload = {
    full_name: trimmedName,
    email: (email || '').trim() || null,
    role: (role || '').trim() || null,
    department: (dept || '').trim() || null,
  };

  if (userPhoneColumnAvailable) {
    payload.phone = normalizeLoginPhone(phone) || null;
  }

  if (userPasswordColumnAvailable && password?.trim()) {
    payload.password = password.trim();
  }

  if (status) {
    payload.status = status === 'online' ? 'active' : 'inactive';
  }

  if (accessRole && accessRoleColumnAvailable) {
    payload.access_role = accessRole;
  }

  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('user_id', personId);
  if (error) throw error;
}

function newPersonId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createPersonProfile({ name, email, role, dept, phone, password, status, accessRole }) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Vui lòng nhập tên nhân sự');

  const payload = {
    user_id: newPersonId(),
    full_name: trimmedName,
    email: (email || '').trim() || null,
    role: (role || '').trim() || null,
    department: (dept || '').trim() || null,
    status: status === 'off' ? 'inactive' : 'active',
  };

  if (userPhoneColumnAvailable) {
    payload.phone = normalizeLoginPhone(phone) || null;
  }

  if (userPasswordColumnAvailable) {
    payload.password = (password || '').trim() || null;
  }

  if (accessRole && accessRoleColumnAvailable) {
    payload.access_role = accessRole;
  }

  const { data, error } = await supabase
    .from('users')
    .insert(payload)
    .select('user_id')
    .single();
  if (error) throw error;
  return data;
}

function removePersonFromBlocks(blocks, personId) {
  if (!blocks || typeof blocks !== 'object') return blocks;
  if (!Array.isArray(blocks.assignees) || !blocks.assignees.includes(personId)) return blocks;
  const next = { ...blocks, assignees: blocks.assignees.filter((id) => id !== personId) };
  if (next.assignees.length === 0) delete next.assignees;
  return next;
}

export async function deletePersonProfile(personId) {
  if (!personId) throw new Error('Không xác định được nhân sự cần xóa');

  const { data: tasks, error: tasksReadError } = await supabase
    .from('tasks')
    .select('task_id,assigned_to,content_blocks');
  if (tasksReadError) throw tasksReadError;

  await Promise.all((tasks || []).map((task) => {
    const payload = {};
    if (task.assigned_to === personId) payload.assigned_to = null;
    const nextBlocks = removePersonFromBlocks(task.content_blocks, personId);
    if (nextBlocks !== task.content_blocks) {
      payload.content_blocks = Object.keys(nextBlocks || {}).length ? nextBlocks : null;
    }
    if (Object.keys(payload).length === 0) return Promise.resolve();
    return supabase.from('tasks').update(payload).eq('task_id', task.task_id).then(({ error }) => {
      if (error) throw error;
    });
  }));

  if (featuresContentBlocksAvailable) {
    const { data: features, error: featuresReadError } = await supabase
      .from('features')
      .select('feature_id,content_blocks');
    if (featuresReadError) throw featuresReadError;

    await Promise.all((features || []).map((feature) => {
      const nextBlocks = removePersonFromBlocks(feature.content_blocks, personId);
      if (nextBlocks === feature.content_blocks) return Promise.resolve();
      return supabase
        .from('features')
        .update({ content_blocks: Object.keys(nextBlocks || {}).length ? nextBlocks : null })
        .eq('feature_id', feature.feature_id)
        .then(({ error }) => {
          if (error) throw error;
        });
    }));
  }

  const { error } = await supabase.from('users').delete().eq('user_id', personId);
  if (error) throw error;
}

async function deleteTaskCascade(taskId) {
  if (subtaskColumnAvailable) {
    const { error: childErr } = await supabase.from('tasks').delete().eq('parent_task_id', taskId);
    if (childErr) throw childErr;
  }
  const { error } = await supabase.from('tasks').delete().eq('task_id', taskId);
  if (error) throw error;
}

export async function deleteNode(node) {
  if (!node?._source) throw new Error('Không xác định được mục cần xóa');

  const { table, id } = node._source;

  if (table === 'tasks') {
    await deleteTaskCascade(id);
    return;
  }

  if (table === 'features') {
    const { error: tasksErr } = await supabase.from('tasks').delete().eq('feature_id', id);
    if (tasksErr) throw tasksErr;
    const { error } = await supabase.from('features').delete().eq('feature_id', id);
    if (error) throw error;
    return;
  }

  if (table === 'projects') {
    // Some deployments have tickets linked to project_id.
    // Delete them first to avoid FK violation (tickets_project_id_fkey).
    const { error: ticketsErr } = await supabase.from('tickets').delete().eq('project_id', id);
    if (ticketsErr && ticketsErr.code !== '42P01') throw ticketsErr;

    const { data: features, error: featErr } = await supabase
      .from('features')
      .select('feature_id')
      .eq('project_id', id);
    if (featErr) throw featErr;

    const featureIds = (features || []).map((f) => f.feature_id);
    if (featureIds.length > 0) {
      const { error: tasksErr } = await supabase.from('tasks').delete().in('feature_id', featureIds);
      if (tasksErr) throw tasksErr;
      const { error: delFeatErr } = await supabase.from('features').delete().in('feature_id', featureIds);
      if (delFeatErr) throw delFeatErr;
    }

    const { error } = await supabase.from('projects').delete().eq('project_id', id);
    if (error) throw error;
    return;
  }

  throw new Error('Không thể xóa mục này');
}
