import { findAssignmentsFor } from './data.js';
import { activeSessionForUser, userCompletedCheckoutToday } from './attendance.js';

/**
 * Dự án cần hiển thị check-in GPS: user được giao việc trong cây dự án,
 * chưa check-out hôm nay (hoặc đang trong ca làm việc).
 */
export function findPendingCheckInProjects(userId, products = []) {
  if (!userId || !products.length) return [];

  const assignments = findAssignmentsFor(userId, products);
  const byProject = new Map();

  for (const assignment of assignments) {
    const { node, productId } = assignment;
    const project = products.find((p) => p.id === productId);
    if (!project) continue;

    const sessions = project.attendanceSessions || [];
    const activeSession = activeSessionForUser(sessions, userId);
    const checkedOutToday = userCompletedCheckoutToday(sessions, userId);

    if (checkedOutToday && !activeSession) continue;

    if (!byProject.has(productId)) {
      byProject.set(productId, {
        project,
        activeSession,
        assignedLabels: [],
      });
    }

    const entry = byProject.get(productId);
    if (node.id !== productId && node.name) {
      entry.assignedLabels.push(node.name);
    }
  }

  return [...byProject.values()].map((entry) => ({
    ...entry,
    assignedLabels: [...new Set(entry.assignedLabels)],
  }));
}
