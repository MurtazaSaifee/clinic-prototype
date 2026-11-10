# Tickets

One ticket per commit, built in order. Each ticket points back to the spec ([../spec.md](../spec.md)) for detail.

| # | Ticket | Flows | Est. | Depends on | Status |
|---|---|---|---|---|---|
| 01 | [Schema and seed](01-schema-and-seed.md) | all | 12m | | Done |
| 02 | [App shell and API client](02-app-shell.md) | all | 6m | 01 | Done |
| 03 | [Patients: lookup, register, edit](03-patients.md) | F1, F2 | 15m | 02 | Todo |
| 04 | [Today board, booking, check-in](04-today-booking-checkin.md) | F3, F4 | 15m | 03 | Todo |
| 05 | [Nurse intake, doctor visit, checkout](05-intake-visit-checkout.md) | F5, F6, F7 | 15m | 04 | Todo |
| 06 | [Study screening](06-study-screening.md) | F8 | 15m | 02 | Todo |
| 07 | [Study outreach and consent](07-study-outreach.md) | F9 | 12m | 06 | Todo |
| 08 | [Results inbox](08-results-inbox.md) | F10 | 8m | 02 | Todo |
| 09 | [README](09-readme.md) | | 5m | all | Todo |

Cut order if time runs short: 08, then paging on lists other than patients, then cancel and no-show.

Every ticket is done when: its acceptance criteria pass in tests, `npm test` and `npm run typecheck` pass, the flow works by hand in the browser, and the diff has been reviewed before commit.
