---
paths:
  - "apps/web/**"
  - "packages/ui/**"
---

# Interface (`apps/web`, `packages/ui`)

- **The one rule:** In `apps/web` use only **building blocks from `@study/ui`**: no bare `<button>`, `<input>`, `<select>`, `<textarea>`, no old classes (`button`, `icon-button`, `popover`, `notice`, `segmented`, `tag`) and **no colours as hex, `rgb()` or `hsl()` values**, but tokens (`--ui-…`). `node infra/scripts/ui-gate.mjs` checks this. An exception needs `ui-allow: <reason>` on the line before.
- **New building block:** first check whether a variant or prop is enough; component in `packages/ui/src/components`, CSS in `src/styles` with `ui-` classes and tokens, export in `src/index.ts`, test in `test/`, page under `apps/docs/docs/components/`. Change colours only in `src/tokens.ts` (then `pnpm --filter @study/ui tokens`).
- **Texts** live in `apps/web/src/i18n/`, not scattered through the code: add every key to `en.ts` (the source) and `de.ts` (TypeScript complains otherwise), and import `t` and the formatters from `../i18n`. Never hard-code `de-DE` or German words; use `formatDate`, `intlLocale` and friends. English: plain, "you"; German: informal "du". Verbs on buttons ("Save"/"Speichern", not "OK"). `@study/ui` brings English defaults; the app hands over its words with `setUiText` in `main.tsx`.
- **Permissions:** The interface only **shows** what the server allows (`deadline.editable`, `course.role`). Never rely on it alone.
- **Hooks:** All hooks before any early `return` (a bug here made "Edit" crash for deadlines).
- **Stable props for FullCalendar:** Keep objects and functions passed to FullCalendar stable with `useMemo` (otherwise it resets the view). `dayMinWidth` is a premium feature and **not** allowed.
- **Phone and laptop:** Check both. The breakpoints are in `app.css` (900 px for the sidebar, 760 px for the calendar).
- **Stored settings** (zoom, collapsed, tabs) go through `lib/stored.ts` and live only in the browser.
- **Accessibility:** Everything reachable by keyboard, names for icons (`IconButton` requires `label`); Playwright checks with axe.
