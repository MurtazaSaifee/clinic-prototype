import type { CandidateStatus, ContactOutcome } from '../enums.ts';

// Spec F9: only a call that reaches the patient moves them on to the consent question.
export function statusAfterCall(outcome: ContactOutcome): CandidateStatus {
  return outcome === 'REACHED' ? 'PENDING_CONSENT' : 'PENDING_CONTACT';
}

export const CONSENT_DECISIONS = ['CONSENTED', 'DECLINED'] as const;
