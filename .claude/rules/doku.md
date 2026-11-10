---
paths:
  - "apps/docs/**"
---

# Dokumentation (`apps/docs`)

- **Drei Bereiche, deutsch:** `docs/nutzer/` (Studierende, die benutzen), `docs/admin/` (wer einen Server betreibt), `docs/entwickler/` (wer mitentwickelt). Dazu das Design-System (`docs/grundlagen`, `bausteine`, `muster`, `sprache-und-ton.mdx`, `mitmachen.mdx`, `einstieg.mdx`) unter „Entwickler“. Die Seitenleisten stehen in `sidebars.ts`.
- **Adressen ohne Schrägstrich am Ende** (`trailingSlash: false`): `/nutzer/faecher-und-rollen`, nicht `…/`. Interne Links schreibst du als `/nutzer/seite`; Docusaurus setzt `baseUrl` (`/study-manager/`) selbst. `onBrokenLinks` steht auf `throw`, ein toter Link bricht den Build.
- **Kopf (Front Matter):** Werte mit `: ` darin in **Anführungszeichen** setzen (`description: "Die Bausteine (Snug Simple): …"`), sonst bricht das YAML.
- **MDX:** Geschweifte Klammern und `<` im Fließtext sind Code. Schreibe sie in Backticks oder in Codeblöcke.
- **Schreibe für die Zielgruppe:** Nutzer-Seiten ohne Fachbegriffe der Technik; Admin-Seiten mit Befehlen zum Kopieren; Entwickler-Seiten mit Pfaden. **Probiere Befehle aus, bevor du sie dokumentierst**, und sag in der Seite, was nicht getestet ist.
- **Ehrlich bleiben:** Die Oberfläche ist deutsch, die Stundenplan-Anbindung passt zu CAMPUSonline; das steht in der Doku. Keine Versprechen, die der Code nicht hält.
- **Erfundene Beispiele:** `study.example.org`, `du@example.org`, keine echten Domains oder Personen.
- **Bauen und ansehen:** `pnpm --filter @study/docs build` (erzeugt vorher `src/generated/props.json` aus den Bausteinen), `pnpm --filter @study/docs start` für `http://localhost:3002`. Veröffentlicht wird automatisch über GitHub Pages (`docs.yml`).
