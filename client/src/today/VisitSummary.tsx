import type { VisitDetail } from './types.ts';

const dash = (value: number | null, unit: string) => (value === null ? '—' : `${value} ${unit}`);

export function Vitals({ visit }: { visit: VisitDetail }) {
  const bp = visit.bp_systolic === null || visit.bp_diastolic === null ? null : `${visit.bp_systolic}/${visit.bp_diastolic}`;
  return (
    <dl className="vitals">
      <div><dt>Height</dt><dd>{dash(visit.height_cm, 'cm')}</dd></div>
      <div><dt>Weight</dt><dd>{dash(visit.weight_kg, 'kg')}</dd></div>
      <div><dt>Blood pressure</dt><dd>{bp === null ? '—' : `${bp} mmHg`}</dd></div>
      <div><dt>Heart rate</dt><dd>{dash(visit.heart_rate, 'bpm')}</dd></div>
    </dl>
  );
}

export function Notes({ title, text }: { title: string; text: string | null }) {
  return (
    <section>
      <h4>{title}</h4>
      <p className={text ? 'notes' : 'muted'}>{text ?? 'None recorded.'}</p>
    </section>
  );
}

export function Diagnoses({ visit }: { visit: VisitDetail }) {
  return (
    <section>
      <h4>Diagnoses</h4>
      {visit.diagnoses.length === 0 ? (
        <p className="muted">None on file.</p>
      ) : (
        <ul className="plain-list">
          {visit.diagnoses.map((d) => (
            <li key={d.id}><strong>{d.icd10_code}</strong> {d.description} <span className="muted">since {d.diagnosed_on}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
