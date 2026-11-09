import { expect, openSubject, signIn, silentWav, test } from "./helpers";

// Whisper itself is not run: the transcription goes "with own key" to a
// service, and the service's answer is simulated.
test("transkribiert eine Vorlesung mit (simuliertem) Dienst", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("study.transcription-method", "api");
    localStorage.setItem("study.transcription-provider", "groq");
    localStorage.setItem("study.transcription-key.groq", "test-key");
  });
  await page.route("https://api.groq.com/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ text: "Heute geht es um den Frequenzgang.", segments: [{ start: 0, end: 1, text: "Heute geht es um den Frequenzgang." }] }),
    }),
  );
  await signIn(page);
  await openSubject(page, "Regelungstechnik");
  await page.getByRole("navigation", { name: "Bereiche des Fachs" }).getByRole("button", { name: "Vorlesungen" }).click();
  await page.getByRole("button", { name: "Vorlesung transkribieren" }).first().click();
  await page.locator("input[type=file]").setInputFiles({ name: "vorlesung.wav", mimeType: "audio/wav", buffer: silentWav(2) });
  await page.getByLabel("Titel").fill("Frequenzgang");
  await page.getByRole("button", { name: "Transkribieren", exact: true }).click();
  await expect(page.getByText("Heute geht es um den Frequenzgang.")).toBeVisible({ timeout: 20_000 });
});
