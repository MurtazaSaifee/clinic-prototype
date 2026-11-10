import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mockFetch } from '../shared/mockFetch.ts';
import type { Staff } from '../staff/types.ts';
import { ResultsPage } from './ResultsPage.tsx';
import type { TestResult } from './types.ts';

const amara: Staff = { id: 1, name: 'Amara Okafor', role: 'PHYSICIAN' };
const hba1c: TestResult = {
  id: 1,
  test_name: 'HbA1c',
  result: '8.1 %',
  is_abnormal: true,
  resulted_at: '2026-11-07T15:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  patient: { id: 3, name: 'Rolando Bauch' },
};
const tsh: TestResult = { ...hba1c, id: 2, test_name: 'TSH', result: '2.1 mIU/L', is_abnormal: false, patient: { id: 4, name: 'Duane Klocko' } };
const page = (data: TestResult[]) => ({ body: { data, page: 1, page_size: 25, total: data.length } });

test('Mark reviewed posts the review, removes the row and reports the new count', async () => {
  const routes = { '/api/test-results': page([hba1c, tsh]), 'POST /api/test-results/1/review': { body: {} } };
  const fetchMock = mockFetch(routes);
  const onCount = jest.fn();
  render(<ResultsPage currentStaff={amara} onCount={onCount} />);

  const row = (await screen.findByText('Rolando Bauch')).closest('tr')!;
  expect(within(row).getByText('Abnormal')).toBeInTheDocument();
  expect(within(row).getByText('7 Nov 2026, 15:00')).toBeInTheDocument();
  expect(within(screen.getByText('Duane Klocko').closest('tr')!).queryByText('Abnormal')).not.toBeInTheDocument();
  expect(onCount).toHaveBeenLastCalledWith(2);

  routes['/api/test-results'] = page([tsh]);
  fireEvent.click(within(row).getByRole('button', { name: 'Mark HbA1c for Rolando Bauch reviewed' }));

  await waitFor(() => expect(screen.queryByText('Rolando Bauch')).not.toBeInTheDocument());
  expect(screen.getByText('Duane Klocko')).toBeInTheDocument();
  expect(onCount).toHaveBeenLastCalledWith(1);
  const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
  expect(post?.[0]).toBe('/api/test-results/1/review');
  expect(fetchMock.mock.calls[0][0]).toContain('reviewed=false');
});

test('a result someone else already reviewed shows the message and leaves the list', async () => {
  const routes = {
    '/api/test-results': page([hba1c]),
    'POST /api/test-results/1/review': { status: 409, body: { error: 'This result was already reviewed' } },
  };
  mockFetch(routes);
  render(<ResultsPage currentStaff={amara} onCount={() => {}} />);
  routes['/api/test-results'] = page([]);
  fireEvent.click(await screen.findByRole('button', { name: /Mark HbA1c/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This result was already reviewed');
  expect(await screen.findByText('All results reviewed.')).toBeInTheDocument();
});

test('Mark reviewed is disabled until someone is signed in', async () => {
  mockFetch({ '/api/test-results': page([hba1c]) });
  render(<ResultsPage currentStaff={null} onCount={() => {}} />);
  expect(await screen.findByRole('button', { name: /Mark HbA1c/ })).toBeDisabled();
  expect(screen.getByText(/to mark results reviewed/)).toBeInTheDocument();
});
