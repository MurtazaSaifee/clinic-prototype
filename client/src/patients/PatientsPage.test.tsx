import { render, screen } from '@testing-library/react';
import { mockFetch } from '../shared/mockFetch.ts';
import { PatientsPage } from './PatientsPage.tsx';

test('lists patients returned by the API', async () => {
  mockFetch({
    '/api/patients': {
      body: [{ id: 1, first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1980-12-10', sex: 'FEMALE' }],
    },
  });
  render(<PatientsPage />);
  expect(await screen.findByText('Lovelace, Ada')).toBeInTheDocument();
  expect(screen.getByText('Female')).toBeInTheDocument();
});

test('shows the error when the API fails', async () => {
  mockFetch({ '/api/patients': { body: { error: 'Database down' }, status: 500 } });
  render(<PatientsPage />);
  expect(await screen.findByText('Database down')).toBeInTheDocument();
});
