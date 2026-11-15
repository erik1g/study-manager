// Transcribed lectures of a subject. The transcription itself happens in the
// member's browser (or with their own API key); the server keeps the text,
// shares it with the subject, and lets Claude enter it into the notes.
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { profiles, recordings } from "../db/schema.ts";
import { requireRole } from "./access.ts";
import { invalid, notFound } from "./errors.ts";
import { changes, record } from "./activity.ts";
import type { notesOf } from "./notes.ts";
import type { SectionNotes } from "./notesText.ts";

/** Characters of a transcript per part Claude reads. */
export const PART = 40_000;

export const recordingDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  language: z.string().max(10).nullable().optional(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
  transcript: z.string().min(1).max(3_000_000),
});
export type RecordingDraft = z.infer<typeof recordingDraftSchema>;

export interface RecordingView {
  id: string;
  courseId: string;
  title: string;
  date: string;
  language: string | null;
  durationSeconds: number | null;
  createdBy: string | null;
  createdById: string | null;
  createdAt: string;
  analysedAt: string | null;
  analysedBy: string | null;
  length: number;
}

export function recordingsOf(db: Db, notes: ReturnType<typeof notesOf>) {
  const find = async (recordingId: string) => {
    const row = await db.query.recordings.findFirst({ where: eq(recordings.id, recordingId) });
    if (!row) throw notFound("unknown_recording");
    return row;
  };

  return {
    async list(userId: string, courseId: string): Promise<RecordingView[]> {
      await requireRole(db, userId, courseId, "viewer");
      const by = profiles;
      const rows = await db
        .select({ recording: recordings, creator: by.displayName })
        .from(recordings)
        .leftJoin(by, eq(by.id, recordings.createdBy))
        .where(eq(recordings.courseId, courseId))
        .orderBy(desc(recordings.date), desc(recordings.createdAt));
      const analysers = new Map(
        (await db.select({ id: profiles.id, name: profiles.displayName }).from(profiles)).map((p) => [p.id, p.name]),
      );
      return rows.map(({ recording, creator }) => ({
        id: recording.id,
        courseId: recording.courseId,
        title: recording.title,
        date: recording.date,
        language: recording.language,
        durationSeconds: recording.durationSeconds,
        createdBy: creator,
        createdById: recording.createdBy,
        createdAt: recording.createdAt.toISOString(),
        analysedAt: recording.analysedAt?.toISOString() ?? null,
        analysedBy: recording.analysedBy ? (analysers.get(recording.analysedBy) ?? null) : null,
        length: recording.transcript.length,
      }));
    },

    async get(userId: string, recordingId: string) {
      const row = await find(recordingId);
      await requireRole(db, userId, row.courseId, "viewer");
      return row;
    },

    /** A part of the transcript, for Claude to read it in pieces. */
    async part(userId: string, recordingId: string, part = 1) {
      const row = await this.get(userId, recordingId);
      const parts = Math.max(1, Math.ceil(row.transcript.length / PART));
      if (part < 1 || part > parts) throw invalid("unknown_part");
      return {
        title: row.title,
        date: row.date,
        part,
        parts,
        text: row.transcript.slice((part - 1) * PART, part * PART),
      };
    },

    async create(userId: string, courseId: string, input: RecordingDraft) {
      await requireRole(db, userId, courseId, "editor");
      const draft = recordingDraftSchema.parse(input);
      const [row] = await db
        .insert(recordings)
        .values({ courseId, ...draft, language: draft.language ?? null, durationSeconds: draft.durationSeconds ?? null, createdBy: userId })
        .returning({ id: recordings.id });
      await record(db, { courseId, actorId: userId, action: "recording.created", subjectId: row!.id, subject: draft.title, details: { date: draft.date } });
      return row!.id;
    },

    async rename(userId: string, recordingId: string, change: { title?: string; date?: string }) {
      const row = await find(recordingId);
      await requireRole(db, userId, row.courseId, "editor");
      await db
        .update(recordings)
        .set({ ...(change.title?.trim() && { title: change.title.trim() }), ...(change.date && { date: change.date }) })
        .where(eq(recordings.id, recordingId));
      const diff = changes(row, { title: change.title?.trim() || undefined, date: change.date });
      if (Object.keys(diff).length > 0) {
        await record(db, { courseId: row.courseId, actorId: userId, action: "recording.changed", subjectId: row.id, subject: change.title?.trim() || row.title, details: diff });
      }
    },

    async remove(userId: string, recordingId: string) {
      const row = await find(recordingId);
      await requireRole(db, userId, row.courseId, "editor");
      await db.delete(recordings).where(eq(recordings.id, recordingId));
      await record(db, { courseId: row.courseId, actorId: userId, action: "recording.deleted", subjectId: row.id, subject: row.title });
    },

    /** Enters Claude's evaluation of a lecture into the shared notes. */
    async analyse(userId: string, recordingId: string, sections: SectionNotes[]) {
      const row = await find(recordingId);
      await notes.applyLecture(
        userId,
        row.courseId,
        { key: row.id, date: row.date, transcript: `/fach/${row.courseId}?tab=vorlesungen&aufnahme=${row.id}` },
        sections,
      );
      await db.update(recordings).set({ analysedAt: new Date(), analysedBy: userId }).where(eq(recordings.id, recordingId));
      await record(db, { courseId: row.courseId, actorId: userId, action: "recording.analysed", subjectId: row.id, subject: row.title });
    },

    async unanalysed(courseId: string) {
      return db
        .select({ id: recordings.id, title: recordings.title, date: recordings.date })
        .from(recordings)
        .where(and(eq(recordings.courseId, courseId), isNull(recordings.analysedAt)))
        .orderBy(recordings.date);
    },
  };
}
