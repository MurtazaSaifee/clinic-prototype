import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.tsx';
import { setStaffId } from './shared/api.ts';
import { mockFetch } from './shared/mockFetch.ts';

const staff = [
  { id: 1, name: 'Dr. Ana Ruiz', role: 'PHYSICIAN' },
  { id: 2, name: 'Sam Lee', role: 'NURSE' },
];

function headersOf(fetchMock: ReturnType<typeof mockFetch>, url: string) {
  const call = fetchMock.mock.calls.filter(([u]) => u === url).at(-1);
  return call?.[1].headers as Record<string, string> | undefined;
}

beforeEach(() => {
  setStaffId(null);
  window.location.hash = '';
});

test('the chosen staff member is sent as X-Staff-Id on the next request', async () => {
  const fetchMock = mockFetch({ '/api/staff': { body: staff }, '/api/patients': { body: [] } });
  render(<App />);
  await screen.findByRole('option', { name: 'Sam Lee (Nurse)' });
  fireEvent.change(screen.getByLabelText('Signed in as'), { target: { value: '2' } });
  expect(localStorage.getItem('staffId')).toBe('2');

  fireEvent.click(screen.getByRole('link', { name: 'Patients' }));
  await waitFor(() => expect(headersOf(fetchMock, '/api/patients')).toBeDefined());
  expect(headersOf(fetchMock, '/api/patients')?.['X-Staff-Id']).toBe('2');
});
