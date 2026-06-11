import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { APP_LOGO, APP_NAME } from '../lib/brand.js';
import { useI18n } from '../lib/i18n.jsx';
import { parseAppPath, pathForTab, swapLayoutPath } from '../lib/routes.js';

const NAV_ICONS = {
  products: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  ),
  subtasks: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M7 6h14M7 12h14M7 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  schedule: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  attendance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M8 8h8M8 12h4M8 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  people: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="17" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 19a6 6 0 0112 0M14 18a5 5 0 017 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  me: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4.5 20a7.5 7.5 0 0115 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
};

export function DesktopShell({ children, alertCount = 0, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { tab } = parseAppPath(location.pathname);
  const mobileHref = swapLayoutPath(location.pathname, 'mobile');
  const { t } = useI18n();

  const nav = useMemo(() => [
    { id: 'products', label: t('navProducts'), icon: NAV_ICONS.products },
    { id: 'subtasks', label: t('navSubtasks'), icon: NAV_ICONS.subtasks },
    { id: 'schedule', label: t('navSchedule'), icon: NAV_ICONS.schedule },
    { id: 'attendance', label: t('navAttendance'), icon: NAV_ICONS.attendance },
    { id: 'people', label: t('navPeople'), icon: NAV_ICONS.people },
    { id: 'me', label: t('navMe'), icon: NAV_ICONS.me, badge: alertCount },
    { id: 'settings', label: t('navSettings'), icon: NAV_ICONS.settings },
  ], [t, alertCount]);

  useEffect(() => {
    document.documentElement.classList.add('layout-desktop');
    return () => document.documentElement.classList.remove('layout-desktop');
  }, []);

  return (
    <div className="desktop-shell">
      <aside className="desktop-sidebar">
        <div className="desktop-brand">
          <img src={APP_LOGO} alt={APP_NAME} className="desktop-brand-logo" />
          <div>
            <div className="desktop-brand-title">{APP_NAME}</div>
            <div className="desktop-brand-sub">{t('appTaglineDesktop')}</div>
          </div>
        </div>

        <nav className="desktop-nav">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`desktop-nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => navigate(pathForTab(item.id, 'desktop'))}
            >
              <span className="desktop-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'me' && item.badge > 0 && (
                <span className="desktop-nav-badge">{item.badge}</span>
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
            {t('layoutSwitchMobile')}
          </Link>
          {typeof onLogout === 'function' && (
            <button type="button" className="desktop-layout-switch desktop-logout-btn" onClick={onLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M10 6H6a2 2 0 00-2 2v8a2 2 0 002 2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M14 8l4 4-4 4M18 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Đăng xuất
            </button>
          )}
        </div>
      </aside>

      <main className="desktop-main">{children}</main>
    </div>
  );
}
