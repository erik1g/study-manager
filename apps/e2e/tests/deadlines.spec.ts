import { expect, isPhone, signIn, test } from "./helpers";

test.describe("Deadlines", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("abgehakt rutschen sie zu „Erledigt und vorbei“ und bleiben sichtbar", async ({ page }, info) => {
    // A deadline of this browser's own, so that the runs do not depend on one another.
    const title = `Abgabe ${info.project.name}`;
    if (isPhone(page)) await page.getByRole("button", { name: "Neu anlegen" }).first().click();
    else await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("searchbox", { name: "Suchen oder anlegen" }).fill(`Deadline ${title} morgen`);
    await page.getByRole("searchbox", { name: "Suchen oder anlegen" }).press("Enter");
    // Leaving before the deadline is saved would cancel the request.
    await expect(page.getByRole("status").filter({ hasText: "Deadline angelegt" })).toBeVisible();

    await page.goto("/todos");
    // The row moves to the other list once ticked, so a plain click, then look there.
    await page.getByRole("checkbox", { name: `${title} erledigt` }).click();
    const settled = page.getByRole("region", { name: "Erledigt und vorbei" });
    await expect(settled.getByText(title, { exact: true })).toBeVisible();
    await expect(settled.getByText("Abgabe Übungsblatt 3", { exact: true })).toBeVisible();

    await settled.getByRole("checkbox", { name: `${title} erledigt` }).click();
    await expect(settled.getByText(title, { exact: true })).toHaveCount(0);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  });

  test("Heute zeigt nur Offenes und verweist auf den Rest", async ({ page }) => {
    const due = page.getByRole("region", { name: "Als Nächstes fällig" });
    await expect(due.getByText("Abgabe Übungsblatt 3")).toHaveCount(0);
    await due.getByRole("link", { name: /erledigt oder vorbei/ }).click();
    await expect(page.getByRole("region", { name: "Erledigt und vorbei" })).toBeVisible();
  });
});
