// The clinic runs on UTC (a prototype assumption), so every machine shows the same dates and times.
export const CLINIC_TIME_ZONE = 'UTC';

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: CLINIC_TIME_ZONE });

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

// Whole years between two YYYY-MM-DD dates; a birthday on `today` counts.
export function ageOn(dateOfBirth: string, today: string) {
  const years = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return today.slice(5) < dateOfBirth.slice(5) ? years - 1 : years;
}
