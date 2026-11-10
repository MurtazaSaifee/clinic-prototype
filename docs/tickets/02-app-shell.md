# 02 App shell and API client

Spec: sections 3, 9 (conventions), 10. Estimate: 6m.

## Goal
The shared pieces every later ticket uses: navigation, the "Signed in as" picker, the API client, and server helpers.

## Tasks
- Server:
  - `GET /api/staff`.
  - Helpers: `parse(schema, input)` that throws a 400 with zod details; `requireStaff(req)` reading `X-Staff-Id` (400 if missing or unknown); `paginate(query, page, pageSize)` returning `{ data, page, page_size, total }`; a `HttpError(status, message)` the error handler understands.
  - Shared zod schema for `page` and `page_size` (default 1 and 25, max 100).
- Client:
  - Header with clinic name, nav (Today, Patients, Results, Studies), staff picker remembered in localStorage (wrapped in try/catch).
  - Simple routing with React state or the URL hash (no router library).
  - `api()` sends `X-Staff-Id`; shared `Paged<T>` type; `Pager` component ("page X of Y", disabled at the ends).
  - Labels map for enum values (`READY_FOR_DOCTOR` → "Ready for doctor").

## Acceptance
- Picking a staff member persists across reloads, and every request carries their id.
- A write without `X-Staff-Id` gets 400.

## Tests
- Server: `GET /api/staff`; `requireStaff` rejects a missing or unknown id.
- Client: staff picker sets the header on the next request; Pager disables Previous on page 1.
