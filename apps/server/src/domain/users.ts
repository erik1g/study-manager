// Accounts: invited by an admin, managed in the admin area.
import { randomBytes } from "node:crypto";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { Accounts } from "../auth/accounts.ts";
import type { Db } from "../db/client.ts";
import { courseMembers, courses, files, profiles } from "../db/schema.ts";
import { changes, record } from "./activity.ts";
import { AppError, invalid, notFound } from "./errors.ts";

const icalToken = () => randomBytes(24).toString("base64url");

export interface UserView {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  disabled: boolean;
  quotaBytes: number | null;
  usedBytes: number;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface ProfileChange {
  displayName?: string;
  studies?: string | null;
  semester?: number | null;
}

/** A subject the user owns alone while others are in it, with whom to hand it to. */
export interface HandOver {
  courseId: string;
  title: string;
  semester: string;
  successor: { userId: string; displayName: string; role: string };
}

const AVATAR_BYTES = 2 * 1024 * 1024;
const validEmail = (address: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address);

export function users(db: Db, accounts: Accounts, filesDir: string) {
  const adminCount = async () =>
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(profiles)
      .where(eq(profiles.isAdmin, true))
      .then((rows) => rows[0]?.n ?? 0);

  const find = async (userId: string) => {
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, userId) });
    if (!profile) throw notFound("unknown_user");
    return profile;
  };

  /** Subjects the user is the only owner of, and whom else they have. */
  const ownedSubjects = async (userId: string) => {
    const rows = await db
      .select({ courseId: courses.id, title: courses.title, semester: courses.semester })
      .from(courseMembers)
      .innerJoin(courses, eq(courses.id, courseMembers.courseId))
      .where(and(eq(courseMembers.userId, userId), eq(courseMembers.role, "owner"), isNull(courses.deletedAt)));
    const result: { courseId: string; title: string; semester: string; others: { userId: string; displayName: string; role: string }[] }[] = [];
    for (const row of rows) {
      const others = await db
        .select({ userId: courseMembers.userId, displayName: profiles.displayName, role: courseMembers.role })
        .from(courseMembers)
        .innerJoin(profiles, eq(profiles.id, courseMembers.userId))
        .where(and(eq(courseMembers.courseId, row.courseId), ne(courseMembers.userId, userId)))
        // The highest role first, then who has been in it longest.
        .orderBy(sql`case ${courseMembers.role} when 'owner' then 0 when 'editor' then 1 else 2 end`, courseMembers.joinedAt);
      if (others.some((o) => o.role === "owner")) continue;
      result.push({ ...row, others });
    }
    return result;
  };

  /** Removes the account and everything private to it; shared things stay. */
  const erase = async (userId: string) => {
    const profile = await find(userId);
    if (profile.avatarPath) await rm(join(filesDir, profile.avatarPath), { force: true });
    await db.delete(profiles).where(eq(profiles.id, userId));
    await accounts.remove(userId);
  };

  return {
    /** Invites someone, or gives a fresh link to someone invited before. */
    /**
     * Invites someone: by mail when mail is set up, else with a link for the
     * admin to pass on. Someone invited before gets a fresh link.
     */
    async invite(email: string, displayName: string, makeAdmin = false, byMail = false): Promise<{ userId: string; link: string | null; mailed: boolean }> {
      const address = email.trim().toLowerCase();
      if (!validEmail(address)) throw invalid("invalid_email");
      const sent = byMail ? await accounts.sendInvite(address) : null;
      const { userId, link } = sent ? { userId: sent.userId, link: null } : await accounts.inviteLink(address);
      await db
        .insert(profiles)
        .values({ id: userId, email: address, displayName: displayName.trim() || address.split("@")[0]!, isAdmin: makeAdmin, icalToken: icalToken() })
        .onConflictDoUpdate({ target: profiles.id, set: makeAdmin ? { isAdmin: true } : { email: address } });
      return { userId, link, mailed: !!sent };
    },

    async resetLink(userId: string): Promise<string> {
      const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, userId) });
      if (!profile) throw notFound("unknown_user");
      return accounts.recoveryLink(profile.email);
    },

    async list(): Promise<UserView[]> {
      const [rows, known, usage] = await Promise.all([
        db.select().from(profiles).orderBy(profiles.displayName),
        accounts.list(),
        db
          .select({ userId: files.uploadedBy, bytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint` })
          .from(files)
          .groupBy(files.uploadedBy),
      ]);
      return rows.map((row) => {
        const account = known.find((a) => a.id === row.id);
        return {
          id: row.id,
          email: row.email,
          displayName: row.displayName,
          isAdmin: row.isAdmin,
          disabled: row.disabled,
          quotaBytes: row.quotaBytes,
          usedBytes: Number(usage.find((u) => u.userId === row.id)?.bytes ?? 0),
          lastSignInAt: account?.lastSignInAt ?? null,
          createdAt: row.createdAt.toISOString(),
        };
      });
    },

    async update(
      actingAdmin: string,
      userId: string,
      change: { isAdmin?: boolean; disabled?: boolean; quotaBytes?: number | null; displayName?: string; email?: string },
    ): Promise<void> {
      if (userId === actingAdmin && (change.isAdmin === false || change.disabled === true)) {
        // Otherwise the last admin could lock everyone out.
        throw invalid("cannot_demote_self");
      }
      const before = await find(userId);
      const email = change.email?.trim().toLowerCase();
      if (email !== undefined && email !== before.email) {
        if (!validEmail(email)) throw invalid("invalid_email");
        const taken = await db.query.profiles.findFirst({ where: eq(profiles.email, email) });
        if (taken) throw invalid("email_taken");
        await accounts.setEmail(userId, email);
        await db.update(profiles).set({ email }).where(eq(profiles.id, userId));
      }
      if (change.disabled !== undefined) await accounts.setBanned(userId, change.disabled);
      const updated = await db
        .update(profiles)
        .set({
          ...(change.isAdmin !== undefined && { isAdmin: change.isAdmin }),
          ...(change.disabled !== undefined && { disabled: change.disabled }),
          ...(change.quotaBytes !== undefined && { quotaBytes: change.quotaBytes }),
          ...(change.displayName && { displayName: change.displayName.trim() }),
        })
        .where(eq(profiles.id, userId))
        .returning({ id: profiles.id });
      if (updated.length === 0) throw notFound("unknown_user");
      const diff = changes(before, { ...change, email, displayName: change.displayName?.trim() || undefined });
      if (Object.keys(diff).length > 0) {
        await record(db, { actorId: actingAdmin, action: "user.changed", subjectId: userId, subject: change.displayName?.trim() || before.displayName, details: diff });
      }
    },

    /**
     * Deletes an account. Shared subjects stay with their other members; a
     * subject the user owned alone gets its longest member as owner.
     */
    async remove(actingAdmin: string, userId: string): Promise<void> {
      if (userId === actingAdmin) throw invalid("cannot_delete_self");
      const owned = await db
        .select({ courseId: courseMembers.courseId })
        .from(courseMembers)
        .where(and(eq(courseMembers.userId, userId), eq(courseMembers.role, "owner")));
      for (const { courseId } of owned) {
        const otherOwner = await db.query.courseMembers.findFirst({
          where: and(eq(courseMembers.courseId, courseId), eq(courseMembers.role, "owner"), ne(courseMembers.userId, userId)),
        });
        if (otherOwner) continue;
        const successor = await db.query.courseMembers.findFirst({
          where: and(eq(courseMembers.courseId, courseId), ne(courseMembers.userId, userId)),
          orderBy: courseMembers.joinedAt,
        });
        if (successor) {
          await db
            .update(courseMembers)
            .set({ role: "owner" })
            .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, successor.userId)));
        }
      }
      const profile = await find(userId);
      await erase(userId);
      await record(db, { actorId: actingAdmin, action: "user.deleted", subjectId: userId, subject: profile.displayName });
    },

    me: find,

    /** Takes over an address the user changed and confirmed by mail. */
    async syncEmail(userId: string, email: string) {
      const address = email.trim().toLowerCase();
      if (!validEmail(address)) return;
      await db.update(profiles).set({ email: address }).where(eq(profiles.id, userId));
    },

    async updateProfile(userId: string, change: ProfileChange) {
      if (change.displayName !== undefined && !change.displayName.trim()) throw invalid("missing_name");
      if (change.semester != null && (!Number.isInteger(change.semester) || change.semester < 1 || change.semester > 30)) throw invalid("invalid_study_semester");
      await db
        .update(profiles)
        .set({
          ...(change.displayName !== undefined && { displayName: change.displayName.trim() }),
          ...(change.studies !== undefined && { studies: change.studies?.trim() || null }),
          ...(change.semester !== undefined && { semester: change.semester }),
        })
        .where(eq(profiles.id, userId));
    },

    async rename(userId: string, displayName: string) {
      await this.updateProfile(userId, { displayName });
    },

    /** Takes a square picture the browser already cut and shrank. */
    async setAvatar(userId: string, upload: { tempPath: string; size: number; mime: string }) {
      try {
        if (!/^image\/(webp|png|jpeg)$/.test(upload.mime)) throw invalid("avatar_type");
        if (upload.size > AVATAR_BYTES) throw new AppError(413, "avatar_too_large");
        const relative = join("avatars", `${userId}.${upload.mime.split("/")[1]}`);
        const old = (await find(userId)).avatarPath;
        if (old && old !== relative) await rm(join(filesDir, old), { force: true });
        await mkdir(dirname(join(filesDir, relative)), { recursive: true });
        await rename(upload.tempPath, join(filesDir, relative));
        await db
          .update(profiles)
          .set({ avatarPath: relative, avatarVersion: sql`${profiles.avatarVersion} + 1` })
          .where(eq(profiles.id, userId));
      } finally {
        await rm(upload.tempPath, { force: true });
      }
    },

    async removeAvatar(userId: string) {
      const profile = await find(userId);
      if (profile.avatarPath) await rm(join(filesDir, profile.avatarPath), { force: true });
      await db.update(profiles).set({ avatarPath: null, avatarVersion: sql`${profiles.avatarVersion} + 1` }).where(eq(profiles.id, userId));
    },

    /** The picture on disk, or null. */
    async avatar(userId: string) {
      const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, userId) });
      if (!profile?.avatarPath) return null;
      return { path: join(filesDir, profile.avatarPath), version: profile.avatarVersion, mime: `image/${profile.avatarPath.split(".").pop()}` };
    },

    /**
     * The people the user meets in the app: themselves and everyone sharing a
     * subject with them. Admins see everyone.
     */
    async people(userId: string) {
      const me = await find(userId);
      const shared = db
        .select({ id: courseMembers.userId })
        .from(courseMembers)
        .where(inArray(courseMembers.courseId, db.select({ id: courseMembers.courseId }).from(courseMembers).where(eq(courseMembers.userId, userId))));
      return db
        .select({ id: profiles.id, displayName: profiles.displayName, avatarVersion: profiles.avatarVersion, hasAvatar: sql<boolean>`${profiles.avatarPath} is not null` })
        .from(profiles)
        .where(me.isAdmin ? undefined : or(eq(profiles.id, userId), inArray(profiles.id, shared)))
        .orderBy(profiles.displayName);
    },

    /** What stands in the way of deleting the account. */
    async deletionCheck(userId: string): Promise<{ lastAdmin: boolean; handOver: HandOver[]; alone: { courseId: string; title: string }[] }> {
      const profile = await find(userId);
      const owned = await ownedSubjects(userId);
      return {
        lastAdmin: profile.isAdmin && (await adminCount()) <= 1,
        handOver: owned
          .filter((o) => o.others.length > 0)
          .map((o) => ({ courseId: o.courseId, title: o.title, semester: o.semester, successor: o.others[0]! })),
        alone: owned.filter((o) => o.others.length === 0).map((o) => ({ courseId: o.courseId, title: o.title })),
      };
    },

    /**
     * Deletes the user's own account. Subjects only they are in go with it;
     * subjects shared with others must have been handed over first.
     */
    async deleteSelf(userId: string, confirmEmail: string) {
      const profile = await find(userId);
      if (confirmEmail.trim().toLowerCase() !== profile.email) throw invalid("email_mismatch");
      const check = await this.deletionCheck(userId);
      if (check.lastAdmin) throw invalid("last_admin");
      if (check.handOver.length > 0) throw invalid("hand_over_first");
      for (const course of check.alone) {
        await db.update(courses).set({ deletedAt: new Date() }).where(eq(courses.id, course.courseId));
      }
      await erase(userId);
      await record(db, { actorId: null, action: "user.deleted", subjectId: userId, subject: "" });
    },

    /** A new calendar link; the old one stops working. */
    async renewIcalToken(userId: string): Promise<string> {
      const token = icalToken();
      await db.update(profiles).set({ icalToken: token }).where(eq(profiles.id, userId));
      return token;
    },

    adminCount,
  };
}
