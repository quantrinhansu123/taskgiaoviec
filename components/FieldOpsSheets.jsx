import { useState } from 'react';
import { Sheet } from '../components.jsx';
import { DateTimeFields } from './DateTimeFields.jsx';
import { getCurrentPosition, formatCoords } from '../lib/geolocation.js';
import { DEFAULT_RADIUS_M, RADIUS_PRESETS } from '../lib/siteLocation.js';
import { combineDeadlineLocal, splitDeadlineForInput, currentLocalDateTimeForInput } from '../lib/deadline.js';

export function SiteLocationSheet({ project, onClose, onSave }) {
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
      setErr(e.message || 'Không lấy được GPS');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setErr('');
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) {
      setErr('Nhập tọa độ GPS hợp lệ');
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
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Cài đặt vị trí công trình" onClose={onClose}>
      <div className="form-stack">
        <p className="field-note">
          Thiết lập tọa độ GPS và bán kính check-in cho «{project?.name}».
          Thợ sẽ tự động check-out khi ra khỏi bán kính.
        </p>

        <button type="button" className="btn btn-secondary btn-block" onClick={captureGps} disabled={loading}>
          {loading ? 'Đang lấy GPS…' : 'Lấy vị trí hiện tại'}
        </button>

        <div className="field">
          <label className="field-label" htmlFor="site-lat">Vĩ độ (lat)</label>
          <input id="site-lat" className="field-input" type="text" value={lat} onChange={(e) => setLat(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="site-lng">Kinh độ (lng)</label>
          <input id="site-lng" className="field-input" type="text" value={lng} onChange={(e) => setLng(e.target.value)} />
        </div>
        {lat && lng && (
          <p className="field-note">{formatCoords(Number(lat), Number(lng))}</p>
        )}

        <div className="field">
          <label className="field-label" htmlFor="site-radius">Bán kính check-in (mét)</label>
          <select
            id="site-radius"
            className="field-input"
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value))}
          >
            {RADIUS_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="site-address">Địa chỉ / ghi chú</label>
          <input
            id="site-address"
            className="field-input"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="VD: 123 Nguyễn Văn Linh, Q.7"
          />
        </div>

        {err && <p className="field-error">{err}</p>}

        <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu vị trí công trình'}
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
    if (!team.trim()) { setErr('Chọn đội thợ'); return; }
    if (!startDate) { setErr('Chọn ngày giờ bắt đầu'); return; }
    const startAt = combineDateTime(startDate, startTime, true);
    if (!startAt) { setErr('Ngày giờ bắt đầu không hợp lệ'); return; }
    const endAt = endDate
      ? combineDateTime(endDate, endTime || '17:00', false)
      : startAt;
    if (endAt && new Date(endAt) < new Date(startAt)) {
      setErr('Thời gian kết thúc phải sau thời gian bắt đầu');
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
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={schedule ? 'Sửa lịch đội' : 'Gán đội vào công trình'} onClose={onClose}>
      <div className="form-stack">
        <div className="field">
          <label className="field-label" htmlFor="ts-team">Đội thợ</label>
          <select id="ts-team" className="field-input" value={team} onChange={(e) => setTeam(e.target.value)}>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <DateTimeFields
          label="Ngày giờ bắt đầu"
          dateId="ts-start-date"
          timeId="ts-start-time"
          date={startDate}
          time={startTime}
          onDateChange={setStartDate}
          onTimeChange={setStartTime}
          note="Dùng để tính tiến độ và hiển thị trên Timeline."
          required
        />
        <div className="btn-row btn-row--tight">
          <button type="button" className="btn btn-secondary btn-sm" onClick={stampNowStart}>
            Bây giờ
          </button>
        </div>

        <DateTimeFields
          label="Ngày giờ kết thúc"
          dateId="ts-end-date"
          timeId="ts-end-time"
          date={endDate}
          time={endTime}
          onDateChange={setEndDate}
          onTimeChange={setEndTime}
          note="Để trống ngày kết thúc sẽ dùng cùng ngày bắt đầu."
        />

        <div className="field">
          <label className="field-label" htmlFor="ts-note">Ghi chú</label>
          <input id="ts-note" className="field-input" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {err && <p className="field-error">{err}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu lịch'}
        </button>
        {schedule && onDelete && (
          <button type="button" className="btn btn-danger btn-block" onClick={async () => { await onDelete(); onClose(); }}>
            Xóa lịch này
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function ProjectStartedAtSheet({ project, onClose, onSave }) {
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
      setErr(e.message || 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!date) {
      setErr('Chọn ngày giờ bắt đầu.');
      return;
    }
    const iso = combineDateTime(date, time, true);
    if (!iso) {
      setErr('Ngày giờ không hợp lệ.');
      return;
    }
    persist(iso);
  };

  return (
    <Sheet title="Ngày giờ bắt đầu công trình" onClose={onClose}>
      <div className="form-stack">
        <p className="field-note">
          Thời điểm bắt đầu thi công «{project?.name}». Hệ thống dùng cùng hạn hoàn thành để tính khoảng thời gian trên Timeline và báo cáo giờ.
        </p>
        <DateTimeFields
          label="Ngày giờ bắt đầu"
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
            Bây giờ
          </button>
        </div>
        {err && <p className="field-error">{err}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving || !date}>
          {saving ? 'Đang lưu…' : 'Lưu ngày giờ bắt đầu'}
        </button>
        {project?.startedAt && (
          <button type="button" className="btn btn-ghost-danger btn-block" onClick={() => persist(null)} disabled={saving}>
            Xóa ngày giờ bắt đầu
          </button>
        )}
      </div>
    </Sheet>
  );
}
