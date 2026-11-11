#!/bin/sh
# The test stack: ./infra/test/stack.sh up | seed | down | reset | e2e
#   up     builds the images of this checkout and starts the stack (and writes .env.test with its own secrets the first time)
#   seed   fills it with the invented data of infra/test/seed.mjs (SEED_DAY=YYYY-MM-DD fixes its day)
#   down   stops it, keeps the data
#   reset  stops it and deletes its data, so that the next up starts empty
#   e2e    resets, fills and runs the Playwright tests of apps/e2e against it (needs `pnpm install` once)
#   screenshots  the same, but takes the pictures of the app for README and docs (apps/docs/static/img/oberflaeche/)
# It listens only on http://127.0.0.1:8090 of this machine.
set -e
cd "$(dirname "$0")/../.."
# STACK_EXTRA=file.yml adds a Compose file of your own (e.g. to build on the host's network).
compose() { docker compose -p study-test --env-file .env.test -f docker-compose.yml -f infra/compose/test.yml ${STACK_EXTRA:+-f "$STACK_EXTRA"} "$@"; }

case "$1" in
  up)
    if [ ! -f .env.test ]; then
      docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work -e ENV_FILE=.env.test -e DOMAIN=localhost -e SITE_URL=http://localhost:8090 \
        -e ADMIN_EMAIL=mira@example.org node:24.22.2-bookworm-slim node infra/scripts/setup.mjs
    fi
    # STACK_NO_BUILD=1 uses images that are built already (tagged study-manager-server:test and study-manager-web:test).
    if [ -n "$STACK_NO_BUILD" ]; then build=--no-build; else build=--build; fi
    compose up -d $build db auth server web
    ;;
  seed)
    compose exec -T -w /app -e TZ=Europe/Berlin -e SEED_DAY="${SEED_DAY:-}" server node infra/test/seed.mjs
    ;;
  down)
    compose down
    ;;
  e2e|screenshots)
    # A clean stack with the data of a fixed day, then the Playwright tests in their own container.
    "$0" reset
    "$0" up
    # Wait until the server answers (it migrates the database first).
    for _ in $(seq 1 60); do
      if curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then break; fi
      sleep 2
    done
    SEED_DAY=2026-11-03 "$0" seed
    mode=$1
    shift
    as_me=
    if [ "$mode" = screenshots ]; then
      # The pictures land in the checkout, so they must belong to you and not to root.
      set -- --config playwright.screenshots.config.ts "$@"
      as_me="--user $(id -u):$(id -g) -e HOME=/tmp"
    fi
    docker run --rm --network host --ipc=host $as_me -v "$PWD:$PWD" -w "$PWD/apps/e2e" -e CI=1 \
      mcr.microsoft.com/playwright:v1.64.1-noble npx playwright test "$@"
    ;;
  reset)
    if [ -f .env.test ]; then compose down -v; fi
    ;;
  *)
    echo "Aufruf: $0 up | seed | down | reset | e2e | screenshots [Playwright-Argumente]" >&2
    exit 1
    ;;
esac
