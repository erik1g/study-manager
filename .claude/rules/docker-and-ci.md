---
paths:
  - "infra/**"
  - ".github/**"
  - "docker-compose*.yml"
---

# Containers, proxy and CI

## Containers

- **All Dockerfiles** live in `infra/docker/`; `dev.Dockerfile` is the development container. **Two images**: `server.Dockerfile` (Node 24, `pg_dump`, server code, user `node`) and `web.Dockerfile` (Caddy with the built web app and `infra/caddy/Caddyfile`). `pnpm` gets into the image through `npm install -g pnpm@12.16.1` (not through `corepack`).
- **Compose files:** `docker-compose.yml` is the one for **operators** (images only, `web` on `127.0.0.1:8080`), `infra/compose/dev.yml` for developers (source mounted, hot reload), `infra/compose/test.yml` sits on top of the first and builds the images from the checkout for the test stack.
- **TLS ends at the operator's reverse proxy.** Caddy in the `web` image only speaks HTTP on port 80. Trusted proxies come from `TRUSTED_PROXIES`.
- **New setting** ⇒ add it to `.env.example`, `apps/docs/docs/admin/konfiguration.mdx` and `setup.mjs` (if it is generated).
- **Nothing about the maintainer's server goes into the repository:** no domains, IPs, paths, firewall scripts.

## GitHub Actions (`.github/workflows`)

- **All actions are pinned to commit hashes** (`uses: owner/repo@<sha> # vX.Y.Z`), Dependabot is off: versions are updated **by hand**, checked before a release and not changed on the side. Add new actions the same way; resolve the hash with `gh api repos/OWNER/REPO/git/matching-refs/tags/vX`.
- **Minimal permissions:** `permissions: {}` or `contents: read` at workflow level, write permissions only in the job that needs them. `actions/checkout` with `persist-credentials: false`.
- **Publishing** only in the original repo (`if: github.repository == 'erik1g/study-manager'`) and only from the environment `release` (release workflow). See `releases-and-security.md`.
- **Checking:** `zizmor` runs in CI; locally `brew install zizmor && zizmor .github`. There must be no findings. YAML syntax: `ruby -ryaml -e 'YAML.load_file(ARGV[0])' file.yml`.
- **CI** (`ci.yml`): UI check, types, unit tests (with a PostgreSQL service, `ALTER ROLE … search_path`), docs and web build, zizmor. **E2E** (`e2e.yml`): Playwright against the built images, on every pull request to `dev` or `main` (required check) and on other pull requests with the label `e2e`. **Title** per Conventional Commits in `pr-title.yml` (its own workflow, also runs on `edited`). **Source** in `pr-source.yml` (required on `main`: only `dev` or the release PR). **Images** (`images-edge.yml`): `edge` and `sha-…` on `dev`, unsigned. **Release** (`release.yml`): release-please and the return PR `main → dev` with the secret `RELEASE_TOKEN`, because PRs opened with the `GITHUB_TOKEN` start no checks.
