import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mockFetch } from '../shared/mockFetch.ts';
import type { Staff } from '../staff/types.ts';
import type { VisitDetail } from './types.ts';
import { VisitPanel } from './VisitPanel.tsx';

const lena: Staff = { id: 5, name: 'Lena Novak', role: 'RECEPTIONIST' };

const base: VisitDetail = {
  id: 12,
  scheduled_at: '2026-11-10T09:00:00.000Z',
  status: 'READY_FOR_CHECKOUT',
  reason: 'Lower back pain',
  physician: { id: 2, name: 'Daniel Reyes' },
  patient: { id: 1, name: 'Ada Lovelace', phone: '(555) 012-3456', date_of_birth: '1980-12-10', sex: 'FEMALE' },
  height_cm: 170,
  weight_kg: 65.5,
  bp_systolic: 128,
  bp_diastolic: 82,
  heart_rate: 74,
  nurse_notes: 'Pain 4/10, worse in the mornings.',
  doctor_notes: null,
  diagnoses: [{ id: 1, icd10_code: 'I10', description: 'Essential (primary) hypertension', diagnosed_on: '2019-03-02' }],
  checkout_tasks: [],
};

const openTask = { id: 31, description: 'Book follow-up in 2 weeks', completed_at: null, completed_by: null };
const doneTask = {
  id: 32,
  description: 'Blood draw for HbA1c',
  completed_at: '2026-11-10T09:40:00.000Z',
  completed_by: { id: 5, name: 'Lena Novak' },
};

function bodyOf(fetchMock: ReturnType<typeof mockFetch>, method: string, url: string) {
  const call = fetchMock.mock.calls.find(([u, init]) => u === url && init.method === method);
  return call && JSON.parse(call[1].body as string);
}

test('Check out stays disabled until every task is ticked, then checks the visit out', async () => {
  const fetchMock = mockFetch({
    '/api/appointments/12': { body: { ...base, checkout_tasks: [doneTask, openTask] } },
    'PATCH /api/checkout-tasks/31': { body: { ...openTask, completed_at: '2026-11-10T09:45:00.000Z', completed_by: { id: 5, name: 'Lena Novak' } } },
    'POST /api/appointments/12/status': { body: {} },
  });
  const onChanged = jest.fn();
  const onClose = jest.fn();
  render(<VisitPanel visitId={12} currentStaff={lena} onChanged={onChanged} onClose={onClose} />);

  const checkOut = await screen.findByRole('button', { name: 'Check out' });
  expect(checkOut).toBeDisabled();
  expect(screen.getByText('1 task still open')).toBeInTheDocument();
  expect(screen.getByText(/done by Lena Novak at 09:40/)).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Book follow-up in 2 weeks'));
  await waitFor(() => expect(checkOut).toBeEnabled());
  expect(bodyOf(fetchMock, 'PATCH', '/api/checkout-tasks/31')).toEqual({ completed: true });

  fireEvent.click(checkOut);
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(bodyOf(fetchMock, 'POST', '/api/appointments/12/status')).toEqual({ status: 'CHECKED_OUT' });
  expect(onChanged).toHaveBeenCalled();
});

test('tasks cannot be ticked until someone is signed in', async () => {
  mockFetch({ '/api/appointments/12': { body: { ...base, checkout_tasks: [openTask] } } });
  render(<VisitPanel visitId={12} currentStaff={null} onChanged={() => {}} onClose={() => {}} />);
  expect(await screen.findByLabelText('Book follow-up in 2 weeks')).toBeDisabled();
  expect(screen.getByText(/Choose who you are/)).toBeInTheDocument();
});

test('nurse intake saves vitals as numbers (blank as null), then sends to the doctor', async () => {
  const fetchMock = mockFetch({
    '/api/appointments/12': {
      body: { ...base, status: 'CHECKED_IN', height_cm: null, weight_kg: null, bp_systolic: null, bp_diastolic: null, heart_rate: null, nurse_notes: null },
    },
    'PATCH /api/appointments/12': { body: {} },
    'POST /api/appointments/12/status': { body: {} },
  });
  const onClose = jest.fn();
  render(<VisitPanel visitId={12} currentStaff={null} onChanged={() => {}} onClose={onClose} />);

  expect(await screen.findByText('Lower back pain')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '72.4' } });
  fireEvent.change(screen.getByLabelText('BP systolic (mmHg)'), { target: { value: '130' } });
  fireEvent.change(screen.getByLabelText('BP diastolic (mmHg)'), { target: { value: '85' } });
  fireEvent.change(screen.getByLabelText('Heart rate (bpm)'), { target: { value: '70' } });
  fireEvent.change(screen.getByLabelText('Nurse notes'), { target: { value: 'Started a week ago.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send to doctor' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(bodyOf(fetchMock, 'PATCH', '/api/appointments/12')).toEqual({
    height_cm: null,
    weight_kg: 72.4,
    bp_systolic: 130,
    bp_diastolic: 85,
    heart_rate: 70,
    nurse_notes: 'Started a week ago.',
  });
  expect(bodyOf(fetchMock, 'POST', '/api/appointments/12/status')).toEqual({ status: 'READY_FOR_DOCTOR' });
});

test('nurse intake shows out-of-range vitals next to the field and does not send to the doctor', async () => {
  const fetchMock = mockFetch({
    '/api/appointments/12': { body: { ...base, status: 'CHECKED_IN' } },
    'PATCH /api/appointments/12': { status: 400, body: { error: 'Invalid input', details: { heart_rate: ['Heart rate must be 20 to 250 bpm'] } } },
  });
  render(<VisitPanel visitId={12} currentStaff={null} onChanged={() => {}} onClose={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Heart rate (bpm)'), { target: { value: '400' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send to doctor' }));

  expect(await screen.findByText('Heart rate must be 20 to 250 bpm')).toBeInTheDocument();
  expect(screen.getByLabelText('Heart rate (bpm)')).toHaveAttribute('aria-invalid', 'true');
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/status'))).toBe(false);
});

test('the doctor sees reason, nurse notes, vitals and diagnoses together, adds a task and sends to checkout', async () => {
  const fetchMock = mockFetch({
    '/api/appointments/12': { body: { ...base, status: 'READY_FOR_DOCTOR' } },
    'POST /api/appointments/12/checkout-tasks': { status: 201, body: openTask },
    'PATCH /api/appointments/12': { body: {} },
    'POST /api/appointments/12/status': { body: {} },
  });
  render(<VisitPanel visitId={12} currentStaff={null} onChanged={() => {}} onClose={() => {}} />);

  expect(await screen.findByText('Lower back pain')).toBeInTheDocument();
  expect(screen.getByText('Pain 4/10, worse in the mornings.')).toBeInTheDocument();
  expect(screen.getByText('128/82 mmHg')).toBeInTheDocument();
  expect(screen.getByText('Essential (primary) hypertension')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('New checkout task'), { target: { value: 'Book follow-up in 2 weeks' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  expect(await screen.findByLabelText('Book follow-up in 2 weeks')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Doctor notes'), { target: { value: 'Likely muscular.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send to checkout' }));
  await waitFor(() => expect(bodyOf(fetchMock, 'POST', '/api/appointments/12/status')).toEqual({ status: 'READY_FOR_CHECKOUT' }));
  expect(bodyOf(fetchMock, 'PATCH', '/api/appointments/12')).toEqual({ doctor_notes: 'Likely muscular.' });
});
