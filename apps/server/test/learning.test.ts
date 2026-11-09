import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mcpServer } from "../src/mcp/server.ts";
import { passages } from "../src/search/search.ts";
import { fixture, world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

/** A subject Alex owns and Lena edits, Tom reads. */
async function subject() {
  const alex = await w.user("Alex");
  const lena = await w.user("Lena");
  const tom = await w.user("Tom");
  const course = await w.services.courses.create(alex, { title: "Real-time Systems", semester: "WiSe26-27" });
  await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);
  await w.services.courses.acceptInvite(tom, (await w.services.courses.createInvite(alex, course.id, "viewer")).token);
  return { alex, lena, tom, course };
}

describe("shared notes", () => {
  it("are edited like a wiki: a save against an old version is refused with the current text", async () => {
    const { alex, lena, tom, course } = await subject();
    const fresh = await w.services.notes.get(tom, course.id);
    expect(fresh.version).toBe(0);
    expect(fresh.content).toContain("# Notizen · Real-time Systems");

    const first = await w.services.notes.save(alex, course.id, fresh.content + "\nAlex war hier.\n", 0);
    expect(first.version).toBe(1);
    // Lena loaded version 1, Alex saves version 2 in between.
    await w.services.notes.save(alex, course.id, first.content + "Nochmal Alex.\n", 1);
    const refused = await w.services.notes.save(lena, course.id, first.content + "Lena.\n", 1).catch((e) => e);
    expect(refused.code).toBe("notes_conflict");
    expect(refused.current.content).toContain("Nochmal Alex.");
    expect(refused.current.updatedBy).toBe("Alex");
    await expect(w.services.notes.save(tom, course.id, "x", 2)).rejects.toMatchObject({ code: "role_too_low" });
  });

  it("keep private notes to their writer", async () => {
    const { alex, lena, course } = await subject();
    await w.services.notes.savePrivate(lena, course.id, "Nur für mich");
    expect((await w.services.notes.getPrivate(lena, course.id)).content).toBe("Nur für mich");
    expect((await w.services.notes.getPrivate(alex, course.id)).content).toBe("");
  });

  it("get the outline of each script, which the inbox asks Claude for", async () => {
    const { alex, lena, course } = await subject();
    const k1 = await w.services.files.upload(alex, course.id, "skripte", await w.upload("Kapitel 1.pdf", "%PDF"));
    const k2 = await w.services.files.upload(alex, course.id, "skripte", await w.upload("Kapitel 2.pdf", "%PDF"));
    let inbox = await w.services.inbox.items(lena);
    expect(inbox.filter((i) => i.courseId === course.id).map((i) => [i.kind, i.title])).toEqual([
      ["outline", "Kapitel 1.pdf"],
      ["outline", "Kapitel 2.pdf"],
    ]);
    // Out of order: the second script's chapters still come after the first's.
    await w.services.notes.applyOutline(lena, course.id, { script: k2.id, chapters: [{ title: "2 Scheduling", page: 1 }] });
    await w.services.notes.applyOutline(lena, course.id, { script: k1.id, chapters: [{ title: "1 Intro", page: 1, sections: [{ title: "1.1 Begriffe", page: 3 }] }] });
    const text = (await w.services.notes.get(alex, course.id)).content;
    expect(text.indexOf("## 1 Intro")).toBeLessThan(text.indexOf("## 2 Scheduling"));
    inbox = await w.services.inbox.items(lena);
    expect(inbox.filter((i) => i.courseId === course.id)).toEqual([]);
    await expect(w.services.notes.applyOutline(lena, course.id, { script: "00000000-0000-4000-8000-000000000000", chapters: [{ title: "x" }] })).rejects.toMatchObject({
      code: "not_a_script",
    });
  });
});

