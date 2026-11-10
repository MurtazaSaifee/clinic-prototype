# 07 Study outreach and consent

Spec: flow F9. Estimate: 12m.

## Goal
Reception knows who still needs a call and who has been reached, and everyone can see consent status.

## API
- `GET /api/studies/:id/candidates?status=&page=`: paged, with patient (id, name, phone), match_reasons, attempt_count, last_attempt (outcome, attempted_at, staff_name). Default status `PENDING_CONTACT`; oldest last attempt first, never-called first.
- `POST /api/candidates/:id/contact-attempts`: `{ outcome, notes? }` → 201. Only from `PENDING_CONTACT` (409 otherwise). `REACHED` moves to `PENDING_CONSENT`.
- `PATCH /api/candidates/:id`: `{ status: CONSENTED | DECLINED }`, only from `PENDING_CONSENT` (409 otherwise).

## UI
- Call list tab: status filter with counts, rows with name, phone (large, easy to read), attempts, last attempt.
- Log call: outcome buttons plus optional note.
- `PENDING_CONSENT` rows: Consented and Declined buttons.

## Acceptance (from spec)
- `NO_ANSWER`, `VOICEMAIL`, `WRONG_NUMBER` keep the candidate in `PENDING_CONTACT` and raise the attempt count.
- `REACHED` moves to `PENDING_CONSENT`; consent decision moves to `CONSENTED` or `DECLINED`.

## Tests
- Server: each outcome's effect; consent only from `PENDING_CONSENT`; list counts and last attempt.
- Client: logging an outcome posts it and refreshes the row.
