import { useEffect, useState } from 'react';
import { api } from '../shared/api.ts';
import { Pager } from '../shared/Pager.tsx';
import { formatDateTime } from '../shared/time.ts';
import type { Paged } from '../shared/types.ts';
import type { Staff } from '../staff/types.ts';
import type { TestResult } from './types.ts';

const PAGE_SIZE = 25;

type Props = { currentStaff: Staff | null; onCount: (unreviewed: number) => void };

export function ResultsPage({ currentStaff, onCount }: Props) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paged<TestResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    api<Paged<TestResult>>(`/test-results?reviewed=false&page=${page}&page_size=${PAGE_SIZE}`)
      .then((data) => {
        if (!current) return;
        onCount(data.total);
        // Reviewing the last result of a page empties it; step back instead of showing a blank page.
        if (data.data.length === 0 && page > 1) setPage(page - 1);
        else setResult(data);
      })
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [page, reload, onCount]);

  async function markReviewed(r: TestResult) {
    setBusyId(r.id);
    try {
      await api(`/test-results/${r.id}/review`, { method: 'POST' });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
      setReload((n) => n + 1);
    }
  }

  return (
    <>
      <h2>Results to review</h2>
      {!currentStaff && <p className="muted">Choose who you are under "Signed in as" to mark results reviewed.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!result && !error && <p className="muted">Loading…</p>}
      {result && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Patient</th><th>Test</th><th>Result</th><th>Came back</th><th></th></tr>
              </thead>
              <tbody>
                {result.data.map((r) => (
                  <tr key={r.id} className={r.is_abnormal ? 'abnormal' : undefined}>
                    <td>{r.patient.name}</td>
                    <td>{r.test_name}</td>
                    <td>
                      {r.result}
                      {r.is_abnormal && <span className="flag">Abnormal</span>}
                    </td>
                    <td>{formatDateTime(r.resulted_at)}</td>
                    <td className="row-actions">
                      <button
                        disabled={!currentStaff || busyId !== null}
                        onClick={() => markReviewed(r)}
                        aria-label={`Mark ${r.test_name} for ${r.patient.name} reviewed`}
                      >
                        Mark reviewed
                      </button>
                    </td>
                  </tr>
                ))}
                {result.total === 0 && (
                  <tr><td colSpan={5} className="empty">All results reviewed.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={result.page} pageSize={result.page_size} total={result.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
