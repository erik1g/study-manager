// Who is asking. Requests carry either a token from Supabase Auth (the web
// app's session, or an OAuth token Claude got for its user) or a personal
// key made in the settings for MCP clients without OAuth.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Db } from "../db/client.ts";
import { apiTokens, profiles } from "../db/schema.ts";

export interface Identity {
  userId: string;
  email: string;
  /** How the user proved who they are: "password", "passkey", "totp", … */
  methods: string[];
  /** "aal2" once a second factor was checked. */
  aal: string;
  via: "session" | "oauth" | "key";
  /** When the user last proved who they are (not when the token was refreshed). */
  authenticatedAt: Date | null;
}

export interface Authenticator {
  /** The identity behind an `Authorization` header, or null. */
  identify(header: string | undefined): Promise<Identity | null>;
}

const KEY_PREFIX = "sm_";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function newKey(): { key: string; hash: string } {
  const key = KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, hash: hashKey(key) };
}

interface Claims {
  sub?: string;
  email?: string;
  aal?: string;
  amr?: { method: string; timestamp?: number }[];
  client_id?: string;
  session_id?: string;
}

export function tokenAuthenticator(options: {
  db: Db;
  /** Where the public keys of Supabase Auth are, e.g. http://auth:9999/.well-known/jwks.json */
  jwksUrl?: string;
  keys?: JWTVerifyGetKey;
  issuer: string;
}): Authenticator {
  const keys = options.keys ?? createRemoteJWKSet(new URL(options.jwksUrl!));
  return {
    async identify(header) {
      const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
      if (!token) return null;
      if (token.startsWith(KEY_PREFIX)) return byKey(options.db, token);
      try {
        const { payload } = await jwtVerify<Claims>(token, keys, { issuer: options.issuer });
        if (!payload.sub) return null;
        const profile = await options.db.query.profiles.findFirst({ where: eq(profiles.id, payload.sub) });
        if (!profile || profile.disabled) return null;
        // An app the user disconnected loses access at once, not when its token runs out.
        if (payload.client_id && payload.session_id) {
          const live = await options.db.execute(sql`select 1 from auth.sessions where id = ${payload.session_id}::uuid`);
          if (live.length === 0) return null;
        }
        return {
          userId: payload.sub,
          email: payload.email?.toLowerCase() ?? profile.email,
          methods: (payload.amr ?? []).map((entry) => entry.method),
          aal: payload.aal ?? "aal1",
          via: payload.client_id ? "oauth" : "session",
          authenticatedAt: payload.amr?.length ? new Date(Math.max(...payload.amr.map((entry) => entry.timestamp ?? 0)) * 1000) : null,
        };
      } catch {
        return null;
      }
    },
  };
}

async function byKey(db: Db, key: string): Promise<Identity | null> {
  const row = await db
    .select({ userId: apiTokens.userId, id: apiTokens.id, email: profiles.email, disabled: profiles.disabled })
    .from(apiTokens)
    .innerJoin(profiles, eq(profiles.id, apiTokens.userId))
    .where(and(eq(apiTokens.tokenHash, hashKey(key)), gt(apiTokens.expiresAt, new Date())))
    .then((rows) => rows[0]);
  if (!row || row.disabled) return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  return { userId: row.userId, email: row.email, methods: ["key"], aal: "aal1", via: "key", authenticatedAt: null };
}

/** Whether the user signed in again just now, as asked before deleting the account. */
export function recentlyAuthenticated(identity: Identity, minutes = 10, now = new Date()): boolean {
  return identity.via === "session" && !!identity.authenticatedAt && now.getTime() - identity.authenticatedAt.getTime() < minutes * 60_000;
}

/**
 * Admins must have shown a second factor or signed in with a passkey, which
 * is a factor of its own; a password alone is not enough to manage others.
 */
export function strongEnoughForAdmin(identity: Identity): boolean {
  return identity.via === "session" && (identity.aal === "aal2" || identity.methods.some((m) => /passkey|webauthn/.test(m)));
}
