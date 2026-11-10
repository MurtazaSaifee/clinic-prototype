# 05 Nurse intake, doctor visit, checkout

Spec: flows F5, F6, F7. Estimate: 15m.

## Goal
Each handoff carries what the next person needs: reason and nurse notes reach the doctor; checkout tasks reach reception.

## API
- `GET /api/appointments/:id`: visit with vitals, notes, patient, diagnoses[], checkout_tasks[].
- `PATCH /api/appointments/:id`: vitals and notes (zod: sensible ranges, for example heart rate 20 to 250).
- `POST /api/appointments/:id/checkout-tasks`: `{ description }` → 201.
- `PATCH /api/checkout-tasks/:id`: `{ completed }`; stamps `completed_at` and `completed_by` from `X-Staff-Id`, clears them when false.
- Status move to `CHECKED_OUT` with open tasks → 409 "N checkout tasks still open".

## UI
- Visit panel opens from any board row. Shows reason at the top. Sections by status:
  - `CHECKED_IN`: vitals form + nurse notes, Send to doctor.
  - `READY_FOR_DOCTOR`: read-only vitals and nurse notes, diagnoses, doctor notes, add task, Send to checkout.
  - `READY_FOR_CHECKOUT`: task checklist (who and when on done ones), Check out disabled while any is open.
- Doctor tab lists the signed-in physician's patients first.

## Acceptance (from spec)
- Doctor sees reason, nurse notes, vitals and diagnoses on one screen.
- Checkout is blocked in the UI and by the server while tasks are open.

## Tests
- Server: patch vitals; out-of-range vitals 400; add task; complete task stamps staff; checkout blocked with open task, allowed after completing it.
- Client: Check out button disabled until all tasks are ticked.
