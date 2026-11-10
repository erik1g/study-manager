#!/bin/sh
# Updates this installation of the Study Manager to another version (or back to an older one).
#
#   ./update.sh 0.2.0               go to version 0.2.0
#   ./update.sh 0.2.0 --no-backup   the same without the backup (only if you have made one yourself)
#   ./update.sh --status            show the version that runs
#
# What it does, in this order, and stops at the first problem:
#   1. makes a backup (database and documents, encrypted with BACKUP_PASSPHRASE);
#   2. pulls the new images BEFORE it touches anything that runs;
#   3. writes the version to STUDY_VERSION in .env and restarts;
#   4. waits until the server answers; if it does not, it returns to the previous version.
# Database migrations run when the server starts. Going back to an older version does not undo them:
# read the release notes, and restore the backup (see the admin documentation) if a release says so.
set -eu
cd "$(dirname "$0")"

say() { printf '%s\n' "$*"; }
die() { printf 'Fehler: %s\n' "$*" >&2; exit 1; }

status=0
backup=1
new=""
for arg in "$@"; do
  case "$arg" in
    --status) status=1 ;;
    --no-backup) backup=0 ;;
    -*) die "Unbekannte Option $arg" ;;
    *) [ -z "$new" ] || die "Nur eine Version angeben"; new=$arg ;;
  esac
done

[ -f .env ] || die ".env fehlt in $(pwd)"
docker compose version >/dev/null 2>&1 || die "docker compose fehlt"

current() { grep -E '^STUDY_VERSION=' .env | tail -1 | cut -d= -f2- || true; }
set_version() {
  tmp=$(mktemp ".env.XXXXXX")
  grep -v -E '^STUDY_VERSION=' .env > "$tmp" || true
  printf 'STUDY_VERSION=%s\n' "$1" >> "$tmp"
  chmod --reference=.env "$tmp" 2>/dev/null || chmod 600 "$tmp"
  mv "$tmp" .env
}
healthy() {
  docker compose exec -T server node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))" >/dev/null 2>&1
}
wait_healthy() {
  i=0
  while [ "$i" -lt "${UPDATE_WAIT_STEPS:-60}" ]; do
    healthy && return 0
    i=$((i + 1))
    sleep 3
  done
  return 1
}

if [ "$status" -eq 1 ] || [ -z "$new" ]; then
  say "Version in .env:      $(current)"
  [ -f VERSION ] && say "Version dieses Pakets: $(cat VERSION)"
  docker compose ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
  [ "$status" -eq 1 ] || { say ""; say "Aufruf: ./update.sh <Version>   (zum Beispiel ./update.sh 0.2.0)"; }
  exit 0
fi

case "$new" in
  [0-9]*.[0-9]*.[0-9]*|latest|edge) ;;
  *) die "Version \"$new\" ist ungültig (erwartet: 1.2.3, latest oder edge)" ;;
esac
old=$(current)
[ -n "$old" ] || old=$( [ -f VERSION ] && cat VERSION || echo latest )
say "→ Aktuelle Version: $old, gewünschte Version: $new"
[ "$old" = "$new" ] && say "  (gleiche Version: es werden nur die Images neu gezogen)"

# 1. Backup (only if the server runs)
if [ "$backup" -eq 0 ]; then
  say "→ OHNE Sicherung (--no-backup): die Verantwortung dafür liegt bei dir"
elif docker compose ps --status running --services 2>/dev/null | grep -qx server; then
  say "→ Sicherung der Datenbank und der Dokumente"
  if ! docker compose exec -T server node --import tsx -e "import('./src/jobs/backup.ts').then((m) => m.runBackup()).then((r) => console.log(r.files.map((f) => f.name + ' (' + Math.round(f.size / 1024) + ' KB)').join('\n')))"; then
    die "Die Sicherung ist fehlgeschlagen (ist BACKUP_PASSPHRASE in .env gesetzt?). Nichts wurde verändert."
  fi
else
  say "→ Der Server läuft nicht: keine Sicherung möglich (die Daten bleiben unberührt)"
fi

# 2. Pull first: a missing version must not take anything down.
say "→ Images ziehen: $new"
STUDY_VERSION=$new docker compose pull || die "Die Images für $new gibt es nicht oder sind nicht erreichbar. Nichts wurde verändert."

# 3. Switch
say "→ Neu starten mit $new"
set_version "$new"
docker compose up -d --remove-orphans

# 4. Health check, otherwise back
if wait_healthy; then
  say "✓ Läuft mit Version $new"
  docker compose ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
  exit 0
fi

say "✗ Der Server antwortet nicht. Zurück auf $old ..." >&2
docker compose logs --tail 40 server >&2 || true
set_version "$old"
docker compose up -d --remove-orphans
if wait_healthy; then
  say "✓ Wieder auf Version $old. Die Aktualisierung auf $new ist fehlgeschlagen (Logs oben)." >&2
else
  say "✗ Auch $old antwortet nicht. Bitte Logs prüfen (docker compose logs server) und notfalls das Backup einspielen." >&2
fi
exit 1
