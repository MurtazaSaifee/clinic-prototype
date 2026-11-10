import type { AppointmentStatus } from '../enums.ts';

// Spec section 7: the only moves a visit can make.
const NEXT: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['READY_FOR_DOCTOR'],
  READY_FOR_DOCTOR: ['READY_FOR_CHECKOUT'],
  READY_FOR_CHECKOUT: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canMove(from: AppointmentStatus, to: AppointmentStatus) {
  return NEXT[from].includes(to);
}
