import { expect, openSubject, signIn, test } from "./helpers";

test.describe("Rollen", () => {
  test("Leser sehen das Fach, können aber nichts hochladen", async ({ page }) => {
    await signIn(page, "sina");
    await openSubject(page, "Regelungstechnik");
    await expect(page.getByText("Du bist Leser in diesem Fach.")).toBeVisible();
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Dokumente" }).click();
    await expect(page.getByRole("button", { name: /^Skript Kapitel 4/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /hochladen/ })).toHaveCount(0);
  });

  test("Bearbeiter können hochladen, aber keine Rollen vergeben", async ({ page }) => {
    await signIn(page, "jonas");
    await openSubject(page, "Regelungstechnik");
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Dokumente" }).click();
    await expect(page.getByRole("button", { name: "In „Skripte“ hochladen" })).toBeVisible();
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Mitglieder, Aktivität und Papierkorb" }).click();
    await page.getByRole("menuitem", { name: "Mitglieder" }).click();
    await expect(page.getByRole("combobox", { name: /Rolle von/ })).toHaveCount(0);
  });

  test("Fächer anderer erscheinen nicht", async ({ page }) => {
    await signIn(page, "sina");
    await page.goto("/faecher");
    await expect(page.getByRole("main").getByRole("link", { name: /Regelungstechnik/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Thermodynamik/ })).toHaveCount(0);
  });
});
