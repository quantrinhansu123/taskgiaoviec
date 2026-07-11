export const ACCESS_ROLE = {
  ADMIN: 'admin',
  WORKER: 'worker',
};

const ADMIN_KEYWORDS = ['admin', 'quản lý', 'quan ly', 'manager'];
/** Vai trò ngắn (vd. nick "ad") — chỉ khớp nguyên chuỗi. */
const ADMIN_EXACT = new Set(['ad', 'admin']);

export function normalizeAccessRole(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === ACCESS_ROLE.ADMIN || raw === 'ad') return ACCESS_ROLE.ADMIN;
  if (raw === ACCESS_ROLE.WORKER) return ACCESS_ROLE.WORKER;
  return null;
}

export function inferAccessRoleFromTitle(roleText = '') {
  const lower = String(roleText || '').toLowerCase().trim();
  if (ADMIN_EXACT.has(lower)) return ACCESS_ROLE.ADMIN;
  if (ADMIN_KEYWORDS.some((k) => lower.includes(k))) return ACCESS_ROLE.ADMIN;
  return ACCESS_ROLE.WORKER;
}

/** Ưu tiên access_role từ Supabase, sau đó cột role, cuối cùng localStorage. */
export function resolveAccessRole(person, storedRole = null) {
  const fromAccessColumn = normalizeAccessRole(person?.accessRole);
  if (fromAccessColumn === ACCESS_ROLE.ADMIN) return ACCESS_ROLE.ADMIN;

  const fromTitle = inferAccessRoleFromTitle(person?.role || '');
  if (fromTitle === ACCESS_ROLE.ADMIN) return ACCESS_ROLE.ADMIN;

  if (fromAccessColumn === ACCESS_ROLE.WORKER) return ACCESS_ROLE.WORKER;

  const fromStored = normalizeAccessRole(storedRole);
  if (fromStored) return fromStored;

  return ACCESS_ROLE.WORKER;
}

export function isAdmin(accessRole) {
  return accessRole === ACCESS_ROLE.ADMIN;
}

/** Admin được sửa trạng thái thủ công (kể cả đã hoàn thành / có mục con). */
export function canOverrideNodeStatus(accessRole) {
  return isAdmin(accessRole);
}

export function canDeleteNode(accessRole) {
  return isAdmin(accessRole);
}

export function canEditAnyChecklist(accessRole) {
  return isAdmin(accessRole);
}

export function canEditWorkAction(accessRole, action, node, userId) {
  if (isAdmin(accessRole)) return true;
  if (!action) return true;
  if (action.createdBy && action.createdBy === userId) return true;
  const assignees = node?.assignees || [];
  return assignees.includes(userId);
}

export function canDeleteWorkAction(accessRole, action, node, userId) {
  if (isAdmin(accessRole)) return true;
  if (action?.createdBy === userId) return true;
  return false;
}

export function isUserAssignedToTree(node, userId) {
  if (!node || !userId) return false;
  if ((node.assignees || []).includes(userId)) return true;
  return (node.children || []).some((c) => isUserAssignedToTree(c, userId));
}

export function filterProductsForUser(products, userId, accessRole) {
  if (isAdmin(accessRole) || !userId) return products;
  return products.filter((p) => isUserAssignedToTree(p, userId));
}

export function readStoredAccessRole(userId) {
  try {
    const raw = localStorage.getItem(`clv_access_role_${userId}`);
    if (raw === ACCESS_ROLE.ADMIN || raw === ACCESS_ROLE.WORKER) return raw;
  } catch { /* ignore */ }
  return null;
}

export function writeStoredAccessRole(userId, role) {
  try {
    if (role) localStorage.setItem(`clv_access_role_${userId}`, role);
  } catch { /* ignore */ }
}
