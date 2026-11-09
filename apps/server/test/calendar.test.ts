import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expandIcs, numberSessions, suggestCourse } from "../src/domain/feeds.ts";
import { fixture, world } from "./support.ts";

const window = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2027-04-01T00:00:00Z") };

describe("a university timetable", async () => {
  const sample = (await fixture("timetable-sample.ics")).toString("utf8");
  const events = expandIcs(sample, window.from, window.to);

  it("is read with its sessions, links and dropped dates", () => {
    const vision = events.filter((e) => e.title === "Image Processing VO, Standardgruppe");
    expect(vision).toHaveLength(4);
    expect(vision[0]!.startsAt.toISOString()).toBe("2026-10-12T09:30:00.000Z");
    expect(vision[0]!.endsAt > vision[0]!.startsAt).toBe(true);
    expect(vision[0]!.url).toContain("pStpSpNr=");
    expect(vision[0]!.allDay).toBe(false);

    const dropped = events.filter((e) => e.cancelled);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.notes).toBe("fix; Entfall; Termin fällt aus");
    expect(events.every((e, i) => i === 0 || events[i - 1]!.startsAt <= e.startsAt)).toBe(true);
  });

  it("repeats a recurring event once per date, leaving out the excluded one", () => {
    const meetings = events.filter((e) => e.title === "Fachschaftssitzung");
    // Every second week, four times, one excluded; 18:00 in Berlin.
    expect(meetings.map((e) => e.startsAt.toISOString())).toEqual([
      "2026-10-14T16:00:00.000Z",
      "2026-11-11T17:00:00.000Z",
      "2026-11-25T17:00:00.000Z",
    ]);
    expect(new Set(meetings.map((e) => e.uid)).size).toBe(3);
  });

  it("suggests the subject of each series only when the match is clear", () => {
    const courses = [
      { id: "cv", title: "Image Processing" },
      { id: "at2", title: "Regelungssysteme II" },
      { id: "ar", title: "Mobile Robotics" },
      { id: "ra", title: "Rechnerstrukturen und Betriebssysteme" },
      { id: "aas", title: "Ringvorlesung 'Aspekte Technischer Systeme'" },
      { id: "rtes", title: "Embedded Software Concepts" },
    ];
    const expected: [string, string | null][] = [
      ["Image Processing VO, Standardgruppe", "cv"],
      ["Regelungssysteme II - Übung UE, Standardgruppe", "at2"],
      ["Mobile Robotics - Lecture VO, Standardgruppe", "ar"],
      ["Aspekte Technischer Systeme - Vorlesung VO, Standardgruppe", "aas"],
      ["Embedded Software Concepts UE, Standardgruppe", "rtes"],
      ["Fachschaftssitzung", null],
      ["Systeme", null],
      ["VO, Standardgruppe", null],
    ];
    for (const [title, course] of expected) expect(suggestCourse(title, courses), title).toBe(course);
    const architecture = [...new Set(events.map((e) => e.title))].find((t) => t.startsWith("Rechnerstrukturen"))!;
    expect(suggestCourse(architecture, courses)).toBe("ra");
  });

  it("numbers the sessions that take place", () => {
    const vision = events.filter((e) => e.title.startsWith("Image Processing"));
    const numbered = numberSessions(vision);
    expect(numbered).toHaveLength(7);
    expect(numbered.filter((s) => s.number === null)).toHaveLength(1);
    expect(Math.max(...numbered.map((s) => s.number ?? 0))).toBe(6);
    expect(numbered.every((s) => s.total === 6)).toBe(true);
  });
});

