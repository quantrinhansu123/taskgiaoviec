import { useEffect, useRef, useState } from 'react';
import { getCurrentPosition, watchPosition, isWithinRadius } from '../lib/geolocation.js';
import {
  checkinSession,
  formatAttendanceRange,
  sessionDurationMinutes,
} from '../lib/attendance.js';
import { findPendingCheckInProjects } from '../lib/assignedCheckIn.js';
import { formatDurationMinutes } from '../lib/workActions.js';
import { useI18n } from '../lib/i18n.jsx';

function CheckInRow({
  entry,
  currentUserId,
  team,
  loadingId,
  onCheckIn,
  onCheckOut,
  onOpenProject,
}) {
  const { t } = useI18n();
  const { project, activeSession, assignedLabels } = entry;
  const site = project.siteLocation;
  const [err, setErr] = useState('');
  const [livePos, setLivePos] = useState(null);
  const [outsideCount, setOutsideCount] = useState(0);
  const watchRef = useRef(null);
  const busy = loadingId === project.id;

  const inRange = site && livePos
    ? isWithinRadius(livePos.lat, livePos.lng, site.lat, site.lng, site.radiusM)
    : null;

  useEffect(() => {
    if (!activeSession?.id) {
      if (watchRef.current) watchRef.current();
      watchRef.current = null;
      setOutsideCount(0);
      return undefined;
    }

    if (!site) return undefined;

    watchRef.current = watchPosition(
      (pos) => {
        setLivePos(pos);
        const inside = isWithinRadius(pos.lat, pos.lng, site.lat, site.lng, site.radiusM);
        if (!inside) {
          setOutsideCount((c) => {
            const next = c + 1;
            if (next >= 2 && onCheckOut) {
              onCheckOut(project, activeSession, pos, true);
            }
            return next;
          });
        } else {
          setOutsideCount(0);
        }
      },
      () => {},
    );

    return () => {
      if (watchRef.current) watchRef.current();
    };
  }, [activeSession?.id, site?.lat, site?.lng, site?.radiusM, project, onCheckOut]);

  const handleCheckIn = async () => {
    if (!currentUserId || !onCheckIn) return;
    setErr('');
    try {
      const pos = await getCurrentPosition();
      setLivePos(pos);
      if (site && !isWithinRadius(pos.lat, pos.lng, site.lat, site.lng, site.radiusM)) {
        throw new Error(t('checkInOutsideRadius', { radius: site.radiusM }));
      }
      const session = checkinSession({ userId: currentUserId, team, lat: pos.lat, lng: pos.lng });
      await onCheckIn(project, session);
    } catch (e) {
      setErr(e.message || t('checkInFailed'));
    }
  };

  const handleCheckOut = async (auto = false) => {
    if (!activeSession || !onCheckOut) return;
    setErr('');
    try {
      let pos = livePos;
      if (!pos) {
        try { pos = await getCurrentPosition(); } catch { /* optional */ }
      }
      await onCheckOut(project, activeSession, pos, auto);
    } catch (e) {
      setErr(e.message || t('checkOutFailed'));
    }
  };

  const title = [project.customerName, project.name].filter(Boolean).join(' · ');
  const taskHint = assignedLabels.length > 0
    ? assignedLabels.slice(0, 3).join(', ') + (assignedLabels.length > 3 ? '…' : '')
    : t('checkInAssignedProject');

  return (
    <div className={`assigned-checkin-row ${activeSession ? 'assigned-checkin-row--active' : ''}`}>
      <button type="button" className="assigned-checkin-main" onClick={() => onOpenProject?.(project)}>
        <span className="assigned-checkin-title">{title}</span>
        <span className="assigned-checkin-tasks">{taskHint}</span>
        {activeSession && (
          <span className="assigned-checkin-meta">
            {formatAttendanceRange(activeSession)}
            {' · '}
            {formatDurationMinutes(sessionDurationMinutes(activeSession))}
          </span>
        )}
      </button>
      <div className="assigned-checkin-actions">
        {!site ? (
          <span className="assigned-checkin-note">{t('checkInNoGps')}</span>
        ) : activeSession ? (
          <>
            {outsideCount > 0 && (
              <span className="assigned-checkin-note warn">{t('checkInAutoCheckoutSoon')}</span>
            )}
            {inRange === false && outsideCount === 0 && (
              <span className="assigned-checkin-note warn">{t('checkInOutsideSite')}</span>
            )}
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={busy}
              onClick={() => handleCheckOut(false)}
            >
              {busy ? t('checkInGpsLoading') : t('checkOut')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !currentUserId}
            onClick={handleCheckIn}
          >
            {busy ? t('checkInGpsLoading') : t('checkIn')}
          </button>
        )}
      </div>
      {err && <p className="field-error assigned-checkin-error">{err}</p>}
    </div>
  );
}

export function AssignedCheckInQueue({
  products,
  currentUserId,
  people = [],
  onCheckIn,
  onCheckOut,
  onOpenProject,
}) {
  const { t } = useI18n();
  const [loadingId, setLoadingId] = useState(null);
  const person = people.find((p) => p.id === currentUserId);
  const team = person?.dept || '';

  const items = findPendingCheckInProjects(currentUserId, products);

  const wrapCheckIn = async (project, session) => {
    setLoadingId(project.id);
    try {
      await onCheckIn?.(project, session);
    } finally {
      setLoadingId(null);
    }
  };

  const wrapCheckOut = async (project, session, pos, auto) => {
    setLoadingId(project.id);
    try {
      await onCheckOut?.(project, session, pos, auto);
    } finally {
      setLoadingId(null);
    }
  };

  if (!currentUserId || items.length === 0) return null;

  return (
    <section className="assigned-checkin-queue" aria-label={t('checkInQueueTitle')}>
      <div className="assigned-checkin-head">
        <h2>{t('checkInQueueTitle')}</h2>
        <p>{t('checkInQueueSub')}</p>
      </div>
      <div className="assigned-checkin-list">
        {items.map((entry) => (
          <CheckInRow
            key={entry.project.id}
            entry={entry}
            currentUserId={currentUserId}
            team={team}
            loadingId={loadingId}
            onCheckIn={wrapCheckIn}
            onCheckOut={wrapCheckOut}
            onOpenProject={onOpenProject}
          />
        ))}
      </div>
    </section>
  );
}
