import { expect, openSubject, signIn, test } from "./helpers";

test.describe("Ein Fach", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await openSubject(page, "Regelungstechnik");
  });

  test("hat seine Bereiche als Reiter, die übrigen hinter ⋯", async ({ page }) => {
    const areas = page.getByRole("navigation", { name: "Bereiche des Fachs" });
    for (const tab of ["Überblick", "Dokumente", "Notizen", "Vorlesungen", "Lernkarten"]) await expect(areas.getByRole("button", { name: tab })).toBeVisible();
    await areas.getByRole("button", { name: "Mitglieder, Aktivität und Papierkorb" }).click();
    await page.getByRole("menuitem", { name: "Mitglieder" }).click();
    await expect(page.getByText("Jonas Weber", { exact: true })).toBeVisible();
    await expect(page.getByText("Sina Okafor", { exact: true })).toBeVisible();
  });

  test("legt eine Deadline im Überblick an", async ({ page }) => {
    await page.getByRole("button", { name: "Deadline", exact: true }).click();
    await page.getByLabel("Titel, z. B. Klausur oder Abgabe Blatt 3").fill("Testat Bode");
    await page.getByRole("checkbox", { name: "ganztägig" }).check();
    await page.getByLabel("Datum").fill("2026-11-20");
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(page.getByText("Testat Bode", { exact: true }).first()).toBeVisible();
  });

  test("lädt eine Datei hoch, benennt sie um und holt sie aus dem Papierkorb", async ({ page }) => {
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Dokumente" }).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "In „Sonstiges“ hochladen" }).click();
    await (await chooser).setFiles({ name: "Notizen Tutorium.txt", mimeType: "text/plain", buffer: Buffer.from("Bode, Nyquist, Wurzelortskurve") });
    const row = page.getByRole("button", { name: /^Notizen Tutorium\.txt/ });
    await expect(row).toBeVisible();

    await page.getByRole("button", { name: "Aktionen für Notizen Tutorium.txt" }).click();
    await page.getByRole("menuitem", { name: "Umbenennen" }).click();
    await page.getByLabel("Neuer Name").fill("Tutorium 1.txt");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByRole("button", { name: /^Tutorium 1\.txt/ })).toBeVisible();

    await page.getByRole("button", { name: "Aktionen für Tutorium 1.txt" }).click();
    await page.getByRole("menuitem", { name: "In den Papierkorb" }).click();
    await expect(page.getByRole("button", { name: /^Tutorium 1\.txt/ })).toHaveCount(0);

    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Mitglieder, Aktivität und Papierkorb" }).click();
    await page.getByRole("menuitem", { name: "Papierkorb" }).click();
    await page.getByRole("button", { name: "Wiederherstellen" }).click();
    await expect(page.getByText("Der Papierkorb ist leer.")).toBeVisible();
  });

  test("öffnet ein PDF in der Ansicht", async ({ page }) => {
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Dokumente" }).click();
    await page.getByRole("button", { name: /^Skript Kapitel 4/ }).click();
    await expect(page.getByLabel("Seite 1 von 1")).toBeVisible();
  });

  test("schreibt gemeinsame Notizen", async ({ page }) => {
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Notizen" }).click();
    await expect(page.getByRole("heading", { name: "Stabilität nach Nyquist" })).toBeVisible();
    await page.getByRole("radio", { name: "Schreiben" }).check({ force: true });
    const editor = page.getByRole("textbox", { name: "Gemeinsam" });
    await editor.fill(`${await editor.inputValue()}\n- Neu aus dem Test`);
    await expect(page.getByText(/zuletzt Mira Hansen/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("radio", { name: "Lesen" }).check({ force: true });
    await expect(page.getByText("Neu aus dem Test").first()).toBeVisible();
  });
});
