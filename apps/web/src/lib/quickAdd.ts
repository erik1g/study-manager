// Understands a sentence in the quick search, such as "Deadline Lab report 3
// on 19/11", "Todo Blatt 5 rechnen morgen um 14 Uhr" or "To-do read chapter 2
// tomorrow at 2pm". English and German work alike, whatever the interface
// language is, since people mix them.

export interface QuickAdd {
  kind: "deadline" | "task";
  title: string;
  /** `YYYY-MM-DD`. */
  date: string | null;
  /** `HH:MM`. */
  time: string | null;
  courseId: string | null;
}

const WEEKDAYS = [
  ["sonntag", "sunday"],
  ["montag", "monday"],
  ["dienstag", "tuesday"],
  ["mittwoch", "wednesday"],
  ["donnerstag", "thursday"],
  ["freitag", "friday"],
  ["samstag", "saturday"],
];
/** How many days from today each word means. */
const RELATIVE: Record<string, number> = { heute: 0, today: 0, morgen: 1, tomorrow: 1, übermorgen: 2, "the day after tomorrow": 2, "day after tomorrow": 2 };
/** The words that start a sentence, and what they make. */
const HEADS: Record<string, "task" | "deadline"> = { todo: "task", "to-do": "task", aufgabe: "task", task: "task", deadline: "deadline", frist: "deadline", abgabe: "deadline", klausur: "deadline", exam: "deadline", submission: "deadline" };
/** Heads that are also part of the name: "Klausur Thermo", "Exam Thermodynamics". */
const NAMED = ["abgabe", "klausur", "exam", "submission"];
const day = (date: Date) => date.toLocaleDateString("sv-SE");
const pad = (n: number) => String(n).padStart(2, "0");

function takeDate(text: string, now: Date): { rest: string; date: string | null } {
  const later = (days: number) => day(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
  // The longest words first, so that "übermorgen" is not read as "morgen".
  const words = Object.keys(RELATIVE).sort((a, b) => b.length - a.length);
  const relative = text.match(new RegExp(`\\s+(${words.join("|")})\\s*$`, "i"));
  if (relative) return { rest: text.slice(0, relative.index), date: later(RELATIVE[relative[1]!.toLowerCase()]!) };
  const weekday = text.match(new RegExp(`\\s+(?:am\\s+|on\\s+)?(${WEEKDAYS.flat().join("|")})\\s*$`, "i"));
  if (weekday) {
    const wanted = WEEKDAYS.findIndex((names) => names.includes(weekday[1]!.toLowerCase()));
    return { rest: text.slice(0, weekday.index), date: later((wanted - now.getDay() + 7) % 7 || 7) };
  }
  // Day first in both: "am 19.11." and "on 19/11".
  const numeric =
    text.match(/\s+(?:am\s+)?(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\s*$/) ?? text.match(/\s+(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/);
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
  // "um 14 Uhr", "um 9:30", "at 14:00", "at 2pm", "at 9.30 am"
  const match = text.match(/\s+(?:um|at)\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*(uhr|am|pm))?\s*$/i);
  if (!match) return { rest: text, time: null };
  let hours = Number(match[1]);
  const suffix = match[3]?.toLowerCase();
  if (suffix === "am" || suffix === "pm") {
    if (hours < 1 || hours > 12) return { rest: text, time: null };
    hours = (hours % 12) + (suffix === "pm" ? 12 : 0);
  }
  if (hours > 23) return { rest: text, time: null };
  return { rest: text.slice(0, match.index), time: `${pad(hours)}:${match[2] ?? "00"}` };
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
  const head = input.trim().match(new RegExp(`^(${Object.keys(HEADS).join("|")})\\s+(.+)$`, "i"));
  if (!head) return null;
  const word = head[1]!.toLowerCase();
  const kind = HEADS[word]!;
  let text = ` ${head[2]!}`;
  // "Abgabe …", "Klausur …" and "Exam …" are deadlines whose name says so.
  if (NAMED.includes(word)) text = ` ${head[1]}${text}`;
  const first = takeTime(text);
  const dated = takeDate(first.rest, now);
  const timed = first.time ? { rest: dated.rest, time: first.time } : takeTime(dated.rest);
  const named = takeCourse(timed.rest, courses);
  const title = named.rest.trim();
  if (!title || (kind === "deadline" && !dated.date)) return null;
  return { kind, title, date: dated.date, time: timed.time, courseId: named.courseId ?? currentCourse };
}
