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

const INSTRUCTIONS = `Study Manager: die Studien-Cloud des Nutzers. Fächer (geteilt mit Kommilitonen, mit Rollen), \
Dokumente (Skripte, Übungen, Altklausuren), geteilte Deadlines, private Aufgaben mit Zeitplanung, \
Studiengänge mit Modulkatalog.

Modulhandbuch importieren: create_program (oder bestehenden Studiengang nehmen), dann read_handbook \
abschnittsweise lesen (höchstens 10 Seiten je Aufruf) und die Module mit submit_modules in Paketen von \
höchstens ${MODULE_BATCH} einreichen. Nur Angaben übernehmen, die im Handbuch stehen; nichts erfinden.

Aufgaben planen: Aufgaben haben einen Tag (planned_date) und optional eine Uhrzeit (start_time) und \
Dauer (estimate_minutes); das ergibt einen Zeitblock im Kalender. Vor dem Planen get_calendar aufrufen, \
um freie Zeiten neben den Vorlesungen zu finden.

Arbeitseingang: work_inbox nennt, was auf dich wartet – Skripte ohne Gliederung in den Notizen und \
transkribierte Vorlesungen, die noch nicht ausgewertet sind. Sagt der Nutzer „arbeite ab“, diese Punkte \
nacheinander erledigen.

Gliederung: Skript mit read_document lesen (bei Folien reichen meist die Folientitel), in Kapitel und \
Abschnitte gliedern (zwei Ebenen, Nummern und Titel aus dem Skript, je Eintrag die Startseite) und mit \
submit_outline einreichen. Es wird nur ergänzt, nie gelöscht.

Vorlesung auswerten: notes_outline für die Kennungen der Abschnitte holen, das Transkript mit \
read_transcript ganz lesen (es ist automatisch erstellt; Namen können falsch geschrieben sein), je \
Abschnitt wenige knappe Kernpunkte zuordnen und Prüfungshinweise („das müssen Sie können“, „kommt in der \
Klausur dran“, „this will be on the exam“ …) wörtlich mit Zeitmarke übernehmen – nie erfinden. Alles in \
einem Aufruf von submit_lecture_notes; Organisatorisches unter ohne-kapitel.

Lernkarten: propose_cards schlägt Karten vor; der Nutzer übernimmt sie in der App. Fragen präzise, \
Antworten kurz, Formeln in LaTeX ($…$).

Suchen: search_course findet Stellen in den Dokumenten eines Fachs nach Bedeutung und Wortlaut, mit \
Seitenzahl.`;

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
          return { content: [{ type: "text" as const, text: `Fehler – ${message}` }], isError: true };
        }
      }) as never,
    );

  // --- Overview ---------------------------------------------------------

  tool(
    "overview",
    "Überblick: Fächer des Nutzers mit Rolle, Studiengänge, offene Aufgaben und die nächsten Deadlines.",
    {},
    async () => {
      const [courses, programs, tasks, deadlines] = await Promise.all([
        services.courses.list(user),
        services.programs.list(user),
        services.planning.tasks(user, { open: true }),
        services.planning.deadlines(user, { from: new Date() }),
      ]);
      return {
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
    "Der Nutzer: Name, Uni und Studiengang (Freitext) und Fachsemester – für Pläne und Empfehlungen, die zu seinem Studium passen.",
    {},
    async () => {
      const profile = await services.users.me(user);
      return { name: profile.displayName, email: profile.email, studies: profile.studies, semester: profile.semester };
    },
    true,
  );

  tool(
    "course_activity",
    "Was zuletzt in einem Fach geändert wurde und von wem (Dateien, Deadlines, Lernkarten, Notizen, Mitglieder). via=claude heißt: über Claude.",
    { course_id: z.string().uuid(), before: z.string().datetime().optional().describe("Für ältere Einträge: Zeitpunkt des ältesten bisher gesehenen") },
    ({ course_id, before }) => services.activity.ofCourse(user, course_id, { before, limit: 50 }),
    true,
  );

  tool("list_courses", "Alle Fächer des Nutzers mit Semester, Rolle und Mitgliederzahl.", {}, () => services.courses.list(user), true);

  tool(
    "course_details",
    "Ein Fach mit Dokumenten (id, Ordner, Name), Mitgliedern und Deadlines.",
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
    "Legt ein Fach an, am besten aus einem Modul (module_id) – dann kommen Titel, Nummer und LP aus dem Katalog. Der Nutzer wird Besitzer.",
    {
      semester: z.string().describe("WiSe26-27 oder SoSe27"),
      module_id: z.string().uuid().optional(),
      title: z.string().optional().describe("nur ohne Modul nötig"),
    },
    ({ semester, module_id, title }) => services.courses.create(user, { semester, moduleId: module_id ?? null, title: title ?? "Fach" }),
  );

  tool(
    "read_document",
    "Liest den Text eines Dokuments. PDFs seitenweise: höchstens 10 Seiten je Aufruf; die Antwort nennt die Seitenzahl.",
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
      throw new AppError(400, "unreadable_type", `${file.mime} lässt sich nicht als Text lesen.`);
    },
    true,
  );

  // --- Planning -----------------------------------------------------------

  tool(
    "list_tasks",
    "Aufgaben (privat) des Nutzers, optional eines Fachs und nur offene.",
    { course_id: z.string().uuid().optional(), open_only: z.boolean().default(true) },
    ({ course_id, open_only }) => services.planning.tasks(user, { courseId: course_id, open: open_only }),
    true,
  );

  const taskFields = {
    title: z.string(),
    course_id: z.string().uuid().nullable().optional(),
    deadline_id: z.string().uuid().nullable().optional(),
    planned_date: z.string().nullable().optional().describe("JJJJ-MM-TT, der Tag, an dem sie erledigt werden soll"),
    start_time: z.string().nullable().optional().describe("HH:MM, ergibt einen Zeitblock"),
    estimate_minutes: z.number().int().positive().nullable().optional(),
  };

  tool("create_task", "Legt eine Aufgabe an, optional geplant als Zeitblock.", taskFields, (a) =>
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
    "Ändert eine Aufgabe: abhaken (done), umplanen, umbenennen. Nur übergebene Felder ändern sich.",
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
    "Deadlines (Klausuren, Abgaben), ab heute oder eines Fachs.",
    { course_id: z.string().uuid().optional(), include_past: z.boolean().default(false) },
    ({ course_id, include_past }) =>
      services.planning.deadlines(user, { courseId: course_id, from: include_past ? undefined : new Date(Date.now() - 86_400_000) }),
    true,
  );

  tool(
    "create_deadline",
    "Legt eine Deadline an. Mit course_id ist sie für alle Mitglieder des Fachs sichtbar (Bearbeiter-Rolle nötig).",
    {
      title: z.string(),
      course_id: z.string().uuid().nullable(),
      all_day: z.boolean(),
      date: z.string().optional().describe("JJJJ-MM-TT, bei ganztägig"),
      starts_at: z.string().optional().describe("ISO-Zeit mit Zeitzone, z. B. 2027-02-15T08:00:00+01:00"),
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
    "Kalender zwischen zwei Zeitpunkten: Vorlesungen (session), andere Termine, Deadlines und geplante Aufgaben.",
    { from: z.string().describe("ISO-Datum"), to: z.string().describe("ISO-Datum") },
    ({ from, to }) => services.calendar.items(user, new Date(from), new Date(to)),
    true,
  );

  // --- Work for Claude, notes and lectures --------------------------------

  tool("work_inbox", "Was auf Claude wartet: Skripte ohne Gliederung und unausgewertete Vorlesungen, je mit Anweisung.", {}, () => services.inbox.items(user), true);

  tool(
    "get_notes",
    "Die gemeinsamen Notizen eines Fachs (Markdown) und, falls vorhanden, die privaten Notizen des Nutzers.",
    { course_id: z.string().uuid() },
    async ({ course_id }) => ({
      shared: (await services.notes.get(user, course_id)).content,
      private: (await services.notes.getPrivate(user, course_id)).content,
    }),
    true,
  );

  tool("notes_outline", "Die Abschnitte der gemeinsamen Notizen mit ihren Kennungen (für submit_lecture_notes).", { course_id: z.string().uuid() }, ({ course_id }) =>
    services.notes.outline(user, course_id),
  true);

  const outlineItem = z.object({ title: z.string(), page: z.number().int().positive().nullable().optional() });
  tool(
    "submit_outline",
    "Trägt die Gliederung eines Skripts in die gemeinsamen Notizen ein (Kapitel ## und Abschnitte ###). Ergänzt nur Fehlendes.",
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
    "Durchsucht die Dokumente eines Fachs nach Bedeutung und Wortlaut; liefert Stellen mit Datei und Seite.",
    { course_id: z.string().uuid(), query: z.string(), limit: z.number().int().min(1).max(20).default(8) },
    ({ course_id, query, limit }) => services.search.search(user, course_id, query, limit),
    true,
  );

  tool(
    "list_recordings",
    "Die transkribierten Vorlesungen eines Fachs, mit Datum und ob sie schon ausgewertet sind.",
    { course_id: z.string().uuid() },
    ({ course_id }) => services.recordings.list(user, course_id),
    true,
  );

  tool(
    "read_transcript",
    "Liest das Transkript einer Vorlesung in Teilen (part beginnt bei 1); die Antwort nennt die Zahl der Teile.",
    { recording_id: z.string().uuid(), part: z.number().int().positive().default(1) },
    ({ recording_id, part }) => services.recordings.part(user, recording_id, part),
    true,
  );

  tool(
    "submit_lecture_notes",
    "Trägt die Auswertung einer Vorlesung in die gemeinsamen Notizen ein: je Abschnitt (id aus notes_outline) Kernpunkte und wörtliche Prüfungshinweise mit Zeitmarke. Eine erneute Auswertung ersetzt die alte.",
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

  tool("list_decks", "Die Lernkarten-Stapel eines Fachs mit Kartenzahl und fälligen Karten des Nutzers.", { course_id: z.string().uuid() }, ({ course_id }) =>
    services.flashcards.decks(user, course_id),
  true);

  tool(
    "propose_cards",
    "Schlägt Lernkarten für einen Stapel vor (höchstens 50). Der Nutzer übernimmt oder verwirft jede in der App.",
    {
      course_id: z.string().uuid(),
      deck: z.string().describe("Name des Stapels; ein neuer wird beim Übernehmen angelegt"),
      cards: z
        .array(z.object({ front: z.string(), back: z.string(), source: z.string().optional().describe("Datei-ID#Seite") }))
        .min(1)
        .max(50),
    },
    async ({ course_id, deck, cards }) => ({ proposed: await services.flashcards.propose(user, course_id, deck, cards) }),
  );

  // --- Degree programmes and handbooks ----------------------------------

  tool("list_programs", "Alle Studiengänge der Cloud mit Modulzahl und ob der Nutzer sie studiert.", {}, () => services.programs.list(user), true);

  tool(
    "create_program",
    "Legt einen Studiengang an; der Nutzer verwaltet dann dessen Modulkatalog.",
    { university: z.string(), name: z.string(), degree: z.string().default(""), regulation: z.string().default("") },
    async (a) => ({ id: await services.programs.create(user, a) }),
  );

  tool(
    "read_handbook",
    "Liest das hochgeladene Modulhandbuch eines Studiengangs seitenweise (höchstens 10 Seiten je Aufruf).",
    { program_id: z.string().uuid(), from_page: z.number().int().positive().default(1), to_page: z.number().int().positive().optional() },
    ({ program_id, from_page, to_page }) => services.programs.handbookText(program_id, from_page, Math.min(to_page ?? from_page + 9, from_page + 9)),
    true,
  );

  tool(
    "submit_modules",
    `Reicht Module für den Katalog ein (höchstens ${MODULE_BATCH} je Aufruf); bestehende mit gleicher Nummer werden ersetzt. Nur der Verwalter des Studiengangs darf.`,
    { program_id: z.string().uuid(), modules: z.array(moduleSchema).max(MODULE_BATCH) },
    ({ program_id, modules }) => services.programs.upsertModules(user, program_id, modules),
  );

  tool(
    "list_modules",
    "Module eines Studiengangs, optional gefiltert nach Titel oder Nummer.",
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
          .send({ error: "unauthorized", error_description: "Anmeldung nötig" });
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
