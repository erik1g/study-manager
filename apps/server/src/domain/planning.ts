// Deadlines (shared in their subject) and tasks (private), the two things a
// student plans with.
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  DEFAULT_SLOT_MINUTES,
  deadlineDraftSchema,
  taskDraftSchema,
  type DeadlineDraft,
  type TaskDraft,
} from "@study/shared";
import type { Db } from "../db/client.ts";
import { courseMembers, courses, deadlineDone, deadlines, profiles, tasks } from "../db/schema.ts";
import { requireRole, roleIn } from "./access.ts";
import { changes, record } from "./activity.ts";
import { invalid, notFound } from "./errors.ts";

export interface DeadlineView {
  id: string;
  courseId: string | null;
  title: string;
  allDay: boolean;
  date: string | null;
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdById: string | null;
  /** Whether the user may change it. */
  editable: boolean;
  /** Whether the user has ticked it off; each member for themselves. */
  done: boolean;
  doneAt: string | null;
}

export interface TaskView {
  id: string;
  courseId: string | null;
  deadlineId: string | null;
  title: string;
  plannedDate: string | null;
  startTime: string | null;
  estimateMinutes: number | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
}

/** The subjects a user is in (and that still exist). */
export const memberCourseIds = (db: Db, userId: string) =>
  db
    .select({ id: courseMembers.courseId })
    .from(courseMembers)
    .innerJoin(courses, eq(courses.id, courseMembers.courseId))
    .where(and(eq(courseMembers.userId, userId), isNull(courses.deletedAt)));

/** Local start and end of a task's time block, if it is planned at a time. */
export function taskSlot(task: Pick<TaskView, "plannedDate" | "startTime" | "estimateMinutes">): { start: Date; end: Date } | null {
  if (!task.plannedDate || !task.startTime) return null;
  const start = new Date(`${task.plannedDate}T${task.startTime}:00`);
  return { start, end: new Date(start.getTime() + (task.estimateMinutes ?? DEFAULT_SLOT_MINUTES) * 60_000) };
}

