// The clinic runs on UTC (a prototype assumption), so every machine shows the same dates and times.
export const CLINIC_TIME_ZONE = 'UTC';

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: CLINIC_TIME_ZONE });

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}
