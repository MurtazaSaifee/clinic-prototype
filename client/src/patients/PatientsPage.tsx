import { useEffect, useState } from 'react';
import { api } from '../shared/api.ts';
import { Pager } from '../shared/Pager.tsx';
import type { Paged } from '../shared/types.ts';
import { useDebounced } from '../shared/useDebounced.ts';
import { PatientForm } from './PatientForm.tsx';
import type { Patient } from './types.ts';

const PAGE_SIZE = 25;

export function PatientsPage() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paged<Patient> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Patient | 'new' | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => setPage(1), [q]);

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ q, page: String(page), page_size: String(PAGE_SIZE) });
    api<Paged<Patient>>(`/patients?${params}`)
      .then((data) => {
        if (current) {
          setResult(data);
          setError(null);
        }
      })
      .catch((e: Error) => current && setError(e.message));
    // Ignore a slow response that arrives after a newer search.
    return () => {
      current = false;
    };
  }, [q, page, reload]);

  function saved() {
    setEditing(null);
    setReload((n) => n + 1);
  }

  return (
    <>
      <div className="page-title">
        <h2>Patients</h2>
        <button className="primary" onClick={() => setEditing('new')}>New patient</button>
      </div>

      {editing && (
        <PatientForm
          key={editing === 'new' ? 'new' : editing.id}
          patient={editing === 'new' ? undefined : editing}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      )}

      <input
        type="search"
        className="search"
        placeholder="Search by name or phone"
        aria-label="Search patients"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Date of birth</th><th>Phone</th><th></th></tr>
          </thead>
          <tbody>
            {result?.data.map((p) => (
              <tr key={p.id}>
                <td>{p.last_name}, {p.first_name}</td>
                <td>{p.date_of_birth}</td>
                <td>{p.phone}</td>
                <td className="row-actions">
                  <button onClick={() => setEditing(p)} aria-label={`Edit ${p.first_name} ${p.last_name}`}>Edit</button>
                </td>
              </tr>
            ))}
            {result?.data.length === 0 && (
              <tr><td colSpan={4} className="empty">No patients match "{q}".</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {result && <Pager page={result.page} pageSize={result.page_size} total={result.total} onPage={setPage} />}
    </>
  );
}
