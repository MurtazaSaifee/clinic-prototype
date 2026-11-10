# Clinic prototype

A working prototype for a small clinic. It helps staff move a patient through a visit (reception, nurse, doctor, checkout), keeps the doctor's test results from getting lost, and finds patients who may qualify for a clinical study, then tracks the calls and consent. All patient data is synthetic.

## Run it

You need Node 26 and Postgres running locally (I used Postgres 18). Node runs the server's TypeScript directly, so there is no build step.

```bash
npm install
cp server/.env.example server/.env
npm run db:reset
npm run dev
```

Open http://localhost:5173. The API runs on port 3001.

Newer npm versions may warn that install scripts for `@swc/core` and `@parcel/watcher` were skipped. Nothing here needs them, so you can ignore it.

`npm run db:reset` drops and recreates the `clinic` database, runs the migrations and loads the seed. Run it again any time to start over. If your Postgres needs a user or password, change `DATABASE_URL` in `server/.env`.

Pick someone under "Signed in as" in the header first. There is no login, so this is how the app knows who is doing what. Try the receptionist (Lena Novak), a nurse (Priya Shah) and a physician (Amara Okafor) to see each queue.

### Tests and typecheck

```bash
npm test
npm run typecheck
```

Both cover the client and the server. Server tests run against a separate `clinic_test` database, which is rebuilt at the start of each run (set `TEST_DATABASE_URL` to use a different one). There are 140 server tests and 31 client tests.

## What I built

I asked the clinic owner a few questions first. The spec in [docs/spec.md](docs/spec.md) lists their answers and maps each screen back to them. The work was split into the tickets in [docs/tickets/](docs/tickets/), one commit each.

**Receptionist**
- Patients page: search by name ("Smith" or "Smith, Jo") or by any part of the phone number, paged. Register and edit patients with one form. (Owner: reception is slow to find a phone number.)
- Today page: book a visit in a 30-minute slot, check patients in, and check them out. A physician can't be double-booked.
- Checkout shows the doctor's open checkout tasks, and checkout is refused until they are all done. (Owner: reception should know what still needs to happen before the patient leaves.)
- Studies, Call list: who still needs a call (never called first, then the longest wait), with a large phone number, how many calls so far and the last one (outcome, when, by whom). Log a call with an outcome and a note. Mark consent once the patient is reached.

**Nurse**
- Today opens on the checked-in queue. Intake records vitals (with sanity ranges) and nurse notes, then sends the patient to the doctor.

**Physician**
- Today opens on the ready-for-doctor queue, with the physician's own patients first. The visit panel shows the reason for the visit, the nurse's vitals and notes, and the patient's diagnoses, above the doctor's notes. (Owner: the doctor sees why the patient came in and what the nurse noted.)
- Add checkout tasks for reception, such as "Book follow-up in 2 weeks".
- Results page: unreviewed results, abnormal first, then oldest first. Mark reviewed records who and when. The nav shows how many are left. (Owner: the doctor loses track of results.)
- Studies, Possible matches: patients who meet every criterion for the example study, GLUCO-STEP (adults 18 to 75 with type 2 diabetes). Each match shows one line per criterion with the evidence, for example "E11.9 Type 2 diabetes mellitus without complications, diagnosed 2023-10-23", so staff can check it. Eligible sends the patient to the call list. (Owner: staff need to see why a patient matched.)

Every status change is checked on the server, both the allowed moves and two people clicking at once. Writes that record a person (study decisions, calls, task completion, result review) need the "Signed in as" choice.

## What I left out, and why

The timebox was two hours, so I kept to the ten flows the owner's answers called for.

- **Real login and role permissions.** The staff picker stands in for login. A role check on an id you choose yourself wouldn't protect anything, so any staff member can do any action.
- **Deleting patients, rescheduling, rooms, multiple locations, SMS or email.** The owner didn't ask for these.
- **Creating or editing studies in the UI.** One example study was enough for the owner. Its criteria live in the seed as validated JSON, so a second study is a data change, not a code change.
- **Audit log.** The app records who did the key actions (calls, reviews, study decisions, completed tasks) but keeps no history of edits.
- **Deferred:** adding a diagnosis during a visit (so a patient then shows up as a match), and a patient detail page that brings visits, results and study status together. These were the next two things I'd build.

## Known limits

- **No real auth.** Anyone can pick anyone in "Signed in as".
- **No audit log.** Edits to patients and visit notes overwrite the old values.
- **Matching runs in code, not SQL.** The server loads unscreened patients and their diagnoses and evaluates the criteria in TypeScript. That keeps the evidence text and the yes/no in one tested function and is fine for a clinic of this size. A large practice would push the filters into SQL first.
- **Times are UTC.** The clinic's day and the visit times are shown in UTC on every machine. A real clinic would store its own time zone.
- **The seed's "today" is the day you run `db:reset`,** so the Today board always has visits. Rerun it on a new day to get a fresh board.
- **Counts don't update live.** The Results badge and the call list counts refresh when you load the page or act on it, not when someone else does.
- Desktop first. It works on a tablet. It's usable on a phone, but I didn't design for one.

## How it's put together

- `client/` is React 19 with Vite and plain CSS. Colours, spacing and type sizes are CSS variables in `client/src/tokens.css`. Code is grouped by screen (`patients/`, `today/`, `studies/`, `results/`) plus `shared/`.
- `server/` is Express 5 with knex, zod and Postgres, grouped the same way. Each feature has `routes.ts` for HTTP and `store.ts` for the database. Rules with no database access, such as the visit status moves and the study matcher, are plain functions with their own unit tests.
- Enum values (statuses, roles, call outcomes) are defined once in `server/src/enums.ts` and used by the database, the API validation and the client labels.
