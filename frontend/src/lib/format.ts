export const TIME_ZONE = "Europe/Istanbul";

/**
 * Match times come back from the API as naive UTC timestamps with microseconds
 * (e.g. "2026-01-17T01:23:08.840984"). Normalise to a real Date.
 */
export function parseApiTime(value: string): Date {
  let s = value.trim().replace(" ", "T");
  s = s.replace(/(\.\d{3})\d+/, "$1");
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";
  return new Date(s);
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...opts });

const dayFmt = fmt({ day: "numeric", month: "short", year: "numeric" });
const dayShortFmt = fmt({ day: "numeric", month: "short" });
const weekdayFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const formatDay = (d: Date) => dayFmt.format(d);
export const formatDayShort = (d: Date) => dayShortFmt.format(d);
export const formatWeekday = (d: Date) => weekdayFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);
export const formatDateTime = (d: Date) => `${dayFmt.format(d)} · ${timeFmt.format(d)}`;

/** YYYY-MM-DD in Istanbul time. */
export const isoDay = (d: Date) => isoDayFmt.format(d);

/**
 * FIFA nights run past midnight; a match at 01:30 belongs to the previous
 * evening's session. Shift by 6h before taking the calendar day.
 */
export const matchdayKey = (d: Date) =>
  isoDay(new Date(d.getTime() - 6 * 3600 * 1000));

/** Local-midnight Date for a YYYY-MM-DD key (for display only). */
export const dayFromKey = (key: string) => new Date(`${key}T12:00:00Z`);

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relativeTime(d: Date, now = new Date()): string {
  const diff = (d.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

/** Same normalisation the backend uses for names inside team strings. */
export const cleanName = (s: string) => s.replace(/[{}()]/g, "").trim().toLowerCase();

export const parseTeam = (team: string | null | undefined) =>
  (team ?? "").split(",").map(cleanName).filter(Boolean);

export const displayName = (name: string) =>
  name
    .split(/(\s+|-)/)
    .map((w) => (w.trim() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join("");

export const duoKey = (names: string[]) => [...names].sort().join(" & ");

export const pct = (v: number, digits = 0) =>
  `${(Number.isFinite(v) ? v : 0).toFixed(digits)}%`;

export const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

export function daysAgoIso(days: number): string {
  return isoDay(new Date(Date.now() - days * 86400 * 1000));
}
