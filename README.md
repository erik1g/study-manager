# Study Manager

**Dein Studium, gemütlich sortiert – und gemeinsam mit deinen Kommilitoninnen und Kommilitonen.**

Der Study Manager ist eine selbst gehostete Web-App für Studierende: Fächer mit Skripten, Übungen und Altklausuren, geteilte Deadlines, private Aufgaben mit Zeitplanung, Stundenplan-Abos, gemeinsame Notizen neben dem Skript, Vorlesungsmitschriften, Lernkarten und eine Suche. Dazu gibt es einen MCP-Server, über den **dein eigenes Claude** mit allem arbeiten kann. Die App selbst rechnet keine KI: Was Claude erledigen soll, steht in einem Arbeitseingang, den es sich per MCP holt.

Freie Software unter der [GPL-3.0](LICENSE). Gemacht von Studierenden für Studierende – und offen für alle, die mitmachen wollen.

## Was sie kann

- **Fächer** mit Rollen (Besitzer, Bearbeiter, Leser): Dokumente, Deadlines, Mitglieder und ein Aktivitätsverlauf, gemeinsam mit der Lerngruppe.
- **Deadlines und Aufgaben**: geteilte Fristen im Fach, jeder hakt für sich ab; private Aufgaben mit Tag, Uhrzeit und Dauer als Zeitblock im Kalender.
- **Planung**: Wochen-, Tages- und Monatsansicht, Aufgaben per Ziehen einplanen, Kalender-Abo (iCal) für Stundenplan und Handy.
- **Vorlesungsmodus**: Skripte und Notizen im ganzen Fenster, als Tabs, nebeneinander, mit Zoom.
- **Notizen** neben dem Skript, die der Skriptseite folgen; gemeinsam oder privat.
- **Vorlesungen** mitschreiben lassen (Whisper im Browser oder mit eigenem Schlüssel) und mit Claude auswerten.
- **Lernkarten** mit Wiederholungsplan, **Suche** in allen Dokumenten (nach Bedeutung und Wortlaut).
- **Studiengänge und Modulhandbuch**: das Modulhandbuch als PDF hochladen, Claude liest die Module ein, Fächer entstehen aus Modulen.
- **Dein Claude** verbindet sich per MCP (Claude.ai, Claude Desktop, Claude Code) und arbeitet mit deinen Rechten.

Heute ist die Oberfläche **deutsch**, die Semester heißen `WiSe`/`SoSe`, und das Kalender-Abo versteht iCal-Feeds im Stil von CAMPUSonline. Anpassungen für andere Hochschulen und Sprachen sind willkommen (siehe unten).

## Selbst betreiben

Du brauchst einen Server mit Docker, eine Domain und einen Reverse Proxy, der HTTPS übernimmt (zum Beispiel Nginx Proxy Manager, Traefik oder ein Cloudflare Tunnel).

```sh
git clone --depth 1 https://github.com/erik1g/study-manager.git
cd study-manager
docker run --rm -e ADMIN_EMAIL=du@example.org -e DOMAIN=study.example.org \
  docker.io/erik1g/study-manager-server node /app/infra/scripts/setup.mjs --stdout > .env
docker compose pull
docker compose up -d
docker compose logs server   # beim ersten Start steht hier der Link zum Einrichten des Admin-Accounts
```

Die App hört dann auf `127.0.0.1:8080`; dein Reverse Proxy leitet deine Domain dorthin. Die ganze Anleitung (Proxy-Beispiele, Backups, Updates, Mail) steht in der **[Admin-Dokumentation](https://erik1g.github.io/study-manager/admin/)**.

## Dokumentation

**https://erik1g.github.io/study-manager/**

| Für wen | Was |
|---|---|
| [Nutzer](https://erik1g.github.io/study-manager/nutzer/) | Fächer, Deadlines, Planung, Notizen, Vorlesungsmodus, Claude verbinden |
| [Admins](https://erik1g.github.io/study-manager/admin/) | Installieren, konfigurieren, Backups, Updates, Sicherheit |
| [Entwickler](https://erik1g.github.io/study-manager/entwickler/) | Aufbau, lokal starten, Tests, Beitragen, Releases, Design-System |

## Mitmachen

Der Study Manager soll für **möglichst viele Studierende** funktionieren – dafür brauchen wir dich. Du kannst Fehler melden, Dokumentation verbessern, deine Hochschule anbinden (Stud.IP, HISinOne, ILIAS …), eine Sprache übersetzen oder ein Feature bauen. Einsteigerfreundliche Aufgaben tragen das Label [`good first issue`](https://github.com/erik1g/study-manager/labels/good%20first%20issue). Lies zuerst [CONTRIBUTING.md](CONTRIBUTING.md).

## Aufbau

| Teil | Wo |
|---|---|
| Web-App (React, Vite) | `apps/web` |
| Server und MCP-Server (Node.js 24, TypeScript, Fastify, Drizzle, pg-boss) | `apps/server` |
| Bausteine und Design („Snug Simple“) | `packages/ui` |
| Gemeinsame Typen | `packages/shared` |
| End-to-End-Tests (Playwright) | `apps/e2e` |
| Dokumentation (Docusaurus) | `apps/docs` |
| Container, Proxy, Testdaten | `infra` |

Anmeldung, Passkeys und OAuth für MCP-Clients kommen von [Supabase Auth](https://github.com/supabase/auth) (GoTrue) auf einer eigenen PostgreSQL-Datenbank; beides läuft in deinem Docker-Compose-Projekt, nicht bei Supabase.

## Lizenz

[GPL-3.0](LICENSE) – du darfst den Study Manager nutzen, ändern und weitergeben. Geänderte Versionen, die du weitergibst, müssen ebenfalls unter der GPL stehen.
