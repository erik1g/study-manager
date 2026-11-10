---
paths:
  - "apps/web/**"
  - "packages/ui/**"
---

# Oberfläche (`apps/web`, `packages/ui`)

- **Die eine Regel:** In `apps/web` nur **Bausteine aus `@study/ui`**: keine nackten `<button>`, `<input>`, `<select>`, `<textarea>`, keine alten Klassen (`button`, `icon-button`, `popover`, `notice`, `segmented`, `tag`) und **keine Farben als Hex-, `rgb()`- oder `hsl()`-Wert**, sondern Tokens (`--ui-…`). `node infra/scripts/ui-gate.mjs` prüft das. Eine Ausnahme braucht `ui-allow: <Grund>` in der Zeile davor.
- **Neuer Baustein:** erst prüfen, ob eine Variante oder Prop reicht; Komponente in `packages/ui/src/components`, CSS in `src/styles` mit `ui-`-Klassen und Tokens, Export in `src/index.ts`, Test in `test/`, Seite unter `apps/docs/docs/bausteine/`. Farben ändern nur in `src/tokens.ts` (dann `pnpm --filter @study/ui tokens`).
- **Texte** stehen in `apps/web/src/i18n/de.ts`, nicht im Code verstreut. Deutsch, du-Form, Verben auf Knöpfen („Speichern“, nicht „OK“).
- **Rechte:** Die Oberfläche **zeigt** nur, was der Server erlaubt (`deadline.editable`, `course.role`). Verlass dich nie allein auf sie.
- **Hooks:** Alle Hooks vor jedem frühen `return` (ein Fehler hier hat „Bearbeiten“ bei Deadlines abstürzen lassen).
- **Stabile Props für FullCalendar:** Objekte und Funktionen, die FullCalendar bekommt, mit `useMemo` stabil halten (sonst setzt es die Ansicht zurück). `dayMinWidth` ist ein Premium-Feature und **nicht** erlaubt.
- **Handy und Laptop:** Prüfe beides. Die Breakpoints stehen in `app.css` (900 px für die Seitenleiste, 760 px für den Kalender).
- **Gespeicherte Einstellungen** (Zoom, einklappen, Tabs) laufen über `lib/stored.ts` und liegen nur im Browser.
- **Barrierefreiheit:** Alles mit Tastatur erreichbar, Namen für Icons (`IconButton` verlangt `label`); Playwright prüft mit axe.
