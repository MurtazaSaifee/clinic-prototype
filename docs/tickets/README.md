# Build milestones

Sequential implementation milestones mapped to [../spec.md](../spec.md).

| # | Milestone | Flows | Depends on | Status |
|---|---|---|---|---|
| 01 | [Schema and seed](01-schema-and-seed.md) | all | | Done |
| 02 | [App shell and API client](02-app-shell.md) | all | 01 | Done |
| 03 | [Patients: lookup, register, edit](03-patients.md) | F1, F2 | 02 | Done |
| 04 | [Today board, booking, check-in](04-today-booking-checkin.md) | F3, F4 | 03 | Done |
| 05 | [Nurse intake, doctor visit, checkout](05-intake-visit-checkout.md) | F5, F6, F7 | 04 | Done |
| 06 | [Study screening](06-study-screening.md) | F8 | 02 | Done |
| 07 | [Study outreach and consent](07-study-outreach.md) | F9 | 06 | Done |
| 08 | [Results inbox](08-results-inbox.md) | F10 | 02 | Done |
| 09 | [README](09-readme.md) | | all | Done |

Each milestone is complete when its acceptance criteria pass automated tests (`npm test`, `npm run typecheck`), the flow is verified end-to-end in the browser, and the diff is reviewed before commit.
