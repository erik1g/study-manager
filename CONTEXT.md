# Study Manager – Glossar

**Studiengang** (Program):
Ein Studiengang an einer Hochschule mit Prüfungsordnung, z. B. „M.Sc. Technische Systeme, Beispieluniversität, PO 2024“. Hat genau einen Modulkatalog, den alle teilen, die ihn studieren.
_Avoid_: Studium, Programm

**Modul** (Module):
Ein Eintrag des Modulhandbuchs eines Studiengangs, mit Nummer, Titel, Leistungspunkten und den übrigen Angaben des Handbuchs.

**Verwalter** (Manager):
Wer einen Studiengang angelegt hat; nur er (oder ein Admin) ändert dessen Modulkatalog.

**Fach** (Course):
Ein Modul (oder eine frei angelegte Veranstaltung) in einem Semester, gemeinsam mit seinen Mitgliedern. Daran hängen Dokumente, Deadlines und Sitzungen.
_Avoid_: Kurs (für Nutzer), Veranstaltung

**Mitglied** (Member):
Ein Nutzer in einem Fach, mit genau einer Rolle: **Besitzer** (alles, auch Rollen und Löschen), **Bearbeiter** (Gemeinsames hinzufügen, ändern, löschen), **Leser** (alles sehen, nur Eigenes anlegen).

**Dokument** (File):
Eine Datei eines Fachs in einem der Ordner Skripte, Übungen, Altklausuren oder Sonstiges. Gelöschte Dokumente liegen 30 Tage im **Papierkorb** des Fachs.

**Deadline**:
Ein Zeitpunkt wie eine Klausur oder eine Abgabe. Mit Fach für alle Mitglieder sichtbar, ohne Fach nur für den, der sie anlegt.
_Avoid_: Termin (für Kalendereinträge allgemein)

**Aufgabe** (Task):
Ein To-do eines Nutzers, immer privat, geplant für einen Tag und optional eine Uhrzeit; mit Uhrzeit blockt sie ihre geschätzte Dauer als **Zeitblock** im Kalender.
_Avoid_: Todo im Code, Termin

**Kalender-Abo** (Feed):
Ein abonnierter iCal-Kalender eines Nutzers, z. B. der Stundenplan. Seine wiederkehrenden Titel heißen **Serie**; eine Serie, die einem Fach zugeordnet ist, liefert dessen **Sitzungen**.

**Abo-Link** (Calendar link):
Der private Link, über den der Handy-Kalender Deadlines und geplante Aufgaben anzeigt – nur lesend.

**Persönlicher Schlüssel** (Personal key):
Ein Zugangsschlüssel für MCP-Clients ohne OAuth, z. B. Claude Code.

**Notizen** (Notes):
Die **gemeinsamen Notizen** eines Fachs – ein Markdown-Text, den alle Bearbeiter wie ein Wiki ändern; wer gegen einen veralteten Stand speichert, bekommt eine Konfliktwarnung. Dazu hat jedes Mitglied **private Notizen**, die nur es selbst sieht.

**Gliederung** (Outline):
Die Kapitel und Abschnitte eines Skripts in den gemeinsamen Notizen, mit Verweis auf Skript und Seite. Claude ergänzt sie, löscht aber nie etwas.

**Vorlesung** (Recording):
Das Transkript einer Vorlesungsaufnahme, für alle Mitglieder eines Fachs. Transkribiert wird im Browser des Mitglieds oder mit dessen eigenem Schlüssel für einen Dienst. Ihre **Auswertung** (Kernpunkte und wörtliche **Prüfungshinweise**) trägt Claude in die gemeinsamen Notizen ein.

**Stapel** und **Lernkarte** (Deck, Card):
Lernkarten gehören einem Fach und sind geteilt; wann eine Karte wieder fällig ist, rechnet FSRS für jedes Mitglied getrennt. Claude legt keine Karten an, sondern macht **Vorschläge**, die das Mitglied übernimmt oder verwirft.

**Arbeitseingang** (Work inbox):
Was auf das Claude eines Nutzers wartet: Skripte ohne Gliederung und Vorlesungen ohne Auswertung. Die Cloud rechnet selbst keine KI; sie listet die Arbeit, und Claude holt sie sich über MCP.
