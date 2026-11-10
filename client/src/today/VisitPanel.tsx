import { useEffect, useState } from 'react';
import type { AppointmentStatus } from '../../../server/src/enums.ts';
import { api } from '../shared/api.ts';
import { labels } from '../shared/labels.ts';
import { formatTime } from '../shared/time.ts';
import type { Staff } from '../staff/types.ts';
import { IntakeSection } from './IntakeSection.tsx';
import { TaskList } from './TaskList.tsx';
import type { CheckoutTask, VisitDetail } from './types.ts';
import { Diagnoses, Notes, Vitals } from './VisitSummary.tsx';

type Props = { visitId: number; currentStaff: Staff | null; onChanged: () => void; onClose: () => void };

export function VisitPanel({ visitId, currentStaff, onChanged, onClose }: Props) {
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api<VisitDetail>(`/appointments/${visitId}`)
      .then((data) => {
        if (current) {
          setVisit(data);
          setDoctorNotes(data.doctor_notes ?? '');
        }
      })
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [visitId]);

  if (!visit) return <section className="panel">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</section>;

  // Tasks change the board's open-task count, so the board reloads alongside.
  function setTasks(checkout_tasks: CheckoutTask[]) {
    setVisit((v) => v && { ...v, checkout_tasks });
    onChanged();
  }

  async function move(status: AppointmentStatus, changes?: object) {
    try {
      if (changes) await api(`/appointments/${visitId}`, { method: 'PATCH', body: changes });
      await api(`/appointments/${visitId}/status`, { method: 'POST', body: { status } });
      done();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function done() {
    onChanged();
    onClose();
  }

  const openTasks = visit.checkout_tasks.filter((t) => t.completed_at === null).length;

  return (
    <section className="panel visit-panel" aria-label={`Visit for ${visit.patient.name}`}>
      <div className="panel-head">
        <div>
          <h3>{visit.patient.name}</h3>
          <p className="muted">
            {formatTime(visit.scheduled_at)} with {visit.physician.name} · born {visit.patient.date_of_birth} · {visit.patient.phone}
          </p>
        </div>
        <span className={`status status-${visit.status.toLowerCase()}`}>{labels[visit.status]}</span>
        <button onClick={onClose} aria-label="Close visit">Close</button>
      </div>
      <p className="reason"><strong>Reason:</strong> {visit.reason}</p>
      {error && <p className="error" role="alert">{error}</p>}

      {visit.status === 'CHECKED_IN' && <IntakeSection visit={visit} onSent={done} />}

      {visit.status === 'READY_FOR_DOCTOR' && (
        <>
          <Vitals visit={visit} />
          <Notes title="Nurse notes" text={visit.nurse_notes} />
          <Diagnoses visit={visit} />
          <section>
            <h4><label htmlFor="doctor_notes">Doctor notes</label></h4>
            <textarea id="doctor_notes" rows={4} value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)} />
          </section>
          <TaskList visitId={visit.id} tasks={visit.checkout_tasks} onChange={setTasks} canAdd />
          <div className="actions">
            <button className="primary" onClick={() => move('READY_FOR_CHECKOUT', { doctor_notes: doctorNotes })}>
              Send to checkout
            </button>
          </div>
        </>
      )}

      {visit.status === 'READY_FOR_CHECKOUT' && (
        <>
          <TaskList
            visitId={visit.id}
            tasks={visit.checkout_tasks}
            onChange={setTasks}
            canTick
            tickDisabledReason={currentStaff ? undefined : 'Choose who you are under "Signed in as" to tick tasks off.'}
          />
          <div className="actions">
            <button className="primary" disabled={openTasks > 0} onClick={() => move('CHECKED_OUT')}>Check out</button>
            {openTasks > 0 && <span className="muted">{openTasks} {openTasks === 1 ? 'task' : 'tasks'} still open</span>}
          </div>
        </>
      )}

      {!['CHECKED_IN', 'READY_FOR_DOCTOR', 'READY_FOR_CHECKOUT'].includes(visit.status) && (
        <>
          <Vitals visit={visit} />
          <Notes title="Nurse notes" text={visit.nurse_notes} />
          <Notes title="Doctor notes" text={visit.doctor_notes} />
          {visit.checkout_tasks.length > 0 && <TaskList visitId={visit.id} tasks={visit.checkout_tasks} onChange={setTasks} />}
        </>
      )}
    </section>
  );
}
