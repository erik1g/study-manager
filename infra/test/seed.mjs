// Fills the test stack with invented data: Mira (admin), Jonas and Sina,
// six subjects of the current semester, deadlines, todos, notes, flashcards
// and a few files. Runs inside the test stack's server container:
//   ./infra/test/stack.sh seed
// The passwords are test values of this stack only (see PASSWORD below).
import { execFileSync } from "node:child_process";

const API = "http://localhost:3000";
const AUTH = process.env.AUTH_URL;
const SERVICE = process.env.SERVICE_ROLE_KEY;
const ANON = process.env.ANON_KEY;
export const PASSWORD = "test-passwort-mira-1";

/** The day the data is laid around: SEED_DAY (YYYY-MM-DD) for the tests, which freeze the clock there; else today. */
const BASE = process.env.SEED_DAY ? new Date(`${process.env.SEED_DAY}T12:00:00`) : new Date();
const day = (offset) => {
  const d = new Date(BASE);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("sv-SE");
};
const at = (offset, time) => new Date(`${day(offset)}T${time}:00`).toISOString();
function semester(date = new Date()) {
  const y = date.getFullYear() % 100;
  const m = date.getMonth() + 1;
  const p = (n) => String((n + 100) % 100).padStart(2, "0");
  return m >= 10 ? `WiSe${p(y)}-${p(y + 1)}` : m <= 3 ? `WiSe${p(y - 1)}-${p(y)}` : `SoSe${p(y)}`;
}

