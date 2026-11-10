import type { Sex } from '../../../server/src/enums.ts';

export type Patient = {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: Sex;
};
