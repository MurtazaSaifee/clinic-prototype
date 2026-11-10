import type { Knex } from 'knex';
import { faker } from '@faker-js/faker';
import { SEXES } from '../../src/enums.ts';
import type { AppointmentStatus, CandidateStatus, ContactOutcome } from '../../src/enums.ts';

// Every date hangs off the day the seed runs (UTC), so the data is identical relative to
// today and the Today board is never empty, whenever the app is set up.
const TODAY = new Date().toISOString().slice(0, 10);

// Times are written in UTC so the seed doesn't depend on the machine's time zone.
const at = (date: string, time: string) => `${date}T${time}:00Z`;

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addYears(date: string, years: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function ageOn(dateOfBirth: string, date: string) {
  const years = Number(date.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return date.slice(5) < dateOfBirth.slice(5) ? years - 1 : years;
}

const COMMON_DIAGNOSES = [
  { icd10_code: 'I10', description: 'Essential (primary) hypertension' },
  { icd10_code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
  { icd10_code: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { icd10_code: 'E66.9', description: 'Obesity, unspecified' },
  { icd10_code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis' },
  { icd10_code: 'F41.1', description: 'Generalized anxiety disorder' },
];

const TYPE_2_DIABETES = [
  { icd10_code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { icd10_code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
  { icd10_code: 'E11.22', description: 'Type 2 diabetes mellitus with diabetic chronic kidney disease' },
];

const TYPE_1_DIABETES = { icd10_code: 'E10.9', description: 'Type 1 diabetes mellitus without complications' };

const REASONS = [
  'Annual physical',
  'Blood pressure follow-up',
  'Persistent cough',
  'Knee pain after running',
  'Medication review',
  'Rash on forearm',
  'Headaches for two weeks',
  'Flu-like symptoms',
  'Lower back pain',
  'Trouble sleeping',
];

const NURSE_NOTES = [
  'No known allergies. Taking medication as prescribed.',
  'Reports symptoms started about a week ago.',
  'Patient anxious about results from last visit.',
  'Pain 4/10 today, worse in the mornings.',
];

const DOCTOR_NOTES = [
  'Exam unremarkable. Continue current plan.',
  'Likely viral. Rest and fluids, return if not better in a week.',
  'Adjusted dose. Recheck in two weeks.',
  'Ordered labs to rule out anything systemic.',
];

const GLUCO_STEP_CRITERIA = [
  { type: 'AGE_BETWEEN', min: 18, max: 75 },
  { type: 'DIAGNOSIS', icd10_prefixes: ['E11'], label: 'Type 2 diabetes' },
];

// Type 2 patients aged 18 to 75 match the study. The other two diabetic groups miss by one criterion each.
type Profile = 'TYPE_2' | 'TYPE_2_OVER_75' | 'TYPE_1' | 'OTHER';
const AGE_RANGE: Record<Profile, [number, number]> = {
  TYPE_2: [35, 74],
  TYPE_2_OVER_75: [76, 90],
  TYPE_1: [18, 60],
  OTHER: [18, 90],
};

// Visits on TODAY: [time, physician, status]. Together they put something in every queue.
const TODAYS_VISITS: [string, number, AppointmentStatus][] = [
  ['08:30', 0, 'CHECKED_OUT'],
  ['08:30', 1, 'CHECKED_OUT'],
  ['09:00', 0, 'NO_SHOW'],
  ['09:00', 1, 'READY_FOR_CHECKOUT'],
  ['09:30', 0, 'READY_FOR_CHECKOUT'],
  ['09:30', 1, 'READY_FOR_DOCTOR'],
  ['10:00', 0, 'READY_FOR_DOCTOR'],
  ['10:00', 1, 'CHECKED_IN'],
  ['10:30', 0, 'CHECKED_IN'],
  ['11:00', 0, 'SCHEDULED'],
  ['11:00', 1, 'CANCELLED'],
  ['11:00', 1, 'SCHEDULED'], // rebooked into the slot the cancellation freed
  ['14:00', 0, 'SCHEDULED'],
];

const FUTURE_VISITS: [string, string, number][] = [
  [addDays(TODAY, 1), '09:00', 0],
  [addDays(TODAY, 1), '10:30', 1],
  [addDays(TODAY, 2), '09:30', 0],
  [addDays(TODAY, 3), '14:00', 1],
];

// Results from the eight past visits: [past visit, test, result, abnormal, reviewed].
// The first three past visits are with type 2 diabetic patients.
const TEST_RESULTS: [number, string, string, boolean, boolean][] = [
  [0, 'HbA1c', '8.1 %', true, false],
  [0, 'LDL cholesterol', '162 mg/dL', true, false],
  [1, 'HbA1c', '7.4 %', true, false],
  [1, 'Creatinine', '1.0 mg/dL', false, true],
  [2, 'HbA1c', '6.8 %', true, true],
  [3, 'LDL cholesterol', '98 mg/dL', false, true],
  [3, 'TSH', '2.1 mIU/L', false, false],
  [4, 'Hemoglobin', '10.8 g/dL', true, false],
  [4, 'Creatinine', '0.9 mg/dL', false, true],
  [5, 'Vitamin D, 25-hydroxy', '18 ng/mL', true, true],
  [5, 'TSH', '1.6 mIU/L', false, false],
  [6, 'HbA1c', '5.4 %', false, true],
  [6, 'LDL cholesterol', '121 mg/dL', false, false],
  [7, 'Urinalysis', 'Normal', false, true],
  [7, 'Hemoglobin', '14.2 g/dL', false, false],
];

type Call = [ContactOutcome, string?];
const CANDIDATES: [CandidateStatus, Call[]][] = [
  ['NOT_ELIGIBLE', []],
  ['NOT_ELIGIBLE', []],
  ['PENDING_CONTACT', []],
  ['PENDING_CONTACT', [['NO_ANSWER']]],
  ['PENDING_CONTACT', [['NO_ANSWER'], ['VOICEMAIL', 'Left the study callback number']]],
  ['PENDING_CONTACT', [['WRONG_NUMBER', 'Number belongs to someone else, ask for an updated phone at next visit']]],
  ['PENDING_CONSENT', [['REACHED', 'Interested, wants to read the information sheet first']]],
  ['PENDING_CONSENT', [['NO_ANSWER'], ['REACHED', 'Wants to talk it over with family']]],
  ['CONSENTED', [['REACHED', 'Keen to join']]],
  ['CONSENTED', [['VOICEMAIL'], ['REACHED']]],
  ['DECLINED', [['REACHED', 'Not interested, travels a lot for work']]],
];

export async function seed(knex: Knex) {
  await knex.raw(`
    TRUNCATE contact_attempts, study_candidates, clinical_studies, test_results, diagnoses,
      checkout_tasks, appointments, staff, patients RESTART IDENTITY CASCADE
  `);

  faker.seed(42);
  faker.setDefaultRefDate(`${TODAY}T00:00:00Z`);

  const staffIds: number[] = (
    await knex('staff')
      .insert([
        { name: 'Amara Okafor', role: 'PHYSICIAN' },
        { name: 'Daniel Reyes', role: 'PHYSICIAN' },
        { name: 'Priya Shah', role: 'NURSE' },
        { name: 'Tom Becker', role: 'NURSE' },
        { name: 'Lena Novak', role: 'RECEPTIONIST' },
      ])
      .returning('id')
  ).map((row) => row.id);
  const physicians = staffIds.slice(0, 2);
  const nurse = staffIds[2];
  const receptionist = staffIds[4];

  const profiles = faker.helpers.shuffle<Profile>([
    ...Array<Profile>(20).fill('TYPE_2'),
    ...Array<Profile>(3).fill('TYPE_2_OVER_75'),
    ...Array<Profile>(4).fill('TYPE_1'),
    ...Array<Profile>(93).fill('OTHER'),
  ]);
  const patientRows = profiles.map((profile) => {
    const sex = faker.helpers.arrayElement(SEXES);
    const firstName = faker.person.firstName(sex === 'FEMALE' ? 'female' : 'male');
    const lastName = faker.person.lastName();
    const [min, max] = AGE_RANGE[profile];
    return {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: faker.date.birthdate({ min, max, mode: 'age' }).toISOString().slice(0, 10),
      sex,
      phone: faker.phone.number({ style: 'national' }),
      email: faker.helpers.maybe(() => faker.internet.email({ firstName, lastName }), { probability: 0.8 }) ?? null,
    };
  });
  const patientIds: number[] = (await knex('patients').insert(patientRows).returning('id')).map((row) => row.id);
  const patients = patientRows.map((row, i) => ({ ...row, id: patientIds[i], profile: profiles[i] }));

  const diagnosedOn = (dateOfBirth: string) => {
    const adult = addYears(dateOfBirth, 18);
    const earliest = addYears(TODAY, -15);
    const from = adult > earliest ? adult : earliest;
    return faker.date.between({ from, to: TODAY }).toISOString().slice(0, 10);
  };
  const diagnosisRows = patients.flatMap((p) => {
    const picked =
      p.profile === 'OTHER'
        ? faker.helpers.arrayElements(COMMON_DIAGNOSES, { min: 0, max: 2 })
        : p.profile === 'TYPE_1'
          ? [TYPE_1_DIABETES]
          : [
              faker.helpers.arrayElement(TYPE_2_DIABETES),
              ...faker.helpers.arrayElements(COMMON_DIAGNOSES.slice(0, 2), { min: 0, max: 2 }),
            ];
    return picked.map((d) => ({ patient_id: p.id, ...d, diagnosed_on: diagnosedOn(p.date_of_birth) }));
  });
  await knex('diagnoses').insert(diagnosisRows);

  const studyMatches = patients.filter((p) => p.profile === 'TYPE_2');
  const others = faker.helpers.shuffle(patients.filter((p) => p.profile === 'OTHER'));

  const visit = (patientId: number, physicianId: number, scheduledAt: string, status: AppointmentStatus, reason: string) => {
    const intakeDone = ['READY_FOR_DOCTOR', 'READY_FOR_CHECKOUT', 'CHECKED_OUT'].includes(status);
    const doctorDone = ['READY_FOR_CHECKOUT', 'CHECKED_OUT'].includes(status);
    return {
      patient_id: patientId,
      physician_id: physicianId,
      scheduled_at: scheduledAt,
      reason,
      status,
      height_cm: intakeDone ? faker.number.int({ min: 152, max: 193 }) : null,
      weight_kg: intakeDone ? faker.number.float({ min: 50, max: 120, fractionDigits: 1 }) : null,
      bp_systolic: intakeDone ? faker.number.int({ min: 108, max: 152 }) : null,
      bp_diastolic: intakeDone ? faker.number.int({ min: 68, max: 96 }) : null,
      heart_rate: intakeDone ? faker.number.int({ min: 56, max: 98 }) : null,
      nurse_notes: intakeDone ? faker.helpers.arrayElement(NURSE_NOTES) : null,
      doctor_notes: doctorDone ? faker.helpers.arrayElement(DOCTOR_NOTES) : null,
    };
  };

  const pastVisitRows = Array.from({ length: 8 }, (_, i) => {
    const patient = i < 3 ? studyMatches[i] : others.pop()!;
    const reason = i < 3 ? 'Diabetes check-in' : faker.helpers.arrayElement(REASONS);
    return visit(patient.id, physicians[i % 2], at(addDays(TODAY, -5 - i * 3), '09:00'), 'CHECKED_OUT', reason);
  });
  const todayRows = TODAYS_VISITS.map(([time, physician, status]) =>
    visit(others.pop()!.id, physicians[physician], at(TODAY, time), status, faker.helpers.arrayElement(REASONS)),
  );
  const futureRows = FUTURE_VISITS.map(([date, time, physician]) =>
    visit(others.pop()!.id, physicians[physician], at(date, time), 'SCHEDULED', faker.helpers.arrayElement(REASONS)),
  );

  const insertVisits = async (rows: ReturnType<typeof visit>[]) =>
    (await knex('appointments').insert(rows).returning('id')).map((row, i) => ({ ...rows[i], id: row.id as number }));
  const pastVisits = await insertVisits(pastVisitRows);
  const todaysVisits = await insertVisits(todayRows);
  await insertVisits(futureRows);

  // Checked-out visits have every task done; visits waiting for checkout still have open ones.
  const doneTask = (v: { id: number; scheduled_at: string }, description: string) => ({
    appointment_id: v.id,
    description,
    completed_at: new Date(new Date(v.scheduled_at).getTime() + 40 * 60_000).toISOString(),
    completed_by: receptionist,
  });
  const openTask = (v: { id: number }, description: string) => ({ appointment_id: v.id, description });
  const [waitingA, waitingB] = todaysVisits.filter((v) => v.status === 'READY_FOR_CHECKOUT');
  await knex('checkout_tasks').insert([
    ...pastVisits.map((v) => doneTask(v, 'Blood draw for ordered labs')),
    ...todaysVisits.filter((v) => v.status === 'CHECKED_OUT').map((v) => doneTask(v, 'Book follow-up in 4 weeks')),
    openTask(waitingA, 'Book follow-up in 2 weeks'),
    openTask(waitingA, 'Blood draw for HbA1c'),
    doneTask(waitingB, 'Print exercise plan'),
    openTask(waitingB, 'Book physiotherapy referral'),
  ]);

  await knex('test_results').insert(
    TEST_RESULTS.map(([visitIndex, testName, result, isAbnormal, reviewed]) => {
      const v = pastVisits[visitIndex];
      const resultedOn = addDays(v.scheduled_at.slice(0, 10), 2);
      return {
        patient_id: v.patient_id,
        appointment_id: v.id,
        test_name: testName,
        result,
        is_abnormal: isAbnormal,
        resulted_at: at(resultedOn, '15:00'),
        reviewed_at: reviewed ? at(addDays(resultedOn, 1), '08:15') : null,
        reviewed_by: reviewed ? v.physician_id : null,
      };
    }),
  );

  const [study] = await knex('clinical_studies')
    .insert({
      name: 'GLUCO-STEP',
      description: 'A fictional 12-week lifestyle study for adults aged 18 to 75 with type 2 diabetes.',
      criteria: JSON.stringify(GLUCO_STEP_CRITERIA),
    })
    .returning('id');

  for (const [i, [status, calls]] of CANDIDATES.entries()) {
    const patient = studyMatches[i];
    const reviewedOn = addDays(TODAY, -20 + i);
    const diagnosis = diagnosisRows.find((d) => d.patient_id === patient.id && d.icd10_code.startsWith('E11'))!;
    const attempts = calls.map(([outcome, notes], j) => ({
      staff_id: j === 0 && i % 3 === 0 ? nurse : receptionist,
      attempted_at: at(addDays(reviewedOn, 1 + j * 2), '10:15'),
      outcome,
      notes: notes ?? null,
    }));
    // Mirrors what the matcher will report, so the call list shows the same evidence the reviewer saw.
    const matchReasons = [
      { criterion: GLUCO_STEP_CRITERIA[0], met: true, evidence: `Age ${ageOn(patient.date_of_birth, reviewedOn)} (18 to 75 required)` },
      {
        criterion: GLUCO_STEP_CRITERIA[1],
        met: true,
        evidence: `${diagnosis.icd10_code} ${diagnosis.description}, diagnosed ${diagnosis.diagnosed_on}`,
      },
    ];
    const [candidate] = await knex('study_candidates')
      .insert({
        patient_id: patient.id,
        study_id: study.id,
        status,
        match_reasons: JSON.stringify(matchReasons),
        reviewed_by: physicians[i % 2],
        reviewed_at: at(reviewedOn, '16:00'),
        updated_at: attempts.at(-1)?.attempted_at ?? at(reviewedOn, '16:00'),
      })
      .returning('id');
    if (attempts.length > 0) {
      await knex('contact_attempts').insert(attempts.map((a) => ({ ...a, candidate_id: candidate.id })));
    }
  }
}
