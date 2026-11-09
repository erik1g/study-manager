import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { world } from "./support.ts";

type World = Awaited<ReturnType<typeof world>>;
let w: World;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("a shared subject", () => {
  it("is made by its owner and joined through an invitation as editor", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "Automatisierungstechnik II", semester: "WiSe26-27" });
    expect(course.role).toBe("owner");

    // Lena does not see it before she joins.
    await expect(w.services.courses.get(lena, course.id)).rejects.toMatchObject({ code: "unknown_course" });

    const invite = await w.services.courses.createInvite(alex, course.id);
    expect((await w.services.courses.invitation(invite.token)).title).toBe("Automatisierungstechnik II");
    const joined = await w.services.courses.acceptInvite(lena, invite.token);
    expect(joined.role).toBe("editor");
    expect((await w.services.courses.members(alex, course.id)).map((m) => [m.displayName, m.role])).toEqual([
      ["Alex", "owner"],
      ["Lena", "editor"],
    ]);
  });

  it("lets editors share deadlines and files, and keeps readers to reading", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const tom = await w.user("Tom");
    const course = await w.services.courses.create(alex, { title: "Computer Vision", semester: "WiSe26-27" });
    await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);
    await w.services.courses.acceptInvite(tom, (await w.services.courses.createInvite(alex, course.id, "viewer")).token);

    const exam = await w.services.planning.createDeadline(lena, {
      courseId: course.id,
      title: "Klausur",
      allDay: false,
      startsAt: "2027-02-15T08:00:00+01:00",
      endsAt: "2027-02-15T10:00:00+01:00",
    });
    // Everyone in the subject sees it; only editors may change it.
    expect((await w.services.planning.deadlines(tom, { courseId: course.id })).map((d) => [d.title, d.editable])).toEqual([["Klausur", false]]);
    expect((await w.services.planning.deadlines(alex, { courseId: course.id }))[0]!.editable).toBe(true);
    await expect(w.services.planning.deleteDeadline(tom, exam.id)).rejects.toMatchObject({ code: "role_too_low" });
    await expect(w.services.files.upload(tom, course.id, "skripte", await w.upload("vl1.pdf", "%PDF"))).rejects.toMatchObject({
      code: "role_too_low",
    });

    await w.services.files.upload(lena, course.id, "skripte", await w.upload("vl1.pdf", "%PDF"));
    expect((await w.services.files.list(tom, course.id)).map((f) => [f.name, f.uploadedBy])).toEqual([["vl1.pdf", "Lena"]]);

    // The owner promotes Tom; now he may add.
    await w.services.courses.setRole(alex, course.id, tom, "editor");
    await w.services.files.upload(tom, course.id, "uebungen", await w.upload("blatt1.pdf", "%PDF"));
  });

  it("lets each member tick a shared deadline off for themselves, readers too", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const tom = await w.user("Tom");
    const outsider = await w.user("Ola");
    const course = await w.services.courses.create(alex, { title: "Mess- und Regelungstechnik", semester: "WiSe26-27" });
    await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);
    await w.services.courses.acceptInvite(tom, (await w.services.courses.createInvite(alex, course.id, "viewer")).token);
    const sheet = await w.services.planning.createDeadline(alex, { courseId: course.id, title: "Blatt 3", allDay: true, date: "2027-01-12" });

    expect((await w.services.planning.setDeadlineDone(tom, sheet.id, true)).done).toBe(true);
    expect((await w.services.planning.setDeadlineDone(tom, sheet.id, true)).done).toBe(true);
    const seen = async (who: string) => (await w.services.planning.deadlines(who, { courseId: course.id })).map((d) => [d.title, d.done]);
    expect(await seen(tom)).toEqual([["Blatt 3", true]]);
    expect(await seen(lena)).toEqual([["Blatt 3", false]]);
    expect(await seen(alex)).toEqual([["Blatt 3", false]]);

    await w.services.planning.setDeadlineDone(tom, sheet.id, false);
    expect(await seen(tom)).toEqual([["Blatt 3", false]]);
    await expect(w.services.planning.setDeadlineDone(outsider, sheet.id, true)).rejects.toMatchObject({ code: "unknown_deadline" });
  });

  it("keeps tasks private and general deadlines to their maker", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "Agentic Robotics", semester: "WiSe26-27" });
    await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);

    await w.services.planning.createTask(alex, { courseId: course.id, title: "Blatt 2 rechnen" });
    await w.services.planning.createDeadline(alex, { courseId: null, title: "Rückmeldung", allDay: true, date: "2027-01-31" });

    expect(await w.services.planning.tasks(lena)).toEqual([]);
    expect(await w.services.planning.deadlines(lena)).toEqual([]);
    expect((await w.services.planning.deadlines(alex)).map((d) => d.title)).toEqual(["Rückmeldung"]);
  });

  it("never loses its last owner", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "RTES", semester: "WiSe26-27" });
    await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);

    await expect(w.services.courses.removeMember(alex, course.id, alex)).rejects.toMatchObject({ code: "last_owner" });
    await expect(w.services.courses.setRole(alex, course.id, alex, "editor")).rejects.toMatchObject({ code: "last_owner" });
    // Lena may leave on her own, but not throw Alex out.
    await expect(w.services.courses.removeMember(lena, course.id, alex)).rejects.toMatchObject({ code: "role_too_low" });
    await w.services.courses.removeMember(lena, course.id, lena);
    expect(await w.services.courses.list(lena)).toEqual([]);
  });

  it("stays hidden from fellow students of the same programme until they are invited", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const programId = await w.services.programs.create(alex, { university: "Beispieluniversität", name: "Technische Systeme", degree: "M.Sc.", regulation: "" });
    await w.services.programs.upsertModules(alex, programId, [{ number: "21730", title: "Automatisierungstechnik II", credits: 6 }]);
    const [module] = await w.services.programs.modules(programId);
    const course = await w.services.courses.create(alex, { title: "", semester: "WiSe26-27", moduleId: module!.id });
    expect([course.title, course.number, course.credits]).toEqual(["Automatisierungstechnik II", "21730", 6]);

    await w.services.programs.setEnrolled(lena, programId, true);
    expect(await w.services.courses.list(lena)).toEqual([]);
    await expect(w.services.courses.get(lena, course.id)).rejects.toMatchObject({ code: "unknown_course" });
    expect("suggestions" in w.services.courses).toBe(false);
  });

  it("is gone for everyone when its owner deletes it", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "Alt", semester: "SoSe26" });
    await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);
    await expect(w.services.courses.remove(lena, course.id)).rejects.toMatchObject({ code: "role_too_low" });
    await w.services.courses.remove(alex, course.id);
    expect(await w.services.courses.list(lena)).toEqual([]);
  });
});

