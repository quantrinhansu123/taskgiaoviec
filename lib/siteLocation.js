export const DEFAULT_RADIUS_M = 100;

export const RADIUS_PRESETS = [
  { label: 'Nhỏ — 50m', value: 50 },
  { label: 'Vừa — 100m', value: 100 },
  { label: 'Lớn — 200m', value: 200 },
  { label: 'Công trình lớn — 500m', value: 500 },
];

function parseIso(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function dateKeyFromIso(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

export function siteLocationFromBlocks(blocks) {
  if (!blocks || typeof blocks !== 'object') return null;
  const raw = blocks.site_location;
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    radiusM: Number(raw.radius_m ?? raw.radiusM) || DEFAULT_RADIUS_M,
    address: String(raw.address || '').trim(),
  };
}

export function siteLocationToDb(site) {
  if (!site) return null;
  return {
    lat: site.lat,
    lng: site.lng,
    radius_m: site.radiusM || DEFAULT_RADIUS_M,
    address: site.address || null,
  };
}

export function teamSchedulesFromBlocks(blocks) {
  if (!blocks || typeof blocks !== 'object' || !Array.isArray(blocks.team_schedules)) {
    return [];
  }
  return blocks.team_schedules.map(normalizeTeamSchedule).filter(Boolean);
}

export function normalizeTeamSchedule(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const team = String(raw.team || '').trim();
  const startAt = parseIso(raw.start_at || raw.startAt);
  const endAt = parseIso(raw.end_at || raw.endAt);
  const startDate = startAt ? dateKeyFromIso(startAt) : String(raw.start_date || raw.startDate || '').slice(0, 10);
  const endDate = endAt ? dateKeyFromIso(endAt) : String(raw.end_date || raw.endDate || startDate).slice(0, 10);
  if (!team || !startDate) return null;
  return {
    id: raw.id || `ts-${team}-${startDate}`,
    team,
    startAt,
    endAt,
    startDate,
    endDate: endDate || startDate,
    note: String(raw.note || '').trim(),
  };
}

export function teamSchedulesToDb(list) {
  return (list || []).map((s) => ({
    id: s.id,
    team: s.team,
    start_date: s.startDate,
    end_date: s.endDate,
    start_at: s.startAt || null,
    end_at: s.endAt || null,
    note: s.note || null,
  }));
}

export function jobStartedAtFromBlocks(blocks) {
  if (!blocks || typeof blocks !== 'object') return null;
  return parseIso(blocks.job_started_at || blocks.jobStartedAt);
}

export function jobStartedAtToDb(iso) {
  return iso || null;
}

export function newTeamScheduleId() {
  return `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
