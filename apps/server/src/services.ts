// Everything the API, the MCP server and the background jobs work with,
// built once from the configuration.
import type { Accounts } from "./auth/accounts.ts";
import type { Authenticator } from "./auth/identity.ts";
import type { Db } from "./db/client.ts";
import { activityOf } from "./domain/activity.ts";
import { calendarOf } from "./domain/calendar.ts";
import { connectedAppsOf } from "./domain/connectedApps.ts";
import { coursesOf } from "./domain/courses.ts";
import { filesOf } from "./domain/files.ts";
import { flashcardsOf } from "./domain/flashcards.ts";
import { inboxOf } from "./domain/inbox.ts";
import { invitationsOf } from "./domain/invitations.ts";
import { notesOf } from "./domain/notes.ts";
import { recordingsOf } from "./domain/recordings.ts";
import { keysOf } from "./domain/keys.ts";
import { planningOf } from "./domain/planning.ts";
import { programsOf } from "./domain/programs.ts";
import { users } from "./domain/users.ts";
import { localEmbedder, type Embedder } from "./search/embedder.ts";
import { searchOf } from "./search/search.ts";

export interface ServiceOptions {
  db: Db;
  accounts: Accounts;
  authenticator: Authenticator;
  filesDir: string;
  siteUrl: string;
  /** The public key the browser's Supabase client sends along. */
  anonKey?: string;
  fetchText?: (url: string) => Promise<string>;
  embedder?: Embedder;
  /** Whether the sign-in service can send mail. */
  mailEnabled?: boolean;
}

export function buildServices(options: ServiceOptions) {
  const { db } = options;
  const courses = coursesOf(db);
  const notes = notesOf(db);
  const recordings = recordingsOf(db, notes);
  return {
    db,
    authenticator: options.authenticator,
    siteUrl: options.siteUrl,
    mailEnabled: options.mailEnabled ?? false,
    anonKey: options.anonKey ?? "",
    filesDir: options.filesDir,
    users: users(db, options.accounts, options.filesDir),
    activity: activityOf(db),
    courses,
    invitations: invitationsOf(db),
    notes,
    recordings,
    inbox: inboxOf(courses, notes, recordings),
    flashcards: flashcardsOf(db),
    search: searchOf(db, options.embedder ?? localEmbedder(), options.filesDir),
    /** Set by the job queue: a document to (re)read into the search index. */
    indexLater: (fileId: string) => {
      void fileId;
    },
    programs: programsOf(db, options.filesDir),
    files: filesOf(db, options.filesDir),
    planning: planningOf(db),
    calendar: calendarOf(db, options.fetchText),
    keys: keysOf(db),
    connectedApps: connectedAppsOf(db),
  };
}

export type Services = ReturnType<typeof buildServices>;
