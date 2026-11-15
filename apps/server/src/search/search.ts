// The search over a subject's documents: each document is cut into passages,
// which are found both by meaning (vectors) and by their words (German full
// text). Either alone misses too much; the two rankings are fused.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, ilike, inArray, isNotNull, isNull, or, sql, type AnyColumn } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { chunks, courseNotes, deadlines, files, recordings, tasks } from "../db/schema.ts";
import { requireRole } from "../domain/access.ts";
import { memberCourseIds } from "../domain/planning.ts";
import mammoth from "mammoth";
import { pdfPages } from "../text/pdf.ts";
import type { Embedder } from "./embedder.ts";

/** Passages of about this many characters, overlapping a little. */
const PASSAGE = 900;
const OVERLAP = 150;
/** Larger documents are not indexed (scanned books and the like). */
const MAX_BYTES = 80 * 1024 * 1024;

export interface SearchHit {
  fileId: string;
  courseId: string;
  name: string;
  folder: string;
  page: number | null;
  text: string;
  score: number;
}

/** A Word document of today's kind; the older .doc is a different format. */
const isWord = (file: { mime: string; name: string }) => /wordprocessingml\.document/.test(file.mime) || /\.docx$/i.test(file.name);

/** The notes cut at their headings. */
function notesHeadings(content: string): { title: string; text: string }[] {
  return content
    .split(/^(?=#{2,3} )/m)
    .filter((part) => part.startsWith("#"))
    .map((part) => ({ title: part.split("\n")[0]!.replace(/^#+ /, ""), text: part.replace(/<!--[\s\S]*?-->/g, "") }));
}

/** Cuts a page into passages at sentence ends where possible. */
export function passages(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= PASSAGE) return clean.length > 20 ? [clean] : [];
  const result: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + PASSAGE);
    if (end < clean.length) {
      const stop = clean.lastIndexOf(". ", end);
      if (stop > start + PASSAGE / 2) end = stop + 1;
    }
    result.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - OVERLAP, start + 1);
  }
  return result.filter((p) => p.length > 20);
}

export function searchOf(db: Db, embedder: Embedder, filesDir: string) {
  /** The text of a document by page; null for kinds that have none. */
  const pagesOf = async (file: typeof files.$inferSelect): Promise<{ page: number | null; text: string }[] | null> => {
    const path = join(filesDir, file.path);
    if (file.mime === "application/pdf" || /\.pdf$/i.test(file.name)) {
      return (await pdfPages(path)).map((text, i) => ({ page: i + 1, text }));
    }
    if (isWord(file)) {
      return [{ page: null, text: (await mammoth.extractRawText({ path })).value }];
    }
    if (/^text\//.test(file.mime) || /\.(md|markdown|txt|tex)$/i.test(file.name)) {
      return [{ page: null, text: await readFile(path, "utf8") }];
    }
    return null;
  };

  /** Reciprocal rank fusion of a search by meaning and one by words (k = 60). */
  const findPassages = async (courseIds: string[], query: string, limit: number): Promise<SearchHit[]> => {
    const question = query.trim();
    if (!question || courseIds.length === 0) return [];
    const [vector] = await embedder.embed([question], "query");
    const literal = `[${vector!.join(",")}]`;
    const ids = sql.join(courseIds.map((id) => sql`${id}::uuid`), sql`, `);
    const rows = await db.execute<{ file_id: string; course_id: string; name: string; folder: string; page: number | null; text: string; score: number }>(sql`
      with meaning as (
        select c.id, row_number() over (order by c.embedding <=> ${literal}::vector) as rank
        from ${chunks} c join ${files} f on f.id = c.file_id
        where c.course_id in (${ids}) and f.deleted_at is null
        order by c.embedding <=> ${literal}::vector limit 40
      ), wording as (
        select c.id, row_number() over (order by ts_rank(c.words, q) desc) as rank
        from ${chunks} c join ${files} f on f.id = c.file_id, websearch_to_tsquery('german', ${question}) q
        where c.course_id in (${ids}) and f.deleted_at is null and c.words @@ q
        order by ts_rank(c.words, q) desc limit 40
      ), fused as (
        select id, sum(1.0 / (60 + rank)) as score from (select * from meaning union all select * from wording) both_ranks group by id
      )
      select c.file_id, c.course_id, f.name, f.folder::text as folder, c.page, c.text, fused.score::float as score
      from fused join ${chunks} c on c.id = fused.id join ${files} f on f.id = c.file_id
      order by fused.score desc limit ${limit}`);
    return rows.map((r) => ({ fileId: r.file_id, courseId: r.course_id, name: r.name, folder: r.folder, page: r.page, text: r.text, score: Number(r.score) }));
  };

  return {
    /** (Re)reads a document into the index. */
    async index(fileId: string): Promise<number> {
      const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
      if (!file || file.deletedAt) return 0;
      try {
        if (file.size > MAX_BYTES) throw new Error("too large for the search");
        const pages = await pagesOf(file);
        const pieces = (pages ?? []).flatMap(({ page, text }) => passages(text).map((t) => ({ page, text: t })));
        const vectors: number[][] = [];
        for (let i = 0; i < pieces.length; i += 16) {
          vectors.push(...(await embedder.embed(pieces.slice(i, i + 16).map((p) => p.text), "passage")));
        }
        await db.transaction(async (tx) => {
          await tx.delete(chunks).where(eq(chunks.fileId, fileId));
          for (let i = 0; i < pieces.length; i += 200) {
            await tx.insert(chunks).values(
              pieces.slice(i, i + 200).map((p, j) => ({ fileId, courseId: file.courseId, page: p.page, text: p.text, embedding: vectors[i + j]! })),
            );
          }
          await tx.update(files).set({ indexedAt: new Date(), indexError: null }).where(eq(files.id, fileId));
        });
        return pieces.length;
      } catch (error) {
        await db.update(files).set({ indexedAt: new Date(), indexError: String((error as Error).message ?? error) }).where(eq(files.id, fileId));
        return 0;
      }
    },

    /** Documents not yet read into the index. */
    async pending(): Promise<string[]> {
      const rows = await db.select({ id: files.id }).from(files).where(and(isNull(files.indexedAt), isNull(files.deletedAt)));
      return rows.map((r) => r.id);
    },

    /** The best passages of a subject's documents for a question. */
    async search(userId: string, courseId: string, query: string, limit = 8): Promise<SearchHit[]> {
      await requireRole(db, userId, courseId, "viewer");
      return findPassages([courseId], query, limit);
    },

    /** What matches in all the user's subjects, for the quick search. */
    async everywhere(userId: string, query: string, limit = 6) {
      const question = query.trim();
      if (question.length < 2) return { files: [], deadlines: [], tasks: [], recordings: [], notes: [], passages: [] };
      const mine = (await memberCourseIds(db, userId)).map((row) => row.id);
      const like = `%${question.replace(/[%_\\]/g, "\\$&")}%`;
      const inMine = (column: AnyColumn) => (mine.length ? inArray(column, mine) : sql`false`);
      const [foundFiles, foundDeadlines, foundTasks, foundRecordings, foundNotes, foundPassages] = await Promise.all([
        db
          .select({ id: files.id, courseId: files.courseId, name: files.name, folder: files.folder })
          .from(files)
          .where(and(inMine(files.courseId), isNull(files.deletedAt), ilike(files.name, like)))
          .limit(limit),
        db
          .select({ id: deadlines.id, courseId: deadlines.courseId, title: deadlines.title, date: deadlines.date, startsAt: deadlines.startsAt })
          .from(deadlines)
          .where(and(isNull(deadlines.deletedAt), ilike(deadlines.title, like), or(inMine(deadlines.courseId), eq(deadlines.ownerId, userId))))
          .limit(limit),
        db
          .select({ id: tasks.id, courseId: tasks.courseId, title: tasks.title })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), eq(tasks.done, false), ilike(tasks.title, like)))
          .limit(limit),
        db
          .select({ id: recordings.id, courseId: recordings.courseId, title: recordings.title, date: recordings.date })
          .from(recordings)
          .where(and(inMine(recordings.courseId), ilike(recordings.title, like)))
          .limit(limit),
        db
          .select({ courseId: courseNotes.courseId, content: courseNotes.content })
          .from(courseNotes)
          .where(and(inMine(courseNotes.courseId), ilike(courseNotes.content, like)))
          .limit(limit),
        findPassages(mine, question, limit),
      ]);
      const needle = question.toLowerCase();
      return {
        files: foundFiles,
        deadlines: foundDeadlines.map((d) => ({ ...d, startsAt: d.startsAt?.toISOString() ?? null })),
        tasks: foundTasks,
        recordings: foundRecordings,
        notes: foundNotes.flatMap((n) =>
          notesHeadings(n.content)
            .filter((section) => section.text.toLowerCase().includes(needle))
            .slice(0, 3)
            .map((section) => ({ courseId: n.courseId, title: section.title })),
        ),
        passages: foundPassages,
      };
    },

    /** How far the index of a subject is. */
    async status(courseId: string) {
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          indexed: sql<number>`count(*) filter (where ${files.indexedAt} is not null and ${files.indexError} is null)::int`,
          failed: sql<number>`count(*) filter (where ${files.indexError} is not null)::int`,
        })
        .from(files)
        .where(and(eq(files.courseId, courseId), isNull(files.deletedAt)));
      return row ?? { total: 0, indexed: 0, failed: 0 };
    },

    async forget(fileId: string) {
      await db.delete(chunks).where(eq(chunks.fileId, fileId));
      await db.update(files).set({ indexedAt: null }).where(and(eq(files.id, fileId), isNotNull(files.indexedAt)));
    },
  };
}