describe("module catalogues", () => {
  it("take modules in batches, report what does not fit, and only from their manager", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const programId = await w.services.programs.create(alex, { university: "KIT", name: "Informatik", degree: "B.Sc.", regulation: "SPO 2015" });

    const result = await w.services.programs.upsertModules(alex, programId, [
      { number: "M-1", title: "Grundbegriffe der Informatik", credits: 6, exam: "Klausur 120 min" },
      { number: "", title: "ohne Nummer" },
      { number: "M-2", title: "Lineare Algebra", credits: 9 },
    ]);
    expect(result.saved).toEqual(["M-1", "M-2"]);
    expect(result.rejected.map((r) => r.index)).toEqual([1]);

    // A second import replaces modules with the same number.
    await w.services.programs.upsertModules(alex, programId, [{ number: "M-1", title: "Grundbegriffe der Informatik", credits: 4 }]);
    expect((await w.services.programs.modules(programId, "grund")).map((m) => [m.number, m.credits, m.exam ?? null])).toEqual([["M-1", 4, null]]);

    await expect(w.services.programs.upsertModules(lena, programId, [{ number: "M-3", title: "x" }])).rejects.toMatchObject({ code: "not_manager" });
    await expect(
      w.services.programs.upsertModules(alex, programId, Array.from({ length: 21 }, (_, i) => ({ number: `X${i}`, title: "x" }))),
    ).rejects.toMatchObject({ code: "too_many_modules" });
  });
});

