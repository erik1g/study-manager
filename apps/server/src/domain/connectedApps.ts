// The apps a user let in through OAuth (Claude.ai and other MCP clients), as
// Supabase Auth keeps them, and taking that access back.
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { notFound } from "./errors.ts";

export interface ConnectedApp {
  clientId: string;
  name: string;
  /** Where the app sends people back after signing in, as a hint who it is. */
  redirectHosts: string[];
  grantedAt: string;
  lastUsedAt: string | null;
}

export function connectedAppsOf(db: Db) {
  return {
    async list(userId: string): Promise<ConnectedApp[]> {
      const rows = await db.execute<{ client_id: string; client_name: string | null; redirect_uris: string | null; granted_at: Date; last_used: Date | null }>(sql`
        select c.id as client_id, c.client_name, c.redirect_uris, co.granted_at,
          (select max(coalesce(s.refreshed_at, s.created_at)) from auth.sessions s where s.user_id = co.user_id and s.oauth_client_id = c.id) as last_used
        from auth.oauth_consents co join auth.oauth_clients c on c.id = co.client_id
        where co.user_id = ${userId}::uuid and co.revoked_at is null and c.deleted_at is null
        order by co.granted_at desc`);
      return rows.map((r) => ({
        clientId: r.client_id,
        name: r.client_name || "Unbenannte App",
        redirectHosts: [...new Set((r.redirect_uris ?? "").split(/[\s,]+/).filter(Boolean).flatMap((u) => {
          try {
            return [new URL(u).host];
          } catch {
            return [];
          }
        }))],
        grantedAt: new Date(r.granted_at).toISOString(),
        lastUsedAt: r.last_used ? new Date(r.last_used).toISOString() : null,
      }));
    },

    /** Ends the app's access at once: its consent and every session it holds. */
    async disconnect(userId: string, clientId: string) {
      const revoked = await db.execute(sql`
        update auth.oauth_consents set revoked_at = now()
        where user_id = ${userId}::uuid and client_id = ${clientId}::uuid and revoked_at is null returning id`);
      await db.execute(sql`delete from auth.sessions where user_id = ${userId}::uuid and oauth_client_id = ${clientId}::uuid`);
      if (revoked.length === 0) throw notFound("unknown_app");
    },
  };
}
