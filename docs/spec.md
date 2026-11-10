# Clinic prototype: spec

Status: approved, 2026-11-10. Built inside a two-hour timebox.

## 1. Goal

A working prototype for a small clinic (physicians, nurses, one receptionist) that helps staff with everyday visits and finds patients who may qualify for a clinical study. All patient data is synthetic.

## 2. What the clinic owner asked for

From the owner's reply to my clarifying questions:

1. A visit goes reception (check-in) → nurse → doctor → reception (checkout). Make those handoffs easier.
2. The doctor sees why the patient came in and what the nurse noted.
3. At checkout, reception knows what still needs to happen before the patient leaves.
4. Test results arrive after the visit. The doctor loses track of which ones still need review.
5. Reception is slow to find a patient's phone number.
6. One example study is enough. Each study has its own criteria (for example, adults with a documented diabetes diagnosis).
7. Staff see why a patient came up as a possible match, so they can check it.
8. Receptionists call checked patients about the study. Staff see who still needs a call and who has been reached.
9. Staff see whether a patient has consented to the study.

## 3. Users

| Role | Main jobs in the prototype |
|---|---|
| Receptionist | Register and edit patients, book visits, check in, find patients and phone numbers, check out, call study candidates |
| Nurse | Intake: vitals and nurse notes, send to doctor |
| Physician | Read reason and nurse notes, write notes, add checkout tasks, review test results, screen study matches |

There is no login. A "Signed in as" picker in the header chooses the acting staff member. The client sends their id as `X-Staff-Id` so the server can record who did what.

## 4. Scope

### In scope

| # | Flow | Owner need |
|---|---|---|
| F1 | Patient lookup by name or phone, paged | 5 |
| F2 | Register a new patient, edit patient details | 5 |
| F3 | Book a visit | 1 |
| F4 | Check in | 1 |
| F5 | Nurse intake | 1, 2 |
| F6 | Doctor visit and checkout tasks | 2, 3 |
| F7 | Checkout | 3 |
| F8 | Study screening with reasons | 6, 7 |
| F9 | Study outreach and consent | 8, 9 |
| F10 | Doctor's results inbox | 4 |

### Deferred (noted, not planned for this timebox)

- S1. Doctor adds a diagnosis during a visit, and the patient then appears in study matches.
- S2. Patient detail page with diagnoses, visits, results and study status together.

### Out of scope

Real login and role permissions, deleting patients, editing or creating studies in the UI (criteria live in the seed), SMS or email, audit log, rooms and multiple locations, rescheduling.

## 5. User flows and acceptance criteria

Each flow is done when its criteria pass in tests (server, and client where noted) and in a manual run in the browser.

**F1 Patient lookup**
- Patients page lists patients 25 per page, sorted by last name, with name, date of birth and phone.
- Typing in search filters by name (first, last, or "last, first") or by phone digits. "555 01" and "55501" both match "(555) 012-3456".
- Page controls show "page X of Y" and disable at the ends.

**F2 Register and edit patient**
- New patient on the Patients page opens a form with name, date of birth, sex, phone, email. Edit on a row opens the same form filled in.
- Name, date of birth, sex and phone are required. Email is optional.
- Invalid input (empty name, future date of birth, malformed email) is rejected with a message per field (zod, 400).
- A new patient can be booked straight away (F3). Saved changes show in the list straight away.

**F3 Book a visit**
- Receptionist picks a patient, a physician, a date and a 30-minute slot, and enters a reason.
- A physician can't be double-booked: a second visit in the same slot returns 409 and the form says so. Cancelled and no-show visits free the slot.
- The new visit appears on the Today board for that date with status `SCHEDULED`.

**F4 Check in**
- Today board shows the day's visits in time order with patient, phone, physician, reason and status.
- Reception clicks Check in on a `SCHEDULED` visit; it moves to `CHECKED_IN` and into the nurse's queue.
- Reception can also mark a visit `CANCELLED` or `NO_SHOW`.

**F5 Nurse intake**
- Nurse's view shows `CHECKED_IN` visits.
- Opening one shows the reason. Nurse records height, weight, blood pressure, heart rate and notes, then Send to doctor (`READY_FOR_DOCTOR`).

**F6 Doctor visit**
- Doctor's view shows `READY_FOR_DOCTOR` visits for any physician (small clinic), own patients first.
- Opening one shows reason, nurse notes, vitals and the patient's diagnoses.
- Doctor writes notes, adds checkout tasks (free text, for example "Book follow-up in 2 weeks", "Blood draw for HbA1c"), then Send to checkout (`READY_FOR_CHECKOUT`).

