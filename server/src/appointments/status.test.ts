import { APPOINTMENT_STATUSES } from '../enums.ts';
import { canMove } from './status.ts';

const allowed = [
  'SCHEDULED → CHECKED_IN',
  'SCHEDULED → CANCELLED',
  'SCHEDULED → NO_SHOW',
  'CHECKED_IN → READY_FOR_DOCTOR',
  'READY_FOR_DOCTOR → READY_FOR_CHECKOUT',
  'READY_FOR_CHECKOUT → CHECKED_OUT',
];

// Every pair of statuses, so a move added by mistake fails here too.
const everyMove = APPOINTMENT_STATUSES.flatMap((from) => APPOINTMENT_STATUSES.map((to) => [from, to] as const));

test.each(everyMove)('%s → %s', (from, to) => {
  expect(canMove(from, to)).toBe(allowed.includes(`${from} → ${to}`));
});
