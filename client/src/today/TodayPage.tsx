import { useEffect, useState } from 'react';
import type { AppointmentStatus, StaffRole } from '../../../server/src/enums.ts';
import { api } from '../shared/api.ts';
import { labels } from '../shared/labels.ts';
import { formatTime, todayIso } from '../shared/time.ts';
import type { Staff } from '../staff/types.ts';
import { BookVisitForm } from './BookVisitForm.tsx';
import type { BoardVisit } from './types.ts';

const TABS = {
  reception: { label: 'Reception', statuses: ['SCHEDULED', 'READY_FOR_CHECKOUT'] },
  nurse: { label: 'Nurse', statuses: ['CHECKED_IN'] },
  doctor: { label: 'Doctor', statuses: ['READY_FOR_DOCTOR'] },
  all: { label: 'All', statuses: null },
} satisfies Record<string, { label: string; statuses: AppointmentStatus[] | null }>;
type Tab = keyof typeof TABS;

const TAB_FOR_ROLE: Record<StaffRole, Tab> = { RECEPTIONIST: 'reception', NURSE: 'nurse', PHYSICIAN: 'doctor' };

const SCHEDULED_ACTIONS: { status: AppointmentStatus; label: string }[] = [
  { status: 'CHECKED_IN', label: 'Check in' },
  { status: 'CANCELLED', label: 'Cancel' },
  { status: 'NO_SHOW', label: 'No show' },
];

function inTab(tab: Tab, visit: BoardVisit) {
  const statuses: readonly AppointmentStatus[] | null = TABS[tab].statuses;
  return statuses === null || statuses.includes(visit.status);
}

type Props = { currentStaff: Staff | null; physicians: Staff[] };

export function TodayPage({ currentStaff, physicians }: Props) {
  const [date, setDate] = useState(todayIso);
  const [visits, setVisits] = useState<BoardVisit[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const role = currentStaff?.role;
  useEffect(() => setTab(role ? TAB_FOR_ROLE[role] : 'all'), [role]);

  useEffect(() => {
    let current = true;
    api<BoardVisit[]>(`/appointments?date=${date}`)
      .then((data) => {
        if (current) {
          setVisits(data);
          setError(null);
        }
      })
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [date, reload]);

  async function move(visit: BoardVisit, status: AppointmentStatus) {
    try {
      const updated = await api<BoardVisit>(`/appointments/${visit.id}/status`, { method: 'POST', body: { status } });
      setVisits((list) => list.map((v) => (v.id === updated.id ? updated : v)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function booked(visit: BoardVisit) {
    setBooking(false);
    setDate(visit.scheduled_at.slice(0, 10));
    setReload((n) => n + 1);
  }

  const shown = visits.filter((v) => inTab(tab, v));

  return (
    <>
      <div className="page-title">
        <h2>Today</h2>
        <div className="toolbar">
          <input type="date" aria-label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="primary" onClick={() => setBooking(true)}>Book visit</button>
        </div>
      </div>

      {booking && (
        <BookVisitForm physicians={physicians} date={date} onBooked={booked} onCancel={() => setBooking(false)} />
      )}

      <div className="tabs" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <button key={key} role="tab" aria-selected={key === tab} onClick={() => setTab(key)}>
            {TABS[key].label} ({visits.filter((v) => inTab(key, v)).length})
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time</th><th>Patient</th><th>Physician</th><th>Reason</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id}>
                <td>{formatTime(v.scheduled_at)}</td>
                <td>{v.patient.name}<div className="muted">{v.patient.phone}</div></td>
                <td>{v.physician.name}</td>
                <td>{v.reason}</td>
                <td><span className={`status status-${v.status.toLowerCase()}`}>{labels[v.status]}</span></td>
                <td className="row-actions">
                  {v.status === 'SCHEDULED' &&
                    SCHEDULED_ACTIONS.map((a) => (
                      <button key={a.status} onClick={() => move(v, a.status)} aria-label={`${a.label} ${v.patient.name}`}>
                        {a.label}
                      </button>
                    ))}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="empty">No visits here for {date}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
