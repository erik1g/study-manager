// The data of the Study Manager. Accounts themselves live in Supabase Auth
// (`auth.users`); a profile here carries what the app knows about them.
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const at = (name: string) => timestamp(name, { withTimezone: true });

export const courseRole = pgEnum("course_role", ["owner", "editor", "viewer"]);
export const fileFolder = pgEnum("file_folder", ["skripte", "uebungen", "altklausuren", "sonstiges"]);

export const profiles = pgTable("profiles", {
  /** The same id as the account in Supabase Auth. */
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  disabled: boolean("disabled").notNull().default(false),
  /** Upload limit in bytes; no limit when empty. */
  quotaBytes: bigint("quota_bytes", { mode: "number" }),
  /** Secret part of the student's calendar subscription link. */
  icalToken: text("ical_token").notNull().unique(),
  /** The profile picture below the files directory, a square WebP. */
  avatarPath: text("avatar_path"),
  /** Changes with every new picture, so that browsers fetch it again. */
  avatarVersion: integer("avatar_version").notNull().default(0),
  /** Free text, such as "KIT · Maschinenbau B.Sc.". */
  studies: text("studies"),
  semester: smallint("semester"),
  createdAt: createdAt(),
});

// --- Degree programmes ---------------------------------------------------

export const programs = pgTable("programs", {
  id: id(),
  university: text("university").notNull(),
  name: text("name").notNull(),
  degree: text("degree").notNull().default(""),
  regulation: text("regulation").notNull().default(""),
  /** Who imported the handbook and may change the catalogue. */
  managerId: uuid("manager_id").references(() => profiles.id, { onDelete: "set null" }),
  /** The handbook PDF, relative to the files directory. */
  handbookPath: text("handbook_path"),
  createdAt: createdAt(),
});

export const modules = pgTable(
  "modules",
  {
    id: id(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    title: text("title").notNull(),
    credits: real("credits"),
    /** Everything else the handbook says, in the shape of `moduleSchema`. */
    details: jsonb("details").notNull().default({}),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.programId, t.number)],
);

/** Which programmes a student studies. */
export const enrollments = pgTable(
  "enrollments",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.programId] })],
);

// --- Subjects ------------------------------------------------------------

/** A subject in one semester, shared by its members. */
export const courses = pgTable("courses", {
  id: id(),
  title: text("title").notNull(),
  number: text("number"),
  credits: real("credits"),
  semester: text("semester").notNull(),
  moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  deletedAt: at("deleted_at"),
});

export const courseMembers = pgTable(
  "course_members",
  {
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    role: courseRole("role").notNull(),
    /** Each member colours the subject as they like. */
    color: text("color"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.userId] }), index().on(t.userId)],
);