describe("lectures", () => {
  it("are shared, read in parts, and evaluated into the notes once", async () => {
    const { alex, lena, tom, course } = await subject();
    const script = await w.services.files.upload(alex, course.id, "skripte", await w.upload("k1.pdf", "%PDF"));
    await w.services.notes.applyOutline(alex, course.id, { script: script.id, chapters: [{ title: "1 Hyperperiode", page: 2 }] });
    const transcript = "**[00:00:00]** Willkommen.\n\n" + "Bla ".repeat(12_000) + "\n\n**[00:43:05]** Das müssen Sie in der Klausur können.";
    const id = await w.services.recordings.create(lena, course.id, { title: "VO", date: "2026-10-19", transcript, durationSeconds: 5400, language: "de" });
    await expect(w.services.recordings.create(tom, course.id, { title: "x", date: "2026-10-19", transcript: "x" })).rejects.toMatchObject({ code: "role_too_low" });

    expect((await w.services.recordings.list(tom, course.id))[0]).toMatchObject({ title: "VO", createdBy: "Lena", analysedAt: null });
    const first = await w.services.recordings.part(tom, id, 1);
    expect(first.parts).toBe(2);
    expect((await w.services.recordings.part(tom, id, 2)).text).toContain("Klausur können");
    expect((await w.services.inbox.items(alex)).some((i) => i.kind === "lecture" && i.id === id)).toBe(true);

    const [heading] = await w.services.notes.outline(alex, course.id);
    await w.services.recordings.analyse(alex, id, [
      { id: heading!.id, points: ["Hyperperiode = kgV der Perioden"], examHints: [{ quote: "Das müssen Sie in der Klausur können.", time: "00:43:05" }] },
    ]);
    const notes = (await w.services.notes.get(tom, course.id)).content;
    expect(notes).toContain("> **Vorlesung 19.10.2026** · [Transkript](");
    expect(notes).toContain("> - Hyperperiode = kgV der Perioden");
    expect(notes.split("## Prüfungsrelevant")[1]!.split("## 1 Hyperperiode")[0]).toContain("„Das müssen Sie in der Klausur können.“ → 1 Hyperperiode");
    expect((await w.services.inbox.items(alex)).some((i) => i.id === id)).toBe(false);
    expect((await w.services.recordings.list(alex, course.id))[0]!.analysedBy).toBe("Alex");
  });
});

describe("flashcards", () => {
  it("are shared, while each member learns at their own pace", async () => {
    const { alex, lena, tom, course } = await subject();
    const deck = await w.services.flashcards.createDeck(lena, course.id, "Grundbegriffe");
    for (let i = 1; i <= 25; i++) await w.services.flashcards.addCard(lena, deck.id, { front: `Frage ${i}`, back: `Antwort ${i}` });
    await expect(w.services.flashcards.addCard(tom, deck.id, { front: "x", back: "y" })).rejects.toMatchObject({ code: "role_too_low" });

    const now = new Date("2026-10-29T10:00:00Z");
    // At most 20 new cards a day.
    expect((await w.services.flashcards.queue(tom, deck.id, now)).length).toBe(20);
    const [card] = await w.services.flashcards.queue(tom, deck.id, now);
    const answer = await w.services.flashcards.review(tom, card!.id, 3, now);
    expect(new Date(answer.due) > now).toBe(true);
    // Tom's answer does not move the card for Alex.
    expect((await w.services.flashcards.cards(alex, deck.id)).find((c) => c.id === card!.id)!.due).toBeNull();
    const [tomDeck] = await w.services.flashcards.decks(tom, course.id, now);
    expect(tomDeck).toMatchObject({ cards: 25, new: 19 });
    expect((await w.services.flashcards.decks(alex, course.id, now))[0]).toMatchObject({ new: 20 });
  });

  it("from Claude wait as proposals until they are accepted", async () => {
    const { lena, course } = await subject();
    await w.services.flashcards.propose(lena, course.id, "Scheduling", [
      { front: "Was ist EDF?", back: "Earliest Deadline First" },
      { front: "RM?", back: "Rate Monotonic" },
    ]);
    const [first, second] = await w.services.flashcards.proposals(lena, course.id);
    await w.services.flashcards.accept(lena, first!.id, { front: "Was ist EDF?", back: "Earliest Deadline First: kürzeste Frist zuerst" });
    await w.services.flashcards.reject(lena, second!.id);
    expect(await w.services.flashcards.proposals(lena, course.id)).toEqual([]);
    const [deck] = await w.services.flashcards.decks(lena, course.id);
    expect(deck!.name).toBe("Scheduling");
    expect((await w.services.flashcards.cards(lena, deck!.id)).map((c) => c.back)).toEqual(["Earliest Deadline First: kürzeste Frist zuerst"]);
  });
});

