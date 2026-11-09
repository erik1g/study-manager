import { expect, openSubject, signIn, test } from "./helpers";

test.describe("Lernkarten", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("lernt eine Karte: Antwort zeigen und bewerten", async ({ page }) => {
    await openSubject(page, "Regelungstechnik");
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Lernkarten" }).click();
    // Earlier browsers in the same run may have learnt some already.
    const left = page.getByText(/^noch \d+ Karten?$/);
    await expect(left).toBeVisible();
    const before = Number((await left.textContent())!.match(/\d+/)![0]);
    await page.getByRole("button", { name: "Antwort zeigen" }).click();
    await page.getByRole("button", { name: /Leicht/ }).click();
    if (before > 1) await expect(page.getByText(before - 1 === 1 ? "noch 1 Karte" : `noch ${before - 1} Karten`)).toBeVisible();
    else await expect(page.getByRole("heading", { name: /Geschafft/ })).toBeVisible();
  });

  test("zeigt ohne Stapel den leeren Zustand und legt einen an", async ({ page }, info) => {
    // A subject without decks for each browser; Konstruktionslehre stays empty for the pictures.
    await openSubject(page, ({ chromium: "Thermodynamik", webkit: "Werkstoffkunde", iphone: "Technische Mechanik" } as Record<string, string>)[info.project.name] ?? "Thermodynamik");
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Lernkarten" }).click();
    await expect(page.getByRole("heading", { name: "Noch keine Lernkarten" })).toBeVisible();
    await page.getByRole("button", { name: "Stapel anlegen" }).click();
    await page.getByRole("textbox", { name: "Neuer Stapel" }).fill("Hauptsätze");
    await page.getByRole("button", { name: "Anlegen", exact: true }).click();
    await page.getByLabel(/^Vorderseite/).fill("Was sagt der erste Hauptsatz?");
    await page.getByLabel("Rückseite").fill("Energie bleibt erhalten.");
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(page.getByText("Was sagt der erste Hauptsatz?")).toBeVisible();
  });
});
