# Releases, Rechte und Geheimnisse

**Niemand außer den Maintainern darf ein Release auslösen.** Der Schutz besteht aus mehreren Schichten, und du als Assistent darfst keine davon umgehen oder aufweichen.

## Was geschützt ist

- **`main`** ist per Ruleset geschützt: nur Pull Requests, die Prüfungen „Typen, Tests, Build“ und „Titel folgt Conventional Commits“ müssen grün sein, Freigabe durch den Code-Owner, keine Force-Pushes. Du arbeitest immer in einem **Branch und mit einem Pull Request**.
- **Releases** entstehen, wenn der Maintainer den Release-PR von `release-please` mergt. Die **Images** werden danach nur veröffentlicht, wenn er in der GitHub-Umgebung `release` auf „Approve“ klickt.
- **Release-Tags** (`v*`) lassen sich nicht verschieben oder löschen.

## Was du nicht tust, ohne dass der Nutzer es ausdrücklich verlangt

- den **Release-PR mergen**, Tags oder GitHub-Releases anlegen, Images veröffentlichen oder die Umgebung `release` freigeben,
- die **Ausnahme für Admins** („Bypass“) benutzen, um deine eigenen Pull Requests zu mergen,
- **Rulesets, Umgebungen, Secrets, Actions-Rechte oder Sichtbarkeit** des Repos ändern oder ein Ruleset abschwächen,
- Workflows so ändern, dass Geheimnisse an Pull Requests von Forks gelangen, Rechte breiter werden oder Actions nicht mehr auf Commit-Hashes festgelegt sind,
- Versionen von Actions, Images oder Node von dir aus anheben: Dependabot ist aus, Updates macht der Nutzer bewusst (besonders Major-Sprünge wie Node, `cosign` oder `release-please`).

## Geheimnisse

- **Nie** Tokens, Passwörter, Schlüssel oder `.env`-Inhalte in den Chat, in Befehle, Commits, Issues oder Doku schreiben oder von dort übernehmen. Gibt der Nutzer ein Token im Chat preis, sag ihm sofort, dass er es **widerrufen** muss.
- Geheimnisse setzt der Nutzer selbst, ohne dass der Wert im Befehl steht: `pbpaste | gh secret set NAME --repo erik1g/study-manager`.
- `.env`, `.env.*` und Sicherungen liegen **nie** im Repository (`.gitignore`, `.dockerignore`).
- Der Autor von Commits ist die **GitHub-Noreply-Adresse**, nie eine private E-Mail-Adresse.

## Release-Ablauf (zum Verstehen, nicht zum Auslösen)

Pull Request mit `feat:`/`fix:` → Merge in `main` → `release-please` hält den Release-PR (Version und `CHANGELOG.md`) aktuell → der Maintainer mergt ihn → Tag und GitHub-Release → die Images (`server`, `web`) werden gebaut, signiert (cosign) und mit Attestation bei Docker Hub veröffentlicht (Tags `X.Y.Z`, `X.Y`, `X`, `latest`; auf `main` zusätzlich `edge` und `sha-…`). Details: `apps/docs/docs/entwickler/releases.mdx`.
