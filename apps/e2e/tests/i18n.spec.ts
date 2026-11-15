// The language of the interface: the browser's before sign-in, the profile's
// after it, and changed in the settings. The other tests read the German
// interface; the seed gives everyone `de`.
import { expect, PASSWORD, PEOPLE, signIn, test } from "./helpers";

test.describe("Sprache", () => {
  test.describe("mit englischem Browser", () => {
    test.use({ locale: "en-GB" });

    test("zeigt die Anmeldung auf Englisch", async ({ page }) => {
      await page.goto("/anmelden");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    });

    test("übernimmt nach der Anmeldung die Sprache des Profils", async ({ page }) => {
      await page.goto("/anmelden");
      await page.getByLabel("Email").fill(PEOPLE.jonas);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL("/");
      await expect(page.locator("html")).toHaveAttribute("lang", "de");
      await expect(page.getByRole("navigation", { name: "Hauptnavigation" }).first()).toBeVisible();
    });
  });

  test("wechselt in den Einstellungen und bleibt dabei", async ({ page }) => {
    await signIn(page, "sina");
    await page.goto("/einstellungen/profil");
    await page.getByRole("combobox", { name: "Sprache" }).selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Language" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Language" })).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeVisible();

    // Back, for the tests after this one.
    await page.getByRole("combobox", { name: "Language" }).selectOption("de");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("heading", { name: "Sprache" })).toBeVisible();
  });
});
