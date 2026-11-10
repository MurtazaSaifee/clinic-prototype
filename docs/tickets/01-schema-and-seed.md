# 01 Schema and seed

Spec: sections 6, 7, 8, 11. Estimate: 12m.

## Goal
Every table from the data model exists, and `npm run db:reset` fills it with synthetic data that makes every queue and list non-empty on first open.

## Tasks
- Edit the existing patients migration in place: sex becomes `FEMALE | MALE`, phone becomes required.
- One migration for the remaining tables: staff, appointments, checkout_tasks, diagnoses, test_results, clinical_studies, study_candidates, contact_attempts. Columns, nullability, defaults, FKs and indexes exactly as the spec tables.
- Raw SQL for the partial unique index on appointments `(physician_id, scheduled_at)` where status not in `CANCELLED`, `NO_SHOW`.
- `server/src/enums.ts`: one array per enum (UPPER_SNAKE_CASE), used by migrations now and zod later.
- Seed (fixed faker seed and reference date):
  - 2 physicians, 2 nurses, 1 receptionist.
  - 120 patients aged 18 to 90, all with phone.
  - Diagnoses: common codes; about 20 patients with E11.x; a few with E10.x; a few E11 patients over 75.
  - About 12 visits on the reference date across every status, a few future visits, some past checked-out visits. Open checkout tasks on the `READY_FOR_CHECKOUT` visits.
  - About 15 test results, half unreviewed, some abnormal (HbA1c).
  - Study "GLUCO-STEP" with criteria `AGE_BETWEEN 18..75` and `DIAGNOSIS E11`.
  - A few study candidates in each status, with contact attempts.

## Acceptance
- `npm run db:reset` succeeds twice in a row.
- Inserting a second non-cancelled visit for the same physician and slot fails; inserting one after cancelling the first succeeds.
- Existing server tests still pass (update the patient count and sort test as needed).

## Tests
- Server: schema test for the double-booking index (insert, conflict, cancel, insert).
