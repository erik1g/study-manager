import { expect, isPhone, openSubject, signIn, test } from "./helpers";

test.describe("Seitenleiste", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(isPhone(page), "auf dem Handy gibt es die Seitenleiste nicht");
    await signIn(page);
  });

  test("klappt zu Icons ein, bleibt bedienbar und merkt sich den Zustand", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
    const open = (await nav.boundingBox())!.width;
    expect(open).toBeGreaterThan(200);

    await page.getByRole("button", { name: /Seitenleiste einklappen/ }).click();
    await expect.poll(async () => (await nav.boundingBox())!.width).toBeLessThan(100);
    // The places stay reachable by name, only the text is gone.
    await nav.getByRole("link", { name: "Planung" }).click();
    await expect(page).toHaveURL(/\/planung$/);

    await page.reload();
    await expect.poll(async () => (await nav.boundingBox())!.width).toBeLessThan(100);

    await page.keyboard.press("Control+b");
    await expect.poll(async () => (await nav.boundingBox())!.width).toBeGreaterThan(200);
    await expect(page.getByRole("button", { name: /Seitenleiste einklappen/ })).toBeVisible();
  });
});

test.describe("Vorlesungsmodus", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await openSubject(page, "Regelungstechnik");
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Dokumente" }).click();
    await page.getByRole("button", { name: /^Skript Kapitel 4/ }).click();
    await page.getByRole("button", { name: "Vorlesungsmodus", exact: true }).click();
  });

  test("füllt das Fenster, zoomt das Skript und endet mit Esc", async ({ page }) => {
    const lecture = page.getByRole("region", { name: "Vorlesungsmodus" });
    await expect(lecture).toBeVisible();
    const box = (await lecture.boundingBox())!;
    expect(box.width).toBe(page.viewportSize()!.width);
    expect(box.height).toBe(page.viewportSize()!.height);

    await expect(lecture.getByRole("tab", { name: /Skript Kapitel 4/ })).toHaveAttribute("aria-selected", "true");
    await expect(lecture.getByLabel("Seite 1 von 1")).toBeVisible();

    const fit = lecture.getByRole("button", { name: "Seitenbreite" });
    await expect(fit).toHaveText("100 %");
    await lecture.getByRole("button", { name: "Vergrößern" }).click();
    await expect(fit).toHaveText("120 %");
    await lecture.getByRole("button", { name: "Verkleinern" }).click();
    await lecture.getByRole("button", { name: "Verkleinern" }).click();
    await expect(fit).toHaveText("83 %");
    await fit.click();
    await expect(fit).toHaveText("100 %");

    await page.keyboard.press("Escape");
    await expect(lecture).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Regelungstechnik" })).toBeVisible();
  });

  test("hat Tabs, kann Skript neben Notizen teilen und merkt sich alles beim Neuladen", async ({ page }) => {
    const lecture = page.getByRole("region", { name: "Vorlesungsmodus" });
    await expect(lecture.getByRole("tab", { name: /Skript Kapitel 4/ })).toBeVisible();
    await lecture.getByRole("button", { name: "Dokument öffnen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Notizen/ }).click();
    await expect(lecture.getByRole("tab", { name: "Notizen" })).toBeVisible();
    await expect(lecture.getByRole("tab", { name: /Skript Kapitel 4/ })).toBeVisible();

    if (isPhone(page)) {
      await expect(lecture.getByRole("button", { name: "Nebeneinander" })).toHaveCount(0);
      await expect(lecture.getByRole("tablist")).toHaveCount(1);
      return;
    }

    await lecture.getByRole("button", { name: "Nebeneinander" }).click();
    await expect(lecture.getByRole("tablist")).toHaveCount(2);
    // The notes went to the other half and show beside the script.
    await expect(lecture.getByRole("heading", { name: "Stabilität nach Nyquist" })).toBeVisible();
    await expect(lecture.getByLabel("Seite 1 von 1")).toBeVisible();

    await page.reload();
    await expect(lecture).toBeVisible();
    await expect(lecture.getByRole("tablist")).toHaveCount(2);
    await expect(lecture.getByRole("tab", { name: "Notizen" })).toBeVisible();

    await lecture.getByRole("button", { name: "Nebeneinander" }).click();
    await expect(lecture.getByRole("tablist")).toHaveCount(1);
    await lecture.getByRole("button", { name: "Alles schließen" }).click();
    await expect(lecture.getByRole("tab")).toHaveCount(0);
    await expect(lecture.getByText("Nichts geöffnet")).toBeVisible();
  });

  test("öffnet aus den Notizen mit Skript und Notizen nebeneinander", async ({ page }) => {
    test.skip(isPhone(page), "nebeneinander gibt es nur auf breiten Bildschirmen");
    await page.getByRole("button", { name: "Vorlesungsmodus beenden" }).click();
    await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Notizen" }).click();
    await page.getByRole("button", { name: "Vorlesungsmodus", exact: true }).click();
    const lecture = page.getByRole("region", { name: "Vorlesungsmodus" });
    await expect(lecture.getByRole("tablist")).toHaveCount(2);
    await expect(lecture.getByRole("tab", { name: "Notizen" })).toBeVisible();
    await expect(lecture.getByRole("tab", { name: /Skript Kapitel 4/ })).toBeVisible();
  });
});
