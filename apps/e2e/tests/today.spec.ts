import { expect, isPhone, signIn, test } from "./helpers";

test.describe("Heute", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("zeigt den Tag, die Aufgaben, die Fristen und die Fächer", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guten Morgen, Mira");
    const day = page.getByRole("region", { name: "Heute", exact: true });
    await expect(day).toContainText("Als Nächstes: Übungsblatt 4 rechnen um 14:00 Uhr");
    await expect(page.getByRole("region", { name: "Heute erledigen" })).toContainText("Übungsblatt 4 rechnen");
    const due = page.getByRole("region", { name: "Als Nächstes fällig" });
    await expect(due).toContainText("Abgabe Übungsblatt 4");
    await expect(due).toContainText("2");
    await expect(page.getByRole("region", { name: "Deine Fächer" }).locator(".course-card")).toHaveCount(6);
  });

  test("hakt eine Aufgabe ab, dann ist sie weg", async ({ page }, info) => {
    // Each browser ticks a task of its own, so that the runs do not depend on one another.
    const title = `Abhaken ${info.project.name}`;
    if (isPhone(page)) await page.getByRole("button", { name: "Neu anlegen" }).first().click();
    else await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("searchbox", { name: "Suchen oder anlegen" }).fill(`Todo ${title} heute`);
    await page.getByRole("searchbox", { name: "Suchen oder anlegen" }).press("Enter");
    const todo = page.getByRole("region", { name: "Heute erledigen" });
    await todo.getByRole("checkbox", { name: title }).check();
    await expect(todo.getByRole("checkbox", { name: title })).toHaveCount(0);
  });

  test("legt über die Suche ein Todo in einem Satz an", async ({ page }) => {
    if (isPhone(page)) await page.getByRole("button", { name: "Neu anlegen" }).first().click();
    else await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByRole("searchbox", { name: "Suchen oder anlegen" });
    await search.fill("Todo Formelsammlung drucken morgen");
    await expect(page.getByRole("button", { name: /Todo „Formelsammlung drucken“/ }).first()).toBeVisible();
    await search.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Todo angelegt" })).toBeVisible();
    await page.goto("/todos");
    await expect(page.getByRole("checkbox", { name: "Formelsammlung drucken" }).first()).toBeVisible();
  });

  test("findet ein Fach über die Suche", async ({ page }) => {
    if (isPhone(page)) await page.getByRole("button", { name: "Suchen oder anlegen" }).first().click();
    else await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("searchbox", { name: "Suchen oder anlegen" }).fill("Werkstoff");
    await page.getByRole("dialog").getByRole("button", { name: "Werkstoffkunde", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Werkstoffkunde" })).toBeVisible();
  });
});
