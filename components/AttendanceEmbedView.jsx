const ATTENDANCE_URL = 'https://chamcong-psi.vercel.app/';

export function AttendanceEmbedView() {
  return (
    <div className="screen has-nav attendance-embed-screen">
      <div className="attendance-embed-head">
        <div>
          <h1 className="screen-title">Chấm công</h1>
          <p className="screen-sub">Chamcong PSI</p>
        </div>
        <a
          className="attendance-embed-open"
          href={ATTENDANCE_URL}
          target="_blank"
          rel="noreferrer"
        >
          Mở cửa sổ mới
        </a>
      </div>
      <div className="attendance-embed-frame-wrap">
        <iframe
          className="attendance-embed-frame"
          title="Chamcong PSI"
          src={ATTENDANCE_URL}
          allow="camera; microphone; geolocation; clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
