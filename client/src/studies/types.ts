import type { CandidateStatus, ContactOutcome } from '../../../server/src/enums.ts';
import type { Paged } from '../shared/types.ts';

export type Criterion =
  | { type: 'AGE_BETWEEN'; min?: number; max?: number }
  | { type: 'DIAGNOSIS'; icd10_prefixes: string[]; label: string };

export type CriterionResult = { criterion: Criterion; met: boolean; evidence: string };

export type Study = { id: number; name: string; description: string; criteria: Criterion[] };

export type Match = {
  patient: { id: number; name: string; date_of_birth: string; phone: string };
  reasons: CriterionResult[];
};

export type CallListRow = {
  id: number;
  status: CandidateStatus;
  patient: { id: number; name: string; phone: string };
  attempt_count: number;
  last_attempt: { outcome: ContactOutcome; attempted_at: string; staff_name: string } | null;
};

export type CallList = Paged<CallListRow> & { counts: Record<CandidateStatus, number> };