**F7 Checkout**
- Reception's view shows `READY_FOR_CHECKOUT` visits with the open task count.
- Opening one lists tasks. Reception ticks each off (records who and when).
- Check out is disabled while any task is open; the server also refuses it (409).

**F8 Study screening**
- Studies page shows the example study, its criteria in plain words, and its possible matches (paged).
- A possible match is a patient who meets every criterion and hasn't been checked yet for this study.
- Each match shows one line per criterion with the evidence, for example "Age 54 (18 to 75 required)" and "E11.9 Type 2 diabetes mellitus, diagnosed 2023-04-01".
- Staff click Eligible (→ `PENDING_CONTACT`) or Not eligible (→ `NOT_ELIGIBLE`). The reasons are saved with the decision. The patient leaves the matches list.

**F9 Outreach and consent**
- Call list shows candidates by status, with phone, attempt count and last attempt (outcome, when, by whom). Default filter is `PENDING_CONTACT`.
- Log call records an outcome: `REACHED`, `NO_ANSWER`, `VOICEMAIL`, `WRONG_NUMBER`, plus optional notes.
- `REACHED` moves the candidate to `PENDING_CONSENT`. Other outcomes keep it in `PENDING_CONTACT`.
- From `PENDING_CONSENT`, staff mark Consented or Declined. Consent status is visible in the list.

**F10 Results inbox**
- Physician's Results page lists unreviewed results, abnormal first, then oldest first, paged.
- Mark reviewed records who and when, and removes it from the list.

## 6. Data model

Every table has `id serial primary key`. "FK" means a foreign key; "Null" means the column is optional.

### staff

| Column | Type | Null | Notes |
|---|---|---|---|
| name | text | no | |
| role | enum | no | `PHYSICIAN`, `NURSE`, `RECEPTIONIST` |

### patients

| Column | Type | Null | Notes |
|---|---|---|---|
| first_name | text | no | |
| last_name | text | no | |
| date_of_birth | date | no | Age is derived from this, never stored |
| sex | enum | no | `FEMALE`, `MALE` |
| phone | text | no | Stored as typed; search compares digits only |
| email | text | yes | |
| created_at | timestamptz | no | Default `now()` |
| updated_at | timestamptz | no | Default `now()` |

Indexes: `(last_name, first_name)`.

### appointments

One row is one visit, from booking to checkout.

| Column | Type | Null | Notes |
|---|---|---|---|
| patient_id | integer | no | FK → `patients` |
| physician_id | integer | no | FK → `staff` |
| scheduled_at | timestamptz | no | Start of a 30-minute slot |
| reason | text | no | Why the patient is coming in |
| status | enum | no | See section 7. Default `SCHEDULED` |
| height_cm | real | yes | Nurse intake |
| weight_kg | real | yes | Nurse intake |
| bp_systolic | integer | yes | Nurse intake |
| bp_diastolic | integer | yes | Nurse intake |
| heart_rate | integer | yes | Nurse intake |
| nurse_notes | text | yes | Nurse intake |
| doctor_notes | text | yes | Doctor visit |
| created_at | timestamptz | no | Default `now()` |
| updated_at | timestamptz | no | Default `now()` |

Indexes: `(scheduled_at)`; unique `(physician_id, scheduled_at)` where `status` is not `CANCELLED` or `NO_SHOW`.

### checkout_tasks

| Column | Type | Null | Notes |
|---|---|---|---|
| appointment_id | integer | no | FK → `appointments`, cascade delete |
| description | text | no | For example "Book follow-up in 2 weeks" |
| completed_at | timestamptz | yes | Null while the task is open |
| completed_by | integer | yes | FK → `staff` |
| created_at | timestamptz | no | Default `now()` |

### diagnoses

| Column | Type | Null | Notes |
|---|---|---|---|
| patient_id | integer | no | FK → `patients` |
| icd10_code | text | no | For example `E11.9` |
| description | text | no | For example "Type 2 diabetes mellitus without complications" |
| diagnosed_on | date | no | |

Indexes: `(patient_id)`.

### test_results

| Column | Type | Null | Notes |
|---|---|---|---|
| patient_id | integer | no | FK → `patients` |
| appointment_id | integer | yes | FK → `appointments`; the visit that ordered it |
| test_name | text | no | For example "HbA1c" |
| result | text | no | For example "8.1 %" |
| is_abnormal | boolean | no | Default `false` |
| resulted_at | timestamptz | no | When the result came back |
| reviewed_at | timestamptz | yes | Null means it is still in the doctor's inbox |
| reviewed_by | integer | yes | FK → `staff` |

