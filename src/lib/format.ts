/**
 * Parse an openfootball kickoff (e.g. date "2026-06-11", time "13:00 UTC-6")
 * into a real UTC instant. The "UTC-6" suffix is the venue's offset, so we hand
 * the offset straight to the Date constructor as an ISO string.
 */
export function parseKickoff(date: string, time: string): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})$/);
  if (!match) return null;
  const [, hh, mm, off] = match;
  const offset = `${off.startsWith('-') ? '-' : '+'}${String(Math.abs(Number(off))).padStart(2, '0')}:00`;
  const iso = `${date}T${hh.padStart(2, '0')}:${mm}:00${offset}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_FMT = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const TIME_FMT = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  hour: '2-digit',
  minute: '2-digit',
});

/** "jue 11 jun" in Argentina time. */
export function formatDateAR(d: Date): string {
  return DATE_FMT.format(d);
}

/** "19:00" in Argentina time. */
export function formatTimeAR(d: Date): string {
  return TIME_FMT.format(d);
}
