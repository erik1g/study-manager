# Prüfen und Testen

Vor jedem Commit laufen lassen und **erst dann sagen, dass etwas fertig ist**, wenn sie grün sind:

```sh
node infra/scripts/ui-gate.mjs   # nur Bausteine aus @study/ui (keine nackten <button>, <input>, …, keine Hex-Farben)
pnpm typecheck                   # TypeScript aller Pakete (die Doku erzeugt dabei ihre props.json)
pnpm test                        # Unit-Tests; schließt das E2E-Paket aus
```

- **Server-Tests** brauchen eine PostgreSQL-Datenbank: `DATABASE_URL` setzen oder im Dev-Container laufen lassen (`docker compose -f docker-compose.dev.yml exec server sh -c "cd apps/server && pnpm exec vitest run"`). Die Tests legen die Datenbank `study_test` selbst an. Der Suchpfad der Rolle muss das Schema `extensions` enthalten (so wie im Supabase-Image).
- **Oberflächenänderungen** testest du zusätzlich im Browser auf Laptop **und** Handy-Breite und mit der Playwright-Suite.
- **Ende zu Ende:** `./infra/test/stack.sh e2e` (siehe `e2e.md`). Das baut die Produktions-Images aus dem Checkout, startet den Test-Stack und lässt Playwright laufen. Einmal vorher `pnpm install`.
- **Weitere Optionen:** `STACK_NO_BUILD=1` nutzt schon gebaute Images (`study-manager-server:test`, `study-manager-web:test`), `STACK_EXTRA=datei.yml` hängt eine eigene Compose-Datei an.

## Der Test-Stack

Eine zweite, abgeschottete Instanz mit eigener Datenbank, eigenen Schlüsseln und **erfundenen Daten** (Mira ist Admin, Jonas ist Bearbeiter, Sina ist Leserin in „Regelungstechnik“). Sie lauscht nur auf `127.0.0.1:8090`. Die Tests laufen nie gegen eine echte Installation.

`e2e` setzt den Stack zurück, füllt ihn mit den Daten vom **3. November 2026, 10:00 Uhr Berlin** und hält die Uhr im Browser dort an. Whisper wird nicht ausgeführt: Die Vorlesungs-Tests simulieren die Antwort des Dienstes.

## Unit-Tests

- `packages/ui/test`: Kontraste, Aufbau, Barrierefreiheit der Bausteine
- `apps/server/test`: Fachlogik gegen die echte Datenbank; Anmeldung ersetzt `memoryAccounts`, Feeds ersetzen Dateien aus `test/fixtures/`
- Neues Verhalten bekommt einen Test; ein Fehler bekommt zuerst einen Test, der ihn zeigt.
