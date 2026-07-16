import { Link, useLocation } from 'react-router-dom';
import { ROUTE_LABELS } from './routes.js';
import { useI18n } from './i18n.jsx';

/** Bảng đường dẫn — hiển thị trong panel Tweaks (dev) */
export function RouteLinks() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="route-links">
      <div className="route-links-current">
        <span className="route-links-lbl">{t('routeCurrentUrl')}</span>
        <code className="route-links-url">{origin}{pathname}</code>
      </div>
      <span className="route-links-lbl" style={{ marginTop: 10 }}>{t('routeViews')}</span>
      <ul className="route-links-list">
        {ROUTE_LABELS.map(({ path, label }) => (
          <li key={path}>
            <Link to={path} className="route-links-item">
              <span className="route-links-name">{label}</span>
              <code>{path}</code>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
