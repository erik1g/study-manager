# Hinweise für Claude (und andere Assistenten) in diesem Repository

Das ist der Study Manager, freie Software unter der GPL-3.0. Lies zuerst `README.md`, `CONTEXT.md` (Glossar) und `CONTRIBUTING.md`. Die Entwickler-Dokumentation steht unter `apps/docs/docs/entwickler/`.

## Commits und Versionen (wichtig)

Versionen und Changelog entstehen automatisch aus den Commit-Nachrichten (`release-please`, Semantic Versioning). **Jeder Commit und jeder Pull-Request-Titel folgt deshalb Conventional Commits:**

```
<typ>(<bereich>): <kurze Beschreibung im Imperativ oder als Substantiv, deutsch oder englisch, klein, ohne Punkt>

<optional: Warum, wenn es nicht offensichtlich ist>

<optional: BREAKING CHANGE: was bestehende Installationen beachten müssen>
```

- `feat:` neue Funktion → Minor-Version
- `fix:` Fehlerbehebung → Patch-Version
- `feat!:`/`fix!:` oder `BREAKING CHANGE:` im Text → große Änderung (vor 1.0 ebenfalls Minor, ab 1.0 Major). Nutze sie nur, wenn Betreiber beim Update etwas tun müssen (z. B. neue Umgebungsvariable, Datenbankänderung ohne Migration, geänderte Compose-Datei).
- `docs:`, `test:`, `refactor:`, `perf:`, `style:`, `build:`, `ci:`, `chore:` ändern für sich allein keine Version.
- Der Bereich ist optional, aber hilfreich: `planung`, `fach`, `vorlesungsmodus`, `server`, `mcp`, `ui`, `docs`, `docker`, `ci` …
- **Ein Commit, eine Sache.** Mische kein Aufräumen in eine Funktion.
- Keine Versionsnummern, `CHANGELOG.md` oder `.release-please-manifest.json` von Hand ändern: Das macht der Release-PR.

Beispiele:

```
feat(vorlesungsmodus): Tabs und zwei Hälften nebeneinander
fix(deadlines): Bearbeiten stürzte ab, weil Hooks nach einem return standen
docs(admin): Beispiel für Traefik ergänzt
feat(docker)!: Daten liegen jetzt in benannten Volumes

BREAKING CHANGE: DATA_DIR und DB_DIR sind optional; wer Pfade nutzt, setzt sie weiter in der .env.
```

## Arbeiten im Repository

- Die Oberfläche benutzt **nur Bausteine aus `@study/ui`**: keine nackten `<button>`, `<input>`, `<select>`, `<textarea>`, keine Farben als Hex-Wert (`node infra/scripts/ui-gate.mjs` prüft das).
- Texte der Oberfläche stehen in `apps/web/src/i18n/de.ts`.
- Prüfen vor jedem Commit: `pnpm typecheck` und `pnpm test`; bei Änderungen an der Oberfläche zusätzlich `./infra/test/stack.sh e2e`.
- Die Testdaten sind erfunden; nimm in Beispielen, Tests und Doku **keine echten Personen, Hochschulen oder Zugangsdaten**.
- Antworte in der Sprache, in der der Nutzer schreibt; Commit-Titel dürfen deutsch oder englisch sein.
