# Releases, permissions and secrets

**Nobody except the maintainers may trigger a release.** The protection consists of several layers, and you as an assistant may not bypass or weaken any of them.

## What is protected

- **`main`** (the published state) and **`dev`** (default branch, development) are protected by rulesets: pull requests only, the checks "Typen, Tests, Build", "Titel folgt Conventional Commits" and "Playwright" must be green (on `main` also "Quelle erlaubt"), no force pushes, **no exceptions**. You always work in a **branch from `dev` with a pull request to `dev`**.
- **Releases** happen when the maintainer merges the release PR from `release-please`. The **images** are only published after that when they click "Approve" in the GitHub environment `release`.
- **Release tags** (`v*`) cannot be moved or deleted.

## What you do not do unless the user explicitly asks for it

- **merge the release PR**, create tags or GitHub releases, publish images or approve the environment `release`,
- open or merge a pull request `dev → main` (that is the start of a release),
- create, read or change the secret `RELEASE_TOKEN`,
- change **rulesets, environments, secrets, Actions permissions or visibility** of the repo, or weaken a ruleset,
- change workflows so that secrets reach pull requests from forks, permissions get broader or actions are no longer pinned to commit hashes,
- raise versions of actions, images or Node on your own: Dependabot is off, the user makes updates deliberately (especially major jumps such as Node, `cosign` or `release-please`).

## Secrets

- **Never** write tokens, passwords, keys or `.env` contents into the chat, commands, commits, issues or docs, or take them from there. If the user reveals a token in the chat, tell them at once that they must **revoke** it.
- The user sets secrets themselves, without the value in the command: `pbpaste | gh secret set NAME --repo erik1g/study-manager`.
- `.env`, `.env.*` and backups **never** go into the repository (`.gitignore`, `.dockerignore`).
- The author of commits is the **GitHub noreply address**, never a private email address.

## Release flow (to understand, not to trigger)

**Where your pull requests go:** to `dev`, bug fixes too. `dev` must always be releasable: unfinished work stays in the branch or as a draft PR. `main` only gets pull requests from `dev` and the release PR; that is the maintainer's business.

Pull request (squash) to `dev` (CI and E2E required) → test images `edge` and `sha-…` → pull request `dev → main` as a **merge commit** (never squash), only right before a release → `release-please` keeps the release PR (version and `CHANGELOG.md`) up to date → the maintainer merges it → tag and GitHub release → the images (`server`, `web`) are built, signed (cosign) and published to Docker Hub with attestation (tags `X.Y.Z`, `X.Y`, `X`, `latest`) → an automatic pull request `main → dev` (merge commit) brings the changelog and version back. Details: `apps/docs/docs/developers/releases.mdx`.
