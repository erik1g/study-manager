// Degree programmes and their module catalogues, shared by everyone who
// studies them. Whoever imports a handbook manages the catalogue.
import { mkdir, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { MODULE_BATCH, moduleSchema, programDraftSchema, type ModuleData, type ProgramDraft } from "@study/shared";
import type { Db } from "../db/client.ts";
import { enrollments, modules, profiles, programs } from "../db/schema.ts";
import { pdfText } from "../text/pdf.ts";
import { isAdmin } from "./access.ts";
import { forbidden, invalid, notFound } from "./errors.ts";
import { changes, record } from "./activity.ts";

export interface ProgramView {
  id: string;
  university: string;
  name: string;
  degree: string;
  regulation: string;
  managerId: string | null;
  managerName: string | null;
  moduleCount: number;
  enrolled: boolean;
  hasHandbook: boolean;
}

export interface ModuleView extends ModuleData {
  id: string;
  programId: string;
}

export function programsOf(db: Db, filesDir: string) {
  const mayManage = async (userId: string, programId: string) => {
    const program = await db.query.programs.findFirst({ where: eq(programs.id, programId) });
    if (!program) throw notFound("unknown_program");
    if (program.managerId !== userId && !(await isAdmin(db, userId))) throw forbidden("not_manager");
    return program;
  };

  const toModule = (row: typeof modules.$inferSelect): ModuleView => ({
    ...(row.details as Partial<ModuleData>),
    id: row.id,
    programId: row.programId,
    number: row.number,
    title: row.title,
    credits: row.credits,
  });

  return {
    async list(userId: string): Promise<ProgramView[]> {
      const rows = await db
        .select({
          program: programs,
          managerName: profiles.displayName,
          moduleCount: sql<number>`(select count(*)::int from ${modules} m where m.program_id = ${programs.id})`,
          enrolled: sql<boolean>`exists(select 1 from ${enrollments} e where e.program_id = ${programs.id} and e.user_id = ${userId})`,
        })
        .from(programs)
        .leftJoin(profiles, eq(profiles.id, programs.managerId))
        .orderBy(programs.university, programs.name);
      return rows.map(({ program, managerName, moduleCount, enrolled }) => ({
        id: program.id,
        university: program.university,
        name: program.name,
        degree: program.degree,
        regulation: program.regulation,
        managerId: program.managerId,
        managerName,
        moduleCount,
        enrolled,
        hasHandbook: !!program.handbookPath,
      }));
    },

    async create(userId: string, draft: ProgramDraft): Promise<string> {
      const data = programDraftSchema.parse(draft);
      const [program] = await db.insert(programs).values({ ...data, managerId: userId }).returning({ id: programs.id });
      await db.insert(enrollments).values({ userId, programId: program!.id }).onConflictDoNothing();
      await record(db, { actorId: userId, action: "program.created", subjectId: program!.id, subject: `${data.university} · ${data.name}` });
      return program!.id;
    },

    async update(userId: string, programId: string, draft: ProgramDraft) {
      const before = await mayManage(userId, programId);
      const next = programDraftSchema.parse(draft);
      await db.update(programs).set(next).where(eq(programs.id, programId));
      const diff = changes(before, next);
      if (Object.keys(diff).length > 0) {
        await record(db, { actorId: userId, action: "program.changed", subjectId: programId, subject: `${next.university} · ${next.name}`, details: diff });
      }
    },

    async remove(userId: string, programId: string) {
      const program = await mayManage(userId, programId);
      await db.delete(programs).where(eq(programs.id, programId));
      await record(db, { actorId: userId, action: "program.deleted", subjectId: programId, subject: `${program.university} · ${program.name}` });
    },

    async setEnrolled(userId: string, programId: string, enrolled: boolean) {
      if (enrolled) await db.insert(enrollments).values({ userId, programId }).onConflictDoNothing();
      else await db.delete(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.programId, programId)));
    },

    async modules(programId: string, query?: string): Promise<ModuleView[]> {
      const term = query?.trim();
      const rows = await db
        .select()
        .from(modules)
        .where(
          and(
            eq(modules.programId, programId),
            term ? or(ilike(modules.title, `%${term}%`), ilike(modules.number, `%${term}%`)) : undefined,
          ),
        )
        .orderBy(modules.number);
      return rows.map(toModule);
    },

    async module(moduleId: string): Promise<ModuleView> {
      const row = await db.query.modules.findFirst({ where: eq(modules.id, moduleId) });
      if (!row) throw notFound("unknown_module");
      return toModule(row);
    },

    /**
     * Adds or replaces modules by number. Handbooks are long, so they come in
     * batches; each module is checked on its own and the ones that do not
     * fit are reported back rather than failing the batch.
     */
    async upsertModules(userId: string, programId: string, input: unknown[]) {
      const program = await mayManage(userId, programId);
      if (input.length > MODULE_BATCH) throw invalid("too_many_modules", `At most ${MODULE_BATCH} modules per call.`);
      const saved: string[] = [];
      const rejected: { index: number; problem: string }[] = [];
      for (const [index, raw] of input.entries()) {
        const parsed = moduleSchema.safeParse(raw);
        if (!parsed.success) {
          rejected.push({ index, problem: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
          continue;
        }
        const { number, title, credits, ...details } = parsed.data;
        await db
          .insert(modules)
          .values({ programId, number, title, credits: credits ?? null, details })
          .onConflictDoUpdate({
            target: [modules.programId, modules.number],
            set: { title, credits: credits ?? null, details, updatedAt: new Date() },
          });
        saved.push(number);
      }
      if (saved.length > 0) {
        await record(db, { actorId: userId, action: "modules.changed", subjectId: programId, subject: `${program.university} · ${program.name}`, details: { saved } });
      }
      return { saved, rejected };
    },

    async removeModule(userId: string, moduleId: string) {
      const module = await this.module(moduleId);
      const program = await mayManage(userId, module.programId);
      await db.delete(modules).where(eq(modules.id, moduleId));
      await record(db, { actorId: userId, action: "modules.changed", subjectId: program.id, subject: `${program.university} · ${program.name}`, details: { removed: [module.number] } });
    },

    /** Keeps the uploaded handbook PDF with its programme. */
    async setHandbook(userId: string, programId: string, uploaded: string) {
      await mayManage(userId, programId);
      const relative = join("handbooks", `${programId}.pdf`);
      const target = join(filesDir, relative);
      await mkdir(dirname(target), { recursive: true });
      await rename(uploaded, target);
      await db.update(programs).set({ handbookPath: relative }).where(eq(programs.id, programId));
    },

    async handbookText(programId: string, from: number, to?: number) {
      const program = await db.query.programs.findFirst({ where: eq(programs.id, programId) });
      if (!program) throw notFound("unknown_program");
      if (!program.handbookPath) throw notFound("no_handbook");
      return pdfText(join(filesDir, program.handbookPath), from, to);
    },
  };
}
