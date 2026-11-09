import { expect, signIn, test, totp } from "./helpers";

// Runs last among the functional tests: Mira gets a second factor here.
test.describe.serial("Admin", () => {
  test("ist ohne zweiten Faktor verschlossen", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin");
    await expect(page.getByText(/Für den Admin-Bereich brauchst du/)).toBeVisible();
  });

  test("öffnet sich nach dem Einrichten der Authenticator-App und lädt ein", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "einmal genügt: der Faktor bleibt am Konto");
    await signIn(page);
    await page.goto("/einstellungen/sicherheit");
    await page.getByRole("button", { name: "Authenticator-App einrichten" }).click();
    const secret = (await page.locator("code").first().textContent())!.trim();
    await page.getByLabel("Code aus der App").fill(totp(secret));
    await page.getByRole("button", { name: "Bestätigen" }).click();
    await expect(page.getByText("Authenticator-App ist eingerichtet.").first()).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
    await expect(page.getByText("jonas@example.org")).toBeVisible();
    await page.getByLabel("E-Mail", { exact: true }).fill("neu@example.org");
    await page.getByLabel("Name", { exact: true }).fill("Neue Person");
    await page.getByRole("button", { name: "Einladen" }).click();
    await expect(page.getByText(/Einladungslink – schick ihn der Person/)).toBeVisible();
    await expect(page.getByText("neu@example.org")).toBeVisible();
  });
});
