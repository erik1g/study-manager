// What the admin sees about the server: space, data and backups.
import { statfs } from "node:fs/promises";
import { isNotNull, sql } from "drizzle-orm";
import { courses, feeds, files, profiles } from "../db/schema.ts";
import type { Services } from "../services.ts";
import { listBackups } from "./backup.ts";

export async function serverStatus(services: Services) {
  const { db } = services;
  const disk = await statfs(services.filesDir).catch(() => null);
  const count = async (table: typeof profiles | typeof courses | typeof files) =>
    db.select({ n: sql<number>`count(*)::int` }).from(table).then((rows) => rows[0]?.n ?? 0);
  const [databaseBytes] = await db.execute<{ size: string }>(sql`select pg_database_size(current_database())::text as size`);
  const fileBytes = await db
    .select({ bytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint` })
    .from(files)
    .then((rows) => Number(rows[0]?.bytes ?? 0));
  const feedErrors = await db.select({ name: feeds.name, error: feeds.error }).from(feeds).where(isNotNull(feeds.error));
  return {
    disk: disk ? { total: disk.blocks * disk.bsize, free: disk.bavail * disk.bsize } : null,
    databaseBytes: Number(databaseBytes?.size ?? 0),
    fileBytes,
    users: await count(profiles),
    courses: await count(courses),
    files: await count(files),
    backups: await listBackups(),
    feedErrors,
  };
}
