import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mockFetch } from '../shared/mockFetch.ts';
import type { Staff } from '../staff/types.ts';
import { MatchList } from './MatchList.tsx';

const amara: Staff = { id: 1, name: 'Amara Okafor', role: 'PHYSICIAN' };

const match = {
  patient: { id: 42, name: 'Thurman Auer', date_of_birth: '1990-05-15', phone: '(738) 481-7502' },
  reasons: [
    { criterion: { type: 'AGE_BETWEEN', min: 18, max: 75 }, met: true, evidence: 'Age 36 (18 to 75 required)' },
    {
      criterion: { type: 'DIAGNOSIS', icd10_prefixes: ['E11'], label: 'Type 2 diabetes' },
      met: true,
      evidence: 'E11.9 Type 2 diabetes mellitus without complications, diagnosed 2023-10-23',
    },
  ],
};
const page = (data: unknown[]) => ({ data, page: 1, page_size: 10, total: data.length });

test('a match shows one line per criterion with its evidence, and Eligible records the decision', async () => {
  const routes = {
    '/api/studies/1/matches': { body: page([match]) },
    'POST /api/studies/1/candidates': { status: 201, body: {} },
  };
  const fetchMock = mockFetch(routes);
  render(<MatchList studyId={1} currentStaff={amara} />);

  const card = await screen.findByRole('listitem', { name: 'Thurman Auer' });
  expect(within(card).getByText('(738) 481-7502', { exact: false })).toBeInTheDocument();
  expect(within(card).getByText('Age 36 (18 to 75 required)', { exact: false })).toBeInTheDocument();
  expect(within(card).getByText(/E11\.9 Type 2 diabetes mellitus without complications, diagnosed 2023-10-23/)).toBeInTheDocument();
  expect(within(card).getAllByLabelText('Met')).toHaveLength(2);

  // Once the decision is saved, the server no longer lists the patient.
  routes['/api/studies/1/matches'] = { body: page([]) };
  fireEvent.click(within(card).getByRole('button', { name: 'Eligible' }));

  await waitFor(() => expect(screen.queryByText('Thurman Auer')).not.toBeInTheDocument());
  const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
  expect(post?.[0]).toBe('/api/studies/1/candidates');
  expect(JSON.parse(post?.[1].body as string)).toEqual({ patient_id: 42, eligible: true });
  expect(screen.getByText('Nobody left to check.')).toBeInTheDocument();
});

test('Not eligible sends eligible: false', async () => {
  const fetchMock = mockFetch({
    '/api/studies/1/matches': { body: page([match]) },
    'POST /api/studies/1/candidates': { status: 201, body: {} },
  });
  render(<MatchList studyId={1} currentStaff={amara} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Not eligible' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init.method === 'POST')).toBe(true));
  const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
  expect(JSON.parse(post?.[1].body as string)).toEqual({ patient_id: 42, eligible: false });
});

test('decisions are disabled until someone is signed in', async () => {
  mockFetch({ '/api/studies/1/matches': { body: page([match]) } });
  render(<MatchList studyId={1} currentStaff={null} />);
  expect(await screen.findByRole('button', { name: 'Eligible' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Not eligible' })).toBeDisabled();
  expect(screen.getByText(/Choose who you are/)).toBeInTheDocument();
});
