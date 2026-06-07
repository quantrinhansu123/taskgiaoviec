/** Ghi nhận hoàn thành cấp dự án / hạng mục / công việc (content_blocks.completion hoặc projects.documents). */

export function completionFromBlocks(blocks) {
  const raw = blocks && typeof blocks === 'object' ? blocks.completion : null;
  return normalizeCompletion(raw);
}

export function completionFromProjectDocuments(documents) {
  if (!documents || typeof documents !== 'object' || Array.isArray(documents)) return null;
  return normalizeCompletion(documents.completion);
}

export function normalizeCompletion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const completedAt = raw.completed_at || raw.completedAt || null;
  const status = String(raw.status || '').toLowerCase();
  if (!completedAt && status !== 'completed' && status !== 'done') return null;
  return {
    status: 'completed',
    completedAt: completedAt || null,
  };
}

export function completionToDb(completedAt = new Date().toISOString()) {
  return { status: 'completed', completed_at: completedAt };
}

export function formatCompletedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function isNodeManuallyCompleted(node) {
  return Boolean(node?.completedAt);
}
