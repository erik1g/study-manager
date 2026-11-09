import { expect, isPhone, signIn, test } from "./helpers";

test.describe("Einstellungen", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("ändert den Anzeigenamen", async ({ page }) => {
    await page.goto("/einstellungen/profil");
    await page.getByLabel("Anzeigename").fill("Mira H.");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Gespeichert")).toBeVisible();
    await page.getByLabel("Anzeigename").fill("Mira Hansen");
    await page.getByRole("button", { name: "Speichern" }).click();
  });

  test("wechselt die Darstellung auf Dunkel", async ({ page }) => {
    await page.goto("/einstellungen/darstellung");
    await page.getByRole("radio", { name: "Dunkel" }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "System" }).check({ force: true });
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
  });

  test("verbindet ein Programm mit Schlüssel und trennt es wieder", async ({ page }) => {
    await page.goto("/einstellungen/claude");
    await page.getByRole("button", { name: /Anderes Programm/ }).click();
    await page.getByLabel(/Name, z. B. Cursor/).fill("Test-Programm");
    await page.getByRole("button", { name: "Schlüssel erzeugen" }).click();
    const list = page.getByRole("region", { name: "Deine Verbindungen" });
    await expect(list.getByText("Test-Programm")).toBeVisible();
    await list.getByRole("button", { name: "Trennen" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Trennen" }).click();
    await expect(list.getByText("Test-Programm")).toHaveCount(0);
  });

  test("hat den Studiengang als eigene Seite; alte Links führen dorthin", async ({ page }) => {
    await page.goto("/studiengaenge");
    await expect(page).toHaveURL(/\/einstellungen\/studiengang$/);
    await expect(page.getByRole("heading", { name: "Studiengänge", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Studiengänge" })).toHaveCount(0);
  });

  test("zeigt auf dem Handy erst die Themen, dann die Seite", async ({ page }) => {
    test.skip(!isPhone(page), "nur auf schmalen Bildschirmen");
    await page.goto("/einstellungen");
    await page.getByRole("link", { name: /Sicherheit/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Sicherheit" })).toBeVisible();
  });
});
