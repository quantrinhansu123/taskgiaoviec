import { useNavigate } from 'react-router-dom';
import { APP_LOGO, APP_NAME } from '../lib/brand.js';
import { useI18n } from '../lib/i18n.jsx';
import { pathForTab, swapLayoutPath } from '../lib/routes.js';
import { useEffectiveLayout } from '../lib/useEffectiveLayout.js';
import { Icon } from '../components.jsx';

export function SettingsView({ onBack, onLogout, layout = 'mobile' }) {
  const { locale, setLocale, t, locales } = useI18n();
  const navigate = useNavigate();
  const { effectiveLayout, urlLayout } = useEffectiveLayout(window.location.pathname);
  const desktopHref = swapLayoutPath(window.location.pathname, 'desktop');
  const mobileHref = swapLayoutPath(window.location.pathname, 'mobile');

  return (
    <div className="screen has-nav settings-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back')}>
          <Icon.back />
        </button>
        <div className="title-wrap">
          <div className="crumb">{APP_NAME}</div>
          <div className="title">{t('settingsTitle')}</div>
        </div>
      </div>

      <div className="scroll settings-scroll">
        <div className="settings-hero">
          <img src={APP_LOGO} alt={APP_NAME} className="settings-logo" />
          <h1>{APP_NAME}</h1>
          <p>{t('appTagline')}</p>
        </div>

        <section className="settings-section">
          <h2 className="settings-section-title">{t('settingsLanguage')}</h2>
          <p className="settings-section-hint">{t('settingsLanguageHint')}</p>
          <div className="settings-lang-list" role="radiogroup" aria-label={t('settingsLanguage')}>
            {Object.values(locales).map((item) => {
              const label = locale === 'en' ? item.labelEn : item.label;
              const active = locale === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`settings-lang-option ${active ? 'active' : ''}`}
                  onClick={() => setLocale(item.id)}
                >
                  <span className="settings-lang-label">{label}</span>
                  {active && <Icon.check />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{t('settingsLayout')}</h2>
          <div className="settings-action-list">
            {effectiveLayout === 'mobile' && (
              <button
                type="button"
                className="settings-action-btn"
                onClick={() => navigate(desktopHref)}
              >
                {t('settingsOpenDesktop')}
              </button>
            )}
            {effectiveLayout === 'desktop' && urlLayout === 'desktop' && (
              <button
                type="button"
                className="settings-action-btn"
                onClick={() => navigate(mobileHref)}
              >
                {t('settingsOpenMobile')}
              </button>
            )}
            <button
              type="button"
              className="settings-action-btn"
              onClick={() => navigate(pathForTab('me', layout))}
            >
              {t('navMe')}
            </button>
          </div>
        </section>

        <section className="settings-section settings-section--muted">
          <h2 className="settings-section-title">{t('settingsAbout')}</h2>
          <div className="settings-about-row">
            <span>{t('settingsVersion')}</span>
            <span>1.0</span>
          </div>
        </section>

        {typeof onLogout === 'function' && (
          <section className="settings-section">
            <div className="settings-action-list">
              <button
                type="button"
                className="settings-action-btn settings-action-btn--danger"
                onClick={onLogout}
              >
                Đăng xuất
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
