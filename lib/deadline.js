/** Chuẩn hóa deadline: DB timestamptz ↔ form ngày/giờ (giờ địa phương). */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Deadline cũ chỉ có ngày (00:00 UTC hoặc YYYY-MM-DD). */
export function isDateOnlyDeadline(value) {
  if (!value) return true;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  return /T00:00:00(\.000)?Z?$/i.test(s);
}

/** Giá trị DB → ISO lưu trên node. */
export function fromDbDeadline(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO hoặc YYYY-MM-DD → { date, time } cho input date/time. */
export function splitDeadlineForInput(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  if (isDateOnlyDeadline(iso)) return { date, time: '' };
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { date, time };
}

/** Gộp ngày + giờ (giờ địa phương) → ISO UTC cho Supabase. */
export function combineDeadlineLocal(date, time) {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  let hh = 23;
  let mm = 59;
  if (time) {
    const parts = time.split(':');
    hh = Number(parts[0]);
    mm = Number(parts[1] ?? 0);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  }
  const local = new Date(y, m - 1, d, hh, mm, 0, 0);
  return local.toISOString();
}

/** Chuỗi form / ISO → timestamptz DB. */
export function toDbDeadline(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T23:59:59.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDeadlineDateTime(iso, now = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const datePart = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const showTime = !isDateOnlyDeadline(iso);
  const timePart = showTime
    ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dayStart - nowStart) / 86400000);

  let rel = datePart;
  if (diffDays === 0) rel = 'Hôm nay';
  else if (diffDays === 1) rel = 'Mai';
  else if (diffDays === -1) rel = 'Hôm qua';
  else if (diffDays > 0 && diffDays <= 7) rel = `Còn ${diffDays} ngày`;
  else if (diffDays < 0) rel = `Quá ${-diffDays} ngày`;

  if (showTime) {
    if (diffDays === 0 || diffDays === 1 || diffDays === -1) {
      return `${rel} · ${timePart}`;
    }
    return `${rel} · ${datePart} ${timePart}`;
  }

  if (diffDays === 0 || diffDays === 1 || diffDays === -1) return `${rel} · ${datePart}`;
  if (diffDays > 0 && diffDays <= 7) return `${rel} · ${datePart}`;
  if (diffDays < 0) return `${rel} · ${datePart}`;
  return datePart;
}

export function deadlineTone(iso, status, now = new Date()) {
  if (status === 'done') return 'neutral';
  if (!iso) return 'neutral';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'neutral';
  const ms = d - now;
  if (ms < 0) return 'overdue';
  if (ms <= 24 * 60 * 60 * 1000) return 'urgent';
  const days = ms / (86400000);
  if (days <= 3) return 'soon';
  return 'neutral';
}
