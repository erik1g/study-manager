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
docker compose -f docker-compose.dev.yml up -d
```

Alle Schritte, Tests und Hinweise stehen in der Entwickler-Dokumentation.

## Commits und Pull Requests

Wir nutzen [Conventional Commits](https://www.conventionalcommits.org/de/v1.0.0/); daraus entstehen Versionsnummern und Changelog automatisch (mit `release-please`):

| Präfix | Wofür | Wirkung auf die Version |
|---|---|---|
| `feat:` | neue Funktion | Minor (`0.1.0` → `0.2.0`) |
| `fix:` | Fehlerbehebung | Patch (`0.1.0` → `0.1.1`) |
| `docs:`, `test:`, `chore:`, `refactor:`, `ci:`, `perf:`, `style:`, `build:` | alles andere | kein neues Release allein |
| `feat!:` oder `BREAKING CHANGE:` im Text | Änderung, die bestehende Installationen bricht | Major (ab 1.0), davor Minor |

Beispiel: `fix(planung): Wochenansicht auf dem Handy wischbar machen`

- Ein Pull Request = eine Sache. Der **Titel** folgt dem Format oben (er wird beim Mergen der Commit-Titel).
- Die CI muss grün sein (Typprüfung, Tests, UI-Prüfung, Build; für größere Änderungen auch Playwright).
- Schreibe Tests für neues Verhalten und aktualisiere die Dokumentation.
- Mit deinem Beitrag stimmst du zu, dass er unter der **GPL-3.0** des Projekts steht. Eine weitere Vereinbarung ist nicht nötig.

## Verhaltenskodex

Wir halten uns an den [Verhaltenskodex](CODE_OF_CONDUCT.md). Sicherheitslücken meldest du bitte privat (siehe [SECURITY.md](SECURITY.md)).
