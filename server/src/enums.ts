export const STAFF_ROLES = ['PHYSICIAN', 'NURSE', 'RECEPTIONIST'] as const;

export const SEXES = ['FEMALE', 'MALE'] as const;

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CHECKED_IN',
  'READY_FOR_DOCTOR',
  'READY_FOR_CHECKOUT',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
] as const;

export const CANDIDATE_STATUSES = [
  'NOT_ELIGIBLE',
  'PENDING_CONTACT',
  'PENDING_CONSENT',
  'CONSENTED',
  'DECLINED',
] as const;

export const CONTACT_OUTCOMES = ['REACHED', 'NO_ANSWER', 'VOICEMAIL', 'WRONG_NUMBER'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type Sex = (typeof SEXES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];
