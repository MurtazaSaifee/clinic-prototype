# 06 Study screening

Spec: flow F8, section 8. Estimate: 15m.

## Goal
Staff see possible matches for the study, with the evidence for every criterion, and record their decision.

## API
- zod schema for criteria: discriminated union on `type` (`AGE_BETWEEN` with optional `min`/`max`, `DIAGNOSIS` with `icd10_prefixes[]` and `label`). Seed data is parsed with it too.
- `evaluate(criteria, patient, diagnoses, today)`: pure function returning `[{ criterion, met, evidence }]`. Evidence text, for example "Age 54 (18 to 75 required)", "E11.9 Type 2 diabetes mellitus, diagnosed 2023-04-01", "No diagnosis starting E11".
- `GET /api/studies`.
- `GET /api/studies/:id/matches?page=`: patients without a candidate row for the study where every criterion is met, with reasons. Paged in memory.
- `POST /api/studies/:id/candidates`: `{ patient_id, eligible }` → 201. Re-evaluates and saves reasons in `match_reasons`; status `PENDING_CONTACT` or `NOT_ELIGIBLE`; stamps reviewer. 409 if already checked.

## UI
- Studies page: study name, description, criteria in plain words. Tabs: Possible matches, Call list (ticket 07).
- Each match: patient name, age, phone, one line per criterion with a tick and the evidence. Buttons Eligible and Not eligible.

## Acceptance (from spec)
- Only patients meeting every criterion appear; E10-only and over-75 patients don't.
- After a decision the patient leaves the list, and the saved reasons match what was shown.

## Tests
- Server unit: `evaluate` for age at the bounds (birthday today, day before), age outside, no diagnosis, E10 only, E11.9 match, multiple prefixes.
- Server API: matches exclude checked patients; decision 201 then 409 on repeat.
- Client: match card renders each reason and posts the decision.
