import { sessionDurationMinutes } from './attendance.js';
import { actionDurationMinutes } from './workActions.js';
import { getAppLocale } from './localeRuntime.js';

function walkTasks(node, fn) {
  if (node?._source?.table === 'tasks') fn(node);
  (node?.children || []).forEach((c) => walkTasks(c, fn));
}

/** Tổng giờ chấm công GPS theo từng Job (project). */
export function attendanceHoursByProject(products) {
  const map = new Map();
  for (const project of products || []) {
    let totalMin = 0;
    const byUser = new Map();
    for (const session of project.attendanceSessions || []) {
      const mins = sessionDurationMinutes(session);
      if (mins == null) continue;
      totalMin += mins;
      byUser.set(session.userId, (byUser.get(session.userId) || 0) + mins);
    }
    map.set(project.id, {
      projectId: project.id,
      projectName: project.name,
      totalMinutes: totalMin,
      totalHours: Math.round((totalMin / 60) * 100) / 100,
      byUser: [...byUser.entries()].map(([userId, minutes]) => ({ userId, minutes })),
      sessionCount: (project.attendanceSessions || []).filter((s) => s.checkOutAt).length,
    });
  }
  return map;
}

/** Tổng giờ hành động (checklist thủ công) theo Job. */
export function workActionHoursByProject(products) {
  const map = new Map();
  for (const project of products || []) {
    let totalMin = 0;
    const byUser = new Map();
    walkTasks(project, (task) => {
      for (const action of task.workActions || []) {
        const mins = actionDurationMinutes(action);
        if (mins == null) continue;
        totalMin += mins;
        const uid = action.createdBy || (task.assignees || [])[0];
        if (uid) byUser.set(uid, (byUser.get(uid) || 0) + mins);
      }
    });
    map.set(project.id, {
      projectId: project.id,
      projectName: project.name,
      totalMinutes: totalMin,
      totalHours: Math.round((totalMin / 60) * 100) / 100,
      byUser: [...byUser.entries()].map(([userId, minutes]) => ({ userId, minutes })),
    });
  }
  return map;
}

/** Báo cáo tổng hợp giờ thực tế theo Job — ưu tiên GPS, cộng thêm checklist. */
export function buildJobLaborReport(products, people = []) {
  const attMap = attendanceHoursByProject(products);
  const workMap = workActionHoursByProject(products);
  const personName = (id) => people.find((p) => p.id === id)?.name || id?.slice(0, 8) || '—';

  return (products || []).map((project) => {
    const att = attMap.get(project.id) || { totalMinutes: 0, byUser: [], sessionCount: 0 };
    const work = workMap.get(project.id) || { totalMinutes: 0, byUser: [] };
    const combinedMin = att.totalMinutes + work.totalMinutes;

    const userIds = new Set([
      ...att.byUser.map((u) => u.userId),
      ...work.byUser.map((u) => u.userId),
    ]);

    const byPerson = [...userIds].map((userId) => {
      const attMin = att.byUser.find((u) => u.userId === userId)?.minutes || 0;
      const workMin = work.byUser.find((u) => u.userId === userId)?.minutes || 0;
      return {
        userId,
        name: personName(userId),
        attendanceMinutes: attMin,
        workActionMinutes: workMin,
        totalMinutes: attMin + workMin,
        totalHours: Math.round(((attMin + workMin) / 60) * 100) / 100,
      };
    }).sort((a, b) => b.totalMinutes - a.totalMinutes);

    return {
      projectId: project.id,
      projectName: project.name,
      customerName: project.customerName,
      attendanceMinutes: att.totalMinutes,
      workActionMinutes: work.totalMinutes,
      totalMinutes: combinedMin,
      totalHours: Math.round((combinedMin / 60) * 100) / 100,
      sessionCount: att.sessionCount,
      byPerson,
    };
  }).filter((r) => r.totalMinutes > 0 || r.sessionCount > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function formatHours(hours) {
  const en = getAppLocale() === 'en';
  if (hours == null || hours <= 0) return en ? '0 h' : '0 giờ';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return en ? `${m} min` : `${m} phút`;
  if (en) return m ? `${h}h ${m}m` : `${h} h`;
  return m ? `${h}g ${m}p` : `${h} giờ`;
}
