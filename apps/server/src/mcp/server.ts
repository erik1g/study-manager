// The MCP server: the student's own Claude works with the Study Manager
// through these tools, under the student's account and rights. The cloud
// itself runs no AI; reading handbooks and scripts, planning and writing
// happen in Claude.
import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MODULE_BATCH, moduleSchema } from "@study/shared";
import type { Identity } from "../auth/identity.ts";
import { AppError } from "../domain/errors.ts";
import type { Services } from "../services.ts";
import { pdfText } from "../text/pdf.ts";

const INSTRUCTIONS = `Study Manager: the user's study cloud. Courses (shared with fellow students, with roles), \
documents (scripts, exercises, past exams), shared deadlines, private tasks with time planning, \
programmes with a module catalogue.

Language: talk to the user in their language (get_profile gives it as locale; otherwise the language \
they write in). Write what you store in a course – key points, flashcards, tasks and deadlines of the \
course – in the course's language (locale in list_courses and course_details), so that the course stays \
in one language for all its members. Titles taken from a script or handbook keep their wording, and exam \
hints are quoted verbatim in the language they were spoken in.

Importing a module handbook: create_program (or take an existing programme), then read the handbook with \
read_handbook section by section (at most 10 pages per call) and submit the modules with submit_modules \
in batches of at most ${MODULE_BATCH}. Only take over what the handbook says; invent nothing.

Planning tasks: tasks have a day (planned_date) and optionally a time (start_time) and a duration \
(estimate_minutes); that makes a time block in the calendar. Call get_calendar before planning to find \
free time next to the lectures.

Work inbox: work_inbox lists what is waiting for you – scripts without an outline in the notes and \
transcribed lectures not yet evaluated. When the user says "work through the inbox" (or similar), do \
these one after the other.

Outline: read the script with read_document (for slides the slide titles are usually enough), structure \
it into chapters and sections (two levels, numbers and titles from the script, the start page for each \
entry) and submit it with submit_outline. It only adds, never deletes.

Evaluating a lecture: get the section ids with notes_outline, read the whole transcript with \
read_transcript (it is made automatically; names may be misspelt), assign a few concise key points to \
each section and take over exam hints ("this will be on the exam", "you must be able to do this", \
„das müssen Sie können“, „kommt in der Klausur dran“ …) verbatim with their timestamp – never invent \
them. Everything in one call of submit_lecture_notes; organisational matters go under ohne-kapitel.

Flashcards: propose_cards suggests cards; the user accepts them in the app. Precise questions, short \
answers, formulas in LaTeX ($…$).

Searching: search_course finds passages in a course's documents by meaning and wording, with the page.`;

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

