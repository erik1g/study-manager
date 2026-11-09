import { expect, isPhone, openSubject, signIn, test } from "./helpers";

// Who may do what with a shared deadline: members of a subject tick it off for themselves, Bearbeiter and
// Besitzer change and delete it whoever made it, Leser only look and tick.
const NOTE = "Notiz, z. B. Raum";

test.describe("Geteilte Deadlines", () => {
  test("ein Bearbeiter ändert die Deadline eines anderen im Fach", async ({ page }) => {
    // "Klausur" was made by Mira; Jonas is Bearbeiter in the subject.
    await signIn(page, "jonas");
    await openSubject(page, "Regelungstechnik");
    await page.getByRole("button", { name: "Aktionen für Klausur" }).click();
    await page.getByRole("menuitem", { name: "Bearbeiten" }).click();
    // The row turns into the form; the page must not fall apart on the way.
    const notes = page.getByLabel(NOTE);
    await expect(notes).toHaveValue("HS 21");
    await notes.fill("HS 21, Block B");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(/HS 21, Block B/)).toBeVisible();

    await page.getByRole("button", { name: "Aktionen für Klausur" }).click();
    await page.getByRole("menuitem", { name: "Bearbeiten" }).click();
    await page.getByLabel(NOTE).fill("HS 21");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(/Block B/)).toHaveCount(0);
  });

  test("ein Leser sieht die Deadline, ändert sie nicht, hakt sie aber für sich ab", async ({ page }) => {
    await signIn(page, "sina");
    await openSubject(page, "Regelungstechnik");
    await expect(page.getByText("Klausur", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Aktionen für Klausur" })).toHaveCount(0);
    const tick = page.getByRole("checkbox", { name: "Klausur erledigt" });
    await tick.click();
    await expect(tick).toBeChecked();
    await tick.click();
    await expect(tick).not.toBeChecked();
  });

  test("im Kalender kann ein Bearbeiter seine Deadline ändern, löschen und abhaken", async ({ page }) => {
    test.skip(isPhone(page), "die Tagesansicht auf dem Handy zeigt diesen Tag nicht");
    await signIn(page, "jonas");
    await page.goto("/planung");
    await page.getByText("Abgabe Übungsblatt 5").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Löschen" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Erledigt" })).toBeVisible();
    await dialog.getByRole("button", { name: "Bearbeiten" }).click();
    await expect(dialog.getByLabel("Titel, z. B. Klausur oder Abgabe Blatt 3")).toHaveValue("Abgabe Übungsblatt 5");
    await dialog.getByRole("button", { name: "Abbrechen" }).click();
    await expect(dialog.getByRole("button", { name: "Bearbeiten" })).toBeVisible();
  });

  test("im Kalender hat ein Leser nur das Abhaken", async ({ page }) => {
    test.skip(isPhone(page), "die Tagesansicht auf dem Handy zeigt diesen Tag nicht");
    await signIn(page, "sina");
    await page.goto("/planung");
    await page.getByText("Abgabe Übungsblatt 5").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Erledigt" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Bearbeiten" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Löschen" })).toHaveCount(0);
  });
});
