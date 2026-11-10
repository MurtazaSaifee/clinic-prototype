import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mockFetch } from '../shared/mockFetch.ts';
import { PatientsPage } from './PatientsPage.tsx';

const ada = {
  id: 1,
  first_name: 'Ada',
  last_name: 'Lovelace',
  date_of_birth: '1980-12-10',
  sex: 'FEMALE',
  phone: '(555) 012-3456',
  email: null,
};
const onePage = { data: [ada], page: 1, page_size: 25, total: 1 };

test('lists patients with their phone and the page count', async () => {
  mockFetch({ '/api/patients': { body: { ...onePage, total: 120 } } });
  render(<PatientsPage />);
  expect(await screen.findByText('Lovelace, Ada')).toBeInTheDocument();
  expect(screen.getByText('(555) 012-3456')).toBeInTheDocument();
  expect(screen.getByText('page 1 of 5')).toBeInTheDocument();
});

test('shows the error when the API fails', async () => {
  mockFetch({ '/api/patients': { body: { error: 'Database down' }, status: 500 } });
  render(<PatientsPage />);
  expect(await screen.findByText('Database down')).toBeInTheDocument();
});

test('typing in search asks the API for that query from page 1', async () => {
  const fetchMock = mockFetch({ '/api/patients': { body: { ...onePage, total: 120 } } });
  render(<PatientsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/patients?q=&page=2&page_size=25', expect.anything()));

  fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: ' 555 01 ' } });
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/patients?q=555+01&page=1&page_size=25', expect.anything()));
});

test('the form shows the field errors from a 400', async () => {
  mockFetch({
    '/api/patients': { body: onePage },
    'POST /api/patients': {
      status: 400,
      body: {
        error: 'Invalid input',
        details: { last_name: ['Last name is required'], date_of_birth: ['Date of birth cannot be in the future'] },
      },
    },
  });
  render(<PatientsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'New patient' }));
  fireEvent.click(screen.getByRole('button', { name: 'Register patient' }));

  expect(await screen.findByText('Last name is required')).toBeInTheDocument();
  expect(screen.getByText('Check the highlighted fields.')).toBeInTheDocument();
  expect(screen.getByText('Date of birth cannot be in the future')).toBeInTheDocument();
  expect(screen.getByLabelText('Last name')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('First name')).not.toHaveAttribute('aria-invalid');
});

test('Edit opens the same form filled in, and saving refreshes the list', async () => {
  const fetchMock = mockFetch({
    '/api/patients': { body: onePage },
    'PATCH /api/patients/1': { body: { ...ada, phone: '555-777-8888' } },
  });
  render(<PatientsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Ada Lovelace' }));
  expect(screen.getByLabelText('Phone')).toHaveValue('(555) 012-3456');

  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '555-777-8888' } });
  const listCalls = fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/patients?')).length;
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument());
  const patch = fetchMock.mock.calls.find(([, init]) => init.method === 'PATCH');
  expect(JSON.parse(patch?.[1].body as string)).toMatchObject({ phone: '555-777-8888' });
  expect(fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/patients?')).length).toBe(listCalls + 1);
});
