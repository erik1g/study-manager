import type { Page } from "@playwright/test";
import { expect, openSubject, signIn, test } from "../tests/helpers";

const OUT = new URL("../../docs/static/img/screenshots/", import.meta.url).pathname;

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

/**
 * The pictures show the English interface. The seed gives everyone German,
 * so Mira switches first; the stack is reset before every run.
 */
async function toEnglish(page: Page) {
  // After the first picture Mira's profile is English already.
  if ((await page.locator("html").getAttribute("lang")) === "en") return;
  await page.goto("/einstellungen/profil");
  await page.getByRole("combobox", { name: "Sprache" }).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function openTab(page: Page, name: string) {
  const nav = page.getByRole("navigation", { name: "Areas of the course" });
  await nav.getByRole("button", { name, exact: true }).click();
}

for (const theme of ["light", "dark"] as const) {
  test.describe(theme, () => {
    test.use({ colorScheme: theme });

    test(`pictures (${theme})`, async ({ page }, info) => {
      // The laptop shows every page; the phone only today and a course.
      const phone = info.project.name === "phone";
      const shot = async (name: string) => {
        await settled(page);
        await page.screenshot({ path: `${OUT}${name}-${phone ? "phone-" : ""}${theme}.png` });
      };

      await signIn(page);
      await toEnglish(page);
      await shot("today");

      await openSubject(page, "Regelungstechnik");
      await shot("course");
      if (phone) return;

      await openTab(page, "Flashcards");
      await expect(page.getByText(/^\d+ cards? left$/)).toBeVisible();
      await shot("flashcards");

      await page.getByRole("navigation").getByRole("link", { name: "Planning" }).first().click();
      await expect(page).toHaveURL(/planung/);
      await expect(page.locator(".fc-timeGridWeek-view")).toBeVisible();
      await expect(page.locator(".fc-event").first()).toBeVisible();
      await shot("planning");
    });
  });
}
