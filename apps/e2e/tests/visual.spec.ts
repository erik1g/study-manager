import type { Page } from "@playwright/test";
import { expect, openSubject, signIn, test } from "./helpers";

/** Pictures only of a settled page: fonts loaded, data in, entrances finished. */
async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.getAnimations().forEach((a) => a.finish());
    // The app scrolls inside its main column; start each picture at its top.
    document.querySelector(".main")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  });
}

// The look as agreed on the design canvas, compared picture by picture. A
// wanted change is taken over with --update-snapshots.
for (const theme of ["light", "dark"] as const) {
  test.describe(`Aussehen (${theme === "light" ? "hell" : "dunkel"})`, () => {
    test.use({ colorScheme: theme });

    test("Anmeldung", async ({ page }) => {
      await page.goto("/anmelden");
      await settled(page);
      await expect(page).toHaveScreenshot(`anmeldung-${theme}.png`, { fullPage: true });
    });

    test("Heute, Fach, leerer Zustand, Einstellungen", async ({ page }) => {
      await signIn(page);
      // Times of the seed's uploads and edits change with each run.
      const volatile = [page.locator(".ui-row-meta"), page.locator(".notes-state")];
      await settled(page);
      await expect(page).toHaveScreenshot(`heute-${theme}.png`, { fullPage: true, mask: volatile });
      await openSubject(page, "Regelungstechnik");
      await settled(page);
      await expect(page).toHaveScreenshot(`fach-${theme}.png`, { fullPage: true, mask: volatile });
      await openSubject(page, "Konstruktionslehre");
      await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Lernkarten" }).click();
      await expect(page.getByRole("heading", { name: "Noch keine Lernkarten" })).toBeVisible();
      await settled(page);
      await expect(page).toHaveScreenshot(`leer-${theme}.png`, { fullPage: true });
      await page.goto("/einstellungen/profil");
      await settled(page);
      await expect(page).toHaveScreenshot(`einstellungen-${theme}.png`, { fullPage: true });
    });
  });
}
