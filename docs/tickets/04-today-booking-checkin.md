# 04 Today board, booking, check-in

Spec: flows F3, F4, section 7. Estimate: 15m.

## Goal
Reception sees the day at a glance, books visits without double-booking, and checks patients in.

## API
- `GET /api/appointments?date=YYYY-MM-DD`: time order, with patient (id, name, phone), physician (id, name), reason, status, open_task_count.
- `POST /api/appointments`: `{ patient_id, physician_id, scheduled_at, reason }`. `scheduled_at` must be on :00 or :30. Physician must have role `PHYSICIAN`. Unique violation → 409 "That physician already has a visit at this time".
- `POST /api/appointments/:id/status`: `{ status }`. Allowed moves in one function `canMove(from, to)` (spec section 7). Anything else → 409.

## UI
- Today page: date picker (defaults to today), Book visit button, visit list.
- Role tabs: Reception (`SCHEDULED`, `READY_FOR_CHECKOUT`), Nurse (`CHECKED_IN`), Doctor (`READY_FOR_DOCTOR`), All. Opens on the signed-in role's tab.
- Booking form: patient search (reuse from 03), physician select, date, slot select (08:00 to 17:00), reason. Shows the 409 message inline.
- Row actions on `SCHEDULED`: Check in, Cancel, No show.

## Acceptance (from spec)
- New visit appears on the board with status `SCHEDULED`.
- Same physician, same slot → 409 and the form says so. Cancelled or no-show frees the slot.
- Check in moves the visit to `CHECKED_IN` and into the nurse tab.

## Tests
- Server: `canMove` unit table (every allowed and a sample of disallowed moves); list by date; book 201; double-book 409; book after cancel 201; off-slot time 400; status 409 on a bad move.
- Client: check-in button posts the status and the row moves tabs.
