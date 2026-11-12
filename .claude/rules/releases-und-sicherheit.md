# Releases, Rechte und Geheimnisse

**Niemand außer den Maintainern darf ein Release auslösen.** Der Schutz besteht aus mehreren Schichten, und du als Assistent darfst keine davon umgehen oder aufweichen.

## Was geschützt ist

- **`main`** (veröffentlichter Stand) und **`dev`** (Default-Branch, Entwicklung) sind per Ruleset geschützt: nur Pull Requests, die Prüfungen „Typen, Tests, Build“, „Titel folgt Conventional Commits“ und „Playwright“ müssen grün sein (auf `main` zusätzlich „Quelle erlaubt“), keine Force-Pushes, **keine Ausnahmen**. Du arbeitest immer in einem **Branch von `dev` und mit einem Pull Request nach `dev`**.
- **Releases** entstehen, wenn der Maintainer den Release-PR von `release-please` mergt. Die **Images** werden danach nur veröffentlicht, wenn er in der GitHub-Umgebung `release` auf „Approve“ klickt.
- **Release-Tags** (`v*`) lassen sich nicht verschieben oder löschen.

## Was du nicht tust, ohne dass der Nutzer es ausdrücklich verlangt

- den **Release-PR mergen**, Tags oder GitHub-Releases anlegen, Images veröffentlichen oder die Umgebung `release` freigeben,
- einen Pull Request `dev → main` anlegen oder mergen (das ist der Start eines Releases),
- das Secret `RELEASE_TOKEN` anlegen, lesen oder ändern,
- **Rulesets, Umgebungen, Secrets, Actions-Rechte oder Sichtbarkeit** des Repos ändern oder ein Ruleset abschwächen,
- Workflows so ändern, dass Geheimnisse an Pull Requests von Forks gelangen, Rechte breiter werden oder Actions nicht mehr auf Commit-Hashes festgelegt sind,
- Versionen von Actions, Images oder Node von dir aus anheben: Dependabot ist aus, Updates macht der Nutzer bewusst (besonders Major-Sprünge wie Node, `cosign` oder `release-please`).

## Geheimnisse

- **Nie** Tokens, Passwörter, Schlüssel oder `.env`-Inhalte in den Chat, in Befehle, Commits, Issues oder Doku schreiben oder von dort übernehmen. Gibt der Nutzer ein Token im Chat preis, sag ihm sofort, dass er es **widerrufen** muss.
- Geheimnisse setzt der Nutzer selbst, ohne dass der Wert im Befehl steht: `pbpaste | gh secret set NAME --repo erik1g/study-manager`.
- `.env`, `.env.*` und Sicherungen liegen **nie** im Repository (`.gitignore`, `.dockerignore`).
- Der Autor von Commits ist die **GitHub-Noreply-Adresse**, nie eine private E-Mail-Adresse.

## Release-Ablauf (zum Verstehen, nicht zum Auslösen)

**Wohin deine Pull Requests gehen:** nach `dev`, auch Fehlerbehebungen. `dev` muss immer releasefähig sein: Unfertiges bleibt im Branch oder als Draft-PR. `main` bekommt nur Pull Requests von `dev` und den Release-PR; das ist Sache des Maintainers.

Pull Request (Squash) nach `dev` (CI und E2E Pflicht) → Testimages `edge` und `sha-…` → Pull Request `dev → main` als **Merge-Commit** (nie Squash), nur direkt vor einem Release → `release-please` hält den Release-PR (Version und `CHANGELOG.md`) aktuell → der Maintainer mergt ihn → Tag und GitHub-Release → die Images (`server`, `web`) werden gebaut, signiert (cosign) und mit Attestation bei Docker Hub veröffentlicht (Tags `X.Y.Z`, `X.Y`, `X`, `latest`) → ein automatischer Pull Request `main → dev` (Merge-Commit) bringt Changelog und Version zurück. Details: `apps/docs/docs/entwickler/releases.mdx`.
