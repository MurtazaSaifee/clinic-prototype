import { useEffect, useState } from 'react';
import { api } from '../shared/api.ts';
import type { Paged } from '../shared/types.ts';
import { useDebounced } from '../shared/useDebounced.ts';
import type { Patient } from './types.ts';

type Props = { id: string; selected: Patient | null; onSelect: (patient: Patient | null) => void; invalid?: boolean };

// Same search as the Patients page, trimmed to a short pick list for forms.
export function PatientPicker({ id, selected, onSelect, invalid }: Props) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [matches, setMatches] = useState<Patient[]>([]);

  useEffect(() => {
    if (!q) {
      setMatches([]);
      return;
    }
    let current = true;
    api<Paged<Patient>>(`/patients?${new URLSearchParams({ q, page_size: '5' })}`)
      .then((result) => current && setMatches(result.data))
      .catch(() => current && setMatches([]));
    return () => {
      current = false;
    };
  }, [q]);

  if (selected) {
    return (
      <div className="picked">
        <span>{selected.last_name}, {selected.first_name} · {selected.date_of_birth} · {selected.phone}</span>
        <button type="button" onClick={() => onSelect(null)}>Change</button>
      </div>
    );
  }

  return (
    <div className="picker">
      <input
        id={id}
        type="search"
        placeholder="Search by name or phone"
        value={search}
        aria-invalid={invalid || undefined}
        onChange={(e) => setSearch(e.target.value)}
      />
      {matches.length > 0 && (
        <ul className="picker-results">
          {matches.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onSelect(p)}>
                {p.last_name}, {p.first_name} · {p.date_of_birth} · {p.phone}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
