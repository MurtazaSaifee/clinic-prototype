import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../shared/api.ts';
import { describeError, Field } from '../shared/forms.tsx';
import type { FieldErrors } from '../shared/forms.tsx';
import type { Vitals, VisitDetail } from './types.ts';

const VITALS: { name: keyof Vitals; label: string; step: string }[] = [
  { name: 'height_cm', label: 'Height (cm)', step: '0.1' },
  { name: 'weight_kg', label: 'Weight (kg)', step: '0.1' },
  { name: 'bp_systolic', label: 'BP systolic (mmHg)', step: '1' },
  { name: 'bp_diastolic', label: 'BP diastolic (mmHg)', step: '1' },
  { name: 'heart_rate', label: 'Heart rate (bpm)', step: '1' },
];

type Props = { visit: VisitDetail; onSent: () => void };

export function IntakeSection({ visit, onSent }: Props) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(VITALS.map(({ name }) => [name, visit[name]?.toString() ?? ''])),
  );
  const [notes, setNotes] = useState(visit.nurse_notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function sendToDoctor(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const vitals = Object.fromEntries(VITALS.map(({ name }) => [name, values[name] === '' ? null : Number(values[name])]));
      await api(`/appointments/${visit.id}`, { method: 'PATCH', body: { ...vitals, nurse_notes: notes } });
      await api(`/appointments/${visit.id}/status`, { method: 'POST', body: { status: 'READY_FOR_DOCTOR' } });
      onSent();
    } catch (err) {
      const { fields, message } = describeError(err);
      setErrors(fields);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={sendToDoctor} noValidate aria-label="Nurse intake">
      {formError && <p className="error" role="alert">{formError}</p>}
      <div className="form-grid">
        {VITALS.map(({ name, label, step }) => (
          <Field key={name} label={label} htmlFor={name} errors={errors[name]}>
            <input
              id={name}
              type="number"
              step={step}
              value={values[name]}
              aria-invalid={errors[name] ? true : undefined}
              onChange={(e) => setValues({ ...values, [name]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <Field label="Nurse notes" htmlFor="nurse_notes" errors={errors.nurse_notes}>
        <textarea id="nurse_notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="actions">
        <button type="submit" className="primary" disabled={saving}>Send to doctor</button>
      </div>
    </form>
  );
}
