import { useEffect, useState } from 'react';
import { api } from '../shared/api.ts';
import { Pager } from '../shared/Pager.tsx';
import { ageOn, todayIso } from '../shared/time.ts';
import type { Paged } from '../shared/types.ts';
import type { Staff } from '../staff/types.ts';
import { describeCriterion } from './describe.ts';
import type { Match } from './types.ts';

const PAGE_SIZE = 10;

type Props = { studyId: number; currentStaff: Staff | null };

export function MatchList({ studyId, currentStaff }: Props) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paged<Match> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    api<Paged<Match>>(`/studies/${studyId}/matches?page=${page}&page_size=${PAGE_SIZE}`)
      .then((data) => {
        if (!current) return;
        // Deciding on the last match of a page empties it; step back instead of showing a blank page.
        if (data.data.length === 0 && page > 1) setPage(page - 1);
        else setResult(data);
      })
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [studyId, page, reload]);

  async function decide(match: Match, eligible: boolean) {
    setBusyId(match.patient.id);
    try {
      await api(`/studies/${studyId}/candidates`, { method: 'POST', body: { patient_id: match.patient.id, eligible } });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
      setReload((n) => n + 1);
    }
  }

  if (!result) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  return (
    <>
      <p className="muted">
        {result.total === 1 ? '1 patient' : `${result.total} patients`} meet every criterion and have not been checked yet.
      </p>
      {!currentStaff && <p className="muted">Choose who you are under "Signed in as" to record a decision.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <ul className="plain-list match-list">
        {result.data.map((match) => (
          <li key={match.patient.id} className="panel match" aria-label={match.patient.name}>
            <div className="panel-head">
              <div>
                <h3>{match.patient.name}</h3>
                <p className="muted">
                  Age {ageOn(match.patient.date_of_birth, todayIso())} · born {match.patient.date_of_birth} · {match.patient.phone}
                </p>
              </div>
            </div>
            <ul className="plain-list reasons">
              {match.reasons.map((reason) => (
                <li key={describeCriterion(reason.criterion)}>
                  <span className={reason.met ? 'met' : 'not-met'} aria-label={reason.met ? 'Met' : 'Not met'}>
                    {reason.met ? '✓' : '✗'}
                  </span>{' '}
                  <strong>{describeCriterion(reason.criterion)}:</strong> {reason.evidence}
                </li>
              ))}
            </ul>
            <div className="actions">
              <button className="primary" disabled={!currentStaff || busyId !== null} onClick={() => decide(match, true)}>
                Eligible
              </button>
              <button disabled={!currentStaff || busyId !== null} onClick={() => decide(match, false)}>
                Not eligible
              </button>
            </div>
          </li>
        ))}
      </ul>
      {result.total === 0 && <p className="empty">Nobody left to check.</p>}
      <Pager page={result.page} pageSize={result.page_size} total={result.total} onPage={setPage} />
    </>
  );
}
