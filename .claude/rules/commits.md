# Commits und Versionen

Versionen und Changelog entstehen **automatisch** aus den Commit-Nachrichten (`release-please`, Semantic Versioning, Start bei `0.1.0`). Darum folgt **jeder Commit und jeder Pull-Request-Titel Conventional Commits.** Der PR-Titel wird beim Squash-Merge zum Commit-Titel, und die CI prüft ihn.

```
<typ>(<bereich>): <kurze Beschreibung, klein, ohne Punkt, deutsch oder englisch>

<optional: das Warum, wenn es nicht offensichtlich ist>

<optional: BREAKING CHANGE: was Betreiber beim Update tun müssen>
```

| Typ | Wofür | Wirkung |
|---|---|---|
| `feat` | neue Funktion | Minor (`0.1.0` → `0.2.0`) |
| `fix` | Fehlerbehebung | Patch |
| `perf` | schneller | Patch |
| `docs`, `test`, `refactor`, `style`, `build`, `ci`, `chore`, `revert` | alles andere | allein kein Release |
| `feat!`, `fix!` oder `BREAKING CHANGE:` im Text | Betreiber müssen etwas tun | vor 1.0 Minor, ab 1.0 Major |

- Setze `BREAKING CHANGE` immer dann, wenn Betreiber beim Update etwas tun müssen: neue oder geänderte Umgebungsvariable, geänderte Compose-Datei, ein Schritt außerhalb der automatischen Migration.
- Der Bereich ist optional, aber hilfreich: `planung`, `fach`, `deadlines`, `vorlesungsmodus`, `server`, `mcp`, `ui`, `docs`, `docker`, `ci` …
- **Ein Commit, eine Sache.** Mische kein Aufräumen in eine Funktion.
- **Fasse nie von Hand an:** Versionsnummern in `package.json`, `CHANGELOG.md`, `.release-please-manifest.json`. Das macht der Release-PR.
- Commit-Trailer, wenn du als Assistent committest: `Co-Authored-By: Claude <noreply@anthropic.com>` (mit dem Modellnamen, den die Sitzung vorgibt).

Beispiele:

```
feat(vorlesungsmodus): Tabs und zwei Hälften nebeneinander
fix(deadlines): Bearbeiten stürzte ab, weil Hooks nach einem return standen
docs(admin): Beispiel für Traefik ergänzt
feat(docker)!: Daten liegen jetzt in benannten Volumes

BREAKING CHANGE: Wer Ordner auf dem Host nutzt, setzt DATA_DIR und DB_DIR in der .env.
```
