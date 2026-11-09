// Personal keys for MCP clients that cannot sign in through OAuth, such as
// Claude Code. A key is shown once; only its hash is kept.
import { and, desc, eq, sql } from "drizzle-orm";
import { newKey } from "../auth/identity.ts";
import type { Db } from "../db/client.ts";
import { apiTokens } from "../db/schema.ts";
import { invalid, notFound } from "./errors.ts";

export function keysOf(db: Db) {
  return {
    async list(userId: string) {
      const rows = await db
        .select({ id: apiTokens.id, name: apiTokens.name, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt, expiresAt: apiTokens.expiresAt })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .orderBy(desc(apiTokens.createdAt));
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null, expiresAt: r.expiresAt.toISOString() }));
    },

    async create(userId: string, name: string): Promise<{ id: string; key: string }> {
      if (!name.trim()) throw invalid("missing_name");
      const { key, hash } = newKey();
      const [row] = await db.insert(apiTokens).values({ userId, name: name.trim(), tokenHash: hash }).returning({ id: apiTokens.id });
      return { id: row!.id, key };
    },

    /** Another 90 days from now. */
    async extend(userId: string, keyId: string) {
      const updated = await db
        .update(apiTokens)
        .set({ expiresAt: sql`now() + interval '90 days'` })
        .where(and(eq(apiTokens.id, keyId), eq(apiTokens.userId, userId)))
        .returning({ expiresAt: apiTokens.expiresAt });
      if (updated.length === 0) throw notFound("unknown_key");
      return { expiresAt: updated[0]!.expiresAt.toISOString() };
    },

    async revoke(userId: string, keyId: string) {
      const deleted = await db
        .delete(apiTokens)
        .where(and(eq(apiTokens.id, keyId), eq(apiTokens.userId, userId)))
        .returning({ id: apiTokens.id });
      if (deleted.length === 0) throw notFound("unknown_key");
    },
  };
}
