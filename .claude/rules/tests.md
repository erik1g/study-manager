# Checking and testing

Run these before every commit and **only say something is done once they are green**:

```sh
node infra/scripts/ui-gate.mjs   # only building blocks from @study/ui (no bare <button>, <input>, …, no hex colours)
pnpm typecheck                   # TypeScript of all packages (the docs generate their props.json on the way)
pnpm test                        # unit tests; leaves out the E2E package
```

- **Server tests** need a PostgreSQL database: set `DATABASE_URL` or run them in the dev container (`docker compose --project-directory . -f infra/compose/dev.yml exec server sh -c "cd apps/server && pnpm exec vitest run"`). The tests create the database `study_test` themselves. The role's search path must include the schema `extensions` (as in the Supabase image).
- **Interface changes** you also test in the browser at laptop **and** phone width and with the Playwright suite.
- **End to end:** `./infra/test/stack.sh e2e` (see `e2e.md`). It builds the production images from the checkout, starts the test stack and runs Playwright. Run `pnpm install` once beforehand.
- **More options:** `STACK_NO_BUILD=1` uses images that are already built (`study-manager-server:test`, `study-manager-web:test`), `STACK_EXTRA=file.yml` adds your own compose file.

## The test stack

A second, isolated instance with its own database, its own keys and **invented data** (Mira is admin, Jonas is editor, Sina is reader in "Regelungstechnik"). It only listens on `127.0.0.1:8090`. The tests never run against a real installation.

`e2e` resets the stack, fills it with the data of **3 November 2026, 10:00 Berlin time** and stops the browser clock there. Whisper is not run: the lecture tests simulate the service's answer.

## Unit tests

- `packages/ui/test`: contrast, structure and accessibility of the building blocks
- `apps/server/test`: domain logic against the real database; `memoryAccounts` replaces sign-in, files from `test/fixtures/` replace feeds
- New behaviour gets a test; a bug first gets a test that shows it.
