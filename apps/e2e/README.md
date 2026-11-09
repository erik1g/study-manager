# Playwright-Tests

Die Tests laufen gegen den Test-Stack (eigene Datenbank, eigene Konten, erfundene Daten) – nie gegen die echte App.

```sh
./infra/test/stack.sh e2e                       # alles, in Chromium, WebKit und auf dem iPhone
./infra/test/stack.sh e2e --project=chromium    # nur ein Browser
./infra/test/stack.sh e2e --update-snapshots    # gewollte Änderungen im Aussehen übernehmen
```

`e2e` setzt den Stack zurück, füllt ihn mit den Daten vom 3. November 2026 und hält die Uhr im Browser dort an. Die Bilder für die Vergleiche liegen in `tests/__screenshots__/`. Der Bericht landet in `playwright-report/`.

Whisper wird nicht ausgeführt: Die Vorlesungs-Tests nehmen den Weg „mit eigenem Schlüssel“ und simulieren die Antwort des Dienstes.
