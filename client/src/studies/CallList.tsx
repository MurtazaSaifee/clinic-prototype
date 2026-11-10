import { useEffect, useState } from 'react';
import { CONTACT_OUTCOMES, type CandidateStatus, type ContactOutcome } from '../../../server/src/enums.ts';
import { api } from '../shared/api.ts';
import { labels } from '../shared/labels.ts';
import { Pager } from '../shared/Pager.tsx';
import { formatDateTime } from '../shared/time.ts';
import type { Staff } from '../staff/types.ts';
import type { CallList as CallListData, CallListRow } from './types.ts';

const PAGE_SIZE = 10;

// NOT_ELIGIBLE patients are never called, so they have no place on the call list.
const FILTERS: CandidateStatus[] = ['PENDING_CONTACT', 'PENDING_CONSENT', 'CONSENTED', 'DECLINED'];

type Props = { studyId: number; currentStaff: Staff | null };

export function CallList({ studyId, currentStaff }: Props) {
  const [status, setStatus] = useState<CandidateStatus>('PENDING_CONTACT');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CallListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingId, setLoggingId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    api<CallListData>(`/studies/${studyId}/candidates?status=${status}&page=${page}&page_size=${PAGE_SIZE}`)
      .then((data) => {
        if (!current) return;
        // A call or consent can move the last row of a page to another status; step back instead of a blank page.
        if (data.data.length === 0 && page > 1) setPage(page - 1);
        else setResult(data);
      })
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [studyId, status, page, reload]);

  async function save(request: Promise<unknown>) {
    setBusy(true);
    try {
      await request;
      setError(null);
      setLoggingId(null);
      setNote('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setReload((n) => n + 1);
    }
  }

  const logCall = (row: CallListRow, outcome: ContactOutcome) =>
    save(api(`/candidates/${row.id}/contact-attempts`, { method: 'POST', body: { outcome, notes: note.trim() || null } }));

  const decide = (row: CallListRow, decision: 'CONSENTED' | 'DECLINED') =>
    save(api(`/candidates/${row.id}`, { method: 'PATCH', body: { status: decision } }));

  function chooseFilter(next: CandidateStatus) {
    setStatus(next);
    setPage(1);
    setLoggingId(null);
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Call list status">
        {FILTERS.map((s) => (
          <button key={s} role="tab" aria-selected={s === status} onClick={() => chooseFilter(s)}>
            {labels[s]} ({result?.counts[s] ?? '…'})
          </button>
        ))}
      </div>
      {status === 'PENDING_CONTACT' && !currentStaff && (
        <p className="muted">Choose who you are under "Signed in as" to log a call.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {!result && !error && <p className="muted">Loading…</p>}

      {result && (
        <>
          <ul className="plain-list match-list">
            {result.data.map((row) => (
              <li key={row.id} className="panel match" aria-label={row.patient.name}>
                <div className="panel-head">
                  <div>
                    <h3>{row.patient.name}</h3>
                    <a className="phone" href={`tel:${row.patient.phone.replace(/[^\d+]/g, '')}`}>{row.patient.phone}</a>
                    <p className="muted">
                      {row.attempt_count === 1 ? '1 call' : `${row.attempt_count} calls`}
                      {row.last_attempt
                        ? ` · last: ${labels[row.last_attempt.outcome]}, ${formatDateTime(row.last_attempt.attempted_at)} by ${row.last_attempt.staff_name}`
                        : ' · never called'}
                    </p>
                  </div>
                </div>

                {row.status === 'PENDING_CONTACT' && loggingId !== row.id && (
                  <div className="actions">
                    <button className="primary" disabled={!currentStaff || busy} onClick={() => { setLoggingId(row.id); setNote(''); }}>
                      Log call
                    </button>
                  </div>
                )}
                {row.status === 'PENDING_CONTACT' && loggingId === row.id && (
                  <div className="log-call">
                    <label htmlFor={`note-${row.id}`} className="muted">Note (optional)</label>
                    <textarea id={`note-${row.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                    <p className="muted">How did the call go?</p>
                    <div className="actions">
                      {CONTACT_OUTCOMES.map((outcome) => (
                        <button key={outcome} className={outcome === 'REACHED' ? 'primary' : undefined} disabled={busy} onClick={() => logCall(row, outcome)}>
                          {labels[outcome]}
                        </button>
                      ))}
                      <button className="link" disabled={busy} onClick={() => setLoggingId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
                {row.status === 'PENDING_CONSENT' && (
                  <div className="actions">
                    <button className="primary" disabled={busy} onClick={() => decide(row, 'CONSENTED')}>Consented</button>
                    <button disabled={busy} onClick={() => decide(row, 'DECLINED')}>Declined</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {result.total === 0 && <p className="empty">Nobody here.</p>}
          <Pager page={result.page} pageSize={result.page_size} total={result.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
