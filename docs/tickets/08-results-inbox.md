# 08 Results inbox

Spec: flow F10. Estimate: 8m. First to cut if time runs short.

## Goal
The doctor never loses track of a result they haven't looked at.

## API
- `GET /api/test-results?reviewed=false&page=`: abnormal first, then oldest first, with patient (id, name).
- `POST /api/test-results/:id/review`: stamps `reviewed_at`, `reviewed_by`. 409 if already reviewed.

## UI
- Results page: count in the nav, list with abnormal results flagged, Mark reviewed per row.

## Acceptance (from spec)
- Unreviewed only, abnormal first. Reviewing removes it and records who.

## Tests
- Server: ordering; review stamps staff; repeat review 409.
- Client: Mark reviewed removes the row.
