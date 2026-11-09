// Understands a sentence in the quick search, such as "Deadline Laborbericht 3
// am 19.11." or "Todo Blatt 5 rechnen morgen um 14 Uhr".

export interface QuickAdd {
  kind: "deadline" | "task";
  title: string;
  /** `YYYY-MM-DD`. */
  date: string | null;
  /** `HH:MM`. */
  time: string | null;
  courseId: string | null;
}

const WEEKDAYS = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const day = (date: Date) => date.toLocaleDateString("sv-SE");
const pad = (n: number) => String(n).padStart(2, "0");

function takeDate(text: string, now: Date): { rest: string; date: string | null } {
  const later = (days: number) => day(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
  const relative = text.match(/\s+(heute|morgen|übermorgen)\s*$/i);
  if (relative) {
    const word = relative[1]!.toLowerCase();
    return { rest: text.slice(0, relative.index), date: later(word === "heute" ? 0 : word === "morgen" ? 1 : 2) };
  }
  const weekday = text.match(new RegExp(`\\s+(?:am\\s+)?(${WEEKDAYS.join("|")})\\s*$`, "i"));
  if (weekday) {
    const wanted = WEEKDAYS.indexOf(weekday[1]!.toLowerCase());
    return { rest: text.slice(0, weekday.index), date: later((wanted - now.getDay() + 7) % 7 || 7) };
  }
  const numeric = text.match(/\s+(?:am\s+)?(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\s*$/);
  if (numeric) {
    const [d, m] = [Number(numeric[1]), Number(numeric[2])];
    let year = numeric[3] ? Number(numeric[3].padStart(4, "20")) : now.getFullYear();
    const date = new Date(year, m - 1, d);
    if (date.getMonth() !== m - 1) return { rest: text, date: null };
    // Without a year it is the next such day.
    if (!numeric[3] && day(date) < day(now)) year += 1;
    return { rest: text.slice(0, numeric.index), date: `${year}-${pad(m)}-${pad(d)}` };
  }
  return { rest: text, date: null };
}

function takeTime(text: string): { rest: string; time: string | null } {
  const match = text.match(/\s+um\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*uhr)?\s*$/i);
  if (!match || Number(match[1]) > 23) return { rest: text, time: null };
  return { rest: text.slice(0, match.index), time: `${pad(Number(match[1]))}:${match[2] ?? "00"}` };
}

/** A subject is meant when its title, or its first word, stands in the text. */
function takeCourse(text: string, courses: { id: string; title: string }[]): { rest: string; courseId: string | null } {
  const lower = text.toLowerCase();
  const byLength = [...courses].sort((a, b) => b.title.length - a.title.length);
  for (const course of byLength) {
    const at = lower.indexOf(course.title.toLowerCase());
    if (at >= 0) return { rest: (text.slice(0, at) + text.slice(at + course.title.length)).replace(/\s+/g, " ").trim(), courseId: course.id };
  }
  for (const course of byLength) {
    const word = course.title.split(/\s+/)[0]!;
    if (word.length >= 5 && lower.includes(word.toLowerCase())) return { rest: text, courseId: course.id };
  }
  return { rest: text, courseId: null };
}

export function parseQuickAdd(input: string, courses: { id: string; title: string }[], currentCourse: string | null, now = new Date()): QuickAdd | null {
  const head = input.trim().match(/^(deadline|frist|todo|aufgabe|abgabe|klausur)\s+(.+)$/i);
  if (!head) return null;
  const word = head[1]!.toLowerCase();
  const kind = word === "todo" || word === "aufgabe" ? "task" : "deadline";
  let text = ` ${head[2]!}`;
  // "Abgabe …" and "Klausur …" are deadlines whose name says so.
  if (word === "abgabe" || word === "klausur") text = ` ${head[1]}${text}`;
  const first = takeTime(text);
  const dated = takeDate(first.rest, now);
  const timed = first.time ? { rest: dated.rest, time: first.time } : takeTime(dated.rest);
  const named = takeCourse(timed.rest, courses);
  const title = named.rest.trim();
  if (!title || (kind === "deadline" && !dated.date)) return null;
  return { kind, title, date: dated.date, time: timed.time, courseId: named.courseId ?? currentCourse };
}
