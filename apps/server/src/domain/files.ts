// The documents of a subject. They are plain files in readable folders
// (`courses/<subject>/<folder>/<name>`), so that they can later be offered
// as a network drive; the database knows who uploaded what. Deleting moves
// a file to the subject's trash for 30 days.
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { and, desc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { FILE_FOLDERS, type FileFolder } from "@study/shared";
import type { Db } from "../db/client.ts";
import { files, profiles } from "../db/schema.ts";
import { requireRole } from "./access.ts";
import { record } from "./activity.ts";
import { AppError, invalid, notFound } from "./errors.ts";

export const TRASH_DAYS = 30;

export interface FileView {
  id: string;
  courseId: string;
  folder: FileFolder;
  name: string;
  size: number;
  mime: string;
  uploadedBy: string | null;
  uploadedById: string | null;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface Upload {
  /** Where the upload was written, on the same disk as the files. */
  tempPath: string;
  name: string;
  size: number;
  mime: string;
  sha256: string;
}

/** A name that is safe as a file name and still readable. */
export function cleanName(name: string): string {
  const cleaned = basename(name.replace(/\\/g, "/"))
    .replace(/[\u0000-\u001f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  if (!cleaned || cleaned === "." || cleaned === "..") return "Datei";
  return cleaned;
}

export function filesOf(db: Db, filesDir: string) {
  const absolute = (relative: string) => join(filesDir, relative);

  /** `name`, or `name (2)` … if a live file already has it in the folder. */
  const freePath = async (courseId: string, folder: FileFolder, name: string): Promise<{ path: string; name: string }> => {
    const extension = extname(name);
    const stem = name.slice(0, name.length - extension.length);
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? name : `${stem} (${n})${extension}`;
      const path = join("courses", courseId, folder, candidate);
      const taken = await db.query.files.findFirst({ where: eq(files.path, path) });
      if (!taken) return { path, name: candidate };
    }
  };

  const view = (row: typeof files.$inferSelect, uploader?: string | null, deleter?: string | null): FileView => ({
    id: row.id,
    courseId: row.courseId,
    folder: row.folder,
    name: row.name,
    size: row.size,
    mime: row.mime,
    uploadedBy: uploader ?? null,
    uploadedById: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    deletedBy: deleter ?? null,
  });

  const find = async (fileId: string) => {
    const row = await db.query.files.findFirst({ where: eq(files.id, fileId) });
    if (!row) throw notFound("unknown_file");
    return row;
  };

  const usedBy = async (userId: string) =>
    db
      .select({ bytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint` })
      .from(files)
      .where(eq(files.uploadedBy, userId))
      .then((rows) => Number(rows[0]?.bytes ?? 0));

  return {
    async list(userId: string, courseId: string): Promise<FileView[]> {
      await requireRole(db, userId, courseId, "viewer");
      const rows = await db
        .select({ file: files, uploader: profiles.displayName })
        .from(files)
        .leftJoin(profiles, eq(profiles.id, files.uploadedBy))
        .where(and(eq(files.courseId, courseId), isNull(files.deletedAt)))
        .orderBy(files.folder, files.name);
      return rows.map((r) => view(r.file, r.uploader));
    },

    async upload(userId: string, courseId: string, folder: string, upload: Upload): Promise<FileView> {
      await requireRole(db, userId, courseId, "editor");
      if (!(FILE_FOLDERS as readonly string[]).includes(folder)) throw invalid("unknown_folder");
      const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, userId) });
      if (profile?.quotaBytes != null && (await usedBy(userId)) + upload.size > profile.quotaBytes) {
        await rm(upload.tempPath, { force: true });
        throw new AppError(413, "quota_exceeded");
      }
      const { path, name } = await freePath(courseId, folder as FileFolder, cleanName(upload.name));
      await mkdir(dirname(absolute(path)), { recursive: true });
      await rename(upload.tempPath, absolute(path));
      const [row] = await db
        .insert(files)
        .values({ courseId, folder: folder as FileFolder, name, path, size: upload.size, mime: upload.mime, sha256: upload.sha256, uploadedBy: userId })
        .returning();
      await record(db, { courseId, actorId: userId, action: "file.uploaded", subjectId: row!.id, subject: name, details: { folder, size: upload.size } });
      return view(row!, profile?.displayName);
    },

    /** The file on disk, for reading; only live files of subjects the user is in. */
    async open(userId: string, fileId: string) {
      const row = await find(fileId);
      await requireRole(db, userId, row.courseId, "viewer");
      if (row.deletedAt) throw notFound("unknown_file");
      return { path: absolute(row.path), name: row.name, mime: row.mime, size: row.size, folder: row.folder, courseId: row.courseId };
    },

    async update(userId: string, fileId: string, change: { name?: string; folder?: string }): Promise<FileView> {
      const row = await find(fileId);
      await requireRole(db, userId, row.courseId, "editor");
      if (row.deletedAt) throw notFound("unknown_file");
      const folder = (change.folder ?? row.folder) as FileFolder;
      if (!(FILE_FOLDERS as readonly string[]).includes(folder)) throw invalid("unknown_folder");
      const wanted = change.name ? cleanName(change.name) : row.name;
      if (folder === row.folder && wanted === row.name) return view(row);
      const { path, name } = await freePath(row.courseId, folder, wanted);
      await mkdir(dirname(absolute(path)), { recursive: true });
      await rename(absolute(row.path), absolute(path));
      const [updated] = await db.update(files).set({ folder, name, path }).where(eq(files.id, fileId)).returning();
      if (name !== row.name) {
        await record(db, { courseId: row.courseId, actorId: userId, action: "file.renamed", subjectId: row.id, subject: name, details: { name: [row.name, name] } });
      }
      if (folder !== row.folder) {
        await record(db, { courseId: row.courseId, actorId: userId, action: "file.moved", subjectId: row.id, subject: name, details: { folder: [row.folder, folder] } });
      }
      return view(updated!);
    },

    async trash(userId: string, fileId: string) {
      const row = await find(fileId);
      await requireRole(db, userId, row.courseId, "editor");
      if (row.deletedAt) return;
      const path = join("courses", row.courseId, ".papierkorb", `${row.id}${extname(row.name)}`);
      await mkdir(dirname(absolute(path)), { recursive: true });
      await rename(absolute(row.path), absolute(path));
      await db.update(files).set({ path, deletedAt: new Date(), deletedBy: userId }).where(eq(files.id, fileId));
      await record(db, { courseId: row.courseId, actorId: userId, action: "file.deleted", subjectId: row.id, subject: row.name });
    },

    async trashList(userId: string, courseId: string): Promise<FileView[]> {
      await requireRole(db, userId, courseId, "viewer");
      const rows = await db
        .select({ file: files, deleter: profiles.displayName })
        .from(files)
        .leftJoin(profiles, eq(profiles.id, files.deletedBy))
        .where(and(eq(files.courseId, courseId), isNotNull(files.deletedAt)))
        .orderBy(desc(files.deletedAt));
      return rows.map((r) => view(r.file, null, r.deleter));
    },

    async restore(userId: string, fileId: string): Promise<FileView> {
      const row = await find(fileId);
      await requireRole(db, userId, row.courseId, "editor");
      if (!row.deletedAt) return view(row);
      const { path, name } = await freePath(row.courseId, row.folder, row.name);
      await mkdir(dirname(absolute(path)), { recursive: true });
      await rename(absolute(row.path), absolute(path));
      const [restored] = await db
        .update(files)
        .set({ path, name, deletedAt: null, deletedBy: null })
        .where(eq(files.id, fileId))
        .returning();
      await record(db, { courseId: row.courseId, actorId: userId, action: "file.restored", subjectId: row.id, subject: name });
      return view(restored!);
    },

    /** Removes for good what has been in the trash longer than allowed. */
    async purge(now = new Date()): Promise<number> {
      const limit = new Date(now.getTime() - TRASH_DAYS * 86_400_000);
      const old = await db.select().from(files).where(and(isNotNull(files.deletedAt), lt(files.deletedAt, limit)));
      for (const row of old) {
        await rm(absolute(row.path), { force: true });
        await db.delete(files).where(eq(files.id, row.id));
      }
      return old.length;
    },

    /** Whether a path still exists on disk (for checks). */
    async exists(relative: string) {
      return stat(absolute(relative)).then(
        () => true,
        () => false,
      );
    },
  };
}
