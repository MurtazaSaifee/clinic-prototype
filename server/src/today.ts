// The clinic runs on UTC (see the client's CLINIC_TIME_ZONE), so "today" is the UTC date.
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
