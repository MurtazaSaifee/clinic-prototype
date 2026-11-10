import { render, screen } from '@testing-library/react';
import App from './App.tsx';

// jsdom has no fetch, so each test installs a stub returning a canned response.
function mockFetch(body: unknown, status = 200) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    statusText: 'Error',
    json: async () => body,
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

test('lists patients returned by the API', async () => {
  const fetchMock = mockFetch([
    { id: 1, first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1980-12-10', sex: 'female' },
  ]);
  render(<App />);
  expect(await screen.findByText('Lovelace, Ada')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/patients', expect.anything());
});

test('shows the error when the API fails', async () => {
  mockFetch({ error: 'Database down' }, 500);
  render(<App />);
  expect(await screen.findByText('Database down')).toBeInTheDocument();
});
