---
paths:
  - "apps/docs/**"
---

# Documentation (`apps/docs`)

- **Three areas:** `docs/nutzer/` (students who use the app), `docs/admin/` (whoever runs a server), `docs/entwickler/` (whoever develops along). Plus the design system (`docs/grundlagen`, `bausteine`, `muster`, `sprache-und-ton.mdx`, `mitmachen.mdx`, `einstieg.mdx`) under "Developers". The sidebars are in `sidebars.ts`. The pages are still German; they are being translated to English.
- **Addresses without a trailing slash** (`trailingSlash: false`): `/nutzer/faecher-und-rollen`, not `…/`. Write internal links as `/nutzer/page`; Docusaurus adds `baseUrl` (`/study-manager/`) itself. `onBrokenLinks` is set to `throw`, a dead link breaks the build.
- **Front matter:** Put values containing `: ` in **quotes** (`description: "The building blocks (Snug Simple): …"`), otherwise the YAML breaks.
- **MDX:** Curly braces and `<` in running text are code. Put them in backticks or code blocks.
- **Write for the audience:** user pages without technical jargon; admin pages with commands to copy; developer pages with paths. **Try commands before you document them**, and say on the page what is not tested.
- **Stay honest:** The interface is German, the timetable connection fits CAMPUSonline; the docs say so. No promises the code does not keep.
- **Invented examples:** `study.example.org`, `you@example.org`, no real domains or people.
- **Build and view:** `pnpm --filter @study/docs build` (first generates `src/generated/props.json` from the building blocks), `pnpm --filter @study/docs start` for `http://localhost:3002`. Publishing happens automatically through GitHub Pages (`docs.yml`).
