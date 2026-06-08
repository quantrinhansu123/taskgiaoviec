/** Đường dẫn URL cho từng view (BrowserRouter) */

const DESKTOP_PREFIX = '/desktop';

export const ROUTES = {
  products: '/san-pham',
  subtasks: '/sub-task',
  people: '/nhan-su',
  me: '/toi',
  schedule: '/lich-doi',
  labor: '/bao-cao-gio',
  attendance: '/cham-cong',
  desktop: {
    products: `${DESKTOP_PREFIX}/san-pham`,
    subtasks: `${DESKTOP_PREFIX}/sub-task`,
    people: `${DESKTOP_PREFIX}/nhan-su`,
    me: `${DESKTOP_PREFIX}/toi`,
    schedule: `${DESKTOP_PREFIX}/lich-doi`,
    labor: `${DESKTOP_PREFIX}/bao-cao-gio`,
    attendance: `${DESKTOP_PREFIX}/cham-cong`,
  },
};

export function getLayoutFromPath(pathname = '/') {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'desktop' || segments[0] === 'may-tinh') return 'desktop';
  return 'mobile';
}

function routePrefix(layout) {
  return layout === 'desktop' ? DESKTOP_PREFIX : '';
}

/** Đường dẫn chuẩn tới một node (tránh /feature/feature trùng id). */
export function productPathForNode(nodeId, pathIndex = { paths: {} }, layout = 'mobile') {
  if (!nodeId) return buildProductPath([], layout);
  const ancestors = pathIndex.paths?.[nodeId];
  if (ancestors) return buildProductPath([...ancestors, nodeId], layout);
  return buildProductPath([nodeId], layout);
}

/** Chỉ bỏ id trùng liên tiếp trong URL (vd. .../feature/feature). */
export function normalizeProductStack(stackIds) {
  const out = [];
  for (const id of stackIds) {
    if (!id) continue;
    if (out[out.length - 1] === id) continue;
    out.push(id);
  }
  return out;
}

export function stacksEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

export function buildProductPath(stackIds = [], layout = 'mobile') {
  const ids = stackIds.filter(Boolean);
  const base = `${routePrefix(layout)}/san-pham`;
  if (ids.length === 0) return base;
  return `${base}/${ids.join('/')}`;
}

export function buildPersonPath(personId, layout = 'mobile') {
  return `${routePrefix(layout)}/nhan-su/${personId}`;
}

/**
 * @returns {{ layout: 'mobile'|'desktop', tab: 'products'|'people'|'me', stack: string[], personId: string|null }}
 */
export function parseAppPath(pathname = '/') {
  const segments = pathname.split('/').filter(Boolean);
  let layout = 'mobile';
  let i = 0;

  if (segments[0] === 'desktop' || segments[0] === 'may-tinh') {
    layout = 'desktop';
    i = 1;
  }

  const head = segments[i] || '';

  if (head === 'san-pham' || head === 'products') {
    return { layout, tab: 'products', stack: segments.slice(i + 1), personId: null };
  }
  if (head === 'sub-task' || head === 'subtasks') {
    return { layout, tab: 'subtasks', stack: [], personId: null };
  }
  if (head === 'nhan-su' || head === 'people') {
    return { layout, tab: 'people', stack: [], personId: segments[i + 1] || null };
  }
  if (head === 'toi' || head === 'me') {
    return { layout, tab: 'me', stack: [], personId: null };
  }
  if (head === 'lich-doi' || head === 'schedule') {
    return { layout, tab: 'schedule', stack: [], personId: null };
  }
  if (head === 'bao-cao-gio' || head === 'labor') {
    return { layout, tab: 'labor', stack: [], personId: null };
  }
  if (head === 'cham-cong' || head === 'attendance') {
    return { layout, tab: 'attendance', stack: [], personId: null };
  }

  return { layout, tab: 'products', stack: [], personId: null };
}

export function pathForTab(tab, layout = 'mobile') {
  if (tab === 'subtasks') return `${routePrefix(layout)}/sub-task`;
  if (tab === 'people') return `${routePrefix(layout)}/nhan-su`;
  if (tab === 'me') return `${routePrefix(layout)}/toi`;
  if (tab === 'schedule') return `${routePrefix(layout)}/lich-doi`;
  if (tab === 'labor') return `${routePrefix(layout)}/bao-cao-gio`;
  if (tab === 'attendance') return `${routePrefix(layout)}/cham-cong`;
  return `${routePrefix(layout)}/san-pham`;
}

/** Giữ tab + stack, chỉ đổi mobile ↔ desktop */
export function swapLayoutPath(pathname, targetLayout) {
  const { tab, stack, personId } = parseAppPath(pathname);
  if (tab === 'products') return buildProductPath(stack, targetLayout);
  if (tab === 'subtasks') return pathForTab('subtasks', targetLayout);
  if (tab === 'people' && personId) return buildPersonPath(personId, targetLayout);
  if (tab === 'people') return pathForTab('people', targetLayout);
  if (tab === 'me') return pathForTab('me', targetLayout);
  if (tab === 'schedule') return pathForTab('schedule', targetLayout);
  if (tab === 'labor') return pathForTab('labor', targetLayout);
  if (tab === 'attendance') return pathForTab('attendance', targetLayout);
  return pathForTab('products', targetLayout);
}

export const ROUTE_LABELS = [
  { path: ROUTES.products, label: 'Điện thoại — Sản phẩm' },
  { path: ROUTES.subtasks, label: 'Điện thoại — Sub-task' },
  { path: ROUTES.people, label: 'Điện thoại — Nhân sự' },
  { path: ROUTES.me, label: 'Điện thoại — Tôi' },
  { path: ROUTES.desktop.products, label: 'Máy tính — Sản phẩm (full màn)' },
  { path: ROUTES.desktop.subtasks, label: 'Máy tính — Sub-task' },
  { path: ROUTES.desktop.people, label: 'Máy tính — Nhân sự' },
  { path: ROUTES.desktop.me, label: 'Máy tính — Tôi' },
  { path: `${ROUTES.products}/:projectId`, label: 'Chi tiết dự án (mobile)' },
  { path: `${ROUTES.desktop.products}/:projectId`, label: 'Chi tiết dự án (desktop)' },
  { path: `${ROUTES.people}/:personId`, label: 'Chi tiết nhân sự' },
];
