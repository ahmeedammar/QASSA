/**
 * Time handling: store UTC, display Africa/Tunis.
 * All appointment timestamps are persisted as timestamptz (UTC) and rendered
 * through these helpers only.
 */

export const TUNIS_TIMEZONE = "Africa/Tunis";

export function utcNow(): string {
  return new Date().toISOString();
}

export function toUtcIso(date: Date): string {
  return date.toISOString();
}

export function nowInTunis(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TUNIS_TIMEZONE }),
  );
}

export function formatInTunis(
  isoUtc: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return new Intl.DateTimeFormat(locale, {
    timeZone: TUNIS_TIMEZONE,
    ...options,
  }).format(date);
}

/** Validates an ISO string, returning it normalized or null. */
export function normalizeUtcIso(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * True when [startA, endA) overlaps [startB, endB). Half-open intervals so
 * back-to-back appointments never count as overlapping.
 */
export function rangesOverlap(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string,
): boolean {
  const a1 = new Date(startA).getTime();
  const a2 = new Date(endA).getTime();
  const b1 = new Date(startB).getTime();
  const b2 = new Date(endB).getTime();
  if ([a1, a2, b1, b2].some(Number.isNaN)) return false;
  return a1 < b2 && b1 < a2;
}
