type Route = { body: unknown; status?: number };

// jsdom has no fetch, so tests install a stub. Routes are keyed by path ("/api/patients")
// or by method and path ("POST /api/patients"); the query string is ignored.
export function mockFetch(routes: Record<string, Route>) {
  const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    const path = url.split('?')[0];
    const route = routes[`${init.method ?? 'GET'} ${path}`] ?? routes[path];
    const { body, status = 200 } = route ?? { body: { error: 'Not found' }, status: 404 };
    return { ok: status < 400, status, statusText: 'Error', json: async () => body };
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
