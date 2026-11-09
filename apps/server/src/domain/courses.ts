// Subjects and who is in them.
import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { COLORS, courseDraftSchema, type CourseDraft, type CourseRole } from "@study/shared";
import type { Db } from "../db/client.ts";
import { courseInvites, courseMembers, courses, modules, profiles } from "../db/schema.ts";
import { requireRole } from "./access.ts";
import { changes, record } from "./activity.ts";
import { invalid, notFound } from "./errors.ts";

export interface CourseView {
  id: string;
  title: string;
  number: string | null;
  credits: number | null;
  semester: string;
  moduleId: string | null;
  role: CourseRole;
  color: string | null;
  memberCount: number;
}

export interface MemberView {
  userId: string;
  displayName: string;
  email: string;
  role: CourseRole;
  joinedAt: string;
}

/** Days an invitation link stays valid. */
const INVITE_DAYS = 14;

export function coursesOf(db: Db) {
  const view = async (userId: string, courseIds?: string[]): Promise<CourseView[]> => {
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        number: courses.number,
        credits: courses.credits,
        semester: courses.semester,
        moduleId: courses.moduleId,
        role: courseMembers.role,
        color: courseMembers.color,
        memberCount: sql<number>`(select count(*)::int from ${courseMembers} m where m.course_id = ${courses.id})`,
      })
      .from(courseMembers)
      .innerJoin(courses, eq(courses.id, courseMembers.courseId))
      .where(
        and(
          eq(courseMembers.userId, userId),
          isNull(courses.deletedAt),
          courseIds ? inArray(courses.id, courseIds) : undefined,
        ),
      )
      .orderBy(sql`${courses.semester} desc`, courses.title);
    return rows;
  };

  const ownerCount = async (courseId: string) =>
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(courseMembers)
      .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.role, "owner")))
      .then((rows) => rows[0]?.n ?? 0);

  const nameOf = async (userId: string) =>
    (await db.query.profiles.findFirst({ where: eq(profiles.id, userId) }))?.displayName ?? "";

  return {
    list: (userId: string) => view(userId),

    async get(userId: string, courseId: string): Promise<CourseView> {
      await requireRole(db, userId, courseId, "viewer");
      const [course] = await view(userId, [courseId]);
      return course!;
    },

    async create(userId: string, draft: CourseDraft): Promise<CourseView> {
      const data = courseDraftSchema.parse(draft);
      let { title, number, credits } = data;
      if (data.moduleId) {
        const module = await db.query.modules.findFirst({ where: eq(modules.id, data.moduleId) });
        if (!module) throw notFound("unknown_module");
        title = module.title;
        number = module.number;
        credits = module.credits;
      }
      const [course] = await db
        .insert(courses)
        .values({ title, number: number ?? null, credits: credits ?? null, semester: data.semester, moduleId: data.moduleId ?? null, createdBy: userId })
        .returning();
      await db.insert(courseMembers).values({ courseId: course!.id, userId, role: "owner" });
      await record(db, { courseId: course!.id, actorId: userId, action: "course.created", subjectId: course!.id, subject: title, details: { semester: data.semester } });
      return this.get(userId, course!.id);
    },

    async update(userId: string, courseId: string, change: { title?: string; semester?: string; credits?: number | null }) {
      await requireRole(db, userId, courseId, "owner");
      if (change.semester && !/^(WiSe\d{2}-\d{2}|SoSe\d{2})$/.test(change.semester)) throw invalid("invalid_semester");
      const before = (await db.query.courses.findFirst({ where: eq(courses.id, courseId) }))!;
      const diff = changes(before, { title: change.title?.trim() || undefined, semester: change.semester, credits: change.credits });
      if (Object.keys(diff).length > 0) {
        await record(db, { courseId, actorId: userId, action: "course.changed", subjectId: courseId, subject: change.title?.trim() || before.title, details: diff });
      }
      await db
        .update(courses)
        .set({
          ...(change.title?.trim() && { title: change.title.trim() }),
          ...(change.semester && { semester: change.semester }),
          ...(change.credits !== undefined && { credits: change.credits }),
        })
        .where(eq(courses.id, courseId));
    },

    /** Each member picks their own colour for a subject. */
    async setColor(userId: string, courseId: string, color: string | null) {
      await requireRole(db, userId, courseId, "viewer");
      if (color && !(COLORS as readonly string[]).includes(color)) throw invalid("invalid_color");
      await db
        .update(courseMembers)
        .set({ color })
        .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, userId)));
    },

    /** Deletes the subject for everyone; only an owner may. */
    async remove(userId: string, courseId: string) {
      await requireRole(db, userId, courseId, "owner");
      const [course] = await db.update(courses).set({ deletedAt: new Date() }).where(eq(courses.id, courseId)).returning();
      await record(db, { courseId, actorId: userId, action: "course.deleted", subjectId: courseId, subject: course!.title });
    },

    async members(userId: string, courseId: string): Promise<MemberView[]> {
      await requireRole(db, userId, courseId, "viewer");
      const rows = await db
        .select({
          userId: courseMembers.userId,
          displayName: profiles.displayName,
          email: profiles.email,
          role: courseMembers.role,
          joinedAt: courseMembers.joinedAt,
        })
        .from(courseMembers)
        .innerJoin(profiles, eq(profiles.id, courseMembers.userId))
        .where(eq(courseMembers.courseId, courseId))
        .orderBy(courseMembers.joinedAt);
      return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
    },

    async setRole(userId: string, courseId: string, memberId: string, role: CourseRole) {
      await requireRole(db, userId, courseId, "owner");
      const member = await db.query.courseMembers.findFirst({
        where: and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, memberId)),
      });
      if (!member) throw notFound("unknown_member");
      if (member.role === "owner" && role !== "owner" && (await ownerCount(courseId)) <= 1) {
        throw invalid("last_owner");
      }
      await db
        .update(courseMembers)
        .set({ role })
        .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, memberId)));
      if (member.role !== role) {
        await record(db, { courseId, actorId: userId, action: "member.role", subjectId: memberId, subject: await nameOf(memberId), details: { role: [member.role, role] } });
      }
    },

    /** Owners remove members; anyone may leave, except the last owner. */
    async removeMember(userId: string, courseId: string, memberId: string) {
      if (memberId === userId) await requireRole(db, userId, courseId, "viewer");
      else await requireRole(db, userId, courseId, "owner");
      const member = await db.query.courseMembers.findFirst({
        where: and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, memberId)),
      });
      if (!member) throw notFound("unknown_member");
      if (member.role === "owner" && (await ownerCount(courseId)) <= 1) throw invalid("last_owner");
      await db.delete(courseMembers).where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, memberId)));
      await record(db, {
        courseId,
        actorId: userId,
        action: memberId === userId ? "member.left" : "member.removed",
        subjectId: memberId,
        subject: await nameOf(memberId),
      });
    },

    async createInvite(userId: string, courseId: string, role: CourseRole = "editor"): Promise<{ token: string; expiresAt: string }> {
      await requireRole(db, userId, courseId, "owner");
      const token = randomBytes(18).toString("base64url");
      const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
      await db.insert(courseInvites).values({ token, courseId, role, createdBy: userId, expiresAt });
      return { token, expiresAt: expiresAt.toISOString() };
    },

    /** What an invitation leads to, shown before accepting it. */
    async invitation(token: string) {
      const row = await db
        .select({ courseId: courses.id, title: courses.title, semester: courses.semester, role: courseInvites.role })
        .from(courseInvites)
        .innerJoin(courses, eq(courses.id, courseInvites.courseId))
        .where(and(eq(courseInvites.token, token), gt(courseInvites.expiresAt, new Date()), isNull(courses.deletedAt)))
        .then((rows) => rows[0]);
      if (!row) throw notFound("invite_invalid");
      return row;
    },

    async acceptInvite(userId: string, token: string): Promise<CourseView> {
      const invite = await this.invitation(token);
      const joined = await db.insert(courseMembers).values({ courseId: invite.courseId, userId, role: invite.role }).onConflictDoNothing().returning();
      if (joined.length > 0) {
        await record(db, { courseId: invite.courseId, actorId: userId, action: "member.joined", subjectId: userId, subject: await nameOf(userId), details: { role: invite.role } });
      }
      return this.get(userId, invite.courseId);
    },
  };
}
