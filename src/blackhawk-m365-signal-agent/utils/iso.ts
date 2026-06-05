export function nowIso() {
  return new Date().toISOString();
}

export function addHours(iso: string, hours: number) {
  return new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
}

export function subtractHours(iso: string, hours: number) {
  return addHours(iso, -hours);
}

export function addDays(iso: string, days: number) {
  return addHours(iso, days * 24);
}

export function isValidIsoTimestamp(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function minutesUntil(targetIso: string, nowIsoValue: string) {
  return Math.round((Date.parse(targetIso) - Date.parse(nowIsoValue)) / 60_000);
}
