// The notes of a subject: one shared text, edited like a wiki, and one
// private text per member. The shared text is saved against the version it
// was loaded in; if someone saved in between, the save is refused and the
// current text returned, so nobody silently overwrites someone else.
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { courseNotes, courses, files, privateNotes, profiles } from "../db/schema.ts";
import { requireRole } from "./access.ts";
import { AppError, invalid, notFound } from "./errors.ts";
import { record } from "./activity.ts";
import { addSession, mergeOutline, newNotes, outlineIds, scriptsInNotes, type ScriptOutline, type SectionNotes, type SessionInfo } from "./notesText.ts";

export interface NotesView {
  content: string;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedById: string | null;
}

/** Notes may be long, but not without limit. */
const MAX_LENGTH = 2_000_000;

export class NotesConflict extends AppError {
  constructor(readonly current: NotesView) {
    super(409, "notes_conflict");
  }
}

export function notesOf(db: Db) {
  const read = async (courseId: string): Promise<NotesView> => {
    const row = await db
      .select({ notes: courseNotes, by: profiles.displayName })
      .from(courseNotes)
      .leftJoin(profiles, eq(profiles.id, courseNotes.updatedBy))
      .where(eq(courseNotes.courseId, courseId))
      .then((rows) => rows[0]);
    if (row) return { content: row.notes.content, version: row.notes.version, updatedAt: row.notes.updatedAt.toISOString(), updatedBy: row.by, updatedById: row.notes.updatedBy };
    const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
    if (!course) throw notFound("unknown_course");
    return { content: newNotes(course.title, course.locale), version: 0, updatedAt: null, updatedBy: null, updatedById: null };
  };

  /** Writes the text if it is still at `baseVersion`; the next version otherwise conflicts. */
  const write = async (userId: string, courseId: string, content: string, baseVersion: number): Promise<NotesView> => {
    if (content.length > MAX_LENGTH) throw invalid("notes_too_long");
    if (baseVersion === 0) {
      const inserted = await db
        .insert(courseNotes)
        .values({ courseId, content, version: 1, updatedBy: userId })
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) throw new NotesConflict(await read(courseId));
      await record(db, { courseId, actorId: userId, action: "notes.edited", subjectId: courseId, subject: "Notizen" });
    } else {
      const updated = await db
        .update(courseNotes)
        .set({ content, version: baseVersion + 1, updatedAt: new Date(), updatedBy: userId })
        .where(and(eq(courseNotes.courseId, courseId), eq(courseNotes.version, baseVersion)))
        .returning();
      if (updated.length === 0) throw new NotesConflict(await read(courseId));
      await record(db, { courseId, actorId: userId, action: "notes.edited", subjectId: courseId, subject: "Notizen" });
    }
    return read(courseId);
  };

  /** Applies a change to the current text, retrying if someone saved in between. */
  const change = async (userId: string, courseId: string, edit: (text: string) => string): Promise<NotesView> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await read(courseId);
      const next = edit(current.content);
      if (next === current.content) return current;
      try {
        return await write(userId, courseId, next, current.version);
      } catch (error) {
        if (!(error instanceof NotesConflict)) throw error;
      }
    }
    throw new AppError(409, "notes_busy");
  };

  /** The subject's scripts in the order they belong in the notes: by name, numbers counted. */
  const scriptOrder = async (courseId: string) => {
    const scripts = await db
      .select({ id: files.id, name: files.name })
      .from(files)
      .where(and(eq(files.courseId, courseId), eq(files.folder, "skripte")));
    const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });
    return scripts.sort((a, b) => collator.compare(a.name, b.name));
  };

  return {
    async get(userId: string, courseId: string): Promise<NotesView> {
      await requireRole(db, userId, courseId, "viewer");
      return read(courseId);
    },

    async save(userId: string, courseId: string, content: string, baseVersion: number): Promise<NotesView> {
      await requireRole(db, userId, courseId, "editor");
      return write(userId, courseId, content, baseVersion);
    },

    async getPrivate(userId: string, courseId: string): Promise<{ content: string; updatedAt: string | null }> {
      await requireRole(db, userId, courseId, "viewer");
      const row = await db.query.privateNotes.findFirst({ where: and(eq(privateNotes.userId, userId), eq(privateNotes.courseId, courseId)) });
      return { content: row?.content ?? "", updatedAt: row?.updatedAt.toISOString() ?? null };
    },

    async savePrivate(userId: string, courseId: string, content: string) {
      await requireRole(db, userId, courseId, "viewer");
      if (content.length > MAX_LENGTH) throw invalid("notes_too_long");
      await db
        .insert(privateNotes)
        .values({ userId, courseId, content })
        .onConflictDoUpdate({ target: [privateNotes.userId, privateNotes.courseId], set: { content, updatedAt: new Date() } });
    },

    /** The headings Claude can add to, with their ids. */
    async outline(userId: string, courseId: string) {
      await requireRole(db, userId, courseId, "viewer");
      return outlineIds((await read(courseId)).content);
    },

    /** Adds a script's chapters and sections the notes lack. */
    async applyOutline(userId: string, courseId: string, outline: ScriptOutline): Promise<NotesView> {
      await requireRole(db, userId, courseId, "editor");
      const order = await scriptOrder(courseId);
      if (!order.some((s) => s.id === outline.script)) throw invalid("not_a_script", "The outline must belong to a script of this course.");
      if (outline.chapters.length === 0) throw invalid("empty_outline");
      return change(userId, courseId, (text) => mergeOutline(text, outline, order.map((s) => s.id)));
    },

    /** Enters what a lecture contributed; evaluating it again replaces its blocks. */
    async applyLecture(userId: string, courseId: string, session: SessionInfo, notes: SectionNotes[]): Promise<NotesView> {
      await requireRole(db, userId, courseId, "editor");
      const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
      if (!course) throw notFound("unknown_course");
      return change(userId, courseId, (text) => addSession(text, session, notes, course.locale));
    },

    /** Scripts of the subject that have no chapters in the notes yet. */
    async scriptsWithoutOutline(courseId: string) {
      const present = scriptsInNotes((await read(courseId)).content);
      return (await scriptOrder(courseId)).filter((s) => !present.has(s.id));
    },
  };
}
