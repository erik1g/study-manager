import { expect, PASSWORD, PEOPLE, signIn, test } from "./helpers";

test.describe("Anmelden", () => {
  test("sagt bei falschem Passwort, was nicht stimmt", async ({ page }) => {
    await page.goto("/anmelden");
    await page.getByLabel("E-Mail").fill(PEOPLE.mira);
    await page.getByLabel("Passwort").fill("falsch-falsch-falsch");
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("E-Mail oder Passwort stimmen nicht");
    await expect(page).toHaveURL(/anmelden/);
  });

  test("führt nach der Anmeldung dorthin, wohin man wollte", async ({ page }) => {
    await page.goto("/todos");
    await expect(page).toHaveURL(/anmelden\?weiter=/);
    await page.getByLabel("E-Mail").fill(PEOPLE.mira);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Todos" })).toBeVisible();
  });

  test("meldet über das Kontomenü ab", async ({ page }) => {
    await signIn(page);
    if ((page.viewportSize()?.width ?? 1400) < 900) {
      // On phones the account is in the settings; signing out lives in the side menu on wide screens only.
      test.skip();
    }
    await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("button", { name: /Mira Hansen/ }).click();
    await page.getByRole("menuitem", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/anmelden/);
  });
});
