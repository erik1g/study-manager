---
paths:
  - "apps/server/**"
---

# Server (`apps/server`)

- **Structure:** `src/domain/` is the domain logic (one file per area), `src/http/` are thin Fastify routes, `src/mcp/` the MCP server, `src/jobs/` scheduled jobs (pg-boss), `src/search/` the search, `src/db/` schema and migrations. The routes and MCP call the same logic from `domain/`.
- **Permissions:** Check them in `domain/` (`access.ts`: `requireRole`, `roleIn`; roles `viewer` < `editor` < `owner` from `@study/shared`). A course someone may not see "does not exist" (`notFound`), not `forbidden`.
- **Deadlines:** shared (with a course: create, change, delete from `editor`) or private (without a course: only the owner). **Ticking off is per user** (`deadline_done`) and changes nothing for others.
- **Database:** Drizzle. Schema in `src/db/schema.ts`, migration with `pnpm --filter @study/server db:generate`, then **review the generated migration and commit it too**. The server runs migrations on start (`migrateDb`). A migration must run on an existing installation.
- **Extensions:** The search needs `vector`, in the schema `extensions` (created by `migrateDb`). Migrations write `vector(384)` without a schema and rely on the search path.
- **Configuration:** only through `src/config.ts` (zod). A new environment variable is a change for **operators**: add it to `.env.example`, `docker-compose.yml`, `apps/docs/docs/admin/configuration.mdx` and use `BREAKING CHANGE` if it is required.
- **The AI does not run on the server** (ADR `0002`): Claude works through MCP with the user's permissions; what used to run automatically is listed in the work inbox (`domain/inbox.ts`).
- **From the image:** The server runs as user `node` with `node --import tsx src/index.ts`. There is no `pnpm` in the container at runtime; scripts call `node --import tsx`.
- **Outgoing requests** (calendar feeds) only go to public addresses (`publicFetch`); do not weaken that.
- **Tests:** `apps/server/test/`, against the real database (see `tests.md`). Sample files in `test/fixtures/` are **invented**.
