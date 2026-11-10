---
paths:
  - "apps/e2e/**"
  - "infra/test/**"
---

# Ende-zu-Ende-Tests (`apps/e2e`, `infra/test`)

- Aufruf: `./infra/test/stack.sh e2e` (alles), `… e2e --project=chromium` (ein Browser), `… e2e --reporter=line tests/datei.spec.ts` (eine Datei), `… e2e --update-snapshots tests/visual.spec.ts` (gewollte Änderungen im Aussehen; die geänderten Bilder unter `tests/__screenshots__/` gehören in den Commit und ins PR).
- **Browser:** Chromium, WebKit und ein iPhone-Profil. Was es nur auf einer Breite gibt, überspringst du mit `test.skip(isPhone(page), "Grund")`.
- **Reihenfolge:** zuerst die Bildvergleiche (Aussehen, Hell und Dunkel) auf den frischen Daten, dann die Tests, die Daten ändern, zuletzt das Löschen eines Kontos.
- **Hilfen** in `tests/helpers.ts`: `signIn(page, "mira" | "jonas" | "sina")`, `openSubject(page, "Regelungstechnik")`, `isPhone(page)`. Die Uhr steht auf dem 3. November 2026, 10:00 Uhr Berlin.
- **Wartest du auf eine sichtbare Bestätigung** (z. B. die Meldung „Deadline angelegt“), **bevor du die Seite wechselst**; sonst wird die laufende Anfrage abgebrochen und der Test ist instabil.
- **Daten teilen sich alle Browser.** Lege eigene Daten mit eindeutigem Namen an (`info.project.name`) oder stelle den Zustand wieder her. Ändere nie die Testdaten, auf die andere Tests bauen.
- **Test-Daten** liegen in `infra/test/seed.mjs`; sie sind **erfunden**. Wer dort etwas ergänzt, bedenkt die Bildvergleiche.
- **Rollen im Test-Stack:** Mira (Admin und Besitzerin), Jonas (Bearbeiter in Regelungstechnik und Mathe III), Sina (Leserin in Regelungstechnik).
- Der Playwright-Bericht landet in `apps/e2e/playwright-report/`; `test-results/` und der Bericht sind nicht im Repository.
