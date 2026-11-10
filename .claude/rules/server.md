---
paths:
  - "apps/server/**"
---

# Server (`apps/server`)

- **Aufbau:** `src/domain/` ist die Fachlogik (eine Datei pro Bereich), `src/http/` sind dünne Fastify-Routen, `src/mcp/` der MCP-Server, `src/jobs/` zeitgesteuerte Jobs (pg-boss), `src/search/` die Suche, `src/db/` Schema und Migrationen. Die Routen und MCP rufen dieselbe Logik aus `domain/` auf.
- **Rechte:** Prüfe sie in `domain/` (`access.ts`: `requireRole`, `roleIn`; Rollen `viewer` < `editor` < `owner` aus `@study/shared`). Ein Fach, das jemand nicht sehen darf, „existiert nicht“ (`notFound`), nicht `forbidden`.
- **Deadlines:** geteilt (mit Fach: anlegen, ändern, löschen ab `editor`) oder privat (ohne Fach: nur der Besitzer). **Abhaken ist pro Nutzer** (`deadline_done`) und ändert nichts für andere.
- **Datenbank:** Drizzle. Schema in `src/db/schema.ts`, Migration mit `pnpm --filter @study/server db:generate`, danach **die erzeugte Migration prüfen und mit committen**. Der Server führt Migrationen beim Start aus (`migrateDb`). Eine Migration muss auf einer bestehenden Installation laufen.
- **Erweiterungen:** Die Suche braucht `vector`, im Schema `extensions` (legt `migrateDb` an). Migrationen schreiben `vector(384)` ohne Schema und verlassen sich auf den Suchpfad.
- **Konfiguration:** nur über `src/config.ts` (zod). Eine neue Umgebungsvariable ist eine Änderung für **Betreiber**: ergänze `.env.example`, `docker-compose.yml`, `apps/docs/docs/admin/konfiguration.mdx` und nutze `BREAKING CHANGE`, wenn sie Pflicht ist.
- **Die KI läuft nicht auf dem Server** (ADR `0002`): Claude arbeitet über MCP mit den Rechten des Nutzers; was früher automatisch lief, steht im Arbeitseingang (`domain/inbox.ts`).
- **Aus dem Image:** Der Server läuft als Benutzer `node` mit `node --import tsx src/index.ts`. Im Container gibt es kein `pnpm` zur Laufzeit; Skripte rufen `node --import tsx` auf.
- **Anfragen nach außen** (Kalender-Feeds) gehen nur an öffentliche Adressen (`publicFetch`); schwäche das nicht ab.
- **Tests:** `apps/server/test/`, gegen die echte Datenbank (siehe `tests.md`). Beispieldateien in `test/fixtures/` sind **erfunden**.