async function admin(path, method = "GET", body) {
  const res = await fetch(`${AUTH}${path}`, {
    method,
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function userId(email) {
  const { users } = await admin("/admin/users?per_page=1000");
  return users.find((u) => u.email === email)?.id;
}

/** Makes the account (by the app's own invitation) and gives it the test password. */
async function account(email, name) {
  if (!(await userId(email))) {
    execFileSync("node", ["--import", "tsx", "src/cli/invite.ts", email, name], { cwd: "apps/server", stdio: "ignore" });
  }
  const id = await userId(email);
  await admin(`/admin/users/${id}`, "PUT", { password: PASSWORD, email_confirm: true });
  const res = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const { access_token: token } = await res.json();
  const call = async (method, path, body) => {
    const isForm = body instanceof FormData;
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(isForm ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  };
  await call("PATCH", "/api/me", { displayName: name });
  return { id, call };
}

const mira = await account("mira@example.org", "Mira Hansen");
const jonas = await account("jonas@example.org", "Jonas Weber");
const sina = await account("sina@example.org", "Sina Okafor");
await mira.call("PATCH", "/api/me", { studies: "TU Musterstadt · Maschinenbau B.Sc.", semester: 5 });

// A programme with a few modules (the first one long), for the catalogue tests.
if (!(await mira.call("GET", "/api/programs")).some((p) => p.name === "Maschinenbau")) {
  const program = await mira.call("POST", "/api/programs", { university: "TU Musterstadt", name: "Maschinenbau", degree: "B.Sc.", regulation: "PO 2024" });
  execFileSync("node", ["--import", "tsx", "src/cli/seed-test-modules.ts", await userId("mira@example.org"), program.id], { cwd: "apps/server", stdio: "inherit" });
}

const existing = await mira.call("GET", "/api/courses");
if (existing.length > 0) {
  console.log("Schon gefüllt – zum Neuanfang: stack.sh reset, up, seed.");
  process.exit(0);
}

const now = semester(BASE);
const subjects = [
  ["Regelungstechnik", "blau", 6],
  ["Technische Mechanik", "orange", 5],
  ["Werkstoffkunde", "petrol", 5],
  ["Mathe III", "violett", 8],
  ["Thermodynamik", "gelb", 6],
  ["Konstruktionslehre", "gruen", 4],
];
const courses = {};
for (const [title, color, credits] of subjects) {
  const course = await mira.call("POST", "/api/courses", { semester: now, title, credits });
  await mira.call("PUT", `/api/courses/${course.id}/color`, { color });
  courses[title] = course.id;
}
// An earlier semester, to see the older subjects.
const old = await mira.call("POST", "/api/courses", { semester: "SoSe26", title: "Mathe II", credits: 8 });
await mira.call("PUT", `/api/courses/${old.id}/color`, { color: "rot" });

// Jonas and Sina study two subjects with Mira.
for (const [title, who, role] of [
  ["Regelungstechnik", jonas, "editor"],
  ["Regelungstechnik", sina, "viewer"],
  ["Mathe III", jonas, "editor"],
]) {
  const { token } = await mira.call("POST", `/api/courses/${courses[title]}/invites`, { role });
  await who.call("POST", `/api/invitations/${token}/accept`, {});
}

const deadline = (who, title, course, offset, time, notes = null) =>
  who.call("POST", "/api/deadlines", {
    courseId: course ? courses[course] : null,
    title,
    allDay: !time,
    date: time ? null : day(offset),
    startsAt: time ? at(offset, time) : null,
    endsAt: null,
    notes,
  });
await deadline(mira, "Abgabe Übungsblatt 3", "Technische Mechanik", -5, "23:59");
await deadline(mira, "Abgabe Übungsblatt 4", "Technische Mechanik", 2, "23:59");
await deadline(mira, "Laborbericht Härteprüfung", "Werkstoffkunde", 9, null, "als PDF im Fach");
await deadline(jonas, "Abgabe Übungsblatt 5", "Regelungstechnik", 3, "12:00");
await deadline(mira, "Klausur", "Regelungstechnik", 106, "09:00", "HS 21");
await deadline(mira, "Rückmeldung Semesterbeitrag", null, 14, null);

const task = (title, course, offset, startTime = null, estimateMinutes = null) =>
  mira.call("POST", "/api/tasks", { title, courseId: course ? courses[course] : null, plannedDate: offset === null ? null : day(offset), startTime, estimateMinutes });
await task("Skript Kapitel 3 lesen", "Regelungstechnik", 0, "08:00", 60);
await task("Übungsblatt 4 rechnen", "Technische Mechanik", 0, "14:00", 120);
await task("Laborprotokoll vorbereiten", "Werkstoffkunde", 0, null, 45);
await task("Bode-Diagramme wiederholen", "Regelungstechnik", -1, null, 30);
await task("Lerngruppe Mathe vorbereiten", "Mathe III", 1, "16:30", 60);
await task("Bücher zurückgeben", null, 3);
const done = await task("Mail an Prüfungsamt", null, 0);
await mira.call("PATCH", `/api/tasks/${done.id}`, { done: true });

const notes = await mira.call("GET", `/api/courses/${courses["Regelungstechnik"]}/notes`);
await jonas.call("PUT", `/api/courses/${courses["Regelungstechnik"]}/notes`, {
  version: notes.version,
  content: `# Stabilität nach Nyquist

Der geschlossene Kreis ist **stabil**, wenn die Ortskurve des offenen Kreises den kritischen Punkt $-1$ nicht umschließt.

- Phasenreserve ablesen bei $|G_0(j\\omega)| = 1$
- Amplitudenreserve bei $\\varphi = -180°$

## Offene Fragen
- Warum gilt das nur für stabile offene Kreise?
`,
});

const deck = await mira.call("POST", `/api/courses/${courses["Regelungstechnik"]}/decks`, { name: "Grundbegriffe" });
for (const [front, back] of [
  ["Was ist eine Übertragungsfunktion?", "Das Verhältnis von Ausgangs- zu Eingangssignal im Laplace-Bereich, bei Anfangswerten null."],
  ["Wann ist ein System BIBO-stabil?", "Wenn jedes beschränkte Eingangssignal ein beschränktes Ausgangssignal ergibt."],
  ["Was zeigt ein Bode-Diagramm?", "Betrag und Phase des Frequenzgangs über der Frequenz, logarithmisch."],
]) {
  await mira.call("POST", `/api/decks/${deck.id}/cards`, { front, back });
}
const maths = await mira.call("POST", `/api/courses/${courses["Mathe III"]}/decks`, { name: "Fourier-Reihen" });
await mira.call("POST", `/api/decks/${maths.id}/cards`, { front: "Wann konvergiert eine Fourier-Reihe punktweise?", back: "Bei stückweise stetig differenzierbaren Funktionen; an Sprungstellen gegen den Mittelwert." });

// A tiny but real PDF, so that the viewer has something to show.
const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 74>>stream
BT /F1 24 Tf 72 760 Td (Kapitel 4 - Frequenzgang) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;
for (const [name, folder, who] of [
  ["Skript Kapitel 4 – Frequenzgang.pdf", "skripte", mira],
  ["Übungsblatt 5.pdf", "uebungen", jonas],
  ["Altklausur WiSe 24-25.pdf", "altklausuren", mira],
]) {
  const form = new FormData();
  form.append("file", new Blob([pdf], { type: "application/pdf" }), name);
  await who.call("POST", `/api/courses/${courses["Regelungstechnik"]}/files?folder=${folder}`, form);
}

console.log(`Gefüllt: 3 Konten, ${subjects.length + 1} Fächer (Passwort in seed.mjs).`);
