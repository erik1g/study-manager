// Recurring work, queued in Postgres (pg-boss), so that nothing runs twice
// and missed runs are caught up after a restart.
import PgBoss from "pg-boss";
import type { FastifyBaseLogger } from "fastify";
import type { Services } from "../services.ts";
import { runBackup } from "./backup.ts";

const JOBS = {
  "feeds-refresh": { cron: "17 * * * *" },
  // Documents the index missed, e.g. while the server was down.
  "index-missing": { cron: "*/10 * * * *" },
  backup: { cron: "30 3 * * *" },
  "trash-purge": { cron: "45 3 * * *" },
} as const;

export async function startScheduler(databaseUrl: string, services: Services, log: FastifyBaseLogger) {
  const boss = new PgBoss({ connectionString: databaseUrl, schema: "pgboss" });
  boss.on("error", (error: Error) => log.error(error, "job queue"));
  await boss.start();
  const tz = process.env.TZ ?? "Europe/Berlin";
  for (const [name, { cron }] of Object.entries(JOBS)) {
    await boss.createQueue(name);
    await boss.schedule(name, cron, {}, { tz });
  }
  await boss.createQueue("index-file");
  services.indexLater = (fileId) => void boss.send("index-file", { fileId }, { singletonKey: fileId }).catch(() => {});
  // One document at a time: reading and embedding is heavy for the processor.
  await boss.work<{ fileId: string }>("index-file", { batchSize: 1 }, async ([job]) => {
    if (!job) return;
    const passages = await services.search.index(job.data.fileId);
    log.info({ fileId: job.data.fileId, passages }, "indexed");
  });
  await boss.work("index-missing", async () => {
    for (const fileId of await services.search.pending()) services.indexLater(fileId);
  });
  await boss.work("feeds-refresh", async () => {
    await services.calendar.refreshAll();
  });
  await boss.work("backup", async () => {
    const result = await runBackup();
    log.info(result, "backup done");
  });
  await boss.work("trash-purge", async () => {
    const removed = await services.files.purge();
    log.info({ removed }, "trash purged");
    const pruned = await services.activity.prune();
    log.info({ pruned }, "old activity pruned");
  });
  // Once right after start, so that a fresh server has its calendars and index.
  await boss.send("feeds-refresh", {});
  await boss.send("index-missing", {});
  return boss;
}
