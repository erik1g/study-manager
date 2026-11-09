import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test as base, type Page } from "@playwright/test";

/** The test password of the stack's accounts, from the seed. */
export const PASSWORD = readFileSync(new URL("../../../infra/test/seed.mjs", import.meta.url), "utf8").match(/PASSWORD = "([^"]+)"/)![1]!;

export const PEOPLE = {
  mira: "mira@example.org",
  jonas: "jonas@example.org",
  sina: "sina@example.org",
} as const;
export type Who = keyof typeof PEOPLE;

/** The day the seed is laid around, at 10:00 in Berlin. */
export const NOW = new Date("2026-11-03T10:00:00+01:00");

export const test = base.extend<{ clockFixed: void }>({
  clockFixed: [
    async ({ page }, use) => {
      await page.clock.setFixedTime(NOW);
      await use();
    },
    { auto: true },
  ],
});
export { expect };

export async function signIn(page: Page, who: Who = "mira") {
  await page.goto("/anmelden");
  await page.getByLabel("E-Mail").fill(PEOPLE[who]);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1400) < 900;

/** Goes to a subject by its name, the way a person would. */
export async function openSubject(page: Page, title: string) {
  await page.goto("/faecher");
  await page.getByRole("main").getByRole("link", { name: new RegExp(title) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** A six-digit code of an authenticator app for a base32 secret (RFC 6238). */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[hash.length - 1]! & 0xf;
  const code = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

/** A second of silence as a WAV file, for the transcription. */
export function silentWav(seconds = 1, rate = 16_000): Buffer {
  const samples = seconds * rate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