### clinical_studies

| Column | Type | Null | Notes |
|---|---|---|---|
| name | text | no | |
| description | text | no | |
| criteria | jsonb | no | List of criteria, validated by zod. See section 8 |

### study_candidates

A row exists only once a staff member has checked a possible match.

| Column | Type | Null | Notes |
|---|---|---|---|
| patient_id | integer | no | FK → `patients` |
| study_id | integer | no | FK → `clinical_studies` |
| status | enum | no | `NOT_ELIGIBLE`, `PENDING_CONTACT`, `PENDING_CONSENT`, `CONSENTED`, `DECLINED` |
| match_reasons | jsonb | no | The evidence the reviewer saw when they decided |
| reviewed_by | integer | no | FK → `staff` |
| reviewed_at | timestamptz | no | Default `now()` |
| updated_at | timestamptz | no | Default `now()` |

Indexes: unique `(patient_id, study_id)`.

### contact_attempts

| Column | Type | Null | Notes |
|---|---|---|---|
| candidate_id | integer | no | FK → `study_candidates`, cascade delete |
| staff_id | integer | no | FK → `staff`; who made the call |
| attempted_at | timestamptz | no | Default `now()` |
| outcome | enum | no | `REACHED`, `NO_ANSWER`, `VOICEMAIL`, `WRONG_NUMBER` |
| notes | text | yes | |

Choices worth noting:
- Patients don't log in, so they aren't in `staff`.
- Age is derived from `date_of_birth` on the day it's needed. It's never stored.
- Height and weight belong to a visit, not a patient.
- Phone is a real column because lookup speed is a stated pain point.
- An appointment row is the visit. This saves a table; the cost is that a walk-in needs an appointment row too.
- Possible matches are computed live and never stored. A `study_candidates` row exists only once a person has checked the match.
- The double-booking rule is a partial unique index, so the database enforces it, not just the API.

## 7. Visit status

```
SCHEDULED → CHECKED_IN → READY_FOR_DOCTOR → READY_FOR_CHECKOUT → CHECKED_OUT
SCHEDULED → CANCELLED
SCHEDULED → NO_SHOW
```

Any other change returns 409. Moving to `CHECKED_OUT` with open checkout tasks returns 409. The rules live in one function on the server with unit tests.

## 8. Study criteria and matching

Criteria are a zod-validated list stored as jsonb:

```json
[
  { "type": "AGE_BETWEEN", "min": 18, "max": 75 },
  { "type": "DIAGNOSIS", "icd10_prefixes": ["E11"], "label": "Type 2 diabetes" }
]
```

Supported types: `AGE_BETWEEN` (either bound optional) and `DIAGNOSIS` (any diagnosis whose code starts with one of the prefixes).

The matcher is a pure function: `evaluate(criteria, patient, diagnoses, today) → [{ criterion, met, evidence }]`. A patient is a possible match when every result has `met: true`. `today` is passed in so tests don't depend on the calendar. The server loads patients without a candidate row for the study, plus their diagnoses, and evaluates them in code. That's fine at clinic scale; a large practice would push the filters into SQL.

Example study: "GLUCO-STEP", a fictional lifestyle study for adults 18 to 75 with type 2 diabetes.

## 9. REST API

Conventions:
- JSON, snake_case fields matching the database columns. Enum values are UPPER_SNAKE_CASE everywhere (database, API, client).
- Writes that record a person require the `X-Staff-Id` header (400 without it).
- Bodies and query strings are validated with zod. Errors are `400 { error, details }`, `404 { error }`, `409 { error }`.
- Paged lists take `?page=1&page_size=25` (max 100) and return `{ data, page, page_size, total }`.

