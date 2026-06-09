import { useMemo } from 'react';
import { buildJobLaborReport, formatHours } from '../lib/laborReport.js';
import { formatDurationMinutes } from '../lib/workActions.js';
import { isAdmin } from '../lib/permissions.js';
import { useI18n } from '../lib/i18n.jsx';

export function LaborReportView({ products, people, accessRole, embedded = false }) {
  const { t } = useI18n();
  const report = useMemo(
    () => buildJobLaborReport(products, people),
    [products, people],
  );

  const grandTotal = report.reduce((s, r) => s + r.totalMinutes, 0);

  if (!isAdmin(accessRole)) {
    return (
      <div className="screen has-nav">
        <div className="screen-head">
          <h1 className="screen-title">{t('laborReportTitle')}</h1>
        </div>
        <p className="field-note" style={{ padding: '16px 20px' }}>
          {t('laborAdminOnly')}
        </p>
      </div>
    );
  }

  return (
    <div className={`screen has-nav labor-report-screen ${embedded ? 'screen--embedded' : ''}`}>
      {!embedded && (
        <div className="screen-head">
          <h1 className="screen-title">{t('laborReportJobTitle')}</h1>
          <p className="screen-sub">
            {t('laborSub', { hours: formatHours(grandTotal / 60), count: report.length })}
          </p>
        </div>
      )}

      <div className="labor-report-list">
        {report.length === 0 ? (
          <p className="field-note empty-state">{t('laborEmpty')}</p>
        ) : report.map((row) => (
          <div key={row.projectId} className="labor-report-card">
            <div className="labor-report-head">
              <div>
                <div className="labor-report-name">{row.projectName}</div>
                {row.customerName && (
                  <div className="labor-report-customer">{row.customerName}</div>
                )}
              </div>
              <div className="labor-report-total">
                <strong>{formatHours(row.totalHours)}</strong>
                <span>{row.sessionCount} ca GPS</span>
              </div>
            </div>
            <div className="labor-report-breakdown">
              <span>GPS: {formatDurationMinutes(row.attendanceMinutes)}</span>
              <span>Checklist: {formatDurationMinutes(row.workActionMinutes)}</span>
            </div>
            {row.byPerson.length > 0 && (
              <div className="labor-report-people">
                {row.byPerson.map((p) => (
                  <div key={p.userId} className="labor-person-row">
                    <span>{p.name}</span>
                    <span>{formatHours(p.totalHours)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
