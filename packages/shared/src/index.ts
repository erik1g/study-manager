// What the web app, the API and the MCP server agree on: the shapes of the
// things a student works with, and the rules every input must meet.
import { z } from "zod";

// --- Roles ---------------------------------------------------------------

/** What a member may do in a shared subject. */
export const COURSE_ROLES = ["owner", "editor", "viewer"] as const;
export type CourseRole = (typeof COURSE_ROLES)[number];

const RANK: Record<CourseRole, number> = { viewer: 0, editor: 1, owner: 2 };

/** Whether `role` allows what `needed` allows. */
export function atLeast(role: CourseRole | null | undefined, needed: CourseRole): boolean {
  return role != null && RANK[role] >= RANK[needed];
}

// --- Subjects ------------------------------------------------------------

/** The folders every subject has; nothing else is created. */
export const FILE_FOLDERS = ["skripte", "uebungen", "altklausuren", "sonstiges"] as const;
export type FileFolder = (typeof FILE_FOLDERS)[number];

/** `WiSe26-27` or `SoSe27`. */
export const semesterSchema = z.string().regex(/^(WiSe\d{2}-\d{2}|SoSe\d{2})$/, "Semester wie WiSe26-27 oder SoSe27");

/** A subject comes from a module of the catalogue, or is made by hand with a title. */
export const courseDraftSchema = z
  .object({
    title: z.string().trim().max(200).default(""),
    semester: semesterSchema,
    moduleId: z.string().uuid().nullable().optional(),
    number: z.string().trim().max(40).nullable().optional(),
    credits: z.number().min(0).max(60).nullable().optional(),
  })
  .refine((d) => !!d.moduleId || d.title.length > 0, { message: "Ein Fach braucht einen Titel.", path: ["title"] });
export type CourseDraft = z.infer<typeof courseDraftSchema>;

// --- Degree programmes and their modules ---------------------------------

export const programDraftSchema = z.object({
  university: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  /** B.Sc., M.Sc., M.A. … */
  degree: z.string().trim().max(40).default(""),
  /** The examination regulations the handbook belongs to, e.g. "PO 2023". */
  regulation: z.string().trim().max(80).default(""),
});
export type ProgramDraft = z.infer<typeof programDraftSchema>;

const text = (max: number) => z.string().trim().max(max).nullable().optional();

/**
 * One module as every handbook is brought into it, whatever the university.
 * Only number and title are required; the rest is taken over where the
 * handbook says it.
 */
export const moduleSchema = z.object({
  number: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(300),
  credits: z.number().min(0).max(60).nullable().optional(),
  language: text(80),
  /** How often it is offered, e.g. "jedes Wintersemester". */
  turnus: text(120),
  duration: text(60),
  responsible: text(300),
  lecturers: text(600),
  contents: text(20000),
  learningGoals: text(20000),
  /** Form and length of the examination. */
  exam: text(4000),
  prerequisites: text(4000),
  workload: text(1000),
  /** The courses that make up the module: lecture, exercise, lab … */
  courses: text(2000),
  /** Page in the handbook where the module starts. */
  page: z.number().int().positive().nullable().optional(),
});
export type ModuleData = z.infer<typeof moduleSchema>;

/** Modules arrive in batches, so that a long handbook fits in several calls. */
export const MODULE_BATCH = 20;

// --- Deadlines and tasks -------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Uhrzeit als HH:MM");

/** An exam or a submission cut-off; shared with everyone in its subject. */
export const deadlineDraftSchema = z
  .object({
    courseId: z.string().uuid().nullable(),
    title: z.string().trim().min(1).max(300),
    allDay: z.boolean(),
    date: isoDate.nullable().optional(),
    startsAt: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((d) => (d.allDay ? !!d.date : !!d.startsAt), {
    message: "Ganztägige Termine brauchen ein Datum, andere eine Startzeit.",
  });
export type DeadlineDraft = z.infer<typeof deadlineDraftSchema>;

/** A to-do of one student, planned for a day and optionally a time. */
export const taskDraftSchema = z.object({
  courseId: z.string().uuid().nullable(),
  deadlineId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  plannedDate: isoDate.nullable().optional(),
  startTime: clock.nullable().optional(),
  estimateMinutes: z.number().int().positive().max(24 * 60).nullable().optional(),
});
export type TaskDraft = z.infer<typeof taskDraftSchema>;

/** How long a task planned at a time but without an estimate is blocked out. */
export const DEFAULT_SLOT_MINUTES = 60;

// --- Calendar subscriptions ---------------------------------------------

export const feedDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z
    .string()
    .trim()
    .transform((u) => u.replace(/^webcal:\/\//i, "https://"))
    .pipe(z.string().url()),
  color: z.string().max(20).nullable().optional(),
});
export type FeedDraft = z.infer<typeof feedDraftSchema>;

/** The colours a subject or calendar can have; values live in the stylesheet. */
export const COLORS = ["blau", "petrol", "gruen", "gelb", "orange", "rot", "violett", "grau"] as const;
