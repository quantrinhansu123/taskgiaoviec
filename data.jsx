// Mock data + helpers for Check Lỗi Việc app

const TODAY = new Date('2026-05-25');

function daysFrom(today, offset) {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const PEOPLE = [
  { id: 'p1', name: 'Minh Anh',   initials: 'MA', color: '#C8553D', role: 'iOS Developer',     dept: 'Mobile',   status: 'online' },
  { id: 'p2', name: 'Quốc Việt',  initials: 'QV', color: '#3D6B8C', role: 'Backend Lead',      dept: 'Backend',  status: 'online' },
  { id: 'p3', name: 'Thu Hà',     initials: 'TH', color: '#7B6BA0', role: 'Product Designer',  dept: 'Design',   status: 'busy'   },
  { id: 'p4', name: 'Đăng Khoa',  initials: 'ĐK', color: '#4A8F6B', role: 'Backend Engineer',  dept: 'Backend',  status: 'online' },
  { id: 'p5', name: 'Phương Linh',initials: 'PL', color: '#B07F3F', role: 'UX Writer',         dept: 'Design',   status: 'off'    },
  { id: 'p6', name: 'Hoàng Nam',  initials: 'HN', color: '#5A6E80', role: 'Android Developer', dept: 'Mobile',   status: 'online' },
  { id: 'p7', name: 'Bảo Trân',   initials: 'BT', color: '#A04F6B', role: 'QA Engineer',       dept: 'QA',       status: 'busy'   },
  { id: 'p8', name: 'Tuấn Kiệt',  initials: 'TK', color: '#3D7A6B', role: 'Full-stack Dev',    dept: 'Backend',  status: 'off'    },
];

// statuses: 'done' (đạt) | 'fail' (lỗi) | 'doing' (đang làm) | 'todo' (chờ)
function makeNode(over) {
  return {
    id: over.id, name: over.name,
    deadline: over.deadline,
    status: over.status || 'doing',
    assignees: over.assignees || [],
    note: over.note || '',
    photos: over.photos || [],
    children: over.children || [],
    issues: over.issues || 0, // số lỗi mở
  };
}

// photos: { id, label (caption), tint (placeholder color), kind: 'good'|'bad' }
function ph(id, label, tint, kind='good') { return { id, label, tint, kind }; }

const PRODUCT_1 = makeNode({
    id: 'prod-1',
    name: 'App đặt món Cơm Tấm Sài Gòn',
    deadline: daysFrom(TODAY, 18),
    status: 'doing',
    assignees: ['p1','p2','p3','p4','p5'],
    note: 'Phiên bản v1.2 — chuẩn bị release App Store ngày 12/06. Ưu tiên fix luồng thanh toán và onboarding.',
    photos: [
      ph('pr-1','Mockup màn hình chính', '#E8D5C4'),
      ph('pr-2','Bảng màu thương hiệu', '#D4A574'),
      ph('pr-3','Logo phiên bản mới', '#C8553D'),
    ],
    issues: 4,
    children: [
      makeNode({
        id: 'mod-1', name: 'Onboarding & Đăng nhập',
        deadline: daysFrom(TODAY, 3),
        status: 'fail',
        assignees: ['p1','p3'],
        note: 'OTP gửi chậm trên mạng yếu — cần thêm fallback gửi qua Zalo.',
        photos: [
          ph('m1-1','Lỗi nút đăng nhập bị cắt iPhone SE', '#E89B8E', 'bad'),
          ph('m1-2','Bản design mới đã duyệt', '#D5C4E8'),
        ],
        issues: 2,
        children: [
          makeNode({
            id: 't1-1', name: 'Màn hình Splash',
            deadline: daysFrom(TODAY, -1),
            status: 'done',
            assignees: ['p3'],
            note: 'Đã ship — animation 1.2s mượt.',
            photos: [ph('t11-1','Splash final', '#D5C4E8')],
            children: [
              makeNode({ id:'s1', name:'Logo animation 1.2s', deadline:daysFrom(TODAY,-2), status:'done', assignees:['p3'] }),
              makeNode({ id:'s2', name:'Preload font Lexend', deadline:daysFrom(TODAY,-2), status:'done', assignees:['p3'] }),
              makeNode({ id:'s3', name:'Test trên 5 device', deadline:daysFrom(TODAY,-1), status:'done', assignees:['p3','p6'] }),
            ],
          }),
          makeNode({
            id: 't1-2', name: 'Đăng ký bằng SĐT + OTP',
            deadline: daysFrom(TODAY, 2),
            status: 'fail',
            assignees: ['p1','p3'],
            note: 'Phát hiện 2 lỗi nghiêm trọng khi QA — xem ảnh đính kèm.',
            photos: [
              ph('t12-1','OTP không nhận trên Viettel', '#E89B8E','bad'),
              ph('t12-2','Layout vỡ ở Android 9', '#E89B8E','bad'),
              ph('t12-3','Flow chuẩn iOS', '#D5C4E8'),
            ],
            issues: 2,
            children: [
              makeNode({ id:'s4', name:'Form nhập số điện thoại', deadline:daysFrom(TODAY,-3), status:'done', assignees:['p3'] }),
              makeNode({ id:'s5', name:'Gọi API gửi OTP', deadline:daysFrom(TODAY,0), status:'fail', assignees:['p1'], note:'Timeout 30s khi mạng 3G yếu', issues:1,
                photos:[ph('s5-1','Log lỗi timeout','#E89B8E','bad')] }),
              makeNode({ id:'s6', name:'Màn nhập mã 6 chữ số', deadline:daysFrom(TODAY,1), status:'doing', assignees:['p3'] }),
              makeNode({ id:'s7', name:'Resend OTP sau 60s', deadline:daysFrom(TODAY,2), status:'todo', assignees:['p3'] }),
              makeNode({ id:'s8', name:'Fallback gửi qua Zalo', deadline:daysFrom(TODAY,2), status:'fail', assignees:['p1'], issues:1 }),
            ],
          }),
          makeNode({
            id: 't1-3', name: 'Đăng nhập Google / Apple',
            deadline: daysFrom(TODAY, 3),
            status: 'doing',
            assignees: ['p1'],
            children: [
              makeNode({ id:'s9', name:'Tích hợp Google Sign-In', deadline:daysFrom(TODAY,1), status:'doing', assignees:['p1'] }),
              makeNode({ id:'s10', name:'Tích hợp Apple Sign-In', deadline:daysFrom(TODAY,3), status:'todo', assignees:['p1'] }),
            ],
          }),
        ],
      }),
      makeNode({
        id: 'mod-2', name: 'Trang chủ & Danh mục món',
        deadline: daysFrom(TODAY, 7),
        status: 'doing',
        assignees: ['p2','p5'],
        note: 'Cần thiết kế lại card món ăn cho mobile — version hiện tại quá to.',
        photos: [
          ph('m2-1','Card món ăn v1', '#E8D5C4'),
          ph('m2-2','Layout grid 2 cột', '#D4A574'),
          ph('m2-3','Filter danh mục', '#C8B5A0'),
          ph('m2-4','Banner khuyến mãi', '#E8D5C4'),
        ],
        children: [
          makeNode({
            id: 't2-1', name: 'Header với search bar',
            deadline: daysFrom(TODAY, 1),
            status: 'doing',
            assignees: ['p5'],
            children: [
              makeNode({ id:'s11', name:'Logo + địa chỉ giao hàng', deadline:daysFrom(TODAY,0), status:'done', assignees:['p5'] }),
              makeNode({ id:'s12', name:'Ô search có gợi ý', deadline:daysFrom(TODAY,1), status:'doing', assignees:['p5'] }),
            ],
          }),
          makeNode({
            id: 't2-2', name: 'Banner khuyến mãi (carousel)',
            deadline: daysFrom(TODAY, 4),
            status: 'todo',
            assignees: ['p2','p5'],
            children: [
              makeNode({ id:'s13', name:'Auto scroll 4s', deadline:daysFrom(TODAY,3), status:'todo', assignees:['p2'] }),
              makeNode({ id:'s14', name:'Indicator dot', deadline:daysFrom(TODAY,3), status:'todo', assignees:['p5'] }),
              makeNode({ id:'s15', name:'Deep link tới chi tiết', deadline:daysFrom(TODAY,4), status:'todo', assignees:['p2'] }),
            ],
          }),
          makeNode({
            id: 't2-3', name: 'Danh sách món theo danh mục',
            deadline: daysFrom(TODAY, 7),
            status: 'todo',
            assignees: ['p2'],
            children: [
              makeNode({ id:'s16', name:'Tab danh mục cuộn ngang', deadline:daysFrom(TODAY,5), status:'todo', assignees:['p2'] }),
              makeNode({ id:'s17', name:'Card món: ảnh + giá + nút +', deadline:daysFrom(TODAY,6), status:'todo', assignees:['p2'] }),
              makeNode({ id:'s18', name:'Lazy load ảnh', deadline:daysFrom(TODAY,7), status:'todo', assignees:['p2'] }),
            ],
          }),
        ],
      }),
      makeNode({
        id: 'mod-3', name: 'Giỏ hàng & Thanh toán',
        deadline: daysFrom(TODAY, 10),
        status: 'fail',
        assignees: ['p4','p6','p1'],
        note: 'Cổng VNPay đôi khi trả về thành công nhưng đơn không chốt — đang chờ Backend log.',
        photos: [
          ph('m3-1','Lỗi double charge', '#E89B8E','bad'),
          ph('m3-2','Flow thanh toán chuẩn', '#D5C4E8'),
        ],
        issues: 1,
        children: [
          makeNode({
            id: 't3-1', name: 'Tích hợp VNPay',
            deadline: daysFrom(TODAY, 5),
            status: 'fail',
            assignees: ['p4','p1'],
            note: 'Lỗi callback không nhất quán.',
            issues: 1,
            children: [
              makeNode({ id:'s19', name:'Tạo URL thanh toán', deadline:daysFrom(TODAY,2), status:'done', assignees:['p4'] }),
              makeNode({ id:'s20', name:'Xử lý callback success', deadline:daysFrom(TODAY,4), status:'fail', assignees:['p4'], issues:1, note:'Đôi khi callback đến 2 lần' }),
              makeNode({ id:'s21', name:'Hiển thị màn hình thành công', deadline:daysFrom(TODAY,5), status:'doing', assignees:['p1'] }),
            ],
          }),
          makeNode({
            id: 't3-2', name: 'Áp dụng mã giảm giá',
            deadline: daysFrom(TODAY, 8),
            status: 'todo',
            assignees: ['p6'],
            children: [
              makeNode({ id:'s22', name:'Nhập mã + validate', deadline:daysFrom(TODAY,7), status:'todo', assignees:['p6'] }),
              makeNode({ id:'s23', name:'Hiển thị giá sau giảm', deadline:daysFrom(TODAY,8), status:'todo', assignees:['p6'] }),
            ],
          }),
        ],
      }),
      makeNode({
        id: 'mod-4', name: 'Theo dõi đơn hàng',
        deadline: daysFrom(TODAY, 14),
        status: 'todo',
        assignees: ['p6','p8'],
        children: [
          makeNode({
            id: 't4-1', name: 'Bản đồ realtime tài xế',
            deadline: daysFrom(TODAY, 12),
            status: 'todo',
            assignees: ['p8'],
            children: [
              makeNode({ id:'s24', name:'Tích hợp Mapbox', deadline:daysFrom(TODAY,10), status:'todo', assignees:['p8'] }),
              makeNode({ id:'s25', name:'Marker tài xế di chuyển', deadline:daysFrom(TODAY,12), status:'todo', assignees:['p8'] }),
            ],
          }),
          makeNode({
            id: 't4-2', name: 'Thông báo trạng thái đơn',
            deadline: daysFrom(TODAY, 14),
            status: 'todo',
            assignees: ['p6'],
            children: [
              makeNode({ id:'s26', name:'Push notification', deadline:daysFrom(TODAY,13), status:'todo', assignees:['p6'] }),
              makeNode({ id:'s27', name:'Timeline 5 bước', deadline:daysFrom(TODAY,14), status:'todo', assignees:['p6'] }),
            ],
          }),
        ],
      }),
    ],
  });

// ─── Additional products (lighter detail) ──────────────────────
const PRODUCT_2 = makeNode({
  id: 'prod-2',
  name: 'Website Bán Buôn B2B',
  deadline: daysFrom(TODAY, 42),
  status: 'doing',
  assignees: ['p2','p6','p8'],
  note: 'Sprint 3 đang chạy, ưu tiên tính năng quản lý báo giá đa cấp.',
  photos: [
    ph('p2-1','Wireframe dashboard', '#C8B5A0'),
    ph('p2-2','Flow đặt hàng B2B', '#9EB3C2'),
  ],
  issues: 2,
  children: [
    makeNode({
      id: 'p2-m1', name: 'Quản lý khách hàng',
      deadline: daysFrom(TODAY, 12), status: 'doing',
      assignees: ['p2','p6'],
      children: [
        makeNode({ id:'p2-t1', name:'Form tạo công ty', deadline:daysFrom(TODAY,8), status:'done', assignees:['p2'] }),
        makeNode({ id:'p2-t2', name:'Phân loại theo hạn mức', deadline:daysFrom(TODAY,12), status:'doing', assignees:['p6'] }),
        makeNode({ id:'p2-t3', name:'Lịch sử giao dịch', deadline:daysFrom(TODAY,15), status:'todo', assignees:['p2'] }),
      ],
    }),
    makeNode({
      id: 'p2-m2', name: 'Báo giá & Hợp đồng',
      deadline: daysFrom(TODAY, 25), status: 'fail',
      assignees: ['p8'], issues: 2,
      note: 'Logic chiết khấu nhiều cấp đang sai khi áp combo voucher.',
      children: [
        makeNode({ id:'p2-t4', name:'Tạo báo giá nhiều dòng', deadline:daysFrom(TODAY,18), status:'done', assignees:['p8'] }),
        makeNode({ id:'p2-t5', name:'Tính chiết khấu cấp', deadline:daysFrom(TODAY,22), status:'fail', issues:2, assignees:['p8'] }),
        makeNode({ id:'p2-t6', name:'PDF hợp đồng tự động', deadline:daysFrom(TODAY,25), status:'todo', assignees:['p8'] }),
      ],
    }),
    makeNode({
      id: 'p2-m3', name: 'Vận chuyển & Kho',
      deadline: daysFrom(TODAY, 38), status: 'todo',
      assignees: ['p6'],
      children: [
        makeNode({ id:'p2-t7', name:'Tích hợp GHN/GHTK', deadline:daysFrom(TODAY,32), status:'todo', assignees:['p6'] }),
        makeNode({ id:'p2-t8', name:'Quản lý tồn kho', deadline:daysFrom(TODAY,38), status:'todo', assignees:['p6'] }),
      ],
    }),
  ],
});

const PRODUCT_3 = makeNode({
  id: 'prod-3',
  name: 'Website Landing — Cơm Tấm SG',
  deadline: daysFrom(TODAY, 6),
  status: 'fail',
  assignees: ['p3','p5','p7'],
  note: 'Form đăng ký nhận khuyến mãi đang gửi mail trùng — gấp.',
  photos: [
    ph('p3-1','Hero section v3', '#E8D5C4'),
    ph('p3-2','Mobile responsive issues', '#E89B8E', 'bad'),
    ph('p3-3','Footer & social', '#C8B5A0'),
  ],
  issues: 3,
  children: [
    makeNode({
      id: 'p3-m1', name: 'Hero & Giới thiệu',
      deadline: daysFrom(TODAY, 2), status: 'done',
      assignees: ['p5'],
      children: [
        makeNode({ id:'p3-t1', name:'Hero banner CTA', deadline:daysFrom(TODAY,-1), status:'done', assignees:['p5'] }),
        makeNode({ id:'p3-t2', name:'Giới thiệu thương hiệu', deadline:daysFrom(TODAY,2), status:'done', assignees:['p5'] }),
      ],
    }),
    makeNode({
      id: 'p3-m2', name: 'Form đăng ký & Email',
      deadline: daysFrom(TODAY, 4), status: 'fail',
      assignees: ['p3','p7'], issues: 3,
      note: 'Lỗi double-send khi user click nhanh — đã tìm ra nguyên nhân.',
      children: [
        makeNode({ id:'p3-t3', name:'Validate email + SĐT', deadline:daysFrom(TODAY,1), status:'done', assignees:['p7'] }),
        makeNode({ id:'p3-t4', name:'Gửi mail welcome', deadline:daysFrom(TODAY,3), status:'fail', issues:2, assignees:['p3'] }),
        makeNode({ id:'p3-t5', name:'Lưu lead vào CRM', deadline:daysFrom(TODAY,4), status:'fail', issues:1, assignees:['p3'] }),
      ],
    }),
    makeNode({
      id: 'p3-m3', name: 'SEO & Analytics',
      deadline: daysFrom(TODAY, 6), status: 'doing',
      assignees: ['p7'],
      children: [
        makeNode({ id:'p3-t6', name:'Meta tags + OG', deadline:daysFrom(TODAY,5), status:'doing', assignees:['p7'] }),
        makeNode({ id:'p3-t7', name:'GA4 + GTM events', deadline:daysFrom(TODAY,6), status:'todo', assignees:['p7'] }),
      ],
    }),
  ],
});

const PRODUCT_4 = makeNode({
  id: 'prod-4',
  name: 'App Quản lý Nội bộ — Bếp Trung tâm',
  deadline: daysFrom(TODAY, 65),
  status: 'doing',
  assignees: ['p1','p4','p8'],
  note: '',
  photos: [
    ph('p4-1','Wireframe màn nhập kho', '#9EB3C2'),
  ],
  children: [
    makeNode({
      id: 'p4-m1', name: 'Quản lý nguyên liệu',
      deadline: daysFrom(TODAY, 28), status: 'doing',
      assignees: ['p4'],
      children: [
        makeNode({ id:'p4-t1', name:'Nhập kho có barcode', deadline:daysFrom(TODAY,20), status:'doing', assignees:['p4'] }),
        makeNode({ id:'p4-t2', name:'Cảnh báo sắp hết', deadline:daysFrom(TODAY,28), status:'todo', assignees:['p4'] }),
      ],
    }),
    makeNode({
      id: 'p4-m2', name: 'Báo cáo doanh thu',
      deadline: daysFrom(TODAY, 50), status: 'todo',
      assignees: ['p1','p8'],
      children: [
        makeNode({ id:'p4-t3', name:'Dashboard theo ngày', deadline:daysFrom(TODAY,42), status:'todo', assignees:['p1'] }),
        makeNode({ id:'p4-t4', name:'Xuất Excel báo cáo', deadline:daysFrom(TODAY,50), status:'todo', assignees:['p8'] }),
      ],
    }),
  ],
});

const PRODUCT_5 = makeNode({
  id: 'prod-5',
  name: 'Hệ thống Đặt bàn Nhà hàng',
  deadline: daysFrom(TODAY, -3),
  status: 'done',
  assignees: ['p2','p3'],
  note: 'Đã release v1.0 ngày 22/05 — chuyển sang maintenance.',
  photos: [
    ph('p5-1','Final UI đặt bàn', '#D5C4E8'),
    ph('p5-2','Email confirm', '#E8D5C4'),
  ],
  children: [
    makeNode({
      id: 'p5-m1', name: 'Đặt bàn online',
      deadline: daysFrom(TODAY, -5), status: 'done',
      assignees: ['p2'],
      children: [
        makeNode({ id:'p5-t1', name:'Form chọn ngày + giờ', deadline:daysFrom(TODAY,-10), status:'done', assignees:['p2'] }),
        makeNode({ id:'p5-t2', name:'Email xác nhận', deadline:daysFrom(TODAY,-5), status:'done', assignees:['p3'] }),
      ],
    }),
  ],
});

const DATA = {
  products: [PRODUCT_1, PRODUCT_2, PRODUCT_3, PRODUCT_4, PRODUCT_5],
  product: PRODUCT_1, // backward compat
};

// status meta
const STATUS_META = {
  done:  { label: 'Đạt',      ink: '#1F6B47', bg: '#DCEAE0', dot: '#3FA66E' },
  doing: { label: 'Đang làm', ink: '#5A4A1F', bg: '#F0E6CC', dot: '#C4A23F' },
  todo:  { label: 'Chờ',      ink: '#4A4A52', bg: '#E5E3DE', dot: '#9E9A92' },
  fail:  { label: 'Có lỗi',   ink: '#8C2A1F', bg: '#F5D9D2', dot: '#C8553D' },
};

// Build map id → node + parent path
function buildIndex(root) {
  const map = {};
  const paths = {};
  function walk(node, path) {
    map[node.id] = node;
    paths[node.id] = path;
    (node.children || []).forEach(c => walk(c, [...path, node.id]));
  }
  walk(root, []);
  return { map, paths };
}

const INDEX = buildIndex({ id: 'root', children: DATA.products });

// Level label by depth
const LEVEL_LABEL = ['Sản phẩm', 'Hạng mục', 'Công việc', 'Chi tiết'];

// Aggregate counts for a node (recursive over children + self in leaves)
function aggregate(node) {
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

function formatDeadline(iso, today = TODAY) {
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

function deadlineTone(iso, status, today = TODAY) {
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

// Find all nodes (across all products) assigned to a personId.
// Returns array of { node, productId, productName, parentName, depth }.
function findAssignmentsFor(personId, products) {
  const out = [];
  function walk(node, productRoot, parent, depth) {
    if ((node.assignees || []).includes(personId)) {
      out.push({ node, productId: productRoot.id, productName: productRoot.name, parentName: parent ? parent.name : null, depth });
    }
    (node.children || []).forEach(c => walk(c, productRoot, node, depth + 1));
  }
  products.forEach(p => walk(p, p, null, 0));
  return out;
}

// Stats for one person across all products
function personStats(personId, products) {
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

Object.assign(window, { DATA, PEOPLE, INDEX, STATUS_META, LEVEL_LABEL, aggregate, formatDeadline, deadlineTone, TODAY, findAssignmentsFor, personStats });
