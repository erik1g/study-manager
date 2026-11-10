# Arbeitsweise

- **Sprache:** Antworte in der Sprache, in der der Nutzer schreibt (meist Deutsch). Texte der Oberfläche, Doku und Issues sind deutsch; Commit-Titel dürfen deutsch oder englisch sein. Beachte die Umlaute (ä, ö, ü, ß) vollständig.
- **Erfundene Daten:** In Tests, Beispielen, Fixtures und Doku nur erfundene Personen, Hochschulen, Adressen und Zugangsdaten (z. B. „Beispieluniversität“, `example.org`, Mira/Jonas/Sina). **Nie** echte Namen, E-Mail-Adressen, Stundenpläne oder Domains der Maintainer. Echte Daten, die du zum Nachstellen brauchst, anonymisierst du zuerst.
- **Keine Annahmen über die Server des Nutzers** im Repository: keine festen IP-Adressen, Domains oder Pfade, auch nicht in Kommentaren.
- **Prüfe, bevor du „fertig“ sagst.** Sage genau, was du geprüft hast und was nicht. Wenn etwas nur aus dem Code abgeleitet und nicht ausgeführt ist, sag das.
- **Kleine, nachvollziehbare Schritte:** eine Sache pro Commit und Pull Request; das Warum steht in der Beschreibung.
- **Rechte gehören in die Fachlogik** (`apps/server/src/domain`), nie nur in die Oberfläche. Die Web-App und MCP gelten damit gleich.
- **Dokumentation mitpflegen:** Änderst du Verhalten, passe die passende Doku an (Nutzer, Admin oder Entwickler in `apps/docs/docs/`) und, wenn nötig, `README.md`.
- **Erst fragen bei Unklarem, dann bauen:** Betrifft eine Änderung Rechte, Datenbank-Migrationen, Betreiber (neue Umgebungsvariablen, Compose-Datei) oder die Veröffentlichung, klär es mit dem Nutzer, bevor du es umsetzt.
