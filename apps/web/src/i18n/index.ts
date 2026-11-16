// The language of the interface, chosen once when the page loads: the one
// stored with the profile (cached in the browser), else the browser's, else
// English. Changing it reloads the page, so every text can be a plain value.
import { LOCALES, type Locale, matchLocale } from "@study/shared";
import { ApiError, FileTooLargeError, MAX_UPLOAD_MB } from "../lib/api";
import { readStored, writeStored } from "../lib/stored";
import { de } from "./de";
import { en, type Messages } from "./en";

export type { Locale, Messages };
export { LOCALES };

const MESSAGES: Record<Locale, Messages> = { en, de };

/** Each language by its own name, so that everyone finds theirs. */
export const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", de: "Deutsch" };

/** The language tags for dates and numbers. English uses the 24-hour clock and day-month order. */
const INTL: Record<Locale, string> = { en: "en-GB", de: "de-DE" };

const STORE_KEY = "locale";

function detect(): Locale {
  const stored = matchLocale(readStored<string | null>(STORE_KEY, null));
  if (stored) return stored;
  const languages = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of languages) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return LOCALES[0];
}

/** The language of this page load. */
export const locale: Locale = detect();
/** Every text, in the language of this page load. */
export const t: Messages = MESSAGES[locale];
/** The language tag for `Intl` and `toLocale…String`. */
export const intlLocale = INTL[locale];

if (typeof document !== "undefined") document.documentElement.lang = locale;

/**
 * Takes over the language of the profile. Returns true when it differs from
 * the one on screen; the caller then reloads the page.
 */
export function adoptLocale(next: string | null | undefined): boolean {
  const match = matchLocale(next);
  if (!match) return false;
  writeStored(STORE_KEY, match);
  return match !== locale;
}

/** Shows the page in another language: stores it and reloads when it differs. */
export function switchLocale(next: Locale) {
  if (adoptLocale(next)) window.location.reload();
}

export function errorMessage(error: unknown): string {
  if (error instanceof FileTooLargeError) return t.common.tooLarge(error.file, MAX_UPLOAD_MB);
  if (error instanceof ApiError) {
    const known = t.errors[error.code];
    if (known) return known;
    return error.message && error.message !== error.code ? error.message : t.errors.unknown;
  }
  if (error instanceof Error && error.message) return error.message;
  return t.errors.unknown;
}

// --- Formatting ------------------------------------------------------------

const parse = (value: string | Date) => (typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value);

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString(intlLocale, { maximumFractionDigits });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${formatNumber(minutes / 60)} h`;
}

/** When a session is, as "Today, 10:00" or "Thu, 9:45". */
export function formatWeekTime(value: string): string {
  const date = new Date(value);
  const day = date.toLocaleDateString("sv-SE");
  const time = t.time.clock(`${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`);
  if (day === today()) return `${t.time.today}, ${time}`;
  const days = daysUntil(day);
  if (days === 1) return `${t.time.tomorrow}, ${time}`;
  if (days > 1 && days < 7) return `${date.toLocaleDateString(intlLocale, { weekday: "short" }).replace(".", "")}, ${time}`;
  return `${date.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit" })}, ${time}`;
}

export function formatDate(value: string | Date): string {
  return parse(value).toLocaleDateString(intlLocale, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** A day spelled out, e.g. "Tuesday, 3 November". */
export function formatLongDate(value: string | Date): string {
  return parse(value).toLocaleDateString(intlLocale, { weekday: "long", day: "numeric", month: "long" });
}

export function formatShortDate(value: string | Date): string {
  return parse(value).toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit" });
}

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(value: string | Date): string {
  return `${formatShortDate(value)} ${formatTime(value)}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${formatNumber(bytes / 1024 ** 2)} MB`;
  return `${formatNumber(bytes / 1024 ** 3)} GB`;
}

/** `WiSe26-27` → "Winter semester 2026/27". The id itself stays as it is in every language. */
export function semesterName(id: string): string {
  const winter = id.match(/^WiSe(\d{2})-(\d{2})$/);
  if (winter) return t.time.winter(winter[1]!, winter[2]!);
  const summer = id.match(/^SoSe(\d{2})$/);
  return summer ? t.time.summer(summer[1]!) : id;
}

/** The semester a date falls in: winter from October to March. */
export function semesterOf(date = new Date()): string {
  const year = date.getFullYear() % 100;
  const month = date.getMonth() + 1;
  const pad = (n: number) => String((n + 100) % 100).padStart(2, "0");
  if (month >= 10) return `WiSe${pad(year)}-${pad(year + 1)}`;
  if (month <= 3) return `WiSe${pad(year - 1)}-${pad(year)}`;
  return `SoSe${pad(year)}`;
}

export function nextSemesters(count = 4): string[] {
  const list = [semesterOf()];
  const date = new Date();
  for (let i = 1; i < count; i++) {
    date.setMonth(date.getMonth() + 6);
    const id = semesterOf(date);
    if (!list.includes(id)) list.push(id);
  }
  // The semester before, for courses added late.
  const before = new Date();
  before.setMonth(before.getMonth() - 6);
  return [semesterOf(before), ...list];
}

/** Today as `YYYY-MM-DD` in local time. */
export function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export function daysUntil(day: string): number {
  const target = new Date(`${day}T00:00:00`).getTime();
  const start = new Date(`${today()}T00:00:00`).getTime();
  return Math.round((target - start) / 86_400_000);
}

export function relativeDay(day: string): string {
  const days = daysUntil(day);
  const words = t.time.relative;
  if (days === 0) return words.today;
  if (days === 1) return words.tomorrow;
  if (days === -1) return words.yesterday;
  if (days < 0) return words.ago(-days);
  return words.in(days);
}

/** Green from a week ahead, yellow within the week, red from the day before. */
export function urgency(day: string): "ok" | "soon" | "urgent" {
  const days = daysUntil(day);
  if (days <= 1) return "urgent";
  if (days <= 7) return "soon";
  return "ok";
}
