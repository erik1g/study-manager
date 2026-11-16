// The shared lecture notes of a subject: one Markdown text the members write
// in and Claude extends. Claude only ever adds: chapters taken from the
// scripts, and for each evaluated lecture a block of key points and exam
// hints. Its places are found again through markers in HTML comments, which
// the Markdown view does not show, so headings may be renamed and moved.
// Pure functions; taken over from the desktop app. The words Claude's blocks
// and the standard headings use follow the course's language; the markers
// (ids, `skript:`) are the same in every language.
import type { Locale } from "@study/shared";

export const EXAM_ID = "pruefungsrelevant";
export const OTHER_ID = "ohne-kapitel";

/** A chapter or section of a script, as Claude found it. */
export interface OutlineItem {
  title: string;
  /** 1-based page in the script where it begins. */
  page?: number | null;
  sections?: OutlineItem[];
}

/** The chapters of one script. */
export interface ScriptOutline {
  /** The id of the script's file. */
  script: string;
  chapters: OutlineItem[];
}

export interface ExamHint {
  quote: string;
  /** Position in the recording, `HH:MM:SS`. */
  time?: string | null;
}

/** What one lecture contributed to one chapter or section. */
export interface SectionNotes {
  /** The heading's id; anything unknown counts as "without chapter". */
  id: string;
  points?: string[];
  examHints?: ExamHint[];
}

interface Words {
  notes: (course: string) => string;
  exam: string;
  other: string;
  lecture: string;
  transcript: string;
  examHint: string;
  quote: (text: string) => string;
  date: (iso: string) => string;
}

const WORDS: Record<Locale, Words> = {
  en: {
    notes: (course) => `Notes · ${course}`,
    exam: "Exam-relevant",
    other: "From the lecture, without a chapter",
    lecture: "Lecture",
    transcript: "Transcript",
    examHint: "Exam-relevant:",
    quote: (text) => `“${text}”`,
    date: (iso) => iso.split("-").reverse().join("/"),
  },
  de: {
    notes: (course) => `Notizen · ${course}`,
    exam: "Prüfungsrelevant",
    other: "Aus der Vorlesung, ohne Kapitelbezug",
    lecture: "Vorlesung",
    transcript: "Transkript",
    examHint: "Prüfungsrelevant:",
    quote: (text) => `„${text}“`,
    date: (iso) => iso.split("-").reverse().join("."),
  },
};

export interface SessionInfo {
  /** Stable key; evaluating the same lecture again replaces its blocks. */
  key: string;
  /** The day of the lecture, `YYYY-MM-DD`. */
  date: string;
  /** Link to the transcript. */
  transcript: string;
}

/** The notes of a new course, in the course's language. */
export function newNotes(courseTitle: string, locale: Locale): string {
  const words = WORDS[locale];
  return `# ${words.notes(courseTitle)}\n\n## ${words.exam}\n<!-- id: ${EXAM_ID} -->\n\n## ${words.other}\n<!-- id: ${OTHER_ID} -->\n`;
}

/** As the desktop app made folder names: lower case, umlauts spelled out. */
export function slug(text: string): string {
  let result = "";
  for (const c of text.toLowerCase()) {
    if (c === "ä") result += "ae";
    else if (c === "ö") result += "oe";
    else if (c === "ü") result += "ue";
    else if (c === "ß") result += "ss";
    else if (/[a-z0-9]/.test(c)) result += c;
    else if (!result.endsWith("-") && result.length > 0) result += "-";
  }
  return result.slice(0, 60).replace(/-+$/, "");
}

interface Heading {
  line: number;
  level: number;
  id: string;
  script: string | null;
}

function marker(line: string): string | null {
  const t = line.trim();
  return t.startsWith("<!--") && t.endsWith("-->") ? t.slice(4, -3).trim() : null;
}

