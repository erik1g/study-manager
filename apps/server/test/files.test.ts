import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanName } from "../src/domain/files.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("documents of a subject", () => {
  it("lie in readable folders, and a second file of the same name is numbered", async () => {
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "AT2", semester: "WiSe26-27" });
    await w.services.files.upload(alex, course.id, "skripte", await w.upload("Kapitel 1.pdf", "eins"));
    const second = await w.services.files.upload(alex, course.id, "skripte", await w.upload("Kapitel 1.pdf", "zwei"));
    expect(second.name).toBe("Kapitel 1 (2).pdf");

    const folder = join(w.filesDir, "courses", course.id, "skripte");
    expect((await readdir(folder)).sort()).toEqual(["Kapitel 1 (2).pdf", "Kapitel 1.pdf"]);
    const opened = await w.services.files.open(alex, second.id);
    expect(await readFile(opened.path, "utf8")).toBe("zwei");
  });

  it("go to the trash for 30 days and can come back", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "CV", semester: "WiSe26-27" });
    await w.services.courses.acceptInvite(lena, (await w.services.courses.createInvite(alex, course.id)).token);
    const file = await w.services.files.upload(alex, course.id, "altklausuren", await w.upload("2024.pdf", "%PDF"));

    await w.services.files.trash(lena, file.id);
    expect(await w.services.files.list(alex, course.id)).toEqual([]);
    expect((await w.services.files.trashList(alex, course.id)).map((f) => [f.name, f.deletedBy])).toEqual([["2024.pdf", "Lena"]]);
    await expect(w.services.files.open(alex, file.id)).rejects.toMatchObject({ code: "unknown_file" });

    const restored = await w.services.files.restore(alex, file.id);
    expect(restored.name).toBe("2024.pdf");
    expect(await readFile((await w.services.files.open(alex, file.id)).path, "utf8")).toBe("%PDF");

    // Purged only once the 30 days are over.
    await w.services.files.trash(alex, file.id);
    expect(await w.services.files.purge(new Date(Date.now() + 29 * 86_400_000))).toBe(0);
    expect(await w.services.files.purge(new Date(Date.now() + 31 * 86_400_000))).toBe(1);
    expect(await w.services.files.trashList(alex, course.id)).toEqual([]);
  });

  it("are renamed and moved within the subject's folders only", async () => {
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "RTES", semester: "WiSe26-27" });
    const file = await w.services.files.upload(alex, course.id, "sonstiges", await w.upload("blatt.pdf", "x"));
    const moved = await w.services.files.update(alex, file.id, { folder: "uebungen", name: "Blatt 1.pdf" });
    expect([moved.folder, moved.name]).toEqual(["uebungen", "Blatt 1.pdf"]);
    await expect(w.services.files.update(alex, file.id, { folder: "../etc" })).rejects.toMatchObject({ code: "unknown_folder" });
    expect(cleanName("../../etc/passwd")).toBe("passwd");
    expect(cleanName("a<b>:c?.pdf")).toBe("abc.pdf");
  });

  it("count against the uploader's quota", async () => {
    const admin = await w.user("Admin", true);
    const alex = await w.user("Alex");
    await w.services.users.update(admin, alex, { quotaBytes: 10 });
    const course = await w.services.courses.create(alex, { title: "Voll", semester: "WiSe26-27" });
    await w.services.files.upload(alex, course.id, "skripte", await w.upload("a.pdf", "12345678"));
    await expect(w.services.files.upload(alex, course.id, "skripte", await w.upload("b.pdf", "12345"))).rejects.toMatchObject({
      code: "quota_exceeded",
    });
  });
});