describe("the calendar of a student", () => {
  let w: Awaited<ReturnType<typeof world>>;
  let campus: string;
  const feeds: Record<string, string> = {};
  beforeAll(async () => {
    campus = (await fixture("timetable-sample.ics")).toString("utf8");
    feeds["https://campus.example/feed.ics"] = campus;
    w = await world(feeds);
  });
  afterAll(() => w.close());

  it("subscribes a timetable, turns assigned series into sessions and plans tasks as blocks", async () => {
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "Image Processing", semester: "WiSe26-27" });
    const feed = await w.services.calendar.addFeed(alex, { name: "Uni", url: "webcal://campus.example/feed.ics" });
    expect(feed.url).toBe("https://campus.example/feed.ics");
    await expect(w.services.calendar.addFeed(alex, { name: "Falsch", url: "https://campus.example/nope.ics" })).rejects.toMatchObject({
      code: "feed_unreachable",
    });

    const series = await w.services.calendar.series(alex);
    const vo = series.find((s) => s.title === "Image Processing VO, Standardgruppe")!;
    expect(vo.suggestion).toBe(course.id);
    await w.services.calendar.assign(alex, feed.id, vo.title, course.id);

    const sessions = await w.services.calendar.sessions(alex, course.id);
    expect(sessions).toHaveLength(4);
    const between = new Date(new Date(sessions[1]!.end).getTime() + 60_000);
    const [progress] = await w.services.calendar.progress(alex, between);
    expect(progress).toMatchObject({ courseId: course.id, total: sessions.filter((s) => !s.cancelled).length });
    expect(progress!.done).toBeGreaterThanOrEqual(1);
    expect(new Date(progress!.next!.start).getTime()).toBeGreaterThan(between.getTime() - 3_600_000 * 24);
    expect(sessions[0]!.number).toBe(1);

    const task = await w.services.planning.createTask(alex, {
      courseId: course.id,
      title: "Blatt 3 rechnen",
      plannedDate: "2026-10-26",
      startTime: "14:00",
      estimateMinutes: 90,
    });
    const items = await w.services.calendar.items(alex, new Date("2026-10-19T00:00:00+02:00"), new Date("2026-10-27T00:00:00+01:00"));
    const block = items.find((i) => i.id === task.id)!;
    expect([block.kind, block.allDay, block.start, block.end]).toEqual(["task", false, "2026-10-26T13:00:00.000Z", "2026-10-26T14:30:00.000Z"]);
    expect(items.some((i) => i.kind === "session" && i.courseId === course.id)).toBe(true);
  });

  it("keeps the timetable when the link answers with something else than a calendar", async () => {
    const alex = await w.user("Alex");
    const feed = await w.services.calendar.addFeed(alex, { name: "Uni", url: "https://campus.example/feed.ics" });
    const before = await w.services.calendar.items(alex, new Date("2026-10-01"), new Date("2026-11-30"));
    feeds["https://campus.example/feed.ics"] = "<!doctype html><title>Anmeldung</title>";
    await expect(w.services.calendar.refresh(feed.id)).rejects.toThrow("kein Kalender");
    expect(await w.services.calendar.items(alex, new Date("2026-10-01"), new Date("2026-11-30"))).toHaveLength(before.length);
    expect((await w.services.calendar.feeds(alex))[0]!.error).toContain("kein Kalender");
    feeds["https://campus.example/feed.ics"] = campus;
  });

  it("brings deadlines and open tasks to the phone through the private link", async () => {
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "AT2", semester: "WiSe26-27" });
    await w.services.planning.createDeadline(alex, {
      courseId: course.id,
      title: "Klausur",
      allDay: false,
      startsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE");
    await w.services.planning.createTask(alex, { courseId: course.id, title: "Lernen", plannedDate: tomorrow, startTime: "09:00" });
    const done = await w.services.planning.createTask(alex, { courseId: null, title: "Erledigt", plannedDate: tomorrow });
    await w.services.planning.updateTask(alex, done.id, { done: true });

    const token = (await w.services.users.me(alex)).icalToken;
    const ics = (await w.services.calendar.ics(token))!;
    expect(ics).toContain("SUMMARY:AT2: Klausur");
    expect(ics).toContain("SUMMARY:☐ AT2: Lernen");
    expect(ics).not.toContain("Erledigt");
    expect(await w.services.calendar.ics("falsch")).toBeNull();

    // A new link replaces the old one.
    await w.services.users.renewIcalToken(alex);
    expect(await w.services.calendar.ics(token)).toBeNull();
  });

  it("gives one day only that day's tasks, not the next day's", async () => {
    const alex = await w.user("Alex");
    await w.services.planning.createTask(alex, { courseId: null, title: "Heute", plannedDate: "2026-11-02", startTime: "09:00", estimateMinutes: 60 });
    await w.services.planning.createTask(alex, { courseId: null, title: "Morgen", plannedDate: "2026-11-03", startTime: "09:00", estimateMinutes: 60 });
    await w.services.planning.createTask(alex, { courseId: null, title: "Morgen ganztägig", plannedDate: "2026-11-03" });
    const from = new Date("2026-11-02T00:00:00");
    const to = new Date("2026-11-03T00:00:00");
    const titles = (await w.services.calendar.items(alex, from, to)).filter((i) => i.kind === "task").map((i) => i.title);
    expect(titles).toEqual(["Heute"]);
  });
});