export const courseInvites = pgTable("course_invites", {
  token: text("token").primaryKey(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  role: courseRole("role").notNull(),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  expiresAt: at("expires_at").notNull(),
});

/** An invitation of a registered person to a subject, waiting for their answer. */
export const courseInvitations = pgTable(
  "course_invitations",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: courseRole("role").notNull(),
    invitedBy: uuid("invited_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.inviteeId] }), index().on(t.inviteeId)],
);

/**
 * What a person should know about: an invitation for them, or the answer to
 * one they sent. `data` carries what the kind needs, such as the role.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    data: jsonb("data").notNull().default({}),
    createdAt: createdAt(),
    readAt: at("read_at"),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

/** A document of a subject, stored as a plain file on disk. */
export const files = pgTable(
  "files",
  {
    id: id(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    folder: fileFolder("folder").notNull(),
    name: text("name").notNull(),
    /** Path below the files directory. */
    path: text("path").notNull().unique(),
    size: bigint("size", { mode: "number" }).notNull(),
    mime: text("mime").notNull(),
    sha256: text("sha256").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    deletedAt: at("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
    /** When the search index last read it, and why it could not. */
    indexedAt: at("indexed_at"),
    indexError: text("index_error"),
  },
  (t) => [index().on(t.courseId)],
);

// --- Planning ------------------------------------------------------------

/**
 * An exam or a cut-off. With a subject it is shared with its members;
 * without one it belongs to its creator alone.
 */
export const deadlines = pgTable(
  "deadlines",
  {
    id: id(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    allDay: boolean("all_day").notNull(),
    date: date("date"),
    startsAt: at("starts_at"),
    endsAt: at("ends_at"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: at("updated_at").notNull().defaultNow(),
    deletedAt: at("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [index().on(t.courseId), index().on(t.ownerId)],
);

/** Who has ticked off which deadline: done is personal, as each member hands in on their own. */
export const deadlineDone = pgTable(
  "deadline_done",
  {
    deadlineId: uuid("deadline_id")
      .notNull()
      .references(() => deadlines.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    doneAt: at("done_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.deadlineId, t.userId] }), index().on(t.userId)],
);

/** A to-do; always private to one student. */
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    deadlineId: uuid("deadline_id").references(() => deadlines.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    plannedDate: date("planned_date"),
    /** Local time `HH:MM`. */
    startTime: text("start_time"),
    estimateMinutes: integer("estimate_minutes"),
    done: boolean("done").notNull().default(false),
    doneAt: at("done_at"),
    createdAt: createdAt(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

// --- Calendar subscriptions ---------------------------------------------

/** A calendar the student subscribed to, such as the timetable. */
export const feeds = pgTable("feeds", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  color: text("color"),
  fetchedAt: at("fetched_at"),
  error: text("error"),
  createdAt: createdAt(),
});

/** The events of a feed as last fetched. */
export const feedEvents = pgTable(
  "feed_events",
  {
    id: id(),
    feedId: uuid("feed_id").notNull().references(() => feeds.id, { onDelete: "cascade" }),
    uid: text("uid").notNull(),
    title: text("title").notNull(),
    startsAt: at("starts_at").notNull(),
    endsAt: at("ends_at").notNull(),
    allDay: boolean("all_day").notNull(),
    location: text("location"),
    notes: text("notes"),
    url: text("url"),
    cancelled: boolean("cancelled").notNull().default(false),
  },
  (t) => [index().on(t.feedId, t.startsAt)],
);

/** Events of a feed with this title are sessions of that subject. */
export const seriesAssignments = pgTable(
  "series_assignments",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    feedId: uuid("feed_id").notNull().references(() => feeds.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.feedId, t.title] })],
);

// --- Access for Claude ---------------------------------------------------

/** A personal key for MCP clients that cannot sign in with OAuth. */
export const apiTokens = pgTable("api_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** SHA-256 of the token; the token itself is shown once. */
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
  lastUsedAt: at("last_used_at"),
  /** A key ends after 90 days unless it is extended; a forgotten key does not stay valid forever. */
  expiresAt: at("expires_at").notNull().default(sql`now() + interval '90 days'`),
});

// --- Notes ---------------------------------------------------------------

/** The shared lecture notes of a subject, edited like a wiki. */
export const courseNotes = pgTable("course_notes", {
  courseId: uuid("course_id").primaryKey().references(() => courses.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  /** Raised with every save; a save against an older version is a conflict. */
  version: integer("version").notNull().default(1),
  updatedAt: at("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
});

/** What one member notes for themselves in a subject. */
export const privateNotes = pgTable(
  "private_notes",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] })],
);

// --- Flashcards -----------------------------------------------------------

/** A deck of a subject; its cards are shared, the learning is not. */
export const decks = pgTable(
  "decks",
  {
    id: id(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.courseId, t.name)],
);

export const cards = pgTable(
  "cards",
  {
    id: id(),
    deckId: uuid("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    /** Where it comes from: a file id and page, `<file>#<page>`. */
    source: text("source"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [index().on(t.deckId)],
);

/** One member's learning state of a card (FSRS). */
export const cardStates = pgTable(
  "card_states",
  {
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    due: at("due").notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    elapsedDays: integer("elapsed_days").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    /** 0 new, 1 learning, 2 review, 3 relearning. */
    state: smallint("state").notNull(),
    lastReview: at("last_review"),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] }), index().on(t.userId, t.due)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    /** 1 again, 2 hard, 3 good, 4 easy. */
    rating: smallint("rating").notNull(),
    reviewedAt: at("reviewed_at").notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.reviewedAt)],
);

/** Cards Claude suggested; nothing reaches a deck until the member accepts it. */
export const cardProposals = pgTable(
  "card_proposals",
  {
    id: id(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    deckName: text("deck_name").notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    source: text("source"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.courseId)],
);

// --- Search ---------------------------------------------------------------

/** A passage of a document, for searching by meaning and by words. */
export const chunks = pgTable(
  "chunks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    page: integer("page"),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 384 }).notNull(),
    words: tsvector("words").generatedAlwaysAs(sql`to_tsvector('german', text)`),
  },
  (t) => [
    index().on(t.courseId),
    index().on(t.fileId),
    index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("chunks_words_idx").using("gin", t.words),
  ],
);

// --- Lectures ---------------------------------------------------------------

/** A transcribed lecture of a subject, shared with its members. */
export const recordings = pgTable(
  "recordings",
  {
    id: id(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    date: date("date").notNull(),
    language: text("language"),
    durationSeconds: integer("duration_seconds"),
    /** Markdown with a time stamp before every paragraph. */
    transcript: text("transcript").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    /** When Claude entered it into the notes, and for whom. */
    analysedAt: at("analysed_at"),
    analysedBy: uuid("analysed_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [index().on(t.courseId)],
);

// --- Activity ---------------------------------------------------------------

/** Who changed what in the shared parts; see domain/activity.ts. */
export const activity = pgTable(
  "activity",
  {
    id: id(),
    at: at("at").notNull().defaultNow(),
    /** The subject it happened in; empty for programmes and accounts. */
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    /** "app" or "claude". */
    via: text("via").notNull(),
    action: text("action").notNull(),
    subjectId: uuid("subject_id"),
    subject: text("subject").notNull(),
    details: jsonb("details").notNull().default({}),
    /** Edits merged into this entry. */
    count: integer("count").notNull().default(1),
  },
  (t) => [index().on(t.courseId, t.at), index().on(t.actorId, t.at), index().on(t.at)],
);
