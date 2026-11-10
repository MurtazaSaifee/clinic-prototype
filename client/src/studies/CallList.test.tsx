import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mockFetch } from '../shared/mockFetch.ts';
import type { Staff } from '../staff/types.ts';
import { CallList } from './CallList.tsx';
import type { CallListRow } from './types.ts';

const lena: Staff = { id: 5, name: 'Lena Novak', role: 'RECEPTIONIST' };
const counts = { NOT_ELIGIBLE: 2, PENDING_CONTACT: 1, PENDING_CONSENT: 1, CONSENTED: 0, DECLINED: 3 };
const list = (data: CallListRow[], overrides = {}) => ({ body: { data, page: 1, page_size: 10, total: data.length, counts, ...overrides } });

const sally: CallListRow = {
  id: 7,
  status: 'PENDING_CONTACT',
  patient: { id: 3, name: 'Sally Goldner', phone: '(555) 010-2030' },
  attempt_count: 1,
  last_attempt: { outcome: 'NO_ANSWER', attempted_at: '2026-01-09T10:00:00Z', staff_name: 'Priya Shah' },
};

test('shows each patient with phone, call count and the last call, plus a count per status', async () => {
  mockFetch({ '/api/studies/1/candidates': list([sally, { ...sally, id: 8, patient: { ...sally.patient, name: 'Denise Marks' }, attempt_count: 0, last_attempt: null }]) });
  render(<CallList studyId={1} currentStaff={lena} />);

  const row = await screen.findByRole('listitem', { name: 'Sally Goldner' });
  expect(within(row).getByRole('link', { name: '(555) 010-2030' })).toHaveAttribute('href', 'tel:5550102030');
  expect(within(row).getByText('1 call · last: No answer, 9 Jan 2026, 10:00 by Priya Shah')).toBeInTheDocument();
  expect(within(screen.getByRole('listitem', { name: 'Denise Marks' })).getByText('0 calls · never called')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Needs a call (1)' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Declined (3)' })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /Not eligible/ })).not.toBeInTheDocument();
});

test('logging an outcome posts it with the note and refreshes the row', async () => {
  const routes = {
    '/api/studies/1/candidates': list([sally]),
    'POST /api/candidates/7/contact-attempts': { status: 201, body: {} },
  };
  const fetchMock = mockFetch(routes);
  render(<CallList studyId={1} currentStaff={lena} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Log call' }));
  fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '  Rang twice  ' } });
  routes['/api/studies/1/candidates'] = list([
    { ...sally, attempt_count: 2, last_attempt: { outcome: 'VOICEMAIL', attempted_at: '2026-01-10T15:30:00Z', staff_name: 'Lena Novak' } },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Left voicemail' }));

  expect(await screen.findByText('2 calls · last: Left voicemail, 10 Jan 2026, 15:30 by Lena Novak')).toBeInTheDocument();
  const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
  expect(post?.[0]).toBe('/api/candidates/7/contact-attempts');
  expect(JSON.parse(post?.[1].body as string)).toEqual({ outcome: 'VOICEMAIL', notes: 'Rang twice' });
  expect(screen.queryByLabelText('Note (optional)')).not.toBeInTheDocument();
});

test('the status filter asks the server for that status and offers consent buttons', async () => {
  const routes = {
    '/api/studies/1/candidates': list([sally]),
    'PATCH /api/candidates/9': { body: {} },
  };
  const fetchMock = mockFetch(routes);
  render(<CallList studyId={1} currentStaff={lena} />);
  await screen.findByText('Sally Goldner');

  routes['/api/studies/1/candidates'] = list([{ ...sally, id: 9, status: 'PENDING_CONSENT' }]);
  fireEvent.click(screen.getByRole('tab', { name: 'Awaiting consent (1)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Consented' }));

  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init.method === 'PATCH')).toBe(true));
  expect(fetchMock.mock.calls.some(([url]) => url.includes('status=PENDING_CONSENT'))).toBe(true);
  const patch = fetchMock.mock.calls.find(([, init]) => init.method === 'PATCH');
  expect(patch?.[0]).toBe('/api/candidates/9');
  expect(JSON.parse(patch?.[1].body as string)).toEqual({ status: 'CONSENTED' });
});

test('a refused call shows the server message', async () => {
  mockFetch({
    '/api/studies/1/candidates': list([sally]),
    'POST /api/candidates/7/contact-attempts': { status: 409, body: { error: 'Calls can only be logged while the patient needs a call (status is PENDING_CONSENT)' } },
  });
  render(<CallList studyId={1} currentStaff={lena} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Log call' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reached' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('status is PENDING_CONSENT');
});

test('Log call is disabled until someone is signed in', async () => {
  mockFetch({ '/api/studies/1/candidates': list([sally]) });
  render(<CallList studyId={1} currentStaff={null} />);
  expect(await screen.findByRole('button', { name: 'Log call' })).toBeDisabled();
  expect(screen.getByText(/to log a call/)).toBeInTheDocument();
});
