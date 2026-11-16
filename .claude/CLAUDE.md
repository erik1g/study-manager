# Study Manager – instructions for Claude and developers

Study Manager is free software (GPL-3.0): a self-hosted web app for students with courses, documents, shared deadlines, planning, notes, lecture mode, flashcards and an MCP server for the users' **own** Claude. This folder (`.claude/`) is the **one place for all instructions to Claude and developers**; Claude Code loads it automatically.

## Read first

- Glossary (terms such as course, deadline, task, owner, editor, reader): @../apps/docs/docs/developers/glossary.mdx
- Architecture decisions live in `apps/docs/docs/developers/decisions/` (read them for questions about the "why", above all `0002`: no AI on the server).
- The documentation for users, admins and developers is `apps/docs/docs/` (site: https://erik1g.github.io/study-manager).

## What is where

The rules live in `.claude/rules/`. **Always loaded:**

| File | Content |
|---|---|
| `commits.md` | Conventional Commits, from which versions and the changelog are made |
| `tests.md` | Check commands, the test data and the test stack |
| `releases-and-security.md` | Who may publish, secrets, the branches `dev` and `main` |
| `working-agreements.md` | Language, test data, how you work with the user and with changes |

**Only loaded when you work on matching files:**

| File | Applies to |
|---|---|
| `server.md` | `apps/server/**` |
| `frontend.md` | `apps/web/**`, `packages/ui/**` |
| `e2e.md` | `apps/e2e/**`, `infra/test/**` |
| `docker-and-ci.md` | `infra/**`, `.github/**`, `docker-compose*.yml` |
| `docs.md` | `apps/docs/**` |

## Files that deliberately stay in the root

GitHub and tools expect them there: `README.md`, `LICENSE`, `CHANGELOG.md`, `.github/`. `.github/` also holds `CONTRIBUTING.md`, `SECURITY.md` and `CODE_OF_CONDUCT.md`; GitHub finds them there. Change them there, not here. When a rule in `.claude/rules/` overlaps with `CONTRIBUTING.md` or the documentation page, **keep both up to date**.

## Personal settings

Your own settings that are not meant for everyone belong in `CLAUDE.local.md` and `.claude/settings.local.json` (both are in `.gitignore`).
