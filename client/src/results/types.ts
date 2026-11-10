export type TestResult = {
  id: number;
  test_name: string;
  result: string;
  is_abnormal: boolean;
  resulted_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
  patient: { id: number; name: string };
};
