// Reading subscribed calendars: every occurrence of their events, which
// sessions are cancelled, and which subject a recurring title belongs to.
// Pure functions, without the database.
import nodeIcal, { type VEvent } from "node-ical";

export interface ParsedEvent {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  url: string | null;
  cancelled: boolean;
}

const textOf = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "object" && "val" in (value as object)) return textOf((value as { val: unknown }).val);
  return String(value).trim() || null;
};

/** Universities mark dropped sessions in the description rather than the status. */
function isCancelled(status: unknown, notes: string | null): boolean {
  if (String(status ?? "").toUpperCase() === "CANCELLED") return true;
  const lower = notes?.toLowerCase() ?? "";
  return lower.includes("entfall") || lower.includes("abgesagt") || lower.includes("cancelled");
}

/** Minutes `zone` is ahead of UTC at `instant`. */
function zoneOffset(zone: string, instant: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
  return Math.round((asUtc - instant) / 60_000);
}

/**
 * rrule hands out occurrences of a zoned event as UTC dates that carry the
 * local wall clock time; this turns them into the real instants.
 */
function wallClockToInstant(wall: Date, zone: string): Date {
  const local = wall.getTime();
  let instant = local - zoneOffset(zone, local) * 60_000;
  // Once more with the offset at the result, in case a clock change lies between.
  instant = local - zoneOffset(zone, instant) * 60_000;
  return new Date(instant);
}

/** All occurrences of the events in an iCalendar text that overlap a window. */
export function expandIcs(text: string, from: Date, to: Date): ParsedEvent[] {
  const data = nodeIcal.sync.parseICS(text);
  const result: ParsedEvent[] = [];
  for (const entry of Object.values(data)) {
    if (!entry || entry.type !== "VEVENT") continue;
    const event = entry as VEvent;
    if (!event.start) continue;
    const allDay = (event as { datetype?: string }).datetype === "date";
    const length = event.end
      ? event.end.getTime() - event.start.getTime()
      : allDay
        ? 86_400_000
        : 0;
    const occurrence = (source: VEvent, startsAt: Date, endsAt: Date, uid: string): ParsedEvent => {
      const notes = textOf(source.description) ?? textOf(event.description);
      return {
        uid,
        title: textOf(source.summary) ?? textOf(event.summary) ?? "(ohne Titel)",
        startsAt,
        endsAt,
        allDay,
        location: textOf(source.location) ?? textOf(event.location),
        notes,
        url: textOf((source as { url?: unknown }).url) ?? textOf((event as { url?: unknown }).url),
        cancelled: isCancelled(source.status, notes),
      };
    };
    const overlaps = (start: Date, end: Date) => start <= to && end >= from;

    if (!event.rrule) {
      const end = new Date(event.start.getTime() + length);
      if (overlaps(event.start, end)) result.push(occurrence(event, event.start, end, event.uid));
      continue;
    }
    const excluded = new Set(Object.values(event.exdate ?? {}).map((d) => (d as Date).getTime()));
    const overrides = Object.values(event.recurrences ?? {}) as VEvent[];
    const zone = (event.start as Date & { tz?: string }).tz;
    const zoned = !allDay && !!zone && !/^(utc|etc\/utc|gmt|etc\/gmt|z)$/i.test(zone);
    // The window in the same wall-clock terms, a day wider for the conversion.
    const margin = 86_400_000;
    const occurrences = event.rrule
      .between(new Date(from.getTime() - length - margin), new Date(to.getTime() + margin), true)
      .map((wall) => (zoned ? wallClockToInstant(wall, zone!) : wall));
    for (const start of occurrences) {
      if (excluded.has(start.getTime())) continue;
      const changed = overrides.find((o) => (o.recurrenceid as Date | undefined)?.getTime() === start.getTime());
      const startsAt = changed?.start ?? start;
      const endsAt = changed?.end ?? new Date(startsAt.getTime() + length);
      if (!overlaps(startsAt, endsAt)) continue;
      result.push(occurrence(changed ?? event, startsAt, endsAt, `${event.uid}#${start.toISOString()}`));
    }
  }
  return result.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Words that say what kind of session it is, not which subject. */
const NOISE = new Set([
  "vo", "ue", "vu", "pr", "se", "vorlesung", "übung", "uebung", "lecture", "exercise", "tutorium",
  "mit", "standardgruppe", "gruppe", "praktikum", "seminar", "ringvorlesung",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !NOISE.has(w));
}

/**
 * The subject a series most likely belongs to, judged by the words its
 * title shares with each subject's title. Only a clear match counts.
 */
export function suggestCourse(title: string, courses: { id: string; title: string }[]): string | null {
  const series = words(title);
  if (series.length === 0) return null;
  const scored = courses
    .map((course) => {
      const own = words(course.title);
      const shared = series.filter((w) => own.includes(w)).length;
      // Shared words measured against the longer of the two titles.
      return { id: course.id, score: shared / Math.max(series.length, own.length, 1) };
    })
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < 0.75 || (second && second.score >= best.score)) return null;
  return best.id;
}

/** Sessions in order, numbered among those that take place. */
export function numberSessions<T extends { startsAt: Date; cancelled: boolean }>(events: T[]) {
  const ordered = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const total = ordered.filter((e) => !e.cancelled).length;
  let number = 0;
  return ordered.map((event) => ({ ...event, number: event.cancelled ? null : ++number, total }));
}
