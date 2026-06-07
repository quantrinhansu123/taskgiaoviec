import './globals.css';

export const metadata = {
  title: 'Check Lỗi Việc — Quản lý task 4 cấp',
  description: 'App quản lý + check lỗi việc 4 cấp Sản phẩm / Hạng mục / Công việc / Chi tiết',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
