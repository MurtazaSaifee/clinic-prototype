// jsdom has no fetch, so tests install a stub that answers by URL.
export function mockFetch(routes: Record<string, { body: unknown; status?: number }>) {
  const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    const { body, status = 200 } = routes[url] ?? { body: { error: 'Not found' }, status: 404 };
    return { ok: status < 400, status, statusText: 'Error', json: async () => body };
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
