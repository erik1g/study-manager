import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/http/app.ts";
import { mountMcp } from "../src/mcp/server.ts";
import { world } from "./support.ts";

type World = Awaited<ReturnType<typeof world>>;
let w: World;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

/** A subject of Alex's that Lena edits too. */
async function shared() {
  const alex = await w.user("Alex");
  const lena = await w.user("Lena");
  const course = await w.services.courses.create(alex, { title: "Regelungstechnik", semester: "WiSe26-27" });
  await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);
  return { alex, lena, course };
}

describe("the activity of a subject", () => {
  it("shows who uploaded, renamed and deleted a file, and how a deadline changed", async () => {
    const { alex, lena, course } = await shared();
    const file = await w.services.files.upload(lena, course.id, "skripte", await w.upload("kap1.pdf", "%PDF"));
    await w.services.files.update(alex, file.id, { name: "Kapitel 1.pdf", folder: "uebungen" });
    await w.services.files.trash(lena, file.id);
    const exam = await w.services.planning.createDeadline(alex, { courseId: course.id, title: "Klausur", allDay: true, date: "2027-02-10" });
    await w.services.planning.updateDeadline(lena, exam.id, { courseId: course.id, title: "Klausur", allDay: true, date: "2027-02-17" });

    const entries = await w.services.activity.ofCourse(lena, course.id);
    expect(entries.map((e) => [e.actorName, e.action, e.subject])).toEqual([
      ["Lena", "deadline.changed", "Klausur"],
      ["Alex", "deadline.created", "Klausur"],
      ["Lena", "file.deleted", "Kapitel 1.pdf"],
      ["Alex", "file.moved", "Kapitel 1.pdf"],
      ["Alex", "file.renamed", "Kapitel 1.pdf"],
      ["Lena", "file.uploaded", "kap1.pdf"],
      ["Lena", "member.joined", "Lena"],
      ["Alex", "course.created", "Regelungstechnik"],
    ]);
    expect(entries[0]!.details).toEqual({ date: ["2027-02-10", "2027-02-17"] });
    expect(entries.every((e) => e.via === "app")).toBe(true);
  });

  it("is only for members, and leaves private deadlines and tasks out", async () => {
    const { alex, course } = await shared();
    const tom = await w.user("Tom");
    await expect(w.services.activity.ofCourse(tom, course.id)).rejects.toMatchObject({ code: "unknown_course" });
    await w.services.planning.createDeadline(alex, { courseId: null, title: "Privat", allDay: true, date: "2027-01-01" });
    await w.services.planning.createTask(alex, { courseId: course.id, title: "Lesen" });
    expect((await w.services.activity.all({ actorId: alex })).map((e) => e.action)).toEqual(["course.created"]);
  });

  it("counts a stretch of note edits as one entry", async () => {
    const { alex, course } = await shared();
    let notes = await w.services.notes.get(alex, course.id);
    for (const text of ["# A", "# AB", "# ABC"]) notes = await w.services.notes.save(alex, course.id, text, notes.version);
    const edits = (await w.services.activity.ofCourse(alex, course.id)).filter((e) => e.action === "notes.edited");
    expect(edits).toHaveLength(1);
    expect(edits[0]!.count).toBe(3);
  });

  it("marks what Claude did in the user's name", async () => {
    const { alex, course } = await shared();
    const app = await buildApp(w.services, { extend: (instance) => mountMcp(instance, w.services) });
    const made = await app.inject({
      method: "POST",
      url: "/api/deadlines",
      headers: { authorization: `Bearer key:${alex}` },
      payload: { courseId: course.id, title: "Abgabe", allDay: true, date: "2027-01-15" },
    });
    expect(made.statusCode).toBe(200);
    const call = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: `Bearer key:${alex}`, accept: "application/json, text/event-stream", "content-type": "application/json" },
      payload: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_deadline", arguments: { course_id: course.id, title: "Test", all_day: true, date: "2027-01-20" } } },
    });
    expect(call.statusCode).toBe(200);
    const [latest, before] = await w.services.activity.ofCourse(alex, course.id);
    expect([latest!.subject, latest!.via, before!.subject, before!.via]).toEqual(["Test", "claude", "Abgabe", "claude"]);
    await app.close();
  });
});

