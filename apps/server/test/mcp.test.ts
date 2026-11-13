import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tokenAuthenticator } from "../src/auth/identity.ts";
import { buildApp, LIMITS } from "../src/http/app.ts";
import { mcpServer, mountMcp } from "../src/mcp/server.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

/** Claude, connected as `userId`. */
async function claude(userId: string) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcpServer(w.services, w.identity(userId)).connect(serverSide);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(clientSide);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    const text = result.content[0]!.text;
    return { error: !!result.isError, text, data: result.isError ? null : JSON.parse(text) };
  };
  return { client, call };
}

describe("Claude through MCP", () => {
  it("imports a handbook: reads it page by page and submits modules in batches", async () => {
    const alex = await w.user("Alex");
    const { client, call } = await claude(alex);
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(["overview", "read_handbook", "submit_modules", "create_task", "get_calendar"]));

    const { data: program } = await call("create_program", { university: "Uni Test", name: "Testing", degree: "M.Sc." });
    const pdf = join(w.filesDir, "upload.pdf");
    await copyFile(fileURLToPath(new URL("./fixtures/handbook.pdf", import.meta.url)), pdf);
    await w.services.programs.setHandbook(alex, program.id, pdf);

    const page = await call("read_handbook", { program_id: program.id, from_page: 1 });
    expect(page.error).toBe(false);
    expect(page.data.pageCount).toBeGreaterThan(0);
    expect(page.data.text).toContain("--- Page 1 ---");

    const submitted = await call("submit_modules", {
      program_id: program.id,
      modules: [{ number: "T-1", title: "Testmodul", credits: 6, exam: "mündlich, 30 min" }],
    });
    expect(submitted.data.saved).toEqual(["T-1"]);
    expect((await call("list_modules", { program_id: program.id })).data[0]).toMatchObject({ number: "T-1", exam: "mündlich, 30 min" });
  });

  it("acts with the user's rights, not more", async () => {
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "Privat", semester: "WiSe26-27" });
    const { call } = await claude(lena);
    const answer = await call("course_details", { course_id: course.id });
    expect(answer.error).toBe(true);
    expect(answer.text).toContain("unknown_course");
  });

  it("plans and ticks off tasks", async () => {
    const alex = await w.user("Alex");
    const { call } = await claude(alex);
    const { data: task } = await call("create_task", { title: "Kapitel 4 lesen", planned_date: "2026-11-02", start_time: "10:00", estimate_minutes: 90 });
    await call("update_task", { task_id: task.id, done: true });
    expect((await call("list_tasks", { open_only: false })).data[0]).toMatchObject({ title: "Kapitel 4 lesen", done: true, startTime: "10:00" });
    const overview = await call("overview");
    expect(overview.data.openTasks).toEqual([]);
  });
});

describe("languages through MCP", () => {
  it("tells Claude the user's language and each course's, and how to use them", async () => {
    const mira = await w.user("Mira");
    await w.services.users.updateProfile(mira, { locale: "de" });
    const german = await w.services.courses.create(mira, { title: "Regelungstechnik", semester: "WiSe26-27" });
    await w.services.users.updateProfile(mira, { locale: "en" });
    const { client, call } = await claude(mira);

    const instructions = client.getInstructions() ?? "";
    expect(instructions).toContain("talk to the user in their language");
    expect(instructions).toContain("course's language");
    // Exam hints are recognised in both languages.
    expect(instructions).toContain("this will be on the exam");
    expect(instructions).toContain("kommt in der Klausur dran");

    expect((await call("get_profile")).data.locale).toBe("en");
    expect((await call("overview")).data.user.locale).toBe("en");
    expect((await call("list_courses")).data.find((c: { id: string }) => c.id === german.id).locale).toBe("de");
    expect((await call("course_details", { course_id: german.id })).data.course.locale).toBe("de");

    // A course Claude creates speaks the user's language.
    const { data: created } = await call("create_course", { semester: "WiSe26-27", title: "Control Engineering" });
    expect(created.locale).toBe("en");
    expect((await call("create_course", { semester: "WiSe26-27" })).error).toBe(true);
  });
});

