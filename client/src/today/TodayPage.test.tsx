import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mockFetch } from '../shared/mockFetch.ts';
import type { Staff } from '../staff/types.ts';
import { TodayPage } from './TodayPage.tsx';

const physicians: Staff[] = [{ id: 1, name: 'Amara Okafor', role: 'PHYSICIAN' }];
const receptionist: Staff = { id: 5, name: 'Lena Novak', role: 'RECEPTIONIST' };
const nurse: Staff = { id: 3, name: 'Priya Shah', role: 'NURSE' };

const scheduled = {
  id: 7,
  scheduled_at: '2026-11-10T09:30:00.000Z',
  status: 'SCHEDULED',
  reason: 'Cough',
  patient: { id: 1, name: 'Ada Lovelace', phone: '(555) 012-3456' },
  physician: { id: 1, name: 'Amara Okafor' },
  open_task_count: 0,
};

function selectedTab() {
  return screen.getByRole('tab', { selected: true });
}

test('opens on the signed-in role’s tab, or All when nobody is signed in', async () => {
  mockFetch({ '/api/appointments': { body: [scheduled] } });
  const { rerender } = render(<TodayPage currentStaff={nurse} physicians={physicians} />);
  expect(selectedTab()).toHaveTextContent('Nurse');

  rerender(<TodayPage currentStaff={null} physicians={physicians} />);
  expect(selectedTab()).toHaveTextContent('All');
});

test('shows the visit time in clinic time (UTC) with patient phone and physician', async () => {
  mockFetch({ '/api/appointments': { body: [scheduled] } });
  render(<TodayPage currentStaff={receptionist} physicians={physicians} />);
  const row = (await screen.findByText('Ada Lovelace')).closest('tr')!;
  expect(within(row).getByText('09:30')).toBeInTheDocument();
  expect(within(row).getByText('(555) 012-3456')).toBeInTheDocument();
  expect(within(row).getByText('Scheduled')).toBeInTheDocument();
});

test('Check in posts the new status and the visit moves from Reception to Nurse', async () => {
  const fetchMock = mockFetch({
    '/api/appointments': { body: [scheduled] },
    'POST /api/appointments/7/status': { body: { ...scheduled, status: 'CHECKED_IN' } },
  });
  render(<TodayPage currentStaff={receptionist} physicians={physicians} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Check in Ada Lovelace' }));

  await waitFor(() => expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument());
  const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
  expect(post?.[0]).toBe('/api/appointments/7/status');
  expect(JSON.parse(post?.[1].body as string)).toEqual({ status: 'CHECKED_IN' });
  expect(screen.getByRole('tab', { name: 'Nurse (1)' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Nurse (1)' }));
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  expect(screen.getByText('Checked in')).toBeInTheDocument();
});

test('booking sends the chosen slot and shows a double-booking 409 in the form', async () => {
  const fetchMock = mockFetch({
    '/api/appointments': { body: [] },
    '/api/patients': {
      body: {
        data: [{ id: 1, first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1980-12-10', sex: 'FEMALE', phone: '(555) 012-3456', email: null }],
        page: 1,
        page_size: 5,
        total: 1,
      },
    },
    'POST /api/appointments': { status: 409, body: { error: 'That physician already has a visit at this time' } },
  });
  render(<TodayPage currentStaff={receptionist} physicians={physicians} />);
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Book visit' }));

  fireEvent.change(screen.getByLabelText('Patient'), { target: { value: 'lovelace' } });
  fireEvent.click(await screen.findByRole('button', { name: /Lovelace, Ada/ }));
  fireEvent.change(screen.getByLabelText('Physician'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '09:30' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Follow-up' } });
  fireEvent.click(within(screen.getByRole('form', { name: 'Book visit' })).getByRole('button', { name: 'Book visit' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('That physician already has a visit at this time');
  const post = fetchMock.mock.calls.find(([, init]) => init.method === 'POST');
  expect(JSON.parse(post?.[1].body as string)).toEqual({
    patient_id: 1,
    physician_id: 1,
    scheduled_at: '2026-11-12T09:30:00Z',
    reason: 'Follow-up',
  });
});

test('the Doctor tab lists the signed-in physician’s own patients first', async () => {
  const waiting = (id: number, time: string, physician: { id: number; name: string }, name: string) => ({
    ...scheduled,
    id,
    scheduled_at: `2026-11-10T${time}:00.000Z`,
    status: 'READY_FOR_DOCTOR',
    physician,
    patient: { ...scheduled.patient, id, name },
  });
  mockFetch({
    '/api/appointments': {
      body: [
        waiting(1, '09:00', { id: 1, name: 'Amara Okafor' }, 'First Patient'),
        waiting(2, '09:30', { id: 2, name: 'Daniel Reyes' }, 'Second Patient'),
      ],
    },
  });
  const reyes: Staff = { id: 2, name: 'Daniel Reyes', role: 'PHYSICIAN' };
  render(<TodayPage currentStaff={reyes} physicians={physicians} />);
  await screen.findByText('Second Patient');
  const names = screen.getAllByRole('button', { name: /Patient$/ }).map((b) => b.textContent);
  expect(names).toEqual(['Second Patient', 'First Patient']);
});