/** The tools, bound to one user. */
export function mcpServer(services: Services, identity: Identity): McpServer {
  const server = new McpServer({ name: "study-manager", title: "Study Manager", version: "0.1.0" }, { instructions: INSTRUCTIONS });
  const user = identity.userId;

  const tool = <Shape extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: Shape,
    run: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>,
    readOnly = false,
  ) =>
    server.registerTool(
      name,
      { description, inputSchema: shape, annotations: { readOnlyHint: readOnly } },
      // The SDK hands over checked arguments of this shape.
      (async (args: z.infer<z.ZodObject<Shape>>) => {
        try {
          return json(await run(args));
        } catch (error) {
          const message = error instanceof AppError ? `${error.code}: ${error.message}` : String((error as Error).message ?? error);
          return { content: [{ type: "text" as const, text: `Error – ${message}` }], isError: true };
        }
      }) as never,
    );

  // --- Overview ---------------------------------------------------------

  tool(
    "overview",
    "Overview: the user's profile with their language, their courses with role and language, programmes, open tasks and the next deadlines.",
    {},
    async () => {
      const [profile, courses, programs, tasks, deadlines] = await Promise.all([
        services.users.me(user),
        services.courses.list(user),
        services.programs.list(user),
        services.planning.tasks(user, { open: true }),
        services.planning.deadlines(user, { from: new Date() }),
      ]);
      return {
        user: { name: profile.displayName, locale: profile.locale },
        courses,
        programs: programs.filter((p) => p.enrolled),
        openTasks: tasks,
        nextDeadlines: deadlines.slice(0, 15),
      };
    },
    true,
  );

  // --- Subjects and documents ---------------------------------------------

  tool(
    "get_profile",
    "The user: name, university and programme (free text), semester of study and language (locale: en, de) – for plans and advice that fit their studies, and to talk to them in their language.",
    {},
    async () => {
      const profile = await services.users.me(user);
      return { name: profile.displayName, email: profile.email, studies: profile.studies, semester: profile.semester, locale: profile.locale };
    },
    true,
  );

  tool(
    "course_activity",
    "What was changed in a course lately and by whom (files, deadlines, flashcards, notes, members). via=claude means: through Claude.",
    { course_id: z.string().uuid(), before: z.string().datetime().optional().describe("For older entries: the time of the oldest one seen so far") },
    ({ course_id, before }) => services.activity.ofCourse(user, course_id, { before, limit: 50 }),
    true,
  );

  tool("list_courses", "All of the user's courses with semester, role, number of members and language (locale: what is written into the course is in it).", {}, () => services.courses.list(user), true);

  tool(
    "course_details",
    "A course with its language (locale), documents (id, folder, name), members and deadlines.",
    { course_id: z.string().uuid() },
    async ({ course_id }) => ({
      course: await services.courses.get(user, course_id),
      files: await services.files.list(user, course_id),
      members: await services.courses.members(user, course_id),
      deadlines: await services.planning.deadlines(user, { courseId: course_id }),
    }),
    true,
  );

  tool(
    "create_course",
    "Creates a course, preferably from a module (module_id) – then title, number and credits come from the catalogue. The user becomes the owner; the course gets the user's language.",
    {
      semester: z.string().describe("WiSe26-27 (winter) or SoSe27 (summer)"),
      module_id: z.string().uuid().optional(),
      title: z.string().optional().describe("only needed without a module"),
    },
    ({ semester, module_id, title }) => services.courses.create(user, { semester, moduleId: module_id ?? null, title: title ?? "" }),
  );

  tool(
    "read_document",
    "Reads the text of a document. PDFs page by page: at most 10 pages per call; the answer gives the number of pages.",
    { file_id: z.string().uuid(), from_page: z.number().int().positive().default(1), to_page: z.number().int().positive().optional() },
    async ({ file_id, from_page, to_page }) => {
      const file = await services.files.open(user, file_id);
      if (file.mime === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const last = Math.min(to_page ?? from_page + 9, from_page + 9);
        return { name: file.name, ...(await pdfText(file.path, from_page, last)) };
      }
      if (/^text\/|json|markdown/.test(file.mime) || /\.(md|txt|tex|csv)$/i.test(file.name)) {
        const text = await readFile(file.path, "utf8");
        return { name: file.name, text: text.slice(0, 60_000), truncated: text.length > 60_000 };
      }
      throw new AppError(400, "unreadable_type", `${file.mime} cannot be read as text.`);
    },
    true,
  );

  // --- Planning -----------------------------------------------------------

  tool(
    "list_tasks",
    "The user's (private) tasks, optionally of one course and only open ones.",
    { course_id: z.string().uuid().optional(), open_only: z.boolean().default(true) },
    ({ course_id, open_only }) => services.planning.tasks(user, { courseId: course_id, open: open_only }),
    true,
  );

  const taskFields = {
    title: z.string(),
    course_id: z.string().uuid().nullable().optional(),
    deadline_id: z.string().uuid().nullable().optional(),
    planned_date: z.string().nullable().optional().describe("YYYY-MM-DD, the day it is to be done"),
    start_time: z.string().nullable().optional().describe("HH:MM, makes a time block"),
    estimate_minutes: z.number().int().positive().nullable().optional(),
  };

  tool("create_task", "Creates a task, optionally planned as a time block.", taskFields, (a) =>
    services.planning.createTask(user, {
      title: a.title,
      courseId: a.course_id ?? null,
      deadlineId: a.deadline_id ?? null,
      plannedDate: a.planned_date ?? null,
      startTime: a.start_time ?? null,
      estimateMinutes: a.estimate_minutes ?? null,
    }),
  );

  tool(
    "update_task",
    "Changes a task: tick off (done), replan, rename. Only the fields passed change.",
    { task_id: z.string().uuid(), done: z.boolean().optional(), ...taskFields, title: z.string().optional() },
    (a) =>
      services.planning.updateTask(user, a.task_id, {
        ...(a.title !== undefined && { title: a.title }),
        ...(a.done !== undefined && { done: a.done }),
        ...(a.course_id !== undefined && { courseId: a.course_id }),
        ...(a.deadline_id !== undefined && { deadlineId: a.deadline_id }),
        ...(a.planned_date !== undefined && { plannedDate: a.planned_date }),
        ...(a.start_time !== undefined && { startTime: a.start_time }),
        ...(a.estimate_minutes !== undefined && { estimateMinutes: a.estimate_minutes }),
      }),
  );

  tool(
    "list_deadlines",
    "Deadlines (exams, submissions), from today or of one course.",
    { course_id: z.string().uuid().optional(), include_past: z.boolean().default(false) },
    ({ course_id, include_past }) =>
      services.planning.deadlines(user, { courseId: course_id, from: include_past ? undefined : new Date(Date.now() - 86_400_000) }),
    true,
  );

  tool(
    "create_deadline",
    "Creates a deadline. With course_id it is visible to all members of the course (needs the editor role).",
    {
      title: z.string(),
      course_id: z.string().uuid().nullable(),
      all_day: z.boolean(),
      date: z.string().optional().describe("YYYY-MM-DD, when all day"),
      starts_at: z.string().optional().describe("ISO time with time zone, e.g. 2027-02-15T08:00:00+01:00"),
      ends_at: z.string().optional(),
      notes: z.string().optional(),
    },
    (a) =>
      services.planning.createDeadline(user, {
        title: a.title,
        courseId: a.course_id,
        allDay: a.all_day,
        date: a.date ?? null,
        startsAt: a.starts_at ?? null,
        endsAt: a.ends_at ?? null,
        notes: a.notes ?? null,
      }),
  );

  tool(
    "get_calendar",
    "The calendar between two points in time: lectures (session), other events, deadlines and planned tasks.",
    { from: z.string().describe("ISO date"), to: z.string().describe("ISO date") },
    ({ from, to }) => services.calendar.items(user, new Date(from), new Date(to)),
    true,
  );

  // --- Work for Claude, notes and lectures --------------------------------

  tool("work_inbox", "What is waiting for Claude: scripts without an outline and lectures not yet evaluated, each with an instruction and the course's language.", {}, () => services.inbox.items(user), true);

  tool(
    "get_notes",
    "The shared notes of a course (Markdown) and, if there are any, the user's private notes.",
    { course_id: z.string().uuid() },
    async ({ course_id }) => ({
      shared: (await services.notes.get(user, course_id)).content,
      private: (await services.notes.getPrivate(user, course_id)).content,
    }),
    true,
  );

  tool("notes_outline", "The sections of the shared notes with their ids (for submit_lecture_notes).", { course_id: z.string().uuid() }, ({ course_id }) =>
    services.notes.outline(user, course_id),
  true);

  const outlineItem = z.object({ title: z.string(), page: z.number().int().positive().nullable().optional() });
  tool(
    "submit_outline",
    "Adds a script's outline to the shared notes (chapters ## and sections ###). Only adds what is missing.",
    {
      course_id: z.string().uuid(),
      script_file_id: z.string().uuid(),
      chapters: z.array(outlineItem.extend({ sections: z.array(outlineItem).default([]) })).min(1),
    },
    async ({ course_id, script_file_id, chapters }) => {
      const notes = await services.notes.applyOutline(user, course_id, { script: script_file_id, chapters });
      return { ok: true, headings: (await services.notes.outline(user, course_id)).length, version: notes.version };
    },
  );

  tool(
    "search_course",
    "Searches a course's documents by meaning and wording; returns passages with file and page.",
    { course_id: z.string().uuid(), query: z.string(), limit: z.number().int().min(1).max(20).default(8) },
    ({ course_id, query, limit }) => services.search.search(user, course_id, query, limit),
    true,
  );

  tool(
    "list_recordings",
    "The transcribed lectures of a course, with date and whether they are evaluated yet.",
    { course_id: z.string().uuid() },
    ({ course_id }) => services.recordings.list(user, course_id),
    true,
  );

  tool(
    "read_transcript",
    "Reads a lecture's transcript in parts (part starts at 1); the answer gives the number of parts.",
    { recording_id: z.string().uuid(), part: z.number().int().positive().default(1) },
    ({ recording_id, part }) => services.recordings.part(user, recording_id, part),
    true,
  );

  tool(
    "submit_lecture_notes",
    "Adds a lecture's evaluation to the shared notes: per section (id from notes_outline) key points in the course's language and verbatim exam hints with timestamp. Evaluating again replaces the old evaluation.",
    {
      recording_id: z.string().uuid(),
      sections: z.array(
        z.object({
          id: z.string(),
          points: z.array(z.string()).default([]),
          exam_hints: z.array(z.object({ quote: z.string(), time: z.string().nullable().optional() })).default([]),
        }),
      ),
    },
    async ({ recording_id, sections }) => {
      await services.recordings.analyse(
        user,
        recording_id,
        sections.map((s) => ({ id: s.id, points: s.points, examHints: s.exam_hints })),
      );
      return { ok: true, sections: sections.length, examHints: sections.reduce((n, s) => n + s.exam_hints.length, 0) };
    },
  );

  // --- Flashcards --------------------------------------------------------------

  tool("list_decks", "The flashcard decks of a course with their number of cards and the user's due cards.", { course_id: z.string().uuid() }, ({ course_id }) =>
    services.flashcards.decks(user, course_id),
  true);

  tool(
    "propose_cards",
    "Suggests flashcards for a deck (at most 50), in the course's language. The user accepts or discards each in the app.",
    {
      course_id: z.string().uuid(),
      deck: z.string().describe("Name of the deck; a new one is created on accepting"),
      cards: z
        .array(z.object({ front: z.string(), back: z.string(), source: z.string().optional().describe("file id#page") }))
        .min(1)
        .max(50),
    },
    async ({ course_id, deck, cards }) => ({ proposed: await services.flashcards.propose(user, course_id, deck, cards) }),
  );

  // --- Degree programmes and handbooks ----------------------------------

  tool("list_programs", "All programmes of the cloud with their number of modules and whether the user studies them.", {}, () => services.programs.list(user), true);

  tool(
    "create_program",
    "Creates a programme; the user then manages its module catalogue.",
    { university: z.string(), name: z.string(), degree: z.string().default(""), regulation: z.string().default("") },
    async (a) => ({ id: await services.programs.create(user, a) }),
  );

  tool(
    "read_handbook",
    "Reads a programme's uploaded module handbook page by page (at most 10 pages per call).",
    { program_id: z.string().uuid(), from_page: z.number().int().positive().default(1), to_page: z.number().int().positive().optional() },
    ({ program_id, from_page, to_page }) => services.programs.handbookText(program_id, from_page, Math.min(to_page ?? from_page + 9, from_page + 9)),
    true,
  );

  tool(
    "submit_modules",
    `Submits modules for the catalogue (at most ${MODULE_BATCH} per call); existing ones with the same number are replaced. Only the programme's manager may.`,
    { program_id: z.string().uuid(), modules: z.array(moduleSchema).max(MODULE_BATCH) },
    ({ program_id, modules }) => services.programs.upsertModules(user, program_id, modules),
  );

  tool(
    "list_modules",
    "The modules of a programme, optionally filtered by title or number.",
    { program_id: z.string().uuid(), query: z.string().optional() },
    ({ program_id, query }) => services.programs.modules(program_id, query),
    true,
  );

  return server;
}

/** Mounts `/mcp` (Streamable HTTP, stateless) and the OAuth discovery for it. */
export function mountMcp(app: FastifyInstance, services: Services) {
  const resource = `${services.siteUrl}/mcp`;
  const metadataUrl = `${services.siteUrl}/.well-known/oauth-protected-resource`;

  const metadata = async () => ({
    resource,
    authorization_servers: [`${services.siteUrl}/auth/v1`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"],
    resource_name: "Study Manager",
  });
  app.get("/.well-known/oauth-protected-resource", metadata);
  app.get("/.well-known/oauth-protected-resource/mcp", metadata);

  app.route({
    method: ["GET", "POST", "DELETE"],
    url: "/mcp",
    handler: async (request, reply) => {
      if (!request.identity) {
        return reply
          .status(401)
          .header("WWW-Authenticate", `Bearer resource_metadata="${metadataUrl}"`)
          .send({ error: "unauthorized", error_description: "Sign-in required" });
      }
      if (request.method !== "POST") {
        // Stateless: no server-initiated stream and no sessions to end.
        return reply.status(405).header("Allow", "POST").send();
      }
      const server = mcpServer(services, request.identity);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      reply.hijack();
      reply.raw.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    },
  });
}
