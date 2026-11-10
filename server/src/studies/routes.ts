import { Router } from 'express';
import { z } from 'zod';
import { CANDIDATE_STATUSES, CONTACT_OUTCOMES } from '../enums.ts';
import { HttpError, pageQuery, parse, requireStaff } from '../http.ts';
import { todayIso } from '../today.ts';
import { evaluate, meetsAll } from './criteria.ts';
import { CONSENT_DECISIONS, statusAfterCall } from './outreach.ts';
import {
  countCandidatesByStatus,
  createCandidate,
  findCallListRow,
  findScreenedPatient,
  findStudy,
  listCandidates,
  listStudies,
  logContactAttempt,
  recordConsent,
  unscreenedPatients,
} from './store.ts';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const decision = z.object({
  patient_id: z.number('Choose a patient').int().positive(),
  eligible: z.boolean('Say whether the patient is eligible'),
});

const callListQuery = pageQuery.extend({ status: z.enum(CANDIDATE_STATUSES).default('PENDING_CONTACT') });
const contactAttempt = z.object({
  outcome: z.enum(CONTACT_OUTCOMES, 'Choose how the call went'),
  notes: z.string().trim().max(2000).nullish().transform((v) => v || null),
});
const consent = z.object({ status: z.enum(CONSENT_DECISIONS, 'Choose CONSENTED or DECLINED') });

async function studyOr404(id: number) {
  const study = await findStudy(id);
  if (!study) throw new HttpError(404, 'Study not found');
  return study;
}

export const studyRoutes = Router();

studyRoutes.get('/', async (req, res) => {
  res.json(await listStudies());
});

// Paged in memory: every unchecked patient is evaluated, so the total is exact.
studyRoutes.get('/:id/matches', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { page, page_size } = parse(pageQuery, req.query);
  const study = await studyOr404(id);
  const today = todayIso();

  const matches = (await unscreenedPatients(id))
    .map((p) => ({ patient: p, reasons: evaluate(study.criteria, p, p.diagnoses, today) }))
    .filter((m) => meetsAll(m.reasons))
    .map(({ patient, reasons }) => ({
      patient: {
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        date_of_birth: patient.date_of_birth,
        phone: patient.phone,
      },
      reasons,
    }));

  res.json({
    data: matches.slice((page - 1) * page_size, page * page_size),
    page,
    page_size,
    total: matches.length,
  });
});

studyRoutes.post('/:id/candidates', async (req, res) => {
  const staff = await requireStaff(req);
  const { id } = parse(idParam, req.params);
  const { patient_id, eligible } = parse(decision, req.body);
  const study = await studyOr404(id);
  const patient = await findScreenedPatient(patient_id);
  if (!patient) throw new HttpError(400, 'Invalid input', { patient_id: ['Unknown patient'] });

  // Saved reasons come from the server's own evaluation, not from what the browser sent.
  const reasons = evaluate(study.criteria, patient, patient.diagnoses, todayIso());
  if (eligible && !meetsAll(reasons)) {
    throw new HttpError(409, 'This patient no longer meets every criterion');
  }

  const candidate = await createCandidate({
    study_id: id,
    patient_id,
    status: eligible ? 'PENDING_CONTACT' : 'NOT_ELIGIBLE',
    match_reasons: reasons,
    reviewed_by: staff.id,
  });
  if (!candidate) throw new HttpError(409, 'This patient was already checked for this study');
  res.status(201).json(candidate);
});

// The usual paging envelope plus a count per status, so the filter can show them in one request.
studyRoutes.get('/:id/candidates', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { status, page, page_size } = parse(callListQuery, req.query);
  await studyOr404(id);
  const [list, counts] = await Promise.all([listCandidates(id, status, page, page_size), countCandidatesByStatus(id)]);
  res.json({ ...list, counts });
});

export const candidateRoutes = Router();

async function candidateOr404(id: number) {
  const candidate = await findCallListRow(id);
  if (!candidate) throw new HttpError(404, 'Candidate not found');
  return candidate;
}

candidateRoutes.post('/:id/contact-attempts', async (req, res) => {
  const staff = await requireStaff(req);
  const { id } = parse(idParam, req.params);
  const { outcome, notes } = parse(contactAttempt, req.body);
  const candidate = await candidateOr404(id);
  if (!(await logContactAttempt(id, { staff_id: staff.id, outcome, notes }, statusAfterCall(outcome)))) {
    throw new HttpError(409, `Calls can only be logged while the patient needs a call (status is ${candidate.status})`);
  }
  res.status(201).json(await findCallListRow(id));
});

candidateRoutes.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { status } = parse(consent, req.body);
  const candidate = await candidateOr404(id);
  if (!(await recordConsent(id, status))) {
    throw new HttpError(409, `Consent can only be recorded after the patient is reached (status is ${candidate.status})`);
  }
  res.json(await findCallListRow(id));
});
