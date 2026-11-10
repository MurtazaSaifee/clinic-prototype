import { useEffect, useState } from 'react';
import { api } from './api.ts';
import type { Patient } from './types.ts';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Patient[]>('/patients').then(setPatients).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main>
      <h1>Clinic</h1>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr><th>Name</th><th>Date of birth</th><th>Sex</th></tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id}>
              <td>{p.last_name}, {p.first_name}</td>
              <td>{p.date_of_birth}</td>
              <td>{p.sex}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
