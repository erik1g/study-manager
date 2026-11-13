import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAIL_KINDS, mailPage, mailSubject } from "../src/http/mails.ts";
import { world } from "./support.ts";

type World = Awaited<ReturnType<typeof world>>;
let w: World;
beforeAll(async () => {
  w = await world();
});
afterAll(() => w.close());

describe("the language of an account", () => {
  it("starts as the inviter's, for the profile and the mail templates", async () => {
    const { userId } = await w.services.users.invite("mira@example.org", "Mira", { locale: "de" });
    expect((await w.services.users.me(userId)).locale).toBe("de");
    expect(w.accounts.locales.get(userId)).toBe("de");

    const mailed = await w.services.users.invite("jonas@example.org", "Jonas", { byMail: true, locale: "en" });
    expect((await w.services.users.me(mailed.userId)).locale).toBe("en");
    expect(w.accounts.locales.get(mailed.userId)).toBe("en");
  });

  it("is English when nobody says otherwise", async () => {
    const sina = await w.user("Sina");
    expect((await w.services.users.me(sina)).locale).toBe("en");
  });

  it("changes in the profile and in the sign-in service together", async () => {
    const sina = await w.user("Sina");
    await w.services.users.updateProfile(sina, { locale: "de" });
    expect((await w.services.users.me(sina)).locale).toBe("de");
    expect(w.accounts.locales.get(sina)).toBe("de");
    // @ts-expect-error: not a supported language
    await expect(w.services.users.updateProfile(sina, { locale: "fr" })).rejects.toMatchObject({ code: "invalid_locale" });
    expect((await w.services.users.me(sina)).locale).toBe("de");
  });
});

describe("the mails", () => {
  it("carry every language and fall back to German for accounts without one", () => {
    const page = mailPage("invite");
    expect(page).toContain('{{ if eq (printf "%v" .Data.locale) "en" }}');
    expect(page).toContain("Accept invitation");
    expect(page).toContain("Einladung annehmen");
    expect(page.indexOf("{{ else }}")).toBeLessThan(page.indexOf("Einladung annehmen"));
    // The sign-in service fills these in; escaping must leave them alone.
    expect(page).toContain("{{ .ConfirmationURL }}");
    expect(mailPage("email_change")).toContain("{{ .NewEmail }}");
    expect(mailPage("reauthentication")).toContain("{{ .Token }}");
  });

  it("have the same subjects in the compose files as here", async () => {
    for (const file of ["../../../docker-compose.yml", "../../../infra/compose/dev.yml"]) {
      const compose = await readFile(new URL(file, import.meta.url), "utf8");
      for (const kind of MAIL_KINDS) {
        const line = compose.split("\n").find((l) => l.includes(`GOTRUE_MAILER_SUBJECTS_${kind.toUpperCase()}:`));
        expect(line, `${file}: ${kind}`).toBeDefined();
        expect(line!.split(": ").slice(1).join(": ").trim()).toBe(`'${mailSubject(kind)}'`);
      }
    }
  });
});
