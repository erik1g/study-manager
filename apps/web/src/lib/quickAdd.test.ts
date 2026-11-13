import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quickAdd";

const courses = [
  { id: "a", title: "Regelungstechnik" },
  { id: "b", title: "Eingebettete Systeme" },
];
const now = new Date(2026, 10, 2, 10, 0); // Monday
const parse = (text: string, current: string | null = null) => parseQuickAdd(text, courses, current, now);

describe("the quick add sentence", () => {
  it("reads a deadline with a date", () => {
    expect(parse("Deadline Laborbericht 3 am 19.11.")).toEqual({ kind: "deadline", title: "Laborbericht 3", date: "2026-11-19", time: null, courseId: null });
  });
  it("needs a date for a deadline, not for a todo", () => {
    expect(parse("Deadline Laborbericht")).toBeNull();
    expect(parse("Todo Blatt 5 rechnen")).toMatchObject({ kind: "task", title: "Blatt 5 rechnen", date: null });
  });
  it("understands words for days, weekdays and times", () => {
    expect(parse("Todo Lesen morgen um 14 Uhr")).toMatchObject({ title: "Lesen", date: "2026-11-03", time: "14:00" });
    expect(parse("Todo Lesen am Freitag")).toMatchObject({ date: "2026-11-06" });
    expect(parse("Todo Lesen Montag")).toMatchObject({ date: "2026-11-09" });
  });
  it("takes a date that has passed as next year", () => {
    expect(parse("Klausur Thermo am 10.2.")).toMatchObject({ title: "Klausur Thermo", date: "2027-02-10" });
    expect(parse("Abgabe Bericht am 12.1.2027")).toMatchObject({ title: "Abgabe Bericht", date: "2027-01-12" });
  });
  it("finds the subject in the text, else the one open", () => {
    expect(parse("Deadline Bericht Regelungstechnik am 19.11.")).toMatchObject({ title: "Bericht", courseId: "a" });
    expect(parse("Todo Eingebettete Übung wiederholen")).toMatchObject({ courseId: "b", title: "Eingebettete Übung wiederholen" });
    expect(parse("Todo Lesen", "b")).toMatchObject({ courseId: "b" });
  });
  it("understands the same in English", () => {
    expect(parse("Deadline Lab report 3 on 19/11")).toEqual({ kind: "deadline", title: "Lab report 3", date: "2026-11-19", time: null, courseId: null });
    expect(parse("To-do Read chapter 2 tomorrow at 2pm")).toMatchObject({ kind: "task", title: "Read chapter 2", date: "2026-11-03", time: "14:00" });
    expect(parse("Task Read on Friday at 9:30")).toMatchObject({ date: "2026-11-06", time: "09:30" });
    expect(parse("Todo Read the day after tomorrow")).toMatchObject({ title: "Read", date: "2026-11-04" });
    expect(parse("Exam Thermo on 10/2")).toMatchObject({ title: "Exam Thermo", date: "2027-02-10" });
    expect(parse("Submission Report on 12/1/2027")).toMatchObject({ title: "Submission Report", date: "2027-01-12" });
    expect(parse("Todo Read at 12am")).toMatchObject({ time: "00:00" });
    expect(parse("Todo Read at 13pm")).toMatchObject({ title: "Read at 13pm", time: null });
  });
  it("reads übermorgen as two days, not as morgen", () => {
    expect(parse("Todo Lesen übermorgen")).toMatchObject({ title: "Lesen", date: "2026-11-04" });
  });
  it("leaves other text alone", () => {
    expect(parse("Regelungstechnik")).toBeNull();
    expect(parse("Deadline am 19.11.")).toBeNull();
  });
});
