import { useEffect, useRef, useState } from 'react';
import {
  getCurrentPosition,
  watchPosition,
  isWithinRadius,
  formatCoords,
} from '../lib/geolocation.js';
import {
  activeSessionForUser,
  checkinSession,
  checkoutSession,
  formatAttendanceRange,
  sessionDurationMinutes,
} from '../lib/attendance.js';
import { formatDurationMinutes } from '../lib/workActions.js';
import { isAdmin } from '../lib/permissions.js';

export function AttendancePanel({
  project,
  currentUserId,
  people = [],
  accessRole,
  onCheckIn,
  onCheckOut,
  onOpenSiteSettings,
}) {
  const site = project?.siteLocation;
  const sessions = project?.attendanceSessions || [];
  const active = currentUserId ? activeSessionForUser(sessions, currentUserId) : null;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [livePos, setLivePos] = useState(null);
  const [outsideCount, setOutsideCount] = useState(0);
  const watchRef = useRef(null);

  const person = people.find((p) => p.id === currentUserId);
  const team = person?.dept || '';

  const inRange = site && livePos
    ? isWithinRadius(livePos.lat, livePos.lng, site.lat, site.lng, site.radiusM)
    : null;

  useEffect(() => {
    if (!active || !site) {
      if (watchRef.current) watchRef.current();
      watchRef.current = null;
      setOutsideCount(0);
      return undefined;
    }

    watchRef.current = watchPosition(
      (pos) => {
        setLivePos(pos);
        const inside = isWithinRadius(pos.lat, pos.lng, site.lat, site.lng, site.radiusM);
        if (!inside) {
          setOutsideCount((c) => {
            const next = c + 1;
            if (next >= 2 && onCheckOut) {
              onCheckOut(active, pos, true);
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
  }, [active?.id, site?.lat, site?.lng, site?.radiusM]);

  const handleCheckIn = async () => {
    if (!currentUserId || !onCheckIn) return;
    setErr('');
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      setLivePos(pos);
      if (site && !isWithinRadius(pos.lat, pos.lng, site.lat, site.lng, site.radiusM)) {
        throw new Error(`Bạn đang ngoài bán kính công trình (${site.radiusM}m)`);
      }
      const session = checkinSession({ userId: currentUserId, team, lat: pos.lat, lng: pos.lng });
      await onCheckIn(session);
    } catch (e) {
      setErr(e.message || 'Không check-in được');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (auto = false) => {
    if (!active || !onCheckOut) return;
    setErr('');
    setLoading(true);
    try {
      let pos = livePos;
      if (!pos) {
        try { pos = await getCurrentPosition(); } catch { /* optional */ }
      }
      await onCheckOut(active, pos, auto);
    } catch (e) {
      setErr(e.message || 'Không check-out được');
    } finally {
      setLoading(false);
    }
  };

  const recentSessions = [...sessions]
    .filter((s) => s.checkOutAt)
    .sort((a, b) => new Date(b.checkInAt) - new Date(a.checkInAt))
    .slice(0, 5);

  return (
    <div className="field-ops-section">
      <div className="section-head">
        <h3>Chấm công GPS</h3>
        {isAdmin(accessRole) && typeof onOpenSiteSettings === 'function' && (
          <button type="button" className="section-action" onClick={onOpenSiteSettings}>
            Cài đặt vị trí
          </button>
        )}
      </div>

      {!site ? (
        <p className="field-note">
          {isAdmin(accessRole)
            ? 'Chưa cài đặt vị trí công trình. Nhấn «Cài đặt vị trí» để thiết lập GPS và bán kính.'
            : 'Công trình chưa có vị trí GPS. Liên hệ Admin để cài đặt.'}
        </p>
      ) : (
        <div className="site-location-info">
          <span className="chip">Bán kính {site.radiusM}m</span>
          {site.address && <span className="site-address">{site.address}</span>}
          {livePos && (
            <span className={`gps-status ${inRange === false ? 'out' : inRange ? 'in' : ''}`}>
              {inRange === false ? 'Ngoài công trình' : inRange ? 'Trong công trình' : 'Đang định vị…'}
            </span>
          )}
        </div>
      )}

      {active ? (
        <div className="attendance-active">
          <div className="attendance-active-label">Đang làm việc tại công trình</div>
          <div className="attendance-active-time">{formatAttendanceRange(active)}</div>
          <div className="attendance-active-duration">
            {formatDurationMinutes(sessionDurationMinutes(active))}
          </div>
          {outsideCount > 0 && (
            <p className="field-note warn">Đã ra khỏi bán kính — sẽ tự động check-out…</p>
          )}
          <button
            type="button"
            className="btn btn-danger btn-block"
            disabled={loading}
            onClick={() => handleCheckOut(false)}
          >
            Check-out
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={loading || !site || !currentUserId}
          onClick={handleCheckIn}
        >
          {loading ? 'Đang xác định GPS…' : 'Check-in GPS'}
        </button>
      )}

      {err && <p className="field-error">{err}</p>}

      {recentSessions.length > 0 && (
        <div className="attendance-history">
          <div className="attendance-history-title">Ca gần đây</div>
          {recentSessions.map((s) => {
            const who = people.find((p) => p.id === s.userId)?.name || '—';
            return (
              <div key={s.id} className="attendance-history-row">
                <span className="attendance-who">{who}</span>
                <span className="attendance-when">{formatAttendanceRange(s)}</span>
                <span className="attendance-mins">{formatDurationMinutes(sessionDurationMinutes(s))}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
