import { expect, isPhone, signIn, test } from "./helpers";

test.describe("Modulkatalog", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("öffnet ein Modul als Popup, das selbst scrollt", async ({ page }) => {
    await page.goto("/einstellungen/studiengang");
    await page.getByText("Maschinenbau").first().click();
    await page.getByRole("button", { name: /Technische Mechanik I/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Technische Mechanik I" })).toBeVisible();
    const createButton = dialog.getByRole("button", { name: "Fach anlegen" });
    await createButton.scrollIntoViewIfNeeded();
    await expect(createButton).toBeInViewport();
    await dialog.getByRole("button", { name: "Schließen" }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("Planung", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("nutzt auf dem Handy die Höhe und bietet Tag, Woche, Monat", async ({ page }) => {
    test.skip(!isPhone(page), "nur auf schmalen Bildschirmen");
    await page.goto("/planung");
    const calendar = page.locator(".planning-calendar");
    await expect(calendar.locator(".fc-timeGridDay-view")).toBeVisible();
    const box = (await calendar.boundingBox())!;
    expect(box.height).toBeGreaterThan((page.viewportSize()!.height) * 0.6);
    for (const name of ["Tag", "Woche", "Monat"]) await expect(calendar.getByRole("button", { name })).toBeVisible();
    await calendar.getByRole("button", { name: "Woche" }).click();
    await expect(calendar.locator(".fc-timeGridWeek-view")).toBeVisible();
  });

  test("wechselt mit der Fenstergröße zwischen Tag und sieben Tagen", async ({ page }) => {
    test.skip(isPhone(page), "ändert die Fenstergröße selbst");
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/planung");
    await expect(page.locator(".fc-timeGridWeek-view")).toBeVisible();
    await expect(page.locator(".fc-col-header-cell")).toHaveCount(7);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.locator(".fc-timeGridDay-view")).toBeVisible();
    await page.setViewportSize({ width: 1400, height: 900 });
    await expect(page.locator(".fc-timeGridWeek-view")).toBeVisible();
    await expect(page.locator(".fc-col-header-cell")).toHaveCount(7);
  });
});
