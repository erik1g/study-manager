# Study Manager – Anweisungen für Claude und Entwickler

Der Study Manager ist freie Software (GPL-3.0): eine selbst gehostete Web-App für Studierende mit Fächern, Dokumenten, geteilten Deadlines, Planung, Notizen, Vorlesungsmodus, Lernkarten und einem MCP-Server für das **eigene** Claude der Nutzer. Dieser Ordner (`.claude/`) ist der **eine Ort für alle Anweisungen an Claude und Entwickler**; Claude Code lädt ihn automatisch.

## Zuerst lesen

- Glossar (Begriffe wie Fach, Deadline, Aufgabe, Besitzer, Bearbeiter, Leser): @../CONTEXT.md
- Architekturentscheidungen liegen in `docs/adr/` (lies sie bei Fragen zum „Warum“, vor allem `0002`: keine KI auf dem Server).
- Die Doku für Nutzer, Admins und Entwickler ist `apps/docs/docs/` (Seite: https://erik1g.github.io/study-manager).

## Was wo steht

Die Regeln liegen in `.claude/rules/`. **Immer geladen:**

| Datei | Inhalt |
|---|---|
| `commits.md` | Conventional Commits, aus denen Versionen und Changelog entstehen |
| `tests.md` | Prüfbefehle, die Testdaten und der Test-Stack |
| `releases-und-sicherheit.md` | Wer veröffentlichen darf, Geheimnisse, geschützter `main`-Zweig |
| `arbeitsweise.md` | Sprache, Testdaten, wie du mit dem Nutzer und mit Änderungen umgehst |

**Nur geladen, wenn du an passenden Dateien arbeitest:**

| Datei | Gilt für |
|---|---|
| `server.md` | `apps/server/**` |
| `oberflaeche.md` | `apps/web/**`, `packages/ui/**` |
| `e2e.md` | `apps/e2e/**`, `infra/test/**` |
| `docker-und-ci.md` | `infra/**`, `.github/**`, `docker-compose*.yml` |
| `doku.md` | `apps/docs/**` |

## Dateien, die bewusst im Wurzelordner bleiben

GitHub und Werkzeuge erwarten sie dort: `README.md`, `LICENSE`, `CHANGELOG.md`, `CONTEXT.md` (das Glossar), `.github/`. In `.github/` liegen auch `CONTRIBUTING.md`, `SECURITY.md` und `CODE_OF_CONDUCT.md`; GitHub findet sie dort. Ändere sie dort, nicht hier. Wenn sich eine Regel in `.claude/rules/` und in `CONTRIBUTING.md` oder der Doku-Seite überschneidet, **halte beide aktuell**.

## Persönliches

Eigene, nicht für alle gedachte Einstellungen gehören in `CLAUDE.local.md` und `.claude/settings.local.json` (beide stehen in `.gitignore`).
