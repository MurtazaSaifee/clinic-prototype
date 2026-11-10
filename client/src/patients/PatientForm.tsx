import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, ApiError } from '../shared/api.ts';
import { labels } from '../shared/labels.ts';
import type { Patient } from './types.ts';

type Props = { patient?: Patient; onSaved: (patient: Patient) => void; onCancel: () => void };
type Fields = Omit<Patient, 'id' | 'email' | 'sex'> & { sex: Patient['sex'] | ''; email: string };

const blank: Fields = { first_name: '', last_name: '', date_of_birth: '', sex: '', phone: '', email: '' };

export function PatientForm({ patient, onSaved, onCancel }: Props) {
  const [fields, setFields] = useState<Fields>(patient ? { ...patient, email: patient.email ?? '' } : blank);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { first_name, last_name, date_of_birth, sex, phone, email } = fields;
      const body = { first_name, last_name, date_of_birth, sex, phone, email };
      const saved = patient
        ? await api<Patient>(`/patients/${patient.id}`, { method: 'PATCH', body })
        : await api<Patient>('/patients', { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      const details = err instanceof ApiError ? err.details : {};
      setErrors(details);
      setFormError(Object.keys(details).length ? 'Check the highlighted fields.' : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function field(name: keyof Fields, label: string, input: ReactNode) {
    return (
      <div className="field">
        <label htmlFor={name}>{label}</label>
        {input}
        {errors[name]?.map((message) => <p key={message} className="field-error">{message}</p>)}
      </div>
    );
  }

  const text = (name: keyof Fields, type = 'text') => (
    <input
      id={name}
      type={type}
      value={fields[name]}
      aria-invalid={errors[name] ? true : undefined}
      onChange={(e) => setFields({ ...fields, [name]: e.target.value })}
    />
  );

  return (
    <form className="panel patient-form" onSubmit={submit} noValidate>
      <h3>{patient ? `Edit ${patient.first_name} ${patient.last_name}` : 'New patient'}</h3>
      {formError && <p className="error">{formError}</p>}
      <div className="form-grid">
        {field('first_name', 'First name', text('first_name'))}
        {field('last_name', 'Last name', text('last_name'))}
        {field('date_of_birth', 'Date of birth', text('date_of_birth', 'date'))}
        {field(
          'sex',
          'Sex',
          <select
            id="sex"
            value={fields.sex}
            aria-invalid={errors.sex ? true : undefined}
            onChange={(e) => setFields({ ...fields, sex: e.target.value as Fields['sex'] })}>
            <option value="">Choose</option>
            <option value="FEMALE">{labels.FEMALE}</option>
            <option value="MALE">{labels.MALE}</option>
          </select>,
        )}
        {field('phone', 'Phone', text('phone', 'tel'))}
        {field('email', 'Email (optional)', text('email', 'email'))}
      </div>
      <div className="actions">
        <button type="submit" className="primary" disabled={saving}>{patient ? 'Save changes' : 'Register patient'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
