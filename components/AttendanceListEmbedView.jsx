import { useMemo } from 'react';
import { useI18n } from '../lib/i18n.jsx';
import { isAdmin } from '../lib/permissions.js';

const BANG_CONG_URL = import.meta.env.VITE_BANG_CONG_URL || 'http://localhost:3010/bang-cong';

function buildBangCongUrl(person, currentUserId, accessRole) {
  const url = new URL(BANG_CONG_URL);
  const employeeName = person?.name || person?.email || '';
  const userId = person?.id || currentUserId || '';
  const phone = String(person?.phone || '').trim();
  const admin = isAdmin(accessRole);

  if (employeeName) url.searchParams.set('name', employeeName);
  if (userId) url.searchParams.set('userId', userId);
  if (phone) url.searchParams.set('phone', phone);

  if (admin) {
    url.searchParams.set('scope', 'all');
    url.searchParams.set('admin', '1');
  } else {
    url.searchParams.set('scope', 'self');
  }

  return url.toString();
}

export function AttendanceListEmbedView({
  person = null,
  currentUserId = null,
  accessRole = 'worker',
}) {
  const { t } = useI18n();
  const listUrl = useMemo(
    () => buildBangCongUrl(person, currentUserId, accessRole),
    [person, currentUserId, accessRole],
  );

  return (
    <div className="screen has-nav attendance-embed-screen">
      <div className="attendance-embed-head">
        <h1 className="screen-title">{t('attendanceListTitle')}</h1>
        <p className="screen-sub">
          {isAdmin(accessRole) ? t('attendanceListSubAdmin') : t('attendanceListSubSelf')}
        </p>
      </div>
      <div className="attendance-embed-frame-wrap">
        <iframe
          className="attendance-embed-frame"
          title={t('attendanceListTitle')}
          src={listUrl}
          allow="camera; microphone; geolocation; clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
