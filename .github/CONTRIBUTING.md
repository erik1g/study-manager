# Mitmachen

Danke, dass du den Study Manager besser machen willst! Das Projekt ist für alle Studierenden gedacht, und jede Hilfe zählt: Fehler melden, Dokumentation verbessern, eine Uni anbinden oder ein Feature bauen.

Die ausführliche Anleitung steht in der Entwickler-Dokumentation: **https://erik1g.github.io/study-manager/entwickler/mitmachen**. Hier das Wichtigste in Kürze.

## Bevor du anfängst

- Suche bei den [Issues](https://github.com/erik1g/study-manager/issues), ob es das Thema schon gibt. Mit einem Kommentar „Ich übernehme das“ vermeidest du doppelte Arbeit.
- Bei größeren Änderungen eröffne zuerst ein Issue und besprich die Idee. So verlierst du keine Arbeit an einer Änderung, die nicht ins Projekt passt.
- Einsteigerfreundliche Aufgaben tragen das Label `good first issue`.

## Lokal starten

```sh
pnpm install
ADMIN_EMAIL=du@example.org DOMAIN=localhost node infra/scripts/setup.mjs
docker compose --project-directory . -f infra/compose/dev.yml up -d
```

Alle Schritte, Tests und Hinweise stehen in der Entwickler-Dokumentation.

## Wohin dein Pull Request geht

Alles für die nächste Version sammelt sich in **`dev`**, dem Default-Branch. Forke das Repository, zweige deinen Branch von `dev` ab und öffne deinen Pull Request **gegen `dev`**, auch für Fehlerbehebungen. `main` ist immer der veröffentlichte Stand und bekommt nur Pull Requests von `dev`; ein Pull Request gegen `main` wird von der CI abgelehnt.

`dev` muss **immer releasefähig** sein. Öffne Unfertiges darum als **Draft-PR**; gemergt wird erst, wenn es fertig ist und alle Prüfungen grün sind.

## Commits und Pull Requests

Wir nutzen [Conventional Commits](https://www.conventionalcommits.org/de/v1.0.0/); daraus entstehen Versionsnummern und Changelog automatisch (mit `release-please`):

| Präfix | Wofür | Wirkung auf die Version |
|---|---|---|
| `feat:` | neue Funktion | Minor (`0.1.0` → `0.2.0`) |
| `fix:` | Fehlerbehebung | Patch (`0.1.0` → `0.1.1`) |
| `perf:` | schneller | Patch |
| `docs:`, `test:`, `chore:`, `refactor:`, `ci:`, `style:`, `build:` | alles andere | kein neues Release allein |
| `feat!:` oder `BREAKING CHANGE:` im Text | Änderung, die bestehende Installationen bricht | Major (ab 1.0), davor Minor |

Beispiel: `fix(planung): Wochenansicht auf dem Handy wischbar machen`

- Ein Pull Request = eine Sache. Der **Titel** folgt dem Format oben (er wird beim Mergen der Commit-Titel).
- Die CI muss grün sein: Typprüfung, Tests, UI-Prüfung, Build und die Playwright-Tests.
- Bei Änderungen an der Oberfläche gehören **Screenshots oder ein kurzes Video** in den Pull Request.
- Schreibe Tests für neues Verhalten und aktualisiere die Dokumentation.
- Mit deinem Beitrag stimmst du zu, dass er unter der **GPL-3.0** des Projekts steht. Eine weitere Vereinbarung ist nicht nötig.

## Verhaltenskodex

Wir halten uns an den [Verhaltenskodex](CODE_OF_CONDUCT.md). Sicherheitslücken meldest du bitte privat (siehe [SECURITY.md](SECURITY.md)).
