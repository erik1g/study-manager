// Puts a few modules into a programme of the test stack (there is no HTTP route for it, handbooks come in
// through the import): `pnpm exec tsx src/cli/seed-test-modules.ts <userId> <programId>`.
import { loadConfig } from "../config.ts";
import { createDb } from "../db/client.ts";
import { programsOf } from "../domain/programs.ts";

const [userId, programId] = process.argv.slice(2);
const config = loadConfig();
const { db, client } = createDb(config.DATABASE_URL);
const long = (what: string) => Array.from({ length: 30 }, (_, i) => `${what} ${i + 1}: ein langer Satz, damit die Karte höher ist als jeder Bildschirm.`).join("\n");
await programsOf(db, config.FILES_DIR).upsertModules(userId!, programId!, [
  { number: "ME-101", title: "Technische Mechanik I", credits: 6, language: "Deutsch", turnus: "jedes Wintersemester", contents: long("Inhalt"), learningGoals: long("Lernziel"), exam: "Klausur, 120 Minuten" },
  { number: "ME-102", title: "Werkstoffkunde", credits: 5, contents: "Metalle, Kunststoffe, Keramik" },
  { number: "ME-103", title: "Regelungstechnik", credits: 6, contents: "Regelkreise, Bode-Diagramme" },
]);
await client.end();
