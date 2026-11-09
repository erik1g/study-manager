// Signing in through Supabase Auth, which runs under /auth/v1 of the same
// address as the app.
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
/** Whether the server can send mail (invitations, password reset, address change). */
export let mailEnabled = false;

export async function initAuth(): Promise<SupabaseClient> {
  if (client) return client;
  const config = (await fetch("/api/config").then((r) => r.json())) as { anonKey: string; mail?: boolean };
  mailEnabled = !!config.mail;
  client = createClient(window.location.origin, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Invitation and reset links arrive with the session in the address.
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });
  return client;
}

export function auth(): SupabaseClient {
  if (!client) throw new Error("auth not initialised");
  return client;
}

export async function accessToken(): Promise<string | null> {
  const { data } = await auth().auth.getSession();
  return data.session?.access_token ?? null;
}

export type { Session };