describe("the HTTP side", () => {
  it("asks MCP clients to sign in and tells them where", async () => {
    const app = await buildApp(w.services, { extend: (instance) => mountMcp(instance, w.services) });
    const denied = await app.inject({ method: "POST", url: "/mcp", payload: {} });
    expect(denied.statusCode).toBe(401);
    expect(denied.headers["www-authenticate"]).toContain('resource_metadata="https://study.test/.well-known/oauth-protected-resource"');
    const metadata = (await app.inject({ url: "/.well-known/oauth-protected-resource" })).json();
    expect(metadata).toMatchObject({ resource: "https://study.test/mcp", authorization_servers: ["https://study.test/auth/v1"] });

    const alex = await w.user("Alex");
    const list = await app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: `Bearer user:${alex}`, accept: "application/json, text/event-stream", "content-type": "application/json" },
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().result.tools.length).toBeGreaterThan(10);

    expect((await app.inject({ url: "/api/courses" })).json()).toMatchObject({ code: "not_signed_in" });
    await app.close();
  });

  it("serves file contents in byte ranges to members only", async () => {
    const app = await buildApp(w.services);
    const alex = await w.user("Alex");
    const lena = await w.user("Lena");
    const course = await w.services.courses.create(alex, { title: "PDFs", semester: "WiSe26-27" });
    const file = await w.services.files.upload(alex, course.id, "skripte", await w.upload("a.txt", "0123456789", "text/plain"));

    const part = await app.inject({ url: `/api/files/${file.id}/content`, headers: { authorization: `Bearer user:${alex}`, range: "bytes=2-5" } });
    expect([part.statusCode, part.body, part.headers["content-range"]]).toEqual([206, "2345", "bytes 2-5/10"]);
    const other = await app.inject({ url: `/api/files/${file.id}/content`, headers: { authorization: `Bearer user:${lena}` } });
    expect(other.statusCode).toBe(404);
    await app.close();
  });
});

describe("personal keys", () => {
  it("end after 90 days unless extended", async () => {
    const alex = await w.user("Alex");
    const { id } = await w.services.keys.create(alex, "Claude Code");
    const [key] = await w.services.keys.list(alex);
    const days = (new Date(key!.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(90);
    await w.client.unsafe(`update api_tokens set expires_at = now() + interval '1 day' where id = '${id}'`);
    const { expiresAt } = await w.services.keys.extend(alex, id);
    expect(Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)).toBe(90);
  });

  it("are refused once expired", async () => {
    const alex = await w.user("Alex");
    const { id, key } = await w.services.keys.create(alex, "Alt");
    const authenticator = tokenAuthenticator({ db: w.db, keys: (async () => { throw new Error("no jwt"); }) as never, issuer: "x" });
    expect(await authenticator.identify(`Bearer ${key}`)).toMatchObject({ userId: alex, via: "key" });
    await w.client.unsafe(`update api_tokens set expires_at = now() - interval '1 minute' where id = '${id}'`);
    expect(await authenticator.identify(`Bearer ${key}`)).toBeNull();
  });
});

describe("rate limits", () => {
  it("answer 429 once a user sends too many MCP requests in a minute", async () => {
    const app = await buildApp(w.services, { extend: (instance) => mountMcp(instance, w.services) });
    const alex = await w.user("Alex");
    const send = () =>
      app.inject({
        method: "POST",
        url: "/mcp",
        headers: { authorization: `Bearer user:${alex}`, accept: "application/json, text/event-stream", "content-type": "application/json" },
        payload: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      });
    let last = 200;
    for (let i = 0; i <= LIMITS.mcp; i++) last = (await send()).statusCode;
    expect(last).toBe(429);
    expect((await app.inject({ url: "/api/courses", headers: { authorization: `Bearer user:${alex}` } })).statusCode).toBe(200);
    await app.close();
  });
});

describe("files from a subject", () => {
  it("are never served as a page the browser would run", async () => {
    const app = await buildApp(w.services);
    const alex = await w.user("Alex");
    const course = await w.services.courses.create(alex, { title: "Web", semester: "WiSe26-27" });
    const page = await w.services.files.upload(alex, course.id, "sonstiges", await w.upload("evil.html", "<script>alert(1)</script>", "text/html"));
    const response = await app.inject({ url: `/api/files/${page.id}/content`, headers: { authorization: `Bearer user:${alex}` } });
    expect(response.headers["content-type"]).toBe("application/octet-stream");
    expect(response.headers["content-disposition"]).toMatch(/^attachment/);
    expect(response.headers["content-security-policy"]).toContain("sandbox");
    await app.close();
  });
});
