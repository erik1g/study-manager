---
paths:
  - "apps/docs/**"
---

# Documentation (`apps/docs`)

- **Three areas, in English:** `docs/users/` (students who use the app), `docs/admin/` (whoever runs a server), `docs/developers/` (whoever develops along). Plus the design system (`docs/foundations`, `components`, `patterns`, `voice-and-tone.mdx`, `design-system-contributing.mdx`, `design-system.mdx`) under "Developers". The sidebars are in `sidebars.ts`. There is only the English version; old German addresses are not redirected.
- **Addresses without a trailing slash** (`trailingSlash: false`): `/users/courses-and-roles`, not `…/`. Write internal links as `/users/page`; Docusaurus adds `baseUrl` (`/study-manager/`) itself. `onBrokenLinks` is set to `throw`, a dead link breaks the build.
- **Front matter:** Put values containing `: ` in **quotes** (`description: "The building blocks (Snug Simple): …"`), otherwise the YAML breaks.
- **MDX:** Curly braces and `<` in running text are code. Put them in backticks or code blocks.
- **Write for the audience:** user pages without technical jargon; admin pages with commands to copy; developer pages with paths. **Try commands before you document them**, and say on the page what is not tested.
- **Stay honest:** The interface speaks English and German, the instructions for Claude are English, the timetable connection fits CAMPUSonline; the docs say so. No promises the code does not keep.
- **Invented examples:** `study.example.org`, `you@example.org`, no real domains or people.
- **Build and view:** `pnpm --filter @study/docs build` (first generates `src/generated/props.json` from the building blocks), `pnpm --filter @study/docs start` for `http://localhost:3002`. Publishing happens automatically through GitHub Pages (`docs.yml`).
