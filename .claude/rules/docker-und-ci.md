---
paths:
  - "infra/**"
  - ".github/**"
  - "docker-compose*.yml"
---

# Container, Proxy und CI

## Container

- **Alle Dockerfiles** liegen in `infra/docker/`; `dev.Dockerfile` ist der Entwicklungs-Container. **Zwei Images**: `server.Dockerfile` (Node 24, `pg_dump`, Server-Code, Benutzer `node`) und `web.Dockerfile` (Caddy mit der gebauten Web-App und `infra/caddy/Caddyfile`). `pnpm` kommt per `npm install -g pnpm@12.16.1` ins Image (nicht über `corepack`).
- **Compose-Dateien:** `docker-compose.yml` ist die für **Betreiber** (nur Images, `web` auf `127.0.0.1:8080`), `infra/compose/dev.yml` für Entwickler (Quellcode eingehängt, Hot Reload), `infra/compose/test.yml` legt sich über die erste und baut die Images aus dem Checkout für den Test-Stack.
- **TLS endet am Reverse Proxy des Betreibers.** Caddy im `web`-Image spricht nur HTTP auf Port 80. Vertrauenswürdige Proxys kommen aus `TRUSTED_PROXIES`.
- **Neue Einstellung** ⇒ `.env.example`, `apps/docs/docs/admin/konfiguration.mdx` und `setup.mjs` (falls sie erzeugt wird) ergänzen.
- **Im Repository steht nichts vom Server des Maintainers:** keine Domains, IPs, Pfade, Firewall-Skripte.

## GitHub Actions (`.github/workflows`)

- **Alle Actions sind auf Commit-Hashes festgelegt** (`uses: owner/repo@<sha> # vX.Y.Z`), Dependabot ist aus: Versionen werden **von Hand** aktualisiert, vor einem Release geprüft und nicht nebenbei geändert. Neue Actions ebenso anlegen; Hash mit `gh api repos/OWNER/REPO/git/matching-refs/tags/vX` auflösen.
- **Minimale Rechte:** `permissions: {}` oder `contents: read` auf Workflow-Ebene, Schreibrechte nur im Job, der sie braucht. `actions/checkout` mit `persist-credentials: false`.
- **Veröffentlichen** nur im Original-Repo (`if: github.repository == 'erik1g/study-manager'`) und nur aus der Umgebung `release` (Release-Workflow). Siehe `releases-und-sicherheit.md`.
- **Prüfen:** `zizmor` läuft in der CI; lokal `brew install zizmor && zizmor .github`. Es darf keine Findings geben. YAML-Syntax: `ruby -ryaml -e 'YAML.load_file(ARGV[0])' datei.yml`.
- **CI** (`ci.yml`): UI-Prüfung, Typen, Unit-Tests (mit PostgreSQL-Dienst, `ALTER ROLE … search_path`), Doku- und Web-Build, zizmor. **E2E** (`e2e.yml`): Playwright gegen die gebauten Images, bei jedem Pull Request nach `dev` oder `main` (Pflicht-Prüfung) und bei anderen Pull Requests mit dem Label `e2e`. **Titel** nach Conventional Commits in `pr-title.yml` (eigener Workflow, läuft auch bei `edited`). **Quelle** in `pr-source.yml` (Pflicht auf `main`: nur `dev` oder der Release-PR). **Images** (`images-edge.yml`): `edge` und `sha-…` auf `dev`, unsigniert. **Release** (`release.yml`): release-please und der Rück-PR `main → dev` mit dem Secret `RELEASE_TOKEN`, weil PRs mit dem `GITHUB_TOKEN` keine Prüfungen starten.
