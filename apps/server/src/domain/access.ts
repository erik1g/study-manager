import { and, eq, isNull } from "drizzle-orm";
import { atLeast, type CourseRole } from "@study/shared";
import type { Db } from "../db/client.ts";
import { courseMembers, courses, profiles } from "../db/schema.ts";
import { forbidden, notFound } from "./errors.ts";

/** The member's role in a subject that still exists, or null. */
export async function roleIn(db: Db, userId: string, courseId: string): Promise<CourseRole | null> {
  const row = await db
    .select({ role: courseMembers.role })
    .from(courseMembers)
    .innerJoin(courses, eq(courses.id, courseMembers.courseId))
    .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, userId), isNull(courses.deletedAt)))
    .then((rows) => rows[0]);
  return row?.role ?? null;
}

/**
 * Throws unless the user has at least `needed` in the subject. A subject the
 * user cannot see at all looks as if it did not exist.
 */
export async function requireRole(db: Db, userId: string, courseId: string, needed: CourseRole): Promise<CourseRole> {
  const role = await roleIn(db, userId, courseId);
  if (!role) throw notFound("unknown_course");
  if (!atLeast(role, needed)) throw forbidden("role_too_low");
  return role;
}

export async function isAdmin(db: Db, userId: string): Promise<boolean> {
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, userId) });
  return !!profile?.isAdmin;
}
