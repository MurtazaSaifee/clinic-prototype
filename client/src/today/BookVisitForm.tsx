import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { PatientPicker } from '../patients/PatientPicker.tsx';
import type { Patient } from '../patients/types.ts';
import { api, ApiError } from '../shared/api.ts';
import type { Staff } from '../staff/types.ts';
import type { BoardVisit } from './types.ts';

// 30-minute slots from 08:00; the last one starts at 16:30 and ends at 17:00.
const SLOTS = Array.from({ length: 18 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

type Props = { physicians: Staff[]; date: string; onBooked: (visit: BoardVisit) => void; onCancel: () => void };

export function BookVisitForm({ physicians, date: initialDate, onBooked, onCancel }: Props) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [physicianId, setPhysicianId] = useState('');
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const visit = await api<BoardVisit>('/appointments', {
        method: 'POST',
        body: {
          patient_id: patient?.id,
          physician_id: physicianId ? Number(physicianId) : undefined,
          scheduled_at: date && slot ? `${date}T${slot}:00Z` : undefined,
          reason,
        },
      });
      onBooked(visit);
    } catch (err) {
      const details = err instanceof ApiError ? err.details : {};
      setErrors(details);
      setFormError(Object.keys(details).length ? 'Check the highlighted fields.' : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function field(name: string, label: string, htmlFor: string, input: ReactNode) {
    return (
      <div className="field">
        <label htmlFor={htmlFor}>{label}</label>
        {input}
        {errors[name]?.map((message) => <p key={message} className="field-error">{message}</p>)}
      </div>
    );
  }

  const invalid = (name: string) => (errors[name] ? true : undefined);

  return (
    <form className="panel" aria-label="Book visit" onSubmit={submit} noValidate>
      <h3>Book visit</h3>
      {formError && <p className="error" role="alert">{formError}</p>}
      <div className="form-grid">
        {field('patient_id', 'Patient', 'patient', (
          <PatientPicker id="patient" selected={patient} onSelect={setPatient} invalid={!!errors.patient_id} />
        ))}
        {field('physician_id', 'Physician', 'physician', (
          <select id="physician" value={physicianId} aria-invalid={invalid('physician_id')} onChange={(e) => setPhysicianId(e.target.value)}>
            <option value="">Choose</option>
            {physicians.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ))}
        {field('date', 'Date', 'date', (
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        ))}
        {field('scheduled_at', 'Time', 'slot', (
          <select id="slot" value={slot} aria-invalid={invalid('scheduled_at')} onChange={(e) => setSlot(e.target.value)}>
            <option value="">Choose</option>
            {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ))}
        {field('reason', 'Reason', 'reason', (
          <input id="reason" value={reason} aria-invalid={invalid('reason')} onChange={(e) => setReason(e.target.value)} />
        ))}
      </div>
      <div className="actions">
        <button type="submit" className="primary" disabled={saving}>Book visit</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
