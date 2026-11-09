// The calendar: subscribed timetables, whose events become sessions of a
// subject once their series is assigned, together with deadlines and
// planned tasks; and the private link that brings it all to the phone.
import { and, eq, gt, gte, inArray, lt, lte, sql } from "drizzle-orm";
import ical from "ical-generator";
import { feedDraftSchema, type FeedDraft } from "@study/shared";
import type { Db } from "../db/client.ts";
import { courseMembers, courses, feedEvents, feeds, profiles, seriesAssignments, tasks } from "../db/schema.ts";
import { requireRole } from "./access.ts";
import { invalid, notFound } from "./errors.ts";
import { fetchPublicText, LinkNotAllowed } from "../text/publicFetch.ts";
import { record } from "./activity.ts";
import { expandIcs, numberSessions, suggestCourse } from "./feeds.ts";
import { memberCourseIds, planningOf, taskSlot } from "./planning.ts";

/** How far around today a feed is expanded. */
const PAST_DAYS = 60;
const FUTURE_DAYS = 300;

export interface CalendarItem {
  kind: "session" | "event" | "deadline" | "task";
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  courseId: string | null;
  feedId: string | null;
  location: string | null;
  notes: string | null;
  url: string | null;
  cancelled: boolean;
  /** Tasks: whether it is done; deadlines: whether the user has ticked it off. */
  done?: boolean;
  /** Deadlines: whether the user may change it. */
  editable?: boolean;
}

