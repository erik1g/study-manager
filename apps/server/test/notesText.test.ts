// The desktop app's tests for the notes, carried over.
import { describe, expect, it } from "vitest";
import { addSession, mergeOutline, newNotes, outlineIds, type OutlineItem, type ScriptOutline, type SessionInfo } from "../src/domain/notesText.ts";

const item = (title: string, page: number, sections: [string, number][] = []): OutlineItem => ({
  title,
  page,
  sections: sections.map(([t, p]) => ({ title: t, page: p, sections: [] })),
});
const order = ["k1", "k2", "k3"];
const outline = (script: string, chapters: OutlineItem[]): ScriptOutline => ({ script, chapters });
const titles = (text: string) => text.split("\n").filter((l) => l.startsWith("## ") || l.startsWith("### "));

describe("the notes outline", () => {
  it("puts a new file's chapters between the exam list and the catch-all", () => {
    const text = mergeOutline(newNotes("Real-time Systems", "de"), outline("k1", [item("1 Introduction", 1, [["1.1 Definitions", 4], ["1.2 Examples", 9]])]), order);
    expect(titles(text)).toEqual(["## Prüfungsrelevant", "## 1 Introduction", "### 1.1 Definitions", "### 1.2 Examples", "## Aus der Vorlesung, ohne Kapitelbezug"]);
    expect(text).toContain("## 1 Introduction\n<!-- id: k-1-introduction · skript: k1#1 -->");
    expect(text).toContain("<!-- id: k-1-1-definitions · skript: k1#4 -->");
  });

  it("adds only what is missing, where it belongs, when run again", () => {
    let text = newNotes("RTS", "de");
    text = mergeOutline(text, outline("k1", [item("1 Intro", 1, [["1.1 A", 2], ["1.3 C", 6]])]), order);
    text = mergeOutline(text, outline("k3", [item("3 Scheduling", 1)]), order);
    text = text
      .replace("### 1.1 A\n", "### 1.1 A (wichtig!)\n")
      .replace("## 3 Scheduling\n<!-- id: k-3-scheduling · skript: k3#1 -->\n", "## 3 Scheduling\n<!-- id: k-3-scheduling · skript: k3#1 -->\nMeine Notiz zu Kapitel 3.\n");
    text = mergeOutline(text, outline("k1", [item("1 Intro", 1, [["1.1 A", 2], ["1.2 B", 4], ["1.3 C", 6]])]), order);
    text = mergeOutline(text, outline("k2", [item("2 Model", 1, [["2.1 Tasks", 3]])]), order);
    const again = mergeOutline(text, outline("k2", [item("2 Model", 1, [["2.1 Tasks", 3]])]), order);

    expect(again).toBe(text);
    expect(titles(text)).toEqual([
      "## Prüfungsrelevant",
      "## 1 Intro",
      "### 1.1 A (wichtig!)",
      "### 1.2 B",
      "### 1.3 C",
      "## 2 Model",
      "### 2.1 Tasks",
      "## 3 Scheduling",
      "## Aus der Vorlesung, ohne Kapitelbezug",
    ]);
    expect(text).toContain("Meine Notiz zu Kapitel 3.");
  });
});

const session = (key: string, date: string): SessionInfo => ({ key, date, transcript: `/vorlesungen/${date.split("-").reverse().join(".")} VO` });
const withOutline = () =>
  mergeOutline(newNotes("RTS", "de"), outline("k1", [item("1 Intro", 1, [["1.1 Hyperperiod", 2], ["1.2 Tables", 5]])]), order).replace(
    "<!-- id: k-1-1-hyperperiod · skript: k1#2 -->\n",
    "<!-- id: k-1-1-hyperperiod · skript: k1#2 -->\nMeine eigene Notiz.\n",
  );

