---
paths:
  - "apps/e2e/**"
  - "infra/test/**"
---

# End-to-end tests (`apps/e2e`, `infra/test`)

- Run: `./infra/test/stack.sh e2e` (everything), `… e2e --project=chromium` (one browser), `… e2e --reporter=line tests/file.spec.ts` (one file), `… e2e --update-snapshots tests/visual.spec.ts` (intended changes in appearance; the changed images under `tests/__screenshots__/` belong in the commit and the PR).
- **Pictures for the README and docs:** `./infra/test/stack.sh screenshots` (spec in `apps/e2e/screenshots/`, output in `apps/docs/static/img/oberflaeche/`). Retake them after visible changes and commit them too. Invented data only, never a real account.
- **Browsers:** Chromium, WebKit and an iPhone profile. What only exists at one width you skip with `test.skip(isPhone(page), "reason")`.
- **Order:** first the visual comparisons (appearance, light and dark) on the fresh data, then the tests that change data, last the deletion of an account.
- **Helpers** in `tests/helpers.ts`: `signIn(page, "mira" | "jonas" | "sina")`, `openSubject(page, "Regelungstechnik")`, `isPhone(page)`. The clock stands at 3 November 2026, 10:00 Berlin time.
- **Wait for a visible confirmation** (e.g. the message "Deadline angelegt") **before you change the page**; otherwise the running request is cancelled and the test is flaky.
- **All browsers share the data.** Create your own data with a unique name (`info.project.name`) or restore the state. Never change the test data other tests rely on.
- **Test data** lives in `infra/test/seed.mjs`; it is **invented**. If you add something there, mind the visual comparisons.
- **Roles in the test stack:** Mira (admin and owner), Jonas (editor in Regelungstechnik and Mathe III), Sina (reader in Regelungstechnik).
- The Playwright report goes to `apps/e2e/playwright-report/`; `test-results/` and the report are not in the repository.
