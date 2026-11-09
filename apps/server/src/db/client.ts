import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(url: string) {
  const client = postgres(url, { max: 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}

/** Brings the database to the newest schema; safe to run on every start. */
export async function migrateDb(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    // Supabase keeps extensions in their own schema; a fresh database lacks it.
    await client`create schema if not exists extensions`;
    await client`create extension if not exists vector with schema extensions`;
    const folder = fileURLToPath(new URL("../../drizzle", import.meta.url));
    await migrate(drizzle(client), { migrationsFolder: folder });
  } finally {
    await client.end();
  }
}
