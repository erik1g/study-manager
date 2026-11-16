import { describe, expect, it } from "vitest";
import { toMarkdown } from "./transcribe";

const segments = [{ start: 0, end: 4, text: "Guten Morgen." }];

describe("a transcript's header", () => {
  it("is in the course's language, whatever language was spoken", () => {
    const german = toMarkdown("VO 3", { title: "Regelungstechnik", locale: "de" }, "2026-11-03", "en", 5400, segments);
    expect(german).toContain("Regelungstechnik · Di., 03.11.2026 · Dauer 01:30:00 · Sprache: Englisch");
    expect(german).toContain("*Automatisch transkribiert;");

    const english = toMarkdown("Lecture 3", { title: "Control Engineering", locale: "en" }, "2026-11-03", null, 5400, segments);
    expect(english).toContain("Control Engineering · Tue, 03/11/2026 · Duration 01:30:00 · Language: detected automatically");
    expect(english).toContain("**[00:00:00]** Guten Morgen.");
  });
});
