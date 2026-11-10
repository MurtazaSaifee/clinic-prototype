import { useEffect, useState } from 'react';
import { PatientsPage } from './patients/PatientsPage.tsx';
import { StaffPicker } from './staff/StaffPicker.tsx';

const PAGES = { today: 'Today', patients: 'Patients', results: 'Results', studies: 'Studies' };
type Page = keyof typeof PAGES;

// The URL hash holds the page, so a reload or the back button lands where you were.
function pageFromHash(): Page {
  const hash = window.location.hash.slice(1);
  return hash in PAGES ? (hash as Page) : 'today';
}

export default function App() {
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      <header className="app-header">
        <strong className="clinic-name">Riverside Family Clinic</strong>
        <nav>
          {Object.entries(PAGES).map(([key, label]) => (
            <a key={key} href={`#${key}`} aria-current={key === page ? 'page' : undefined}>{label}</a>
          ))}
        </nav>
        <StaffPicker />
      </header>
      <main>
        {page === 'patients' ? <PatientsPage /> : <h2>{PAGES[page]}</h2>}
      </main>
    </>
  );
}
