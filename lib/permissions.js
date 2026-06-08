export const ACCESS_ROLE = {
  ADMIN: 'admin',
  WORKER: 'worker',
};

const ADMIN_KEYWORDS = ['admin', 'quản lý', 'quan ly', 'manager'];

export function inferAccessRoleFromTitle(roleText = '') {
  const lower = roleText.toLowerCase();
  if (ADMIN_KEYWORDS.some((k) => lower.includes(k))) return ACCESS_ROLE.ADMIN;
  return ACCESS_ROLE.WORKER;
}

export function resolveAccessRole(person, storedRole = null) {
  if (person?.accessRole === ACCESS_ROLE.ADMIN || person?.accessRole === ACCESS_ROLE.WORKER) {
    return person.accessRole;
  }
  if (storedRole === ACCESS_ROLE.ADMIN || storedRole === ACCESS_ROLE.WORKER) {
    return storedRole;
  }
  return inferAccessRoleFromTitle(person?.role || '');
}

export function isAdmin(accessRole) {
  return accessRole === ACCESS_ROLE.ADMIN;
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
