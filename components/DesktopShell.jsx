import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { parseAppPath, pathForTab, swapLayoutPath } from '../lib/routes.js';

const NAV = [
  {
    id: 'products',
    label: 'Sản phẩm',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    id: 'subtasks',
    label: 'Sub-task',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M7 6h14M7 12h14M7 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'schedule',
    label: 'Lịch đội',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'attendance',
    label: 'Chấm công',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 8h8M8 12h4M8 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'people',
    label: 'Nhân sự',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/>
        <circle cx="17" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M3 19a6 6 0 0112 0M14 18a5 5 0 017 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'me',
    label: 'Tôi',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M4.5 20a7.5 7.5 0 0115 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export function DesktopShell({ children, alertCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { tab } = parseAppPath(location.pathname);
  const mobileHref = swapLayoutPath(location.pathname, 'mobile');

  useEffect(() => {
    document.documentElement.classList.add('layout-desktop');
    return () => document.documentElement.classList.remove('layout-desktop');
  }, []);

  return (
    <div className="desktop-shell">
      <aside className="desktop-sidebar">
        <div className="desktop-brand">
          <span className="desktop-brand-mark">CL</span>
          <div>
            <div className="desktop-brand-title">Check Lỗi Việc</div>
            <div className="desktop-brand-sub">Giao diện máy tính</div>
          </div>
        </div>

        <nav className="desktop-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`desktop-nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => navigate(pathForTab(item.id, 'desktop'))}
            >
              <span className="desktop-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'me' && alertCount > 0 && (
                <span className="desktop-nav-badge">{alertCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="desktop-sidebar-foot">
          <Link to={mobileHref} className="desktop-layout-switch">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Giao diện điện thoại
          </Link>
        </div>
      </aside>

      <main className="desktop-main">{children}</main>
    </div>
  );
}
