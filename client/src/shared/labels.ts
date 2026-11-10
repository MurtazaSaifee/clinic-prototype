import type {
  AppointmentStatus,
  CandidateStatus,
  ContactOutcome,
  Sex,
  StaffRole,
} from '../../../server/src/enums.ts';

// Typed against the server's enums, so a new value fails the typecheck until it has a label.
export const labels: Record<StaffRole | Sex | AppointmentStatus | CandidateStatus | ContactOutcome, string> = {
  PHYSICIAN: 'Physician',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  FEMALE: 'Female',
  MALE: 'Male',
  SCHEDULED: 'Scheduled',
  CHECKED_IN: 'Checked in',
  READY_FOR_DOCTOR: 'Ready for doctor',
  READY_FOR_CHECKOUT: 'Ready for checkout',
  CHECKED_OUT: 'Checked out',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
  NOT_ELIGIBLE: 'Not eligible',
  PENDING_CONTACT: 'Needs a call',
  PENDING_CONSENT: 'Awaiting consent',
  CONSENTED: 'Consented',
  DECLINED: 'Declined',
  REACHED: 'Reached',
  NO_ANSWER: 'No answer',
  VOICEMAIL: 'Left voicemail',
  WRONG_NUMBER: 'Wrong number',
};
