import type { AppointmentStatus, Sex } from '../../../server/src/enums.ts';

export type BoardVisit = {
  id: number;
  scheduled_at: string;
  status: AppointmentStatus;
  reason: string;
  patient: { id: number; name: string; phone: string };
  physician: { id: number; name: string };
  open_task_count: number;
};

export type CheckoutTask = {
  id: number;
  description: string;
  completed_at: string | null;
  completed_by: { id: number; name: string } | null;
};

export type Vitals = {
  height_cm: number | null;
  weight_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
};

export type VisitDetail = Omit<BoardVisit, 'patient' | 'open_task_count'> &
  Vitals & {
    nurse_notes: string | null;
    doctor_notes: string | null;
    patient: { id: number; name: string; phone: string; date_of_birth: string; sex: Sex };
    diagnoses: { id: number; icd10_code: string; description: string; diagnosed_on: string }[];
    checkout_tasks: CheckoutTask[];
  };