/** Every heading with a marker on the line below it. */
function headings(lines: string[]): Heading[] {
  const found: Heading[] = [];
  lines.forEach((line, index) => {
    const level = line.match(/^#+/)?.[0].length ?? 0;
    if (level < 2 || level > 3 || line[level] !== " ") return;
    const fields = index + 1 < lines.length ? marker(lines[index + 1]!) : null;
    if (!fields) return;
    let id: string | null = null;
    let script: string | null = null;
    for (const raw of fields.split("·")) {
      const field = raw.trim();
      if (field.startsWith("id:")) id = field.slice(3).trim();
      else if (field.startsWith("skript:")) script = field.slice(7).trim().split("#")[0] ?? "";
    }
    if (id) found.push({ line: index, level, id, script });
  });
  return found;
}

const titleOf = (lines: string[], heading: Heading) => lines[heading.line]!.replace(/^#+/, "").trim();

/** Where content of a heading is appended: before the next heading of any level. */
function endOfOwnText(lines: string[], heading: Heading): number {
  for (let i = heading.line + 2; i < lines.length; i++) if (lines[i]!.startsWith("## ") || lines[i]!.startsWith("### ")) return i;
  return lines.length;
}

/** The line after the last line of a chapter including its sections. */
function endOfChapter(lines: string[], heading: Heading): number {
  for (let i = heading.line + 2; i < lines.length; i++) if (lines[i]!.startsWith("## ")) return i;
  return lines.length;
}

const split = (text: string) => text.split("\n").filter((_, i, all) => i < all.length - 1 || all[i] !== "");
const join = (lines: string[]) => `${lines.join("\n")}\n`;

/** At most one blank line in a row, none at the end. */
function tidy(lines: string[]): string[] {
  const kept: string[] = [];
  for (const line of lines) {
    if (!line.trim() && kept.length > 0 && !kept[kept.length - 1]!.trim()) continue;
    kept.push(line);
  }
  while (kept.length > 0 && !kept[kept.length - 1]!.trim()) kept.pop();
  return kept;
}

/** Inserts `block` before `index`, with one blank line around it. */
function insertBlock(lines: string[], at: number, block: string[]): string[] {
  let index = at;
  while (index > 0 && !lines[index - 1]!.trim()) index--;
  return tidy([...lines.slice(0, index), "", ...block, "", ...lines.slice(index)]);
}

function headingLines(level: number, item: OutlineItem, id: string, script: string): string[] {
  const page = item.page ? `#${item.page}` : "";
  return [`${"#".repeat(level)} ${item.title.trim()}`, `<!-- id: ${id} · skript: ${script}${page} -->`];
}

function newId(title: string, taken: string[]): string {
  const base = `k-${slug(title)}`;
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  taken.push(id);
  return id;
}

/** Whether a heading stands for `title`: by the title it was added with (its id) or its current wording. */
function standsFor(heading: Heading, lines: string[], title: string): boolean {
  const base = `k-${slug(title)}`;
  const byId = heading.id === base || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+$`).test(heading.id);
  return byId || slug(titleOf(lines, heading)) === slug(title);
}

/**
 * Adds the chapters and sections of a script that the notes lack, in the
 * script's order. Headings already there stay as they are, wherever they were
 * moved and whatever they were renamed to. `scriptOrder` lists all scripts of
 * the subject in order, so a new script's chapters land between those of its
 * neighbours.
 */
export function mergeOutline(text: string, outline: ScriptOutline, scriptOrder: string[]): string {
  let lines = split(text);
  const position = (script: string) => {
    const i = scriptOrder.indexOf(script);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  for (const chapter of outline.chapters) {
    const all = headings(lines);
    const taken = all.map((h) => h.id);
    const existing = all.find((h) => h.level === 2 && h.script === outline.script && standsFor(h, lines, chapter.title));
    if (!existing) {
      const id = newId(chapter.title, taken);
      const block = headingLines(2, chapter, id, outline.script);
      for (const section of chapter.sections ?? []) {
        block.push("", ...headingLines(3, section, newId(section.title, taken), outline.script));
      }
      lines = insertBlock(lines, chapterIndexBefore(lines, all, outline.script, position, outline.chapters, chapter), block);
      continue;
    }
    const sections = chapter.sections ?? [];
    sections.forEach((section, order) => {
      const now = headings(lines);
      const taken = now.map((h) => h.id);
      const chapterNow = now.find((h) => h.id === existing.id)!;
      const chapterEnd = endOfChapter(lines, chapterNow);
      const inChapter = now.filter((h) => h.level === 3 && h.line > chapterNow.line && h.line < chapterEnd);
      if (inChapter.some((h) => standsFor(h, lines, section.title))) return;
      const later = sections.slice(order + 1).map((s) => s.title);
      const before = inChapter.find((h) => later.some((title) => standsFor(h, lines, title)));
      lines = insertBlock(lines, before ? before.line : chapterEnd, headingLines(3, section, newId(section.title, taken), outline.script));
    });
  }
  return join(lines);
}

function chapterIndexBefore(
  lines: string[],
  all: Heading[],
  script: string,
  position: (script: string) => number,
  chapters: OutlineItem[],
  chapter: OutlineItem,
): number {
  const ownRank = chapters.indexOf(chapter);
  const mine = position(script);
  for (const heading of all.filter((h) => h.level === 2)) {
    if (heading.id === OTHER_ID) return heading.line;
    if (!heading.script) continue;
    const later =
      heading.script === script
        ? chapters.findIndex((c) => standsFor(heading, lines, c.title)) > ownRank
        : position(heading.script) > mine;
    if (later) return heading.line;
  }
  return lines.length;
}

/** Enters what one lecture contributed, in the course's language; a block it added before is replaced. */
export function addSession(text: string, session: SessionInfo, notes: SectionNotes[], locale: Locale): string {
  const words = WORDS[locale];
  const date = words.date(session.date);
  let lines = removeSession(split(text), session.key);
  const known = headings(lines).map((h) => h.id);
  // Without the two standard sections there is nowhere to put things.
  if (!known.includes(OTHER_ID)) lines = tidy([...lines, "", `## ${words.other}`, `<!-- id: ${OTHER_ID} -->`]);

  const bySection: { id: string; points: string[]; hints: ExamHint[] }[] = [];
  for (const entry of notes) {
    const id = known.includes(entry.id) && entry.id !== EXAM_ID ? entry.id : OTHER_ID;
    const target = bySection.find((s) => s.id === id) ?? bySection[bySection.push({ id, points: [], hints: [] }) - 1]!;
    target.points.push(...(entry.points ?? []));
    target.hints.push(...(entry.examHints ?? []));
  }

  const examList: string[] = [];
  for (const { id, points, hints } of bySection) {
    if (points.length === 0 && hints.length === 0) continue;
    const heading = headings(lines).find((h) => h.id === id)!;
    const title = titleOf(lines, heading);
    const block = [`<!-- session: ${session.key} -->`, `> **${words.lecture} ${date}** · [${words.transcript}](${session.transcript.replace(/ /g, "%20")})`];
    block.push(...points.map((p) => `> - ${p.trim()}`));
    for (const hint of hints) {
      const time = hint.time ? ` [${hint.time}]` : "";
      const quote = words.quote(hint.quote.trim());
      block.push(">", `> ⚠️ **${words.examHint}** ${quote}${time}`);
      examList.push(`- ⚠️ ${quote} → ${title} · ${words.lecture} ${date}${time} <!-- session: ${session.key} -->`);
    }
    block.push("<!-- /session -->");
    lines = insertBlock(lines, endOfOwnText(lines, heading), block);
  }

  if (examList.length > 0) {
    const exam = headings(lines).find((h) => h.id === EXAM_ID);
    if (exam) lines = insertBlock(lines, endOfOwnText(lines, exam), examList);
  }
  return join(lines);
}

function removeSession(lines: string[], key: string): string[] {
  const start = `<!-- session: ${key} -->`;
  const kept: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (skipping) {
      if (line.trim() === "<!-- /session -->") skipping = false;
      continue;
    }
    if (line.trim() === start) {
      skipping = true;
      continue;
    }
    if (line.trimEnd().endsWith(start) && line.trimStart().startsWith("- ")) continue;
    kept.push(line);
  }
  return tidy(kept);
}

/** The headings the notes have, for telling Claude where things can go. */
export function outlineIds(text: string): { id: string; title: string }[] {
  const lines = split(text);
  return headings(lines)
    .filter((h) => h.id !== EXAM_ID)
    .map((h) => ({ id: h.id, title: titleOf(lines, h) }));
}

/** Which scripts the notes already have chapters of. */
export function scriptsInNotes(text: string): Set<string> {
  return new Set(headings(split(text)).flatMap((h) => (h.script ? [h.script] : [])));
}
