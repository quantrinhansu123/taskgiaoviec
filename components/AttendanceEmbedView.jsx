import { useMemo } from 'react';
import { useI18n } from '../lib/i18n.jsx';

const ATTENDANCE_URL = 'https://chamcong-psi.vercel.app/';

function buildAttendanceUrl(person, currentUserId) {
  if (!person && !currentUserId) return ATTENDANCE_URL;

  const url = new URL(ATTENDANCE_URL);
  const employeeName = person?.name || person?.email || '';
  const userId = person?.id || currentUserId || '';
  const phone = String(person?.phone || '').trim();

  if (employeeName) url.searchParams.set('name', employeeName);
  if (userId) url.searchParams.set('userId', userId);
  if (phone) url.searchParams.set('phone', phone);

  return url.toString();
}

export function AttendanceEmbedView({ person = null, currentUserId = null }) {
  const { t } = useI18n();
  const attendanceUrl = useMemo(
    () => buildAttendanceUrl(person, currentUserId),
    [person, currentUserId],
  );

  return (
    <div className="screen has-nav attendance-embed-screen">
      <div className="attendance-embed-head">
        <h1 className="screen-title">{t('attendanceTitle')}</h1>
        <p className="screen-sub">{t('attendanceSub')}</p>
      </div>
      <div className="attendance-embed-frame-wrap">
        <iframe
          className="attendance-embed-frame"
          title="Chamcong PSI"
          src={attendanceUrl}
          allow="camera; microphone; geolocation; clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
