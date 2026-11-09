import { expect, isPhone, openSubject, signIn, test } from "./helpers";

// Mira invites Jonas, who already has an account, into a subject of hers;
// each browser a different subject, so that the runs do not depend on one another.
const SUBJECT: Record<string, string> = { chromium: "Thermodynamik", webkit: "Werkstoffkunde", iphone: "Konstruktionslehre" };

test("lädt ein registriertes Mitglied direkt ein; es nimmt in den Benachrichtigungen an", async ({ page, browser }, info) => {
  const subject = SUBJECT[info.project.name] ?? "Thermodynamik";
  await signIn(page, "mira");
  await openSubject(page, subject);
  await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Mitglieder, Aktivität und Papierkorb" }).click();
  await page.getByRole("menuitem", { name: "Mitglieder" }).click();

  const add = page.getByRole("region", { name: "Mitglied hinzufügen" });
  await add.getByRole("searchbox", { name: "Person suchen" }).fill("Jon");
  const results = add.getByRole("list", { name: "Person suchen" });
  await expect(results.getByText("jonas@example.org")).toBeVisible();
  await add.getByLabel("Als").selectOption({ label: "Leser" });
  await results.getByRole("button", { name: "Einladen" }).click();
  await expect(results.getByText("eingeladen")).toBeVisible();
  await expect(add.getByRole("list", { name: "Eingeladen, noch keine Antwort" }).getByText("Jonas Weber")).toBeVisible();

  // Jonas, in a window of his own.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL, locale, timezoneId } = info.project.use;
  const other = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL, locale, timezoneId });
  const jonas = await other.newPage();
  await jonas.clock.setFixedTime(new Date("2026-11-03T10:00:00+01:00"));
  await signIn(jonas, "jonas");
  const bell = isPhone(jonas)
    ? jonas.getByRole("button", { name: /^Benachrichtigungen \(\d+\)$/ })
    : jonas.getByRole("link", { name: /Benachrichtigungen/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const invitation = jonas.getByRole("listitem").filter({ hasText: `„${subject}“` }).filter({ hasText: "lädt dich" });
  await expect(invitation).toContainText("Mira Hansen lädt dich");
  await invitation.getByRole("button", { name: "Annehmen" }).click();
  await expect(jonas.getByRole("status").filter({ hasText: `Du bist jetzt in „${subject}“` })).toBeVisible();
  await invitation.getByRole("link", { name: "Zum Fach" }).click();
  await expect(jonas.getByRole("heading", { level: 1, name: subject })).toBeVisible();
  await expect(jonas.getByText("Du bist Leser in diesem Fach.")).toBeVisible();
  await other.close();

  // Mira hears of it.
  await page.goto("/benachrichtigungen");
  await expect(page.getByText(`Jonas Weber ist „${subject}“ beigetreten.`)).toBeVisible();
});
