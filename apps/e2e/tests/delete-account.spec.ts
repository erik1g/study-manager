import { expect, PEOPLE, signIn, test, PASSWORD } from "./helpers";

// Sina owns nothing that others share, so her account can go. Once per run.
test("löscht das eigene Konto nach Bestätigung", async ({ page }) => {
  await signIn(page, "sina");
  await page.goto("/einstellungen/profil");
  await page.getByRole("button", { name: "Konto löschen …" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Passwort").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Mit Passwort bestätigen" }).click();
  await dialog.getByLabel(/Gib zum Schluss deine E-Mail-Adresse ein/).fill(PEOPLE.sina);
  await dialog.getByRole("button", { name: "Konto endgültig löschen" }).click();
  await expect(page).toHaveURL(/anmelden/);

  await page.getByLabel("E-Mail").fill(PEOPLE.sina);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
