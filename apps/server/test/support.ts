// A fresh world for each test file: the test database emptied, a temporary
// files directory, and accounts handled in memory instead of Supabase Auth.
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import type { Accounts } from "../src/auth/accounts.ts";
import type { Authenticator, Identity } from "../src/auth/identity.ts";
import { createDb, migrateDb } from "../src/db/client.ts";
import { profiles } from "../src/db/schema.ts";
import { wordEmbedder } from "../src/search/embedder.ts";
import { buildServices } from "../src/services.ts";

export const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url));

function testUrl() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is needed for the tests (run them in the server container)");
  return { base, test: base.replace(/\/[^/?]+(\?.*)?$/, "/study_test$1") };
}

export function memoryAccounts(): Accounts & { made: string[] } {
  const known = new Map<string, string>();
  const made: string[] = [];
  return {
    made,
    async inviteLink(email) {
      let id = known.get(email);
      if (!id) {
        id = randomUUID();
        known.set(email, id);
        made.push(email);
      }
      return { userId: id, link: `https://study.test/auth/v1/verify?token=t-${id}&type=invite` };
    },
    async sendInvite(email) {
      if (known.has(email)) return null;
      const id = randomUUID();
      known.set(email, id);
      made.push(email);
      return { userId: id };
    },
    async recoveryLink(email) {
      return `https://study.test/auth/v1/verify?token=r-${known.get(email)}&type=recovery`;
    },
    async list() {
      return [...known].map(([email, id]) => ({ id, email, lastSignInAt: null, banned: false }));
    },
    async setBanned() {},
    async setEmail(userId, email) {
      for (const [old, id] of known) if (id === userId) known.delete(old);
      known.set(email, userId);
    },
    async remove(userId) {
      for (const [email, id] of known) if (id === userId) known.delete(email);
    },
  };
}

/** Identities are taken from `Bearer user:<id>` in tests, or `Bearer key:<id>` for Claude with a personal key. */
const fakeAuthenticator: Authenticator = {
  async identify(header) {
    const [, kind, id] = header?.match(/^Bearer (user|key):(.+)$/) ?? [];
    if (!id) return null;
    return kind === "key"
      ? { userId: id, email: "", methods: ["key"], aal: "aal1", via: "key", authenticatedAt: null }
      : { userId: id, email: "", methods: ["password"], aal: "aal1", via: "session", authenticatedAt: new Date() };
  },
};

export async function world(feeds: Record<string, string> = {}) {
  const { base, test } = testUrl();
  const admin = postgres(base, { max: 1, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = 'study_test'`;
  if (exists.length === 0) await admin.unsafe("create database study_test");
  await admin.end();
  await migrateDb(test);

  const { db, client } = createDb(test);
  await client.unsafe(
    "truncate profiles, programs, modules, enrollments, courses, course_members, course_invites, files, deadlines, tasks, feeds, feed_events, series_assignments, api_tokens, course_notes, private_notes, decks, cards, card_states, reviews, card_proposals, chunks, recordings, activity cascade",
  );
  const filesDir = await mkdtemp(join(tmpdir(), "study-files-"));
  const accounts = memoryAccounts();
  const services = buildServices({
    db,
    accounts,
    authenticator: fakeAuthenticator,
    filesDir,
    siteUrl: "https://study.test",
    embedder: wordEmbedder(),
    fetchText: async (url) => {
      if (!(url in feeds)) throw new Error(`HTTP 404 for ${url}`);
      return feeds[url]!;
    },
  });

  let counter = 0;
  /** A signed-up user, by display name. */
  const user = async (name: string, isAdmin = false): Promise<string> => {
    const { userId } = await services.users.invite(`${name.toLowerCase()}${++counter}@example.org`, name, isAdmin);
    return userId;
  };

  /** A file ready to upload, written to the files disk. */
  const upload = async (name: string, content: string | Buffer, mime = "application/pdf") => {
    const tempPath = join(filesDir, `.upload-${randomUUID()}`);
    await writeFile(tempPath, content);
    return { tempPath, name, size: Buffer.byteLength(content), mime, sha256: "test" };
  };

  const identity = (userId: string): Identity => ({ userId, email: "", methods: ["password"], aal: "aal1", via: "session", authenticatedAt: new Date() });

  return { services, db, client, filesDir, accounts, user, upload, identity, profiles, close: () => client.end() };
}
