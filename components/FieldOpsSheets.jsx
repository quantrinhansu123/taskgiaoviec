import { useState } from 'react';
import { Sheet } from '../components.jsx';
import { DateTimeFields } from './DateTimeFields.jsx';
import { getCurrentPosition, formatCoords } from '../lib/geolocation.js';
import { DEFAULT_RADIUS_M, radiusPresets } from '../lib/siteLocation.js';
import { combineDeadlineLocal, splitDeadlineForInput, currentLocalDateTimeForInput } from '../lib/deadline.js';
import { useI18n } from '../lib/i18n.jsx';

export function SiteLocationSheet({ project, onClose, onSave }) {
  const { t } = useI18n();
  const existing = project?.siteLocation;
  const [lat, setLat] = useState(existing?.lat?.toString() || '');
  const [lng, setLng] = useState(existing?.lng?.toString() || '');
  const [radiusM, setRadiusM] = useState(existing?.radiusM || DEFAULT_RADIUS_M);
  const [address, setAddress] = useState(existing?.address || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const captureGps = async () => {
    setErr('');
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      setLat(String(pos.lat));
      setLng(String(pos.lng));
    } catch (e) {
      setErr(e.message || t('errGpsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setErr('');
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) {
      setErr(t('errValidGps'));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        lat: latN,
        lng: lngN,
        radiusM: Number(radiusM) || DEFAULT_RADIUS_M,
        address: address.trim(),
      });
      onClose();
    } catch (e) {
      setErr(e.message || t('errSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={t('siteSheetTitle')} onClose={onClose}>
      <div className="form-stack">
        <p className="field-note">
          {t('siteSheetHint', { name: project?.name })}
        </p>

        <button type="button" className="btn btn-secondary btn-block" onClick={captureGps} disabled={loading}>
          {loading ? t('checkInGpsLoading') : t('useCurrentLocation')}
        </button>

        <div className="field">
          <label className="field-label" htmlFor="site-lat">{t('latLabel')}</label>
          <input id="site-lat" className="field-input" type="text" value={lat} onChange={(e) => setLat(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="site-lng">{t('lngLabel')}</label>
          <input id="site-lng" className="field-input" type="text" value={lng} onChange={(e) => setLng(e.target.value)} />
        </div>
        {lat && lng && (
          <p className="field-note">{formatCoords(Number(lat), Number(lng))}</p>
        )}

        <div className="field">
          <label className="field-label" htmlFor="site-radius">{t('radiusLabel')}</label>
          <select
            id="site-radius"
            className="field-input"
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value))}
          >
            {radiusPresets().map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="site-address">{t('addressNoteLabel')}</label>
          <input
            id="site-address"
            className="field-input"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('addressPlaceholder')}
          />
        </div>

        {err && <p className="field-error">{err}</p>}

        <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
          {saving ? t('workSaving') : t('saveSiteLocation')}
        </button>
      </div>
    </Sheet>
  );
}

function resolveTime(date, time, fallbackNow = false) {
  if (time) return time;
  if (!fallbackNow) return '';
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

function combineDateTime(date, time, fallbackNow = false) {
  if (!date) return null;
  return combineDeadlineLocal(date, resolveTime(date, time, fallbackNow));
}

export function TeamScheduleSheet({ project, teams = [], schedule, onClose, onSave, onDelete }) {
  const { t } = useI18n();
  const startInit = splitDeadlineForInput(schedule?.startAt || schedule?.startDate);
  const endInit = splitDeadlineForInput(schedule?.endAt || schedule?.endDate);

  const [team, setTeam] = useState(schedule?.team || teams[0] || '');
  const [startDate, setStartDate] = useState(startInit.date);
  const [startTime, setStartTime] = useState(startInit.time || '08:00');
  const [endDate, setEndDate] = useState(endInit.date);
  const [endTime, setEndTime] = useState(endInit.time || '17:00');
  const [note, setNote] = useState(schedule?.note || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const stampNowStart = () => {
    const s = currentLocalDateTimeForInput();
    setStartDate(s.date);
    setStartTime(s.time || resolveTime(s.date, '', true));
  };

  const handleSave = async () => {
    if (!team.trim()) { setErr(t('errPickTeam')); return; }
    if (!startDate) { setErr(t('errPickStart')); return; }
    const startAt = combineDateTime(startDate, startTime, true);
    if (!startAt) { setErr(t('errInvalidStart')); return; }
    const endAt = endDate
      ? combineDateTime(endDate, endTime || '17:00', false)
      : startAt;
    if (endAt && new Date(endAt) < new Date(startAt)) {
      setErr(t('errEndAfterStart'));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: schedule?.id,
        team: team.trim(),
        startAt,
        endAt: endAt || startAt,
        startDate: startDate.slice(0, 10),
        endDate: (endDate || startDate).slice(0, 10),
        note: note.trim(),
      });
      onClose();
    } catch (e) {
      setErr(e.message || t('errSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={schedule ? t('editTeamSchedule') : t('assignTeamToSite')} onClose={onClose}>
      <div className="form-stack">
        <div className="field">
          <label className="field-label" htmlFor="ts-team">{t('teamCrewLabel')}</label>
          <select id="ts-team" className="field-input" value={team} onChange={(e) => setTeam(e.target.value)}>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <DateTimeFields
          label={t('startDateTimeLabel')}
          dateId="ts-start-date"
          timeId="ts-start-time"
          date={startDate}
          time={startTime}
          onDateChange={setStartDate}
          onTimeChange={setStartTime}
          note={t('timelineNote')}
          required
        />
        <div className="btn-row btn-row--tight">
          <button type="button" className="btn btn-secondary btn-sm" onClick={stampNowStart}>
            {t('now')}
          </button>
        </div>

        <DateTimeFields
          label={t('endDateTimeLabel')}
          dateId="ts-end-date"
          timeId="ts-end-time"
          date={endDate}
          time={endTime}
          onDateChange={setEndDate}
          onTimeChange={setEndTime}
          note={t('endEmptyNote')}
        />

        <div className="field">
          <label className="field-label" htmlFor="ts-note">{t('workKindNote')}</label>
          <input id="ts-note" className="field-input" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {err && <p className="field-error">{err}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
          {saving ? t('workSaving') : t('saveSchedule')}
        </button>
        {schedule && onDelete && (
          <button type="button" className="btn btn-danger btn-block" onClick={async () => { await onDelete(); onClose(); }}>
            {t('deleteSchedule')}
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function ProjectStartedAtSheet({ project, onClose, onSave }) {
  const { t } = useI18n();
  const initial = splitDeadlineForInput(project?.startedAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time || '08:00');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const stampNow = () => {
    const s = currentLocalDateTimeForInput();
    setDate(s.date);
    setTime(s.time || resolveTime(s.date, '', true));
  };

  const persist = async (iso) => {
    setErr('');
    setSaving(true);
    try {
      await onSave(iso);
      onClose();
    } catch (e) {
      setErr(e.message || t('errSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!date) {
      setErr(t('errPickStartDot'));
      return;
    }
    const iso = combineDateTime(date, time, true);
    if (!iso) {
      setErr(t('errInvalidDateTimeShort'));
      return;
    }
    persist(iso);
  };

  return (
    <Sheet title={t('startSheetTitle')} onClose={onClose}>
      <div className="form-stack">
        <p className="field-note">
          {t('startSheetHint', { name: project?.name })}
        </p>
        <DateTimeFields
          label={t('startDateTimeLabel')}
          dateId="proj-start-date"
          timeId="proj-start-time"
          date={date}
          time={time}
          onDateChange={setDate}
          onTimeChange={setTime}
          required
        />
        <div className="btn-row btn-row--tight">
          <button type="button" className="btn btn-secondary btn-sm" onClick={stampNow}>
            {t('now')}
          </button>
        </div>
        {err && <p className="field-error">{err}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving || !date}>
          {saving ? t('workSaving') : t('saveStartAt')}
        </button>
        {project?.startedAt && (
          <button type="button" className="btn btn-ghost-danger btn-block" onClick={() => persist(null)} disabled={saving}>
            {t('deleteStartAt')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
