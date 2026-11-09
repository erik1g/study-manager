// Inviting people who already have an account straight into a subject, and
// the notifications that tell them – and the inviter, once they answered.
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { CourseRole } from "@study/shared";
import type { Db } from "../db/client.ts";
import { courseInvitations, courseMembers, courses, notifications, profiles } from "../db/schema.ts";
import { requireRole } from "./access.ts";
import { record } from "./activity.ts";
import { invalid, notFound } from "./errors.ts";

export type NotificationKind = "course_invitation" | "invitation_accepted" | "invitation_declined";

export interface PersonMatch {
  id: string;
  displayName: string;
  email: string;
  hasAvatar: boolean;
  avatarVersion: number;
  /** Already in the subject, or invited and not yet answered. */
  status: "member" | "invited" | null;
}

export interface PendingInvitation {
  userId: string;
  displayName: string;
  email: string;
  role: CourseRole;
  invitedBy: string | null;
  createdAt: string;
}

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  courseId: string | null;
  courseTitle: string | null;
  actorId: string | null;
  actorName: string | null;
  data: { role?: CourseRole; status?: "open" | "accepted" | "declined" | "withdrawn" };
  createdAt: string;
  read: boolean;
}

/** People shown per search. */
const MATCHES = 8;

export function invitationsOf(db: Db) {
  const nameOf = async (userId: string) => (await db.query.profiles.findFirst({ where: eq(profiles.id, userId) }))?.displayName ?? "";

  /** The open invitation notification of a person for a subject gets its outcome. */
  const settle = (userId: string, courseId: string, status: "accepted" | "declined" | "withdrawn") =>
    db
      .update(notifications)
      .set({ data: sql`${notifications.data} || ${JSON.stringify({ status })}::jsonb`, readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.courseId, courseId),
          eq(notifications.kind, "course_invitation"),
          sql`${notifications.data}->>'status' = 'open'`,
        ),
      );

  return {
    /** People with an account, by name or address, for an owner looking for whom to invite. */
    async findPeople(userId: string, courseId: string, query: string): Promise<PersonMatch[]> {
      await requireRole(db, userId, courseId, "owner");
      const term = query.trim();
      if (term.length < 2) return [];
      const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      const rows = await db
        .select({
          id: profiles.id,
          displayName: profiles.displayName,
          email: profiles.email,
          hasAvatar: sql<boolean>`${profiles.avatarPath} is not null`,
          avatarVersion: profiles.avatarVersion,
          member: sql<boolean>`exists (select 1 from ${courseMembers} m where m.course_id = ${courseId} and m.user_id = ${profiles.id})`,
          invited: sql<boolean>`exists (select 1 from ${courseInvitations} i where i.course_id = ${courseId} and i.invitee_id = ${profiles.id})`,
        })
        .from(profiles)
        .where(and(eq(profiles.disabled, false), or(ilike(profiles.displayName, like), ilike(profiles.email, like))))
        .orderBy(profiles.displayName)
        .limit(MATCHES);
      return rows.map(({ member, invited, ...person }) => ({ ...person, status: member ? "member" : invited ? "invited" : null }));
    },

    /** Invites a person; inviting again only changes the role. */
    async invite(userId: string, courseId: string, inviteeId: string, role: CourseRole): Promise<void> {
      await requireRole(db, userId, courseId, "owner");
      const invitee = await db.query.profiles.findFirst({ where: and(eq(profiles.id, inviteeId), eq(profiles.disabled, false)) });
      if (!invitee) throw notFound("unknown_person");
      const member = await db.query.courseMembers.findFirst({ where: and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, inviteeId)) });
      if (member) throw invalid("already_member");
      const [existing] = await db
        .select()
        .from(courseInvitations)
        .where(and(eq(courseInvitations.courseId, courseId), eq(courseInvitations.inviteeId, inviteeId)));
      await db
        .insert(courseInvitations)
        .values({ courseId, inviteeId, role, invitedBy: userId })
        .onConflictDoUpdate({ target: [courseInvitations.courseId, courseInvitations.inviteeId], set: { role, invitedBy: userId } });
      if (existing) {
        await db
          .update(notifications)
          .set({ data: { role, status: "open" }, actorId: userId, readAt: null, createdAt: new Date() })
          .where(and(eq(notifications.userId, inviteeId), eq(notifications.courseId, courseId), eq(notifications.kind, "course_invitation"), sql`${notifications.data}->>'status' = 'open'`));
      } else {
        await db.insert(notifications).values({ userId: inviteeId, kind: "course_invitation", courseId, actorId: userId, data: { role, status: "open" } });
        await record(db, { courseId, actorId: userId, action: "member.invited", subjectId: inviteeId, subject: invitee.displayName, details: { role } });
      }
    },

    /** The invitations of a subject nobody has answered yet; for its owners. */
    async pending(userId: string, courseId: string): Promise<PendingInvitation[]> {
      await requireRole(db, userId, courseId, "owner");
      const inviter = db.select({ id: profiles.id, name: profiles.displayName }).from(profiles).as("inviter");
      const rows = await db
        .select({
          userId: courseInvitations.inviteeId,
          displayName: profiles.displayName,
          email: profiles.email,
          role: courseInvitations.role,
          invitedBy: inviter.name,
          createdAt: courseInvitations.createdAt,
        })
        .from(courseInvitations)
        .innerJoin(profiles, eq(profiles.id, courseInvitations.inviteeId))
        .leftJoin(inviter, eq(inviter.id, courseInvitations.invitedBy))
        .where(eq(courseInvitations.courseId, courseId))
        .orderBy(courseInvitations.createdAt);
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    },

    async withdraw(userId: string, courseId: string, inviteeId: string): Promise<void> {
      await requireRole(db, userId, courseId, "owner");
      const removed = await db
        .delete(courseInvitations)
        .where(and(eq(courseInvitations.courseId, courseId), eq(courseInvitations.inviteeId, inviteeId)))
        .returning();
      if (removed.length === 0) throw notFound("unknown_invitation");
      await settle(inviteeId, courseId, "withdrawn");
      await record(db, { courseId, actorId: userId, action: "member.uninvited", subjectId: inviteeId, subject: await nameOf(inviteeId) });
    },

    /** The invited person accepts or declines; the inviter hears of it. */
    async respond(userId: string, courseId: string, accept: boolean): Promise<{ courseId: string; joined: boolean }> {
      const [invitation] = await db
        .delete(courseInvitations)
        .where(and(eq(courseInvitations.courseId, courseId), eq(courseInvitations.inviteeId, userId)))
        .returning();
      if (!invitation) throw notFound("unknown_invitation");
      const course = await db.query.courses.findFirst({ where: and(eq(courses.id, courseId), isNull(courses.deletedAt)) });
      if (!course) throw notFound("unknown_course");
      if (accept) {
        const joined = await db.insert(courseMembers).values({ courseId, userId, role: invitation.role }).onConflictDoNothing().returning();
        if (joined.length > 0) {
          await record(db, { courseId, actorId: userId, action: "member.joined", subjectId: userId, subject: await nameOf(userId), details: { role: invitation.role } });
        }
      }
      await settle(userId, courseId, accept ? "accepted" : "declined");
      if (invitation.invitedBy && invitation.invitedBy !== userId) {
        await db.insert(notifications).values({
          userId: invitation.invitedBy,
          kind: accept ? "invitation_accepted" : "invitation_declined",
          courseId,
          actorId: userId,
          data: { role: invitation.role },
        });
      }
      return { courseId, joined: accept };
    },

    /** The newest notifications of a person, invitations to deleted subjects left out. */
    async notifications(userId: string, limit = 50): Promise<NotificationView[]> {
      const rows = await db
        .select({ row: notifications, courseTitle: courses.title, courseDeleted: courses.deletedAt, actorName: profiles.displayName })
        .from(notifications)
        .leftJoin(courses, eq(courses.id, notifications.courseId))
        .leftJoin(profiles, eq(profiles.id, notifications.actorId))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(Math.min(limit, 200));
      return rows
        .filter((r) => !r.courseDeleted)
        .map((r) => ({
          id: r.row.id,
          kind: r.row.kind as NotificationKind,
          courseId: r.row.courseId,
          courseTitle: r.courseTitle,
          actorId: r.row.actorId,
          actorName: r.actorName,
          data: r.row.data as NotificationView["data"],
          createdAt: r.row.createdAt.toISOString(),
          read: !!r.row.readAt,
        }));
    },

    /** Unread notifications, and invitations still to answer even when seen. */
    async unread(userId: string): Promise<number> {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(notifications)
        .leftJoin(courses, eq(courses.id, notifications.courseId))
        .where(
          and(
            eq(notifications.userId, userId),
            isNull(courses.deletedAt),
            or(isNull(notifications.readAt), sql`${notifications.kind} = 'course_invitation' and ${notifications.data}->>'status' = 'open'`),
          ),
        );
      return row?.n ?? 0;
    },

    async markRead(userId: string, ids?: string[]): Promise<void> {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), ids ? inArray(notifications.id, ids) : undefined));
    },
  };
}
