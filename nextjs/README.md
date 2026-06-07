# Check Lỗi Việc — Next.js

App quản lý + check lỗi việc 4 cấp **Sản phẩm → Hạng mục → Công việc → Chi tiết**, port từ prototype HTML sang Next.js (App Router).

## Tính năng

- Drill-down 4 cấp với thẻ gọn (tap để mở chi tiết)
- Mỗi mục có: deadline, nhiều nhân sự, nhiều ảnh + ghi chú từng ảnh, ghi chú chung
- View Nhân sự — danh sách thành viên, tap vào xem việc đang phụ trách
- Bottom tab nav: Sản phẩm / Nhân sự / Tôi
- Tối ưu mobile (render trong khung iPhone giả lập)

## Chạy local

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Cấu trúc

```
app/
  layout.js          Root layout + font Google
  page.js            Entry (client component)
  globals.css        Design tokens + components CSS
components/
  App.js             State + routing giữa các view
  IOSFrame.js        Khung điện thoại
  Icon.js            Inline SVG icons
  primitives.js      Avatars, Chips, ProgressBar, ItemCard, Sheet, ...
  ProductsHome.js
  NodeDetail.js
  PeopleHome.js
  PersonDetail.js
  BottomNav.js
lib/
  data.js            Mock data (sản phẩm, nhân sự)
  helpers.js         aggregate, deadlineTone, formatDeadline, ...
```

## Build production

```bash
npm run build
npm start
```

## Ghi chú

- Toàn bộ UI client-side (`'use client'` ở `app/page.js`) — chưa có backend.
- State đang lưu in-memory, refresh là mất. Nếu cần persist, thêm Zustand/Redux + API routes.
- Bộ font: Plus Jakarta Sans (display) + Inter (body) qua `next/font/google`.
