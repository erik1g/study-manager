// Who changed what in the shared parts of the Study Manager, so that members
// can follow it. Private things (tasks, private notes, learning) are not
// recorded. Entries are kept for a year.
import { AsyncLocalStorage } from "node:async_hooks";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { activity, courses, profiles } from "../db/schema.ts";
import { requireRole } from "./access.ts";

export const KEEP_DAYS = 365;

/** Whether a change came from the web app or from Claude (MCP or a personal key). */
export type Via = "app" | "claude";

const context = new AsyncLocalStorage<{ via: Via }>();

/** Runs `next` with everything it records marked as coming `via`. */
export function actingVia(via: Via, next: () => void) {
  context.run({ via }, next);
}

export type ActivityAction =
  | "course.created"
  | "course.changed"
  | "course.deleted"
  | "member.joined"
  | "member.invited"
  | "member.uninvited"
  | "member.role"
  | "member.removed"
  | "member.left"
  | "file.uploaded"
  | "file.renamed"
  | "file.moved"
  | "file.deleted"
  | "file.restored"
  | "deadline.created"
  | "deadline.changed"
  | "deadline.deleted"
  | "deck.created"
  | "deck.renamed"
  | "deck.deleted"
  | "card.created"
  | "card.changed"
  | "card.deleted"
  | "notes.edited"
  | "recording.created"
  | "recording.changed"
  | "recording.deleted"
  | "recording.analysed"
  | "program.created"
  | "program.changed"
  | "program.deleted"
  | "modules.changed"
  | "feed.added"
  | "feed.removed"
  | "user.invited"
  | "user.changed"
  | "user.deleted";

export interface Entry {
  courseId?: string | null;
  actorId: string | null;
  action: ActivityAction;
  /** The thing it is about, and its name at the time. */
  subjectId?: string | null;
  subject: string;
  /** Changed fields as `[before, after]`, or other facts worth showing. */
  details?: Record<string, unknown>;
}

/** Edits of the same thing by the same person within this time count as one. */
const MERGE_MINUTES = 30;
const MERGED: ActivityAction[] = ["notes.edited", "card.changed"];

export async function record(db: Db, entry: Entry): Promise<void> {
  const via = context.getStore()?.via ?? "app";
  if (MERGED.includes(entry.action) && entry.actorId) {
    const merged = await db
      .update(activity)
      .set({ at: new Date(), count: sql`${activity.count} + 1` })
      .where(
        and(
          eq(activity.action, entry.action),
          eq(activity.actorId, entry.actorId),
          eq(activity.via, via),
          entry.subjectId ? eq(activity.subjectId, entry.subjectId) : sql`${activity.subjectId} is null`,
          gt(activity.at, new Date(Date.now() - MERGE_MINUTES * 60_000)),
        ),
      )
      .returning({ id: activity.id });
    if (merged.length > 0) return;
  }
  await db.insert(activity).values({
    courseId: entry.courseId ?? null,
    actorId: entry.actorId,
    via,
    action: entry.action,
    subjectId: entry.subjectId ?? null,
    subject: entry.subject,
    details: entry.details ?? {},
  });
}

/** Only the fields that changed, as `[before, after]`. */
export function changes<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, [unknown, unknown]> {
  const result: Record<string, [unknown, unknown]> = {};
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    const old = before[key];
    const same = old instanceof Date && value instanceof Date ? old.getTime() === value.getTime() : old === value;
    if (!same) result[key] = [old instanceof Date ? old.toISOString() : (old ?? null), value instanceof Date ? value.toISOString() : value];
  }
  return result;
}

export interface ActivityView {
  id: string;
  at: string;
  courseId: string | null;
  courseTitle: string | null;
  actorId: string | null;
  /** Null once the account was deleted. */
  actorName: string | null;
  actorHasAvatar: boolean;
  via: Via;
  action: ActivityAction;
  subjectId: string | null;
  subject: string;
  details: Record<string, unknown>;
  /** How many edits were merged into this entry. */
  count: number;
}

export function activityOf(db: Db) {
  const select = (where: ReturnType<typeof and>, limit: number, before?: string) =>
    db
      .select({ row: activity, actorName: profiles.displayName, avatar: profiles.avatarPath, courseTitle: courses.title })
      .from(activity)
      .leftJoin(profiles, eq(profiles.id, activity.actorId))
      .leftJoin(courses, eq(courses.id, activity.courseId))
      .where(and(where, before ? lt(activity.at, new Date(before)) : undefined))
      .orderBy(desc(activity.at))
      .limit(Math.min(limit, 200))
      .then((rows) =>
        rows.map(
          (r): ActivityView => ({
            id: r.row.id,
            at: r.row.at.toISOString(),
            courseId: r.row.courseId,
            courseTitle: r.courseTitle,
            actorId: r.row.actorId,
            actorName: r.actorName,
            actorHasAvatar: !!r.avatar,
            via: r.row.via as Via,
            action: r.row.action as ActivityAction,
            subjectId: r.row.subjectId,
            subject: r.row.subject,
            details: r.row.details as Record<string, unknown>,
            count: r.row.count,
          }),
        ),
      );

  return {
    /** What happened in a subject, newest first; for its members. */
    async ofCourse(userId: string, courseId: string, options: { limit?: number; before?: string } = {}) {
      await requireRole(db, userId, courseId, "viewer");
      return select(and(eq(activity.courseId, courseId)), options.limit ?? 50, options.before);
    },

    /** Everything, for admins; optionally one person's or one subject's. */
    all(options: { actorId?: string; courseIds?: string[]; limit?: number; before?: string } = {}) {
      return select(
        and(
          options.actorId ? eq(activity.actorId, options.actorId) : undefined,
          options.courseIds ? inArray(activity.courseId, options.courseIds) : undefined,
        ),
        options.limit ?? 100,
        options.before,
      );
    },

    async prune(now = new Date()): Promise<number> {
      const deleted = await db
        .delete(activity)
        .where(lt(activity.at, new Date(now.getTime() - KEEP_DAYS * 86_400_000)))
        .returning({ id: activity.id });
      return deleted.length;
    },
  };
}