describe("search", () => {
  it("finds passages by their words, with the page, and leaves out the trash", async () => {
    const { alex, tom, course } = await subject();
    const notes = await w.services.files.upload(
      alex,
      course.id,
      "sonstiges",
      await w.upload("scheduling.md", "Der Earliest-Deadline-First-Algorithmus plant die Aufgabe mit der frühesten Frist zuerst ein. Er ist optimal für unabhängige Aufgaben.", "text/markdown"),
    );
    const other = await w.services.files.upload(alex, course.id, "sonstiges", await w.upload("mensa.txt", "Heute gibt es Spätzle in der Mensa.", "text/plain"));
    expect(await w.services.search.index(notes.id)).toBe(1);
    await w.services.search.index(other.id);
    const hits = await w.services.search.search(tom, course.id, "Frist Algorithmus");
    expect(hits[0]).toMatchObject({ fileId: notes.id, name: "scheduling.md", page: null });
    await w.services.files.trash(alex, notes.id);
    expect((await w.services.search.search(tom, course.id, "Frist Algorithmus")).some((h) => h.fileId === notes.id)).toBe(false);
    expect(await w.services.search.status(course.id)).toMatchObject({ total: 1, indexed: 1 });
  });

  it("cuts long pages into overlapping passages at sentence ends", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Satz Nummer ${i} handelt von etwas.`).join(" ");
    const parts = passages(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 900)).toBe(true);
    expect(parts[0]!.endsWith(".")).toBe(true);
  });
});

describe("Claude working through the inbox", () => {
  it("outlines a script and evaluates a lecture through MCP", async () => {
    const { lena, course } = await subject();
    const script = await w.services.files.upload(lena, course.id, "skripte", await w.upload("VL.md", "# 1 Einführung\nText", "text/markdown"));
    const recording = await w.services.recordings.create(lena, course.id, { title: "VO 1", date: "2026-10-12", transcript: "**[00:10:00]** Merken Sie sich das für die Prüfung." });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await mcpServer(w.services, w.identity(lena)).connect(serverSide);
    const client = new Client({ name: "test", version: "1" });
    await client.connect(clientSide);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
      if (result.isError) throw new Error(result.content[0]!.text);
      return JSON.parse(result.content[0]!.text);
    };

    const inbox = await call("work_inbox");
    expect(inbox.map((i: { kind: string }) => i.kind).sort()).toEqual(["lecture", "outline"]);
    await call("submit_outline", { course_id: course.id, script_file_id: script.id, chapters: [{ title: "1 Einführung", page: 1, sections: [] }] });
    const outline = await call("notes_outline", { course_id: course.id });
    const chapter = outline.find((h: { title: string }) => h.title === "1 Einführung");
    const transcript = await call("read_transcript", { recording_id: recording });
    expect(transcript.text).toContain("Prüfung");
    const result = await call("submit_lecture_notes", {
      recording_id: recording,
      sections: [{ id: chapter.id, points: ["Überblick"], exam_hints: [{ quote: "Merken Sie sich das für die Prüfung.", time: "00:10:00" }] }],
    });
    expect(result).toMatchObject({ ok: true, examHints: 1 });
    expect(await call("work_inbox")).toEqual([]);
    const notes = await call("get_notes", { course_id: course.id });
    expect(notes.shared).toContain("⚠️ „Merken Sie sich das für die Prüfung.“ → 1 Einführung");
  });
});

describe("the quick search", () => {
  it("finds things across the user's subjects and nothing of others", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const mine = await w.services.courses.create(alex, { title: "Regelung", semester: "WiSe26-27" });
    const theirs = await w.services.courses.create(lena, { title: "Fremd", semester: "WiSe26-27" });
    await w.services.files.upload(alex, mine.id, "skripte", await w.upload("Beobachter.pdf", "%PDF"));
    await w.services.files.upload(lena, theirs.id, "skripte", await w.upload("Beobachter fremd.pdf", "%PDF"));
    await w.services.planning.createDeadline(alex, { courseId: mine.id, title: "Beobachter abgeben", allDay: true, date: "2027-01-10" });
    await w.services.planning.createTask(alex, { courseId: mine.id, title: "Beobachter lernen" });
    await w.services.notes.save(alex, mine.id, "# Notizen\n\n## 5 Beobachter\n<!-- id: b -->\nSchätzt Zustände.\n\n## 6 Anderes\n<!-- id: a -->\nText", 0);
    const found = await w.services.search.everywhere(alex, "beobachter");
    expect(found.files.map((f) => f.name)).toEqual(["Beobachter.pdf"]);
    expect(found.deadlines.map((d) => d.title)).toEqual(["Beobachter abgeben"]);
    expect(found.tasks.map((t) => t.title)).toEqual(["Beobachter lernen"]);
    expect(found.notes).toEqual([{ courseId: mine.id, title: "5 Beobachter" }]);
    expect((await w.services.search.everywhere(alex, "x")).files).toEqual([]);
  });
});

describe("Word documents", () => {
  it("are read into the search like PDFs", async () => {
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "Labor", semester: "WiSe26-27" });
    const report = await w.services.files.upload(
      alex,
      course.id,
      "uebungen",
      await w.upload("bericht.docx", await fixture("bericht.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    );
    expect(await w.services.search.index(report.id)).toBe(1);
    const hits = await w.services.search.search(alex, course.id, "Zustandsbeobachter Geschwindigkeit");
    expect(hits[0]).toMatchObject({ fileId: report.id, page: null });
    expect(hits[0]!.text).toContain("Anstiegszeit");
  });
});