```
GET   /api/staff                                [{ id, name, role }]

GET   /api/patients?q=&page=                    paged [{ id, first_name, last_name, date_of_birth, sex, phone, email }]
POST  /api/patients                             { first_name, last_name, date_of_birth, sex, phone, email? } → 201
GET   /api/patients/:id                         patient
PATCH /api/patients/:id                         { first_name?, last_name?, date_of_birth?, sex?, phone?, email? }

GET   /api/appointments?date=YYYY-MM-DD         [{ id, scheduled_at, status, reason, patient{ id, name, phone },
                                                   physician{ id, name }, open_task_count }]
POST  /api/appointments                         { patient_id, physician_id, scheduled_at, reason } → 201; 409 if slot taken
GET   /api/appointments/:id                     visit with vitals, notes, patient, diagnoses[], checkout_tasks[]
PATCH /api/appointments/:id                     { reason?, height_cm?, weight_kg?, bp_systolic?, bp_diastolic?,
                                                  heart_rate?, nurse_notes?, doctor_notes? }
POST  /api/appointments/:id/status              { status }; 409 on a disallowed change
POST  /api/appointments/:id/checkout-tasks      { description } → 201
PATCH /api/checkout-tasks/:id                   { completed }

GET   /api/test-results?reviewed=false&page=    paged [{ id, test_name, result, is_abnormal, resulted_at, patient{ id, name } }]
POST  /api/test-results/:id/review              stamps reviewed_at, reviewed_by

GET   /api/studies                              [{ id, name, description, criteria }]
GET   /api/studies/:id/matches?page=            paged [{ patient{ id, name, date_of_birth, phone }, reasons[] }]
POST  /api/studies/:id/candidates               { patient_id, eligible } → 201
GET   /api/studies/:id/candidates?status=&page= paged [{ id, status, patient{ id, name, phone }, match_reasons,
                                                   attempt_count, last_attempt{ outcome, attempted_at, staff_name } }]
POST  /api/candidates/:id/contact-attempts      { outcome, notes? } → 201; REACHED moves to PENDING_CONSENT
PATCH /api/candidates/:id                       { status: CONSENTED | DECLINED } (only from PENDING_CONSENT)
```

## 10. Screens

- **Header:** clinic name, nav, "Signed in as" picker (remembered in localStorage).
- **Today:** date picker, Book visit button, visit list. Opens on the signed-in role's queue (reception: scheduled and ready for checkout; nurse: checked in; physician: ready for doctor), with an "All" tab. Clicking a visit opens a panel with the actions for its status.
- **Patients:** search box, New patient button, paged table, Edit per row. One form for create and edit.
- **Results:** physician inbox.
- **Studies:** study summary, then two tabs: Possible matches and Call list.

Plain CSS, no component library. Desktop first, usable on a tablet.

## 11. Synthetic data

Seeded with faker using a fixed seed and fixed reference date, so every run gives the same data.

- Staff: 2 physicians, 2 nurses, 1 receptionist.
- 120 patients aged 18 to 90 (enough for 5 pages).
- Diagnoses: common ICD-10 codes (hypertension, asthma, hyperlipidemia), about 20 patients with type 2 diabetes (E11), a few with type 1 (E10) and a few over 75 with E11, so the criteria visibly matter.
- Today's visits: about 12 across every status, so every queue has something in it. Some future visits too.
- Test results: about 15, half unreviewed, some abnormal (for example HbA1c 8.1%).
- Study candidates: a few already in each status, with call attempts, so the call list isn't empty on first open.

## 12. Tech and testing

- Client: React 19, Vite, TypeScript. Server: Express 5, TypeScript run directly by Node 26, knex, zod, Postgres 18.
- `npm run db:reset` rebuilds the database; `npm run dev` runs both; `npm test` and `npm run typecheck` cover both packages.
- Server tests use supertest against a separate `clinic_test` database, rebuilt before each run. One test file per resource. Unit tests for the matcher and the status rules.
- Client tests use Testing Library with a stubbed fetch, one per main screen action.
- Each flow is also walked through by hand in the browser before its commit.

## 13. Build order and time

| Step | Commit | Est. |
|---|---|---|
| 1 | Migrations and seed for all tables | 12m |
| 2 | Layout, nav, staff picker, API client with `X-Staff-Id` and paging types | 6m |
| 3 | F1, F2: patient lookup, paging, register, edit | 15m |
| 4 | F3, F4: Today board, booking, check-in, status rules | 15m |
| 5 | F5, F6, F7: intake, doctor visit, checkout tasks, checkout | 15m |
| 6 | F8: matcher and screening | 15m |
| 7 | F9: call list and consent | 12m |
| 8 | F10: results inbox | 8m |
| 9 | README | 5m |

About 103 minutes against about 90 available. If time runs short, cut in this order: F10 results inbox, paging on lists other than patients, the cancel and no-show actions.

## 14. Assumptions

- One clinic, one location, 30-minute slots, no rooms.
- Any physician can see any patient. "Own patients first" is ordering only.
- The receptionist is the one who calls study candidates, but any staff member can log a call.
- Consent is recorded as a status only. No consent document.