describe("a lecture in the notes", () => {
  it("adds its points and exam hints and lists the hints at the top", () => {
    const text = addSession(withOutline(), session("s-1019", "2026-10-19"), [
      { id: "k-1-1-hyperperiod", points: ["Hyperperiode = kgV aller Perioden"], examHints: [{ quote: "Das müssen Sie in der Klausur können.", time: "00:43:05" }] },
      { id: "gibt-es-nicht", points: ["Übungsgruppen ab nächster Woche"] },
    ], "de");
    const section = text.split("### 1.1 Hyperperiod")[1]!.split("### 1.2")[0]!;
    expect(section).toContain("Meine eigene Notiz.\n\n<!-- session: s-1019 -->");
    expect(section).toContain("> **Vorlesung 19.10.2026** · [Transkript](/vorlesungen/19.10.2026%20VO)");
    expect(section).toContain("> - Hyperperiode = kgV aller Perioden");
    expect(section).toContain("> ⚠️ **Prüfungsrelevant:** „Das müssen Sie in der Klausur können.“ [00:43:05]");
    const exam = text.split("## Prüfungsrelevant")[1]!.split("## 1 Intro")[0]!;
    expect(exam).toContain("- ⚠️ „Das müssen Sie in der Klausur können.“ → 1.1 Hyperperiod · Vorlesung 19.10.2026 [00:43:05]");
    expect(text.split("## Aus der Vorlesung, ohne Kapitelbezug")[1]).toContain("> - Übungsgruppen ab nächster Woche");
  });

  it("replaces only its own blocks when evaluated again", () => {
    let text = addSession(withOutline(), session("s-1019", "2026-10-19"), [{ id: "k-1-1-hyperperiod", points: ["alt"], examHints: [{ quote: "Alt" }] }], "de");
    text = addSession(text, session("s-1026", "2026-10-26"), [{ id: "k-1-2-tables", points: ["andere Sitzung"] }], "de");
    text = text.replace("Meine eigene Notiz.", "Meine eigene Notiz, ergänzt.");
    text = addSession(text, session("s-1019", "2026-10-19"), [{ id: "k-1-1-hyperperiod", points: ["neu"] }], "de");

    expect(text).toContain("> - neu");
    expect(text).not.toContain("> - alt");
    expect(text).not.toContain("„Alt“");
    expect(text).toContain("> - andere Sitzung");
    expect(text).toContain("Meine eigene Notiz, ergänzt.");
    expect(text.split("<!-- session: s-1019 -->").length - 1).toBe(1);
    expect(text).not.toContain("\n\n\n");
  });

  it("speaks the course's language", () => {
    const text = addSession(
      mergeOutline(newNotes("RTS", "en"), outline("k1", [item("1 Intro", 1)]), order),
      session("s-1019", "2026-10-19"),
      [{ id: "k-1-intro", points: ["Hyperperiod = lcm of all periods"], examHints: [{ quote: "You must know this for the exam.", time: "00:43:05" }] }],
      "en",
    );
    expect(titles(text)).toEqual(["## Exam-relevant", "## 1 Intro", "## From the lecture, without a chapter"]);
    expect(text).toContain("# Notes · RTS");
    expect(text).toContain("> **Lecture 19/10/2026** · [Transcript](");
    expect(text).toContain("> ⚠️ **Exam-relevant:** “You must know this for the exam.” [00:43:05]");
    expect(text).toContain("- ⚠️ “You must know this for the exam.” → 1 Intro · Lecture 19/10/2026 [00:43:05]");
    // The markers stay the same in every language.
    expect(text).toContain("<!-- id: ohne-kapitel -->");
  });

  it("offers the headings by id and current title", () => {
    expect(outlineIds(withOutline().replace("### 1.2 Tables", "### 1.2 Scheduling-Tabellen"))).toEqual([
      { id: "k-1-intro", title: "1 Intro" },
      { id: "k-1-1-hyperperiod", title: "1.1 Hyperperiod" },
      { id: "k-1-2-tables", title: "1.2 Scheduling-Tabellen" },
      { id: "ohne-kapitel", title: "Aus der Vorlesung, ohne Kapitelbezug" },
    ]);
  });
});