describe("deleting one's own account", () => {
  it("asks to hand over shared subjects first, and keeps what others share", async () => {
    const { alex, lena, course } = await shared();
    const own = await w.services.courses.create(alex, { title: "Nur meins", semester: "WiSe26-27" });
    await w.services.files.upload(alex, course.id, "skripte", await w.upload("a.pdf", "%PDF"));
    const email = (await w.services.users.me(alex)).email;

    const check = await w.services.users.deletionCheck(alex);
    expect(check.handOver.map((h) => [h.title, h.successor.displayName])).toEqual([["Regelungstechnik", "Lena"]]);
    expect(check.alone.map((a) => a.title)).toEqual(["Nur meins"]);
    await expect(w.services.users.deleteSelf(alex, email)).rejects.toMatchObject({ code: "hand_over_first" });
    await expect(w.services.users.deleteSelf(alex, "falsch@example.org")).rejects.toMatchObject({ code: "email_mismatch" });

    await w.services.courses.setRole(alex, course.id, lena, "owner");
    await w.services.users.deleteSelf(alex, email);

    expect((await w.services.files.list(lena, course.id)).map((f) => f.name)).toEqual(["a.pdf"]);
    expect((await w.services.courses.members(lena, course.id)).map((m) => m.displayName)).toEqual(["Lena"]);
    const upload = (await w.services.activity.ofCourse(lena, course.id)).find((e) => e.action === "file.uploaded");
    expect(upload).toMatchObject({ actorId: null, actorName: null });
    await expect(w.services.courses.get(lena, own.id)).rejects.toMatchObject({ code: "unknown_course" });
  });

  it("is not open to the last admin", async () => {
    const admin = await w.user("Chef", true);
    expect((await w.services.users.deletionCheck(admin)).lastAdmin).toBe(true);
    await expect(w.services.users.deleteSelf(admin, (await w.services.users.me(admin)).email)).rejects.toMatchObject({ code: "last_admin" });
    await expect(w.services.users.update(admin, admin, { isAdmin: false })).rejects.toMatchObject({ code: "cannot_demote_self" });
  });
});

describe("the profile", () => {
  it("keeps studies and semester and a picture that only goes with the person", async () => {
    const alex = await w.user("Alex");
    await w.services.users.updateProfile(alex, { studies: "KIT · Maschinenbau B.Sc.", semester: 5 });
    await expect(w.services.users.updateProfile(alex, { semester: 0 })).rejects.toMatchObject({ code: "invalid_study_semester" });
    const upload = await w.upload("me.webp", "RIFFxxxxWEBP", "image/webp");
    await w.services.users.setAvatar(alex, upload);
    const me = await w.services.users.me(alex);
    expect([me.studies, me.semester, me.avatarVersion]).toEqual(["KIT · Maschinenbau B.Sc.", 5, 1]);
    expect((await w.services.users.avatar(alex))?.mime).toBe("image/webp");
    await expect(w.services.users.setAvatar(alex, await w.upload("x.pdf", "%PDF", "application/pdf"))).rejects.toMatchObject({ code: "avatar_type" });
    await w.services.users.removeAvatar(alex);
    expect(await w.services.users.avatar(alex)).toBeNull();
  });

  it("shows people only to those who share a subject with them", async () => {
    const { alex, lena } = await shared();
    const tom = await w.user("Tom");
    expect((await w.services.users.people(lena)).map((p) => p.id).sort()).toEqual([alex, lena].sort());
    expect((await w.services.users.people(tom)).map((p) => p.id)).toEqual([tom]);
  });
});
