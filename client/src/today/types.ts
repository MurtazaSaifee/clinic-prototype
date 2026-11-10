import type { AppointmentStatus } from '../../../server/src/enums.ts';

export type BoardVisit = {
  id: number;
  scheduled_at: string;
  status: AppointmentStatus;
  reason: string;
  patient: { id: number; name: string; phone: string };
  physician: { id: number; name: string };
  open_task_count: number;
};
