import { useMemo } from 'react';
import { useI18n } from '../lib/i18n.jsx';

const ATTENDANCE_URL = 'https://chamcong-psi.vercel.app/';

function buildAttendanceUrl(person, currentUserId) {
  if (!person && !currentUserId) return ATTENDANCE_URL;

  const url = new URL(ATTENDANCE_URL);
  const employeeName = person?.name || person?.email || currentUserId;

  if (employeeName) url.searchParams.set('name', employeeName);

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
        <div>
          <h1 className="screen-title">{t('attendanceTitle')}</h1>
          <p className="screen-sub">{t('attendanceSub')}</p>
        </div>
        <a
          className="attendance-embed-open"
          href={attendanceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {t('attendanceOpenNew')}
        </a>
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
