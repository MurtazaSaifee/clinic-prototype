# 03 Patients: lookup, register, edit

Spec: flows F1, F2. Estimate: 15m.

## Goal
Reception finds any patient and their phone number in seconds, registers new patients, and fixes details.

## API
- `GET /api/patients?q=&page=&page_size=`: paged, sorted by last then first name. `q` matches first name, last name, "last, first", or phone digits (non-digits stripped on both sides).
- `POST /api/patients` → 201.
- `GET /api/patients/:id`, 404 if unknown.
- `PATCH /api/patients/:id`: same zod schema as create, with `.partial()`.
- Validation: names non-empty, date of birth a real date not in the future, sex `FEMALE | MALE`, phone required with at least 7 digits, email optional but valid.

## UI
- Patients page: search box (debounced), table with name, date of birth, phone, Edit; Pager; New patient button.
- One form for create and edit, with per-field errors from the API.

## Acceptance (from spec)
- 25 per page, "page X of Y".
- "555 01" and "55501" both match "(555) 012-3456".
- Invalid input shows a message per field. A new patient appears in search straight away.

## Tests
- Server: search by name, by "last, first", by phone digits with formatting; paging totals; create 201; create with bad fields 400 with field details; patch; 404.
- Client: typing in search calls the API with `q`; form shows field errors from a 400.
