import type { Page } from "@playwright/test";
import { expect, openSubject, signIn, test } from "../tests/helpers";

const OUT = new URL("../../docs/static/img/oberflaeche/", import.meta.url).pathname;

/** Waits until the page is settled: fonts loaded, data in, entrances finished. */
async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.getAnimations().forEach((a) => a.finish());
    document.querySelector(".main")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  });
  // The server's clock is the real one, not the browser's: the times of uploads and edits
  // would show a day that does not fit the seeded one. They stay out of the pictures.
  await page.addStyleTag({ content: ".ui-row-meta, .notes-state { visibility: hidden !important; }" });
}

async function openTab(page: Page, name: string) {
  const nav = page.getByRole("navigation", { name: "Bereiche des Fachs" });
  await nav.getByRole("button", { name, exact: true }).click();
}

for (const [theme, suffix] of [["light", "hell"], ["dark", "dunkel"]] as const) {
  test.describe(theme, () => {
    test.use({ colorScheme: theme });

    test(`Bilder (${suffix})`, async ({ page }, info) => {
      // The laptop shows every page; the phone only today and a subject.
      const phone = info.project.name === "handy";
      const shot = async (name: string) => {
        await settled(page);
        await page.screenshot({ path: `${OUT}${name}-${phone ? "handy-" : ""}${suffix}.png` });
      };

      await signIn(page);
      await shot("heute");

      await openSubject(page, "Regelungstechnik");
      await shot("fach");
      if (phone) return;

      await openTab(page, "Lernkarten");
      await expect(page.getByText(/^noch \d+ Karten?$/)).toBeVisible();
      await shot("lernkarten");

      await page.getByRole("navigation").getByRole("link", { name: "Planung" }).first().click();
      await expect(page).toHaveURL(/planung/);
      await expect(page.locator(".fc-timeGridWeek-view")).toBeVisible();
      await expect(page.locator(".fc-event").first()).toBeVisible();
      await shot("planung");
    });
  });
}
