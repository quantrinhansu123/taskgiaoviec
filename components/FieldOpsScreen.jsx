import { useState } from 'react';
import { TeamScheduleView } from './TeamScheduleView.jsx';
import { PersonalScheduleView } from './PersonalScheduleView.jsx';
import { LaborReportView } from './LaborReportView.jsx';
import { isAdmin } from '../lib/permissions.js';

export function FieldOpsScreen({ products, people, accessRole, defaultTab = 'schedule', onOpenNode }) {
  const [tab, setTab] = useState(defaultTab);
  const showLabor = isAdmin(accessRole);

  return (
    <div className="field-ops-screen">
      <div className="field-ops-tabs">
        <button
          type="button"
          className={`filter-pill ${tab === 'schedule' ? 'active' : ''}`}
          onClick={() => setTab('schedule')}
        >
          Lịch đội
        </button>
        <button
          type="button"
          className={`filter-pill ${tab === 'personal' ? 'active' : ''}`}
          onClick={() => setTab('personal')}
        >
          Lịch cá nhân
        </button>
        {showLabor && (
          <button
            type="button"
            className={`filter-pill ${tab === 'labor' ? 'active' : ''}`}
            onClick={() => setTab('labor')}
          >
            Báo cáo giờ
          </button>
        )}
      </div>
      {tab === 'schedule' ? (
        <TeamScheduleView products={products} people={people} embedded />
      ) : tab === 'personal' ? (
        <PersonalScheduleView products={products} people={people} embedded onOpenNode={onOpenNode} />
      ) : (
        <LaborReportView products={products} people={people} accessRole={accessRole} embedded />
      )}
    </div>
  );
}
