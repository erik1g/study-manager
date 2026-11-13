// The admin side of Supabase Auth: accounts are made by invitation, and
// there is no mail server, so links are handed to the admin to pass on.
import type { Locale } from "@study/shared";

export interface AuthAccount {
  id: string;
  email: string;
  lastSignInAt: string | null;
  banned: boolean;
}

export interface Accounts {
  /**
   * Creates the account if needed and returns a link to set it up. The
   * language goes into the account's metadata, where the mail templates read it.
   */
  inviteLink(email: string, locale: Locale): Promise<{ userId: string; link: string }>;
  /** Creates the account and mails the invitation; null if the address was invited before. */
  sendInvite(email: string, locale: Locale): Promise<{ userId: string } | null>;
  /** The language the mail templates use for this account (`user_metadata.locale`). */
  setLocale(userId: string, locale: Locale): Promise<void>;
  /** A link with which a forgotten password can be replaced. */
  recoveryLink(email: string): Promise<string>;
  list(): Promise<AuthAccount[]>;
  setBanned(userId: string, banned: boolean): Promise<void>;
  /** Changes the address at once; there is no mail to confirm it with yet. */
  setEmail(userId: string, email: string): Promise<void>;
  remove(userId: string): Promise<void>;
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function gotrueAccounts(options: { url: string; serviceKey: string; siteUrl: string }): Accounts {
  const call = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(`${options.url}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${options.serviceKey}`,
        apikey: options.serviceKey,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new AuthError(response.status, data.msg ?? data.message ?? data.error_description ?? text);
    return data;
  };

  const link = async (type: "invite" | "recovery" | "magiclink", email: string, locale?: Locale) => {
    const data = await call("POST", "/admin/generate_link", {
      type,
      email,
      ...(locale && { data: { locale } }),
      redirect_to: `${options.siteUrl}/willkommen`,
    });
    return { userId: data.id as string, link: (data.action_link ?? data.properties?.action_link) as string };
  };

  return {
    async sendInvite(email, locale) {
      try {
        const data = await call("POST", `/invite?redirect_to=${encodeURIComponent(`${options.siteUrl}/willkommen`)}`, { email, data: { locale } });
        return { userId: data.id as string };
      } catch (error) {
        if (error instanceof AuthError && error.status === 422) return null;
        throw error;
      }
    },
    async inviteLink(email, locale) {
      try {
        return await link("invite", email, locale);
      } catch (error) {
        // Invited before but never set up: a sign-in link does the same.
        if (error instanceof AuthError && error.status === 422) return link("magiclink", email);
        throw error;
      }
    },
    async setLocale(userId, locale) {
      // GoTrue merges user_metadata, so other keys stay.
      await call("PUT", `/admin/users/${userId}`, { user_metadata: { locale } });
    },
    async recoveryLink(email) {
      return (await link("recovery", email)).link;
    },
    async list() {
      const data = await call("GET", "/admin/users?per_page=1000");
      return (data.users ?? []).map((user: Record<string, unknown>) => ({
        id: user.id as string,
        email: user.email as string,
        lastSignInAt: (user.last_sign_in_at as string | undefined) ?? null,
        banned: !!user.banned_until && new Date(user.banned_until as string) > new Date(),
      }));
    },
    async setBanned(userId, banned) {
      await call("PUT", `/admin/users/${userId}`, { ban_duration: banned ? "876000h" : "none" });
    },
    async setEmail(userId, email) {
      await call("PUT", `/admin/users/${userId}`, { email, email_confirm: true });
    },
    async remove(userId) {
      await call("DELETE", `/admin/users/${userId}`);
    },
  };
}
