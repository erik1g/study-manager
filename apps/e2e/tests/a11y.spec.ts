import AxeBuilder from "@axe-core/playwright";
import { expect, openSubject, signIn, test } from "./helpers";

// No serious or critical problems on the main pages, in light and dark.
for (const theme of ["light", "dark"] as const) {
  test.describe(`Barrierefreiheit (${theme === "light" ? "hell" : "dunkel"})`, () => {
    test.use({ colorScheme: theme });

    const check = async (page: import("@playwright/test").Page) => {
      // Measured mid-fade, colours would read too light: let entrances finish first.
      await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const bad = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    };

    test("Anmeldung", async ({ page }) => {
      await page.goto("/anmelden");
      await check(page);
    });

    test("Heute, ein Fach, Todos, Planung, Einstellungen", async ({ page }) => {
      await signIn(page);
      await check(page);
      await openSubject(page, "Regelungstechnik");
      await check(page);
      for (const path of ["/todos", "/planung", "/einstellungen/profil", "/einstellungen/studiengang"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await check(page);
      }
    });
  });
}