export function planningOf(db: Db) {
  const visibleDeadline = (userId: string) =>
    and(
      isNull(deadlines.deletedAt),
      or(inArray(deadlines.courseId, memberCourseIds(db, userId)), and(isNull(deadlines.courseId), eq(deadlines.ownerId, userId))),
    );

  const deadlineView = async (userId: string, row: typeof deadlines.$inferSelect, creator?: string | null, doneAt?: Date | null): Promise<DeadlineView> => ({
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    allDay: row.allDay,
    date: row.date,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    notes: row.notes,
    createdBy: creator ?? null,
    createdById: row.createdBy,
    editable: row.courseId ? (await roleIn(db, userId, row.courseId)) !== "viewer" : row.ownerId === userId,
    done: !!doneAt,
    doneAt: doneAt?.toISOString() ?? null,
  });

  const mayChangeDeadline = async (userId: string, deadlineId: string) => {
    const row = await db.query.deadlines.findFirst({ where: and(eq(deadlines.id, deadlineId), isNull(deadlines.deletedAt)) });
    if (!row) throw notFound("unknown_deadline");
    if (row.courseId) await requireRole(db, userId, row.courseId, "editor");
    else if (row.ownerId !== userId) throw notFound("unknown_deadline");
    return row;
  };

  const checkTaskLinks = async (userId: string, draft: TaskDraft) => {
    if (draft.courseId) await requireRole(db, userId, draft.courseId, "viewer");
    if (draft.deadlineId) {
      const visible = await db.select({ id: deadlines.id }).from(deadlines).where(and(eq(deadlines.id, draft.deadlineId), visibleDeadline(userId)));
      if (visible.length === 0) throw notFound("unknown_deadline");
    }
    if (draft.startTime && !draft.plannedDate) throw invalid("time_without_day");
  };

  const taskView = (row: typeof tasks.$inferSelect): TaskView => ({
    id: row.id,
    courseId: row.courseId,
    deadlineId: row.deadlineId,
    title: row.title,
    plannedDate: row.plannedDate,
    startTime: row.startTime,
    estimateMinutes: row.estimateMinutes,
    done: row.done,
    doneAt: row.doneAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });

  const fromDraft = (draft: DeadlineDraft) => ({
    courseId: draft.courseId,
    title: draft.title,
    allDay: draft.allDay,
    date: draft.allDay ? draft.date! : null,
    startsAt: draft.allDay ? null : new Date(draft.startsAt!),
    endsAt: draft.allDay || !draft.endsAt ? null : new Date(draft.endsAt),
    notes: draft.notes || null,
  });

  return {
    // --- Deadlines -------------------------------------------------------

    /** Deadlines from `from` on (and up to `to`), or all upcoming without bounds. */
    async deadlines(userId: string, range: { from?: Date; to?: Date; courseId?: string } = {}): Promise<DeadlineView[]> {
      const day = (d: Date) => d.toISOString().slice(0, 10);
      const rows = await db
        .select({ deadline: deadlines, creator: profiles.displayName, doneAt: deadlineDone.doneAt })
        .from(deadlines)
        .leftJoin(profiles, eq(profiles.id, deadlines.createdBy))
        .leftJoin(deadlineDone, and(eq(deadlineDone.deadlineId, deadlines.id), eq(deadlineDone.userId, userId)))
        .where(
          and(
            visibleDeadline(userId),
            range.courseId ? eq(deadlines.courseId, range.courseId) : undefined,
            range.from
              ? or(gte(deadlines.startsAt, range.from), gte(deadlines.date, day(range.from)))
              : undefined,
            range.to ? or(lte(deadlines.startsAt, range.to), lte(deadlines.date, day(range.to))) : undefined,
          ),
        )
        .orderBy(sql`coalesce(${deadlines.startsAt}, ${deadlines.date}::timestamptz)`);
      return Promise.all(rows.map((r) => deadlineView(userId, r.deadline, r.creator, r.doneAt)));
    },

    /** Ticks a deadline off for the user, or opens it again; nobody else's view changes. */
    async setDeadlineDone(userId: string, deadlineId: string, done: boolean): Promise<DeadlineView> {
      const [found] = await db
        .select({ deadline: deadlines, creator: profiles.displayName })
        .from(deadlines)
        .leftJoin(profiles, eq(profiles.id, deadlines.createdBy))
        .where(and(eq(deadlines.id, deadlineId), visibleDeadline(userId)));
      if (!found) throw notFound("unknown_deadline");
      let doneAt: Date | null = null;
      if (done) {
        const [row] = await db
          .insert(deadlineDone)
          .values({ deadlineId, userId })
          .onConflictDoUpdate({ target: [deadlineDone.deadlineId, deadlineDone.userId], set: { doneAt: sql`${deadlineDone.doneAt}` } })
          .returning();
        doneAt = row!.doneAt;
      } else {
        await db.delete(deadlineDone).where(and(eq(deadlineDone.deadlineId, deadlineId), eq(deadlineDone.userId, userId)));
      }
      return deadlineView(userId, found.deadline, found.creator, doneAt);
    },

    async createDeadline(userId: string, input: DeadlineDraft): Promise<DeadlineView> {
      const draft = deadlineDraftSchema.parse(input);
      if (draft.courseId) await requireRole(db, userId, draft.courseId, "editor");
      const [row] = await db
        .insert(deadlines)
        .values({ ...fromDraft(draft), ownerId: draft.courseId ? null : userId, createdBy: userId })
        .returning();
      if (row!.courseId) {
        await record(db, { courseId: row!.courseId, actorId: userId, action: "deadline.created", subjectId: row!.id, subject: row!.title, details: { when: row!.date ?? row!.startsAt?.toISOString() } });
      }
      return deadlineView(userId, row!);
    },

    async updateDeadline(userId: string, deadlineId: string, input: DeadlineDraft): Promise<DeadlineView> {
      const existing = await mayChangeDeadline(userId, deadlineId);
      const draft = deadlineDraftSchema.parse(input);
      // Moving it to another subject needs the right to add there too.
      if (draft.courseId && draft.courseId !== existing.courseId) await requireRole(db, userId, draft.courseId, "editor");
      const [row] = await db
        .update(deadlines)
        .set({ ...fromDraft(draft), ownerId: draft.courseId ? null : userId, updatedAt: new Date() })
        .where(eq(deadlines.id, deadlineId))
        .returning();
      // Private deadlines are nobody else's business.
      const courseId = row!.courseId ?? existing.courseId;
      if (courseId) {
        const { title, allDay, date, startsAt, endsAt, notes, courseId: movedTo } = row!;
        const diff = changes(existing, { title, allDay, date, startsAt, endsAt, notes, courseId: movedTo });
        if (Object.keys(diff).length > 0) {
          await record(db, { courseId, actorId: userId, action: "deadline.changed", subjectId: row!.id, subject: row!.title, details: diff });
        }
      }
      return deadlineView(userId, row!);
    },

    async deleteDeadline(userId: string, deadlineId: string) {
      const row = await mayChangeDeadline(userId, deadlineId);
      await db.update(deadlines).set({ deletedAt: new Date(), deletedBy: userId }).where(eq(deadlines.id, deadlineId));
      if (row.courseId) await record(db, { courseId: row.courseId, actorId: userId, action: "deadline.deleted", subjectId: row.id, subject: row.title });
    },

    // --- Tasks -----------------------------------------------------------

    async tasks(userId: string, filter: { courseId?: string; open?: boolean } = {}): Promise<TaskView[]> {
      const rows = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            filter.courseId ? eq(tasks.courseId, filter.courseId) : undefined,
            filter.open ? eq(tasks.done, false) : undefined,
          ),
        )
        .orderBy(asc(tasks.done), sql`${tasks.plannedDate} asc nulls last`, sql`${tasks.startTime} asc nulls last`, tasks.createdAt);
      return rows.map(taskView);
    },

    async createTask(userId: string, input: TaskDraft): Promise<TaskView> {
      const draft = taskDraftSchema.parse(input);
      await checkTaskLinks(userId, draft);
      const [row] = await db
        .insert(tasks)
        .values({
          userId,
          courseId: draft.courseId,
          deadlineId: draft.deadlineId ?? null,
          title: draft.title,
          plannedDate: draft.plannedDate ?? null,
          startTime: draft.plannedDate ? (draft.startTime ?? null) : null,
          estimateMinutes: draft.estimateMinutes ?? null,
        })
        .returning();
      return taskView(row!);
    },

    async updateTask(userId: string, taskId: string, input: Partial<TaskDraft> & { done?: boolean }): Promise<TaskView> {
      const existing = await db.query.tasks.findFirst({ where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)) });
      if (!existing) throw notFound("unknown_task");
      const merged = taskDraftSchema.parse({
        courseId: input.courseId !== undefined ? input.courseId : existing.courseId,
        deadlineId: input.deadlineId !== undefined ? input.deadlineId : existing.deadlineId,
        title: input.title ?? existing.title,
        plannedDate: input.plannedDate !== undefined ? input.plannedDate : existing.plannedDate,
        startTime: input.startTime !== undefined ? input.startTime : existing.startTime,
        estimateMinutes: input.estimateMinutes !== undefined ? input.estimateMinutes : existing.estimateMinutes,
      });
      await checkTaskLinks(userId, merged);
      const done = input.done ?? existing.done;
      const [row] = await db
        .update(tasks)
        .set({
          courseId: merged.courseId,
          deadlineId: merged.deadlineId ?? null,
          title: merged.title,
          plannedDate: merged.plannedDate ?? null,
          startTime: merged.plannedDate ? (merged.startTime ?? null) : null,
          estimateMinutes: merged.estimateMinutes ?? null,
          done,
          doneAt: done ? (existing.doneAt ?? new Date()) : null,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId))
        .returning();
      return taskView(row!);
    },

    async deleteTask(userId: string, taskId: string) {
      const deleted = await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).returning({ id: tasks.id });
      if (deleted.length === 0) throw notFound("unknown_task");
    },
  };
}
