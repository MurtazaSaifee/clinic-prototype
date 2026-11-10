import { useEffect, useState } from 'react';
import { api } from '../shared/api.ts';
import type { Staff } from '../staff/types.ts';
import { describeCriterion } from './describe.ts';
import { MatchList } from './MatchList.tsx';
import type { Study } from './types.ts';

export function StudiesPage({ currentStaff }: { currentStaff: Staff | null }) {
  const [study, setStudy] = useState<Study | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The prototype has one study (spec section 2); the page shows the first.
  useEffect(() => {
    api<Study[]>('/studies')
      .then((studies) => setStudy(studies[0] ?? null))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!study) return <p className="muted">Loading…</p>;

  return (
    <>
      <h2>{study.name}</h2>
      <p>{study.description}</p>
      <h4 className="subhead">Who qualifies</h4>
      <ul>
        {study.criteria.map((c) => <li key={describeCriterion(c)}>{describeCriterion(c)}</li>)}
      </ul>

      <h3>Possible matches</h3>
      <MatchList studyId={study.id} currentStaff={currentStaff} />
    </>
  );
}
