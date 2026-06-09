/** Nhân sự được gán trong cây dự án (project → hạng mục → task). */
export function collectProjectAssigneeIds(root) {
  const ids = new Set();
  if (!root) return [];

  function walk(node) {
    (node.assignees || []).forEach((id) => {
      if (id) ids.add(id);
    });
    (node.children || []).forEach(walk);
  }

  walk(root);
  return [...ids];
}

export function collectProjectPeople(projectNode, allPeople = []) {
  const ids = collectProjectAssigneeIds(projectNode);
  const byId = new Map(allPeople.map((p) => [p.id, p]));
  let list = ids.map((id) => byId.get(id)).filter(Boolean);

  if (list.length === 0 && allPeople.length > 0) {
    list = [...allPeople];
  }

  return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
