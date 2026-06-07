// Pure helpers for aggregating tree data and formatting
import { TODAY } from './data';

// Aggregate counts for a node (leaf-based)
export function aggregate(node) {
  let total = 0, done = 0, fail = 0, doing = 0;
  function walk(n) {
    if (!n.children || n.children.length === 0) {
      total++;
      if (n.status === 'done') done++;
      else if (n.status === 'fail') fail++;
      else if (n.status === 'doing') doing++;
    } else {
      n.children.forEach(walk);
    }
  }
  walk(node);
  return { total, done, fail, doing };
}

export function formatDeadline(iso, today = TODAY) {
  if (!iso) return '';
  const d = new Date(iso);
  const t = new Date(today);
  const diff = Math.round((d - t) / (1000*60*60*24));
  const fmt = d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Mai · ' + fmt;
  if (diff === -1) return 'Hôm qua · ' + fmt;
  if (diff > 0 && diff <= 7) return `Còn ${diff} ngày · ${fmt}`;
  if (diff < 0) return `Quá ${-diff} ngày · ${fmt}`;
  return fmt;
}

export function deadlineTone(iso, status, today = TODAY) {
  if (status === 'done') return 'neutral';
  if (!iso) return 'neutral';
  const d = new Date(iso);
  const t = new Date(today);
  const diff = Math.round((d - t) / (1000*60*60*24));
  if (diff < 0) return 'overdue';
  if (diff <= 1) return 'urgent';
  if (diff <= 3) return 'soon';
  return 'neutral';
}

// Find all nodes (across all products) assigned to personId.
export function findAssignmentsFor(personId, products) {
  const out = [];
  function walk(node, productRoot, parent, depth) {
    if ((node.assignees || []).includes(personId)) {
      out.push({
        node, productId: productRoot.id, productName: productRoot.name,
        parentName: parent ? parent.name : null, depth,
      });
    }
    (node.children || []).forEach(c => walk(c, productRoot, node, depth + 1));
  }
  products.forEach(p => walk(p, p, null, 0));
  return out;
}

export function personStats(personId, products) {
  const items = findAssignmentsFor(personId, products);
  const stats = { total: 0, done: 0, doing: 0, todo: 0, fail: 0, overdue: 0 };
  items.forEach(({ node }) => {
    stats.total++;
    stats[node.status] = (stats[node.status]||0) + 1;
    if (node.status !== 'done' && node.deadline) {
      const d = new Date(node.deadline);
      if (d < TODAY) stats.overdue++;
    }
  });
  return stats;
}

// Build id → ancestor path map across all products. Returns { paths: { id: ['prod-x', ...] } }
export function buildPathIndex(products) {
  const paths = {};
  function walk(node, path) {
    paths[node.id] = path;
    (node.children || []).forEach(c => walk(c, [...path, node.id]));
  }
  products.forEach(p => walk(p, []));
  return paths;
}

// Helpers to find nodes within a products array
export function findNodeIn(id, root) {
  if (root.id === id) return root;
  for (const c of (root.children || [])) {
    const r = findNodeIn(id, c);
    if (r) return r;
  }
  return null;
}
export function findNode(id, products) {
  for (const p of products) {
    const r = findNodeIn(id, p);
    if (r) return r;
  }
  return null;
}