describe("the admin area", () => {
  it("invites, and does not let the admin lock themselves out", async () => {
    const admin = await w.user("Admin", true);
    const { link } = await w.services.users.invite("freund@example.org", "Freund");
    expect(link).toContain("type=invite");
    const listed = await w.services.users.list();
    const friend = listed.find((u) => u.email === "freund@example.org")!;
    expect(friend).toMatchObject({ displayName: "Freund", isAdmin: false, usedBytes: 0 });

    await expect(w.services.users.update(admin, admin, { isAdmin: false })).rejects.toMatchObject({ code: "cannot_demote_self" });
    await w.services.users.update(admin, friend.id, { quotaBytes: 1024 });
    expect((await w.services.users.list()).find((u) => u.id === friend.id)!.quotaBytes).toBe(1024);
  });

  it("hands a subject on when its only owner's account is deleted", async () => {
    const admin = await w.user("Admin", true);
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "Erbe", semester: "WiSe26-27" });
    await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);

    await w.services.users.remove(admin, alex);
    expect((await w.services.courses.get(lena, course.id)).role).toBe("owner");
  });
});

describe("invitations", () => {
  it("go out by mail when mail is set up, and as a link otherwise or when sent before", async () => {
    const mailed = await w.services.users.invite("neu@example.org", "Neu", false, true);
    expect(mailed).toMatchObject({ mailed: true, link: null });
    const again = await w.services.users.invite("neu@example.org", "Neu", false, true);
    expect(again.mailed).toBe(false);
    expect(again.link).toContain("token=");
    expect((await w.services.users.invite("ohne-mail@example.org", "Ohne", false, false)).mailed).toBe(false);
  });
});

describe("inviting people who have an account", () => {
  it("finds them, invites them into the notifications, and tells the owner the answer", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Brandt");
    const tom = await w.user("Tom");
    const course = await w.services.courses.create(alex, { title: "Robotik", semester: "WiSe26-27" });
    const inv = w.services.invitations;

    const found = await inv.findPeople(alex, course.id, "brandt");
    expect(found.map((p) => [p.displayName, p.status])).toEqual([["Brandt", null]]);
    await expect(inv.findPeople(lena, course.id, "alex")).rejects.toMatchObject({ code: "unknown_course" });

    await inv.invite(alex, course.id, lena, "viewer");
    expect((await inv.findPeople(alex, course.id, "brandt"))[0]!.status).toBe("invited");
    expect(await inv.unread(lena)).toBe(1);
    const [note] = await inv.notifications(lena);
    expect([note!.kind, note!.courseTitle, note!.actorName, note!.data]).toEqual(["course_invitation", "Robotik", "Alex", { role: "viewer", status: "open" }]);
    // Seen, but still to answer: it keeps counting.
    await inv.markRead(lena);
    expect(await inv.unread(lena)).toBe(1);

    await inv.respond(lena, course.id, true);
    expect((await w.services.courses.members(alex, course.id)).map((m) => [m.displayName, m.role])).toEqual([
      ["Alex", "owner"],
      ["Brandt", "viewer"],
    ]);
    expect(await inv.unread(lena)).toBe(0);
    expect((await inv.notifications(lena))[0]!.data.status).toBe("accepted");
    expect((await inv.notifications(alex)).map((n) => [n.kind, n.actorName])).toEqual([["invitation_accepted", "Brandt"]]);
    await expect(inv.invite(alex, course.id, lena, "editor")).rejects.toMatchObject({ code: "already_member" });

    await inv.invite(alex, course.id, tom, "editor");
    await inv.withdraw(alex, course.id, tom);
    expect((await inv.notifications(tom))[0]!.data.status).toBe("withdrawn");
    await expect(inv.respond(tom, course.id, true)).rejects.toMatchObject({ code: "unknown_invitation" });
  });

  it("lets a declined invitation leave the subject as it was", async () => {
    const alex = await w.user("Alex");
    const ola = await w.user("Ola");
    const course = await w.services.courses.create(alex, { title: "Optik", semester: "WiSe26-27" });
    await w.services.invitations.invite(alex, course.id, ola, "editor");
    await w.services.invitations.respond(ola, course.id, false);
    expect((await w.services.courses.members(alex, course.id)).map((m) => m.displayName)).toEqual(["Alex"]);
    expect((await w.services.invitations.notifications(alex))[0]!.kind).toBe("invitation_declined");
  });
});
