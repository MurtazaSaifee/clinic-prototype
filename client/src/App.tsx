import { useEffect, useState } from 'react';
import { PatientsPage } from './patients/PatientsPage.tsx';
import { api, getStaffId, setStaffId } from './shared/api.ts';
import { StaffPicker } from './staff/StaffPicker.tsx';
import type { Staff } from './staff/types.ts';
import { TodayPage } from './today/TodayPage.tsx';

const PAGES = { today: 'Today', patients: 'Patients', results: 'Results', studies: 'Studies' };
type Page = keyof typeof PAGES;

// The URL hash holds the page, so a reload or the back button lands where you were.
function pageFromHash(): Page {
  const hash = window.location.hash.slice(1);
  return hash in PAGES ? (hash as Page) : 'today';
}

export default function App() {
  const [page, setPage] = useState(pageFromHash);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffId, setSelectedStaffId] = useState(getStaffId());

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    api<Staff[]>('/staff').then(setStaff).catch(() => setStaff([]));
  }, []);

  function chooseStaff(id: number | null) {
    setStaffId(id);
    setSelectedStaffId(id);
  }

  const currentStaff = staff.find((s) => s.id === staffId) ?? null;
  const physicians = staff.filter((s) => s.role === 'PHYSICIAN');

  return (
    <>
      <header className="app-header">
        <strong className="clinic-name">Riverside Family Clinic</strong>
        <nav>
          {Object.entries(PAGES).map(([key, label]) => (
            <a key={key} href={`#${key}`} aria-current={key === page ? 'page' : undefined}>{label}</a>
          ))}
        </nav>
        <StaffPicker staff={staff} selectedId={staffId} onChange={chooseStaff} />
      </header>
      <main>
        {page === 'today' && <TodayPage currentStaff={currentStaff} physicians={physicians} />}
        {page === 'patients' && <PatientsPage />}
        {(page === 'results' || page === 'studies') && <h2>{PAGES[page]}</h2>}
      </main>
    </>
  );
}
