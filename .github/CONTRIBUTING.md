# Contributing

Thank you for wanting to make Study Manager better! The project is meant for all students, and every bit of help counts: reporting bugs, improving the documentation, connecting a university or building a feature.

The full guide is in the developer documentation: **https://erik1g.github.io/study-manager/entwickler/mitmachen**. Here are the essentials in short.

## Language

The project language is **English**: issues, pull requests, commits, code, comments and documentation. Please write issues and pull requests in English, even if the app also speaks German.

## Before you start

- Search the [issues](https://github.com/erik1g/study-manager/issues) to see whether the topic already exists. A comment like "I'll take this" avoids duplicate work.
- For larger changes, open an issue first and discuss the idea. That way you lose no work on a change that does not fit the project.
- Beginner-friendly tasks carry the label `good first issue`.

## Run it locally

```sh
pnpm install
ADMIN_EMAIL=you@example.org DOMAIN=localhost node infra/scripts/setup.mjs
docker compose --project-directory . -f infra/compose/dev.yml up -d
```

All steps, tests and notes are in the developer documentation.

## Where your pull request goes

Everything for the next version collects in **`dev`**, the default branch. Fork the repository, branch off `dev` and open your pull request **against `dev`**, for bug fixes too. `main` is always the published state and only gets pull requests from `dev`; CI rejects a pull request against `main`.

`dev` must **always be releasable**. So open unfinished work as a **draft PR**; it is merged only when it is done and all checks are green.

## Commits and pull requests

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) in English; version numbers and the changelog are made from them automatically (with `release-please`):

| Prefix | For | Effect on the version |
|---|---|---|
| `feat:` | a new feature | minor (`0.1.0` → `0.2.0`) |
| `fix:` | a bug fix | patch (`0.1.0` → `0.1.1`) |
| `perf:` | faster | patch |
| `docs:`, `test:`, `chore:`, `refactor:`, `ci:`, `style:`, `build:` | everything else | no new release on its own |
| `feat!:` or `BREAKING CHANGE:` in the body | a change that breaks existing installations | major (from 1.0), minor before |

Example: `fix(planning): make the week view swipeable on phones`

- One pull request = one thing. The **title** follows the format above (it becomes the commit title on merge).
- CI must be green: type check, tests, UI check, build and the Playwright tests.
- For changes to the interface, **screenshots or a short video** belong in the pull request.
- Write tests for new behaviour and update the documentation.
- By contributing, you agree that your contribution is licensed under the project's **GPL-3.0**. No further agreement is needed.

## Code of Conduct

We follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please report security vulnerabilities privately (see [SECURITY.md](SECURITY.md)).