export function calendarOf(db: Db, fetchText: (url: string) => Promise<string> = defaultFetch) {
  const planning = planningOf(db);

  const ownFeed = async (userId: string, feedId: string) => {
    const feed = await db.query.feeds.findFirst({ where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)) });
    if (!feed) throw notFound("unknown_feed");
    return feed;
  };

  const refresh = async (feedId: string) => {
    const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) });
    if (!feed) return;
    try {
      const now = Date.now();
      const text = await fetchText(feed.url);
      // A login page or an error page instead of the calendar must not empty it.
      if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Unter dem Link liegt gerade kein Kalender.");
      const events = expandIcs(text, new Date(now - PAST_DAYS * 86_400_000), new Date(now + FUTURE_DAYS * 86_400_000));
      await db.transaction(async (tx) => {
        await tx.delete(feedEvents).where(eq(feedEvents.feedId, feedId));
        for (let i = 0; i < events.length; i += 500) {
          await tx.insert(feedEvents).values(events.slice(i, i + 500).map((e) => ({ ...e, feedId })));
        }
        await tx.update(feeds).set({ fetchedAt: new Date(), error: null }).where(eq(feeds.id, feedId));
      });
    } catch (error) {
      await db.update(feeds).set({ error: String((error as Error).message ?? error) }).where(eq(feeds.id, feedId));
      throw error;
    }
  };

  return {
    refresh,

    async refreshAll(): Promise<void> {
      for (const feed of await db.select({ id: feeds.id }).from(feeds)) {
        await refresh(feed.id).catch(() => {});
      }
    },

    async feeds(userId: string) {
      return db.select().from(feeds).where(eq(feeds.userId, userId)).orderBy(feeds.createdAt);
    },

    async addFeed(userId: string, input: FeedDraft) {
      const draft = feedDraftSchema.parse(input);
      // Fetched once right away, so that a wrong link is noticed at once.
      let text: string;
      try {
        text = await fetchText(draft.url);
      } catch (error) {
        if (error instanceof LinkNotAllowed) throw invalid("feed_not_allowed", error.message);
        throw invalid("feed_unreachable", String((error as Error).message));
      }
      if (!text.includes("BEGIN:VCALENDAR")) throw invalid("feed_not_calendar");
      const [feed] = await db.insert(feeds).values({ userId, name: draft.name, url: draft.url, color: draft.color ?? null }).returning();
      await refresh(feed!.id);
      await record(db, { actorId: userId, action: "feed.added", subjectId: feed!.id, subject: feed!.name });
      return feed!;
    },

    async updateFeed(userId: string, feedId: string, change: { name?: string; color?: string | null }) {
      await ownFeed(userId, feedId);
      await db
        .update(feeds)
        .set({ ...(change.name?.trim() && { name: change.name.trim() }), ...(change.color !== undefined && { color: change.color }) })
        .where(eq(feeds.id, feedId));
    },

    async removeFeed(userId: string, feedId: string) {
      const feed = await ownFeed(userId, feedId);
      await db.delete(feeds).where(eq(feeds.id, feedId));
      await record(db, { actorId: userId, action: "feed.removed", subjectId: feedId, subject: feed.name });
    },

    /** The recurring titles of the user's feeds, with their subject and a suggestion. */
    async series(userId: string) {
      const rows = await db
        .select({
          feedId: feedEvents.feedId,
          title: feedEvents.title,
          count: sql<number>`count(*)::int`,
          first: sql<Date>`min(${feedEvents.startsAt})`,
        })
        .from(feedEvents)
        .innerJoin(feeds, eq(feeds.id, feedEvents.feedId))
        .where(eq(feeds.userId, userId))
        .groupBy(feedEvents.feedId, feedEvents.title)
        .orderBy(feedEvents.title);
      const assigned = await db.select().from(seriesAssignments).where(eq(seriesAssignments.userId, userId));
      const mine = await db
        .select({ id: courses.id, title: courses.title, number: courses.number })
        .from(courseMembers)
        .innerJoin(courses, eq(courses.id, courseMembers.courseId))
        .where(eq(courseMembers.userId, userId));
      return rows
        .filter((r) => r.count > 1 || assigned.some((a) => a.feedId === r.feedId && a.title === r.title))
        .map((r) => {
          const assignment = assigned.find((a) => a.feedId === r.feedId && a.title === r.title);
          return {
            feedId: r.feedId,
            title: r.title,
            count: r.count,
            courseId: assignment ? assignment.courseId : null,
            decided: !!assignment,
            suggestion: assignment ? null : suggestCourse(r.title, mine),
          };
        });
    },

    /** The sessions of a subject from the user's timetables, numbered. */
    async sessions(userId: string, courseId: string) {
      await requireRole(db, userId, courseId, "viewer");
      const rows = await db
        .select({ event: feedEvents })
        .from(feedEvents)
        .innerJoin(feeds, eq(feeds.id, feedEvents.feedId))
        .innerJoin(
          seriesAssignments,
          and(eq(seriesAssignments.userId, userId), eq(seriesAssignments.feedId, feedEvents.feedId), eq(seriesAssignments.title, feedEvents.title)),
        )
        .where(and(eq(feeds.userId, userId), eq(seriesAssignments.courseId, courseId)));
      return numberSessions(rows.map((r) => r.event)).map((e) => ({
        id: `${e.feedId}:${e.uid}`,
        title: e.title,
        start: e.startsAt.toISOString(),
        end: e.endsAt.toISOString(),
        location: e.location,
        notes: e.notes,
        url: e.url,
        cancelled: e.cancelled,
        number: e.number,
        total: e.total,
      }));
    },

    /** How far each of the user's subjects is in its timetable. */
    async progress(userId: string, now = new Date()) {
      const courseIds = (await memberCourseIds(db, userId)).map((row) => row.id);
      return Promise.all(
        courseIds.map(async (courseId) => {
          const held = (await this.sessions(userId, courseId)).filter((s) => !s.cancelled);
          const next = held.find((s) => new Date(s.end) > now) ?? null;
          return {
            courseId,
            total: held.length,
            done: held.filter((s) => new Date(s.end) <= now).length,
            next: next && { start: next.start, end: next.end, location: next.location, title: next.title },
          };
        }),
      );
    },

    /** Assigns a series to a subject, or marks it as none (`null`). */
    async assign(userId: string, feedId: string, title: string, courseId: string | null) {
      await ownFeed(userId, feedId);
      if (courseId) await requireRole(db, userId, courseId, "viewer");
      await db
        .insert(seriesAssignments)
        .values({ userId, feedId, title, courseId })
        .onConflictDoUpdate({ target: [seriesAssignments.userId, seriesAssignments.feedId, seriesAssignments.title], set: { courseId } });
    },

    async items(userId: string, from: Date, to: Date): Promise<CalendarItem[]> {
      const items: CalendarItem[] = [];
      const events = await db
        .select({ event: feedEvents, courseId: seriesAssignments.courseId })
        .from(feedEvents)
        .innerJoin(feeds, eq(feeds.id, feedEvents.feedId))
        .leftJoin(
          seriesAssignments,
          and(eq(seriesAssignments.userId, userId), eq(seriesAssignments.feedId, feedEvents.feedId), eq(seriesAssignments.title, feedEvents.title)),
        )
        // The range ends before `to`: what starts at midnight belongs to the next day.
        .where(and(eq(feeds.userId, userId), lt(feedEvents.startsAt, to), gt(feedEvents.endsAt, from)));
      for (const { event, courseId } of events) {
        items.push({
          kind: courseId ? "session" : "event",
          id: `${event.feedId}:${event.uid}`,
          title: event.title,
          start: event.startsAt.toISOString(),
          end: event.endsAt.toISOString(),
          allDay: event.allDay,
          courseId,
          feedId: event.feedId,
          location: event.location,
          notes: event.notes,
          url: event.url,
          cancelled: event.cancelled,
        });
      }
      for (const deadline of await planning.deadlines(userId, { from, to })) {
        const start = deadline.allDay ? new Date(`${deadline.date}T00:00:00`) : new Date(deadline.startsAt!);
        const end = deadline.allDay ? new Date(start.getTime() + 86_400_000) : new Date(deadline.endsAt ?? start.getTime() + 3_600_000);
        if (start >= to || end <= from) continue;
        items.push({
          kind: "deadline",
          id: deadline.id,
          title: deadline.title,
          start: start.toISOString(),
          end: end.toISOString(),
          allDay: deadline.allDay,
          courseId: deadline.courseId,
          feedId: null,
          location: null,
          notes: deadline.notes,
          url: null,
          cancelled: false,
          editable: deadline.editable,
          done: deadline.done,
        });
      }
      const day = (d: Date) => d.toLocaleDateString("sv-SE");
      const planned = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), gte(tasks.plannedDate, day(from)), lte(tasks.plannedDate, day(to))));
      for (const task of planned) {
        const slot = taskSlot(task);
        const start = slot?.start ?? new Date(`${task.plannedDate}T00:00:00`);
        const end = slot?.end ?? new Date(start.getTime() + 86_400_000);
        // Asked for one day, the next day's tasks stay out.
        if (start >= to || end <= from) continue;
        items.push({
          kind: "task",
          id: task.id,
          title: task.title,
          start: start.toISOString(),
          end: end.toISOString(),
          allDay: !slot,
          courseId: task.courseId,
          feedId: null,
          location: null,
          notes: null,
          url: null,
          cancelled: false,
          done: task.done,
        });
      }
      return items.sort((a, b) => a.start.localeCompare(b.start));
    },

    /**
     * The calendar subscription for the phone: deadlines and planned open
     * tasks. Read-only; everything is planned in the web app.
     */
    async ics(token: string): Promise<string | null> {
      const profile = await db.query.profiles.findFirst({ where: eq(profiles.icalToken, token) });
      if (!profile || profile.disabled) return null;
      const calendar = ical({ name: "Study Manager", timezone: process.env.TZ ?? "Europe/Berlin", ttl: 15 * 60 });
      const titles = new Map(
        (
          await db
            .select({ id: courses.id, title: courses.title })
            .from(courses)
            .where(inArray(courses.id, db.select({ id: courseMembers.courseId }).from(courseMembers).where(eq(courseMembers.userId, profile.id))))
        ).map((c) => [c.id, c.title]),
      );
      const prefix = (courseId: string | null) => (courseId && titles.get(courseId) ? `${titles.get(courseId)}: ` : "");
      const from = new Date(Date.now() - 30 * 86_400_000);
      for (const deadline of await planning.deadlines(profile.id, { from })) {
        calendar.createEvent({
          id: `deadline-${deadline.id}@study-manager`,
          summary: `${prefix(deadline.courseId)}${deadline.title}`,
          description: deadline.notes ?? undefined,
          allDay: deadline.allDay,
          start: deadline.allDay ? new Date(`${deadline.date}T00:00:00`) : new Date(deadline.startsAt!),
          end: deadline.allDay ? undefined : new Date(deadline.endsAt ?? new Date(deadline.startsAt!).getTime() + 3_600_000),
        });
      }
      for (const task of await planning.tasks(profile.id, { open: true })) {
        if (!task.plannedDate) continue;
        const slot = taskSlot(task);
        calendar.createEvent({
          id: `task-${task.id}@study-manager`,
          summary: `☐ ${prefix(task.courseId)}${task.title}`,
          allDay: !slot,
          start: slot?.start ?? new Date(`${task.plannedDate}T00:00:00`),
          end: slot?.end,
        });
      }
      return calendar.toString();
    },
  };
}

async function defaultFetch(url: string): Promise<string> {
  return fetchPublicText(url);
}

