import { ageOn, criteriaSchema, evaluate, meetsAll } from './criteria.ts';
import type { Criterion, DiagnosisFact } from './criteria.ts';

const adults18to75: Criterion = { type: 'AGE_BETWEEN', min: 18, max: 75 };
const type2: Criterion = { type: 'DIAGNOSIS', icd10_prefixes: ['E11'], label: 'Type 2 diabetes' };
const TODAY = '2026-11-10';

const e11: DiagnosisFact = { icd10_code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', diagnosed_on: '2023-04-01' };
const e10: DiagnosisFact = { icd10_code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', diagnosed_on: '2001-06-12' };
const i10: DiagnosisFact = { icd10_code: 'I10', description: 'Essential (primary) hypertension', diagnosed_on: '2019-03-02' };

const ageResult = (dateOfBirth: string, criterion: Criterion = adults18to75) =>
  evaluate([criterion], { date_of_birth: dateOfBirth }, [], TODAY)[0];

describe('age', () => {
  test('counts the birthday itself: 75 today is still in, 76 today is out', () => {
    expect(ageResult('1951-11-10')).toEqual({ criterion: adults18to75, met: true, evidence: 'Age 75 (18 to 75 required)' });
    expect(ageResult('1950-11-10')).toMatchObject({ met: false, evidence: 'Age 76 (18 to 75 required)' });
  });

  test('the day before an 18th birthday is 17 and out; on the birthday it is 18 and in', () => {
    expect(ageResult('2008-11-11')).toMatchObject({ met: false, evidence: 'Age 17 (18 to 75 required)' });
    expect(ageResult('2008-11-10')).toMatchObject({ met: true, evidence: 'Age 18 (18 to 75 required)' });
  });

  test('a leap-day birthday is not a year older until 1 March', () => {
    expect(ageOn('2000-02-29', '2027-02-28')).toBe(26);
    expect(ageOn('2000-02-29', '2027-03-01')).toBe(27);
  });

  test('either bound can be left out', () => {
    expect(ageResult('1930-01-01', { type: 'AGE_BETWEEN', min: 18 })).toMatchObject({ met: true, evidence: 'Age 96 (18 or older required)' });
    expect(ageResult('2020-01-01', { type: 'AGE_BETWEEN', max: 75 })).toMatchObject({ met: true, evidence: 'Age 6 (75 or younger required)' });
    expect(ageResult('2020-01-01', { type: 'AGE_BETWEEN' })).toMatchObject({ met: true, evidence: 'Age 6 (any age)' });
  });
});

describe('diagnosis', () => {
  const diagnosisResult = (diagnoses: DiagnosisFact[], criterion: Criterion = type2) =>
    evaluate([criterion], { date_of_birth: '1970-01-01' }, diagnoses, TODAY)[0];

  test('no diagnoses at all is not met', () => {
    expect(diagnosisResult([])).toEqual({ criterion: type2, met: false, evidence: 'No diagnosis starting E11' });
  });

  test('type 1 only (E10) does not count as type 2', () => {
    expect(diagnosisResult([e10, i10])).toMatchObject({ met: false, evidence: 'No diagnosis starting E11' });
  });

  test('E11.9 matches with its description and date as evidence', () => {
    expect(diagnosisResult([i10, e11])).toMatchObject({
      met: true,
      evidence: 'E11.9 Type 2 diabetes mellitus without complications, diagnosed 2023-04-01',
    });
  });

  test('any of several prefixes matches, and every matching diagnosis is listed', () => {
    const diabetes: Criterion = { type: 'DIAGNOSIS', icd10_prefixes: ['E10', 'E11'], label: 'Diabetes' };
    expect(diagnosisResult([e10, i10, e11], diabetes)).toMatchObject({
      met: true,
      evidence:
        'E10.9 Type 1 diabetes mellitus without complications, diagnosed 2001-06-12; ' +
        'E11.9 Type 2 diabetes mellitus without complications, diagnosed 2023-04-01',
    });
    expect(diagnosisResult([i10], diabetes).evidence).toBe('No diagnosis starting E10 or E11');
  });

  test('a prefix matches the start of the code, not anywhere in it', () => {
    expect(diagnosisResult([e11], { type: 'DIAGNOSIS', icd10_prefixes: ['9'], label: 'Starts with 9' }).met).toBe(false);
  });

  test('prefixes match whatever the case', () => {
    expect(diagnosisResult([e11], { type: 'DIAGNOSIS', icd10_prefixes: ['e11'], label: 'T2' }).met).toBe(true);
  });
});

test('a patient matches only when every criterion is met, with one result per criterion', () => {
  const both = evaluate([adults18to75, type2], { date_of_birth: '1970-01-01' }, [e11], TODAY);
  expect(both.map((r) => r.met)).toEqual([true, true]);
  expect(meetsAll(both)).toBe(true);

  const over75 = evaluate([adults18to75, type2], { date_of_birth: '1940-01-01' }, [e11], TODAY);
  expect(over75.map((r) => r.met)).toEqual([false, true]);
  expect(meetsAll(over75)).toBe(false);
});

describe('criteriaSchema', () => {
  test('accepts the GLUCO-STEP criteria', () => {
    expect(criteriaSchema.parse([adults18to75, type2])).toEqual([adults18to75, type2]);
  });

  test.each([
    ['an unknown type', [{ type: 'BMI_OVER', value: 30 }]],
    ['min above max', [{ type: 'AGE_BETWEEN', min: 80, max: 18 }]],
    ['a diagnosis with no prefixes', [{ type: 'DIAGNOSIS', icd10_prefixes: [], label: 'Nothing' }]],
    ['an empty list', []],
  ])('rejects %s', (_, criteria) => {
    expect(criteriaSchema.safeParse(criteria).success).toBe(false);
  });
});
