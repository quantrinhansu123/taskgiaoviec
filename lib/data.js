export const TODAY = new Date();

export const STATUS_META = {
  done: { label: 'Đạt', ink: '#1F6B47', bg: '#DCEAE0', dot: '#3FA66E' },
  doing: { label: 'Đang làm', ink: '#5A4A1F', bg: '#F0E6CC', dot: '#C4A23F' },
  todo: { label: 'Chờ', ink: '#4A4A52', bg: '#E5E3DE', dot: '#9E9A92' },
  fail: { label: 'Có lỗi', ink: '#8C2A1F', bg: '#F5D9D2', dot: '#C8553D' },
};

export const LEVEL_LABEL = ['Sản phẩm', 'Hạng mục', 'Công việc', 'Chi tiết'];

export let PEOPLE = [];

export function setPeople(list) {
  PEOPLE = list;
}

export let pathIndex = { paths: {} };

export function setPathIndex(products) {
  const paths = {};
  function walk(node, path) {
    paths[node.id] = path;
    (node.children || []).forEach((c) => walk(c, [...path, node.id]));
  }
  products.forEach((p) => walk(p, []));
  pathIndex = { paths };
}

export function aggregate(node) {
  let total = 0;
  let done = 0;
  let fail = 0;
  let doing = 0;

  function walk(n) {
    if (!n.children || n.children.length === 0) {
      total++;
      if (n.status === 'done') done++;
      else if (n.status === 'fail') fail++;
      else if (n.status === 'doing') doing++;
      return;
    }
    n.children.forEach(walk);
  }

  walk(node);
  return { total, done, fail, doing };
}

export { formatDeadlineDateTime as formatDeadline, deadlineTone } from './deadline.js';

export function findAssignmentsFor(personId, products) {
  const out = [];
  function walk(node, productRoot, parent, depth) {
    if ((node.assignees || []).includes(personId)) {
      out.push({
        node,
        productId: productRoot.id,
        productName: productRoot.name,
        customerName: productRoot.customerName || null,
        parentName: parent ? parent.name : null,
        depth,
      });
    }
    (node.children || []).forEach((c) => walk(c, productRoot, node, depth + 1));
  }
  products.forEach((p) => walk(p, p, null, 0));
  return out;
}

/** Chỉ sub-task (có parent_task_id) được gán trực tiếp cho nhân sự. */
export function findAssignedSubtasksFor(personId, products) {
  const out = [];
  function walk(node, productRoot, parent, depth, featureNode, parentTaskNode) {
    const table = node?._source?.table;
    let nextFeature = featureNode;
    let nextParentTask = parentTaskNode;

    if (table === 'features') nextFeature = node;
    if (table === 'tasks' && !node._source?.parentTaskId) nextParentTask = node;

    const isSubtask = table === 'tasks' && !!node._source?.parentTaskId;
    if (isSubtask && (node.assignees || []).includes(personId)) {
      out.push({
        node,
        productId: productRoot.id,
        productName: productRoot.name,
        customerName: productRoot.customerName || null,
        featureName: nextFeature?.name || (parent?._source?.table === 'features' ? parent.name : null),
        parentTaskName: parentTaskNode?.name || (parent?._source?.table === 'tasks' ? parent.name : null),
        parentName: nextFeature?.name || parent?.name || null,
        depth,
        isSubtask: true,
      });
    }

    (node.children || []).forEach((c) =>
      walk(c, productRoot, node, depth + 1, nextFeature, nextParentTask),
    );
  }
  products.forEach((p) => walk(p, p, null, 0, null, null));
  return out;
}

function statsFromAssignmentItems(items) {
  const stats = { total: 0, done: 0, doing: 0, todo: 0, fail: 0, overdue: 0 };
  items.forEach(({ node }) => {
    stats.total++;
    stats[node.status] = (stats[node.status] || 0) + 1;
    if (node.status !== 'done' && node.deadline) {
      const d = new Date(node.deadline);
      if (d < TODAY) stats.overdue++;
    }
  });
  return stats;
}

export function personSubtaskStats(personId, products) {
  return statsFromAssignmentItems(findAssignedSubtasksFor(personId, products));
}

export function personStats(personId, products) {
  return statsFromAssignmentItems(findAssignmentsFor(personId, products));
}
