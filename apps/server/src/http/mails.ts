// The mails of the sign-in service, in the app's look and in the recipient's
// language. The service fetches one template per kind and fills in
// {{ .ConfirmationURL }} and the other fields itself; the template carries every
// language and picks one with the account's `user_metadata.locale`
// ({{ .Data.locale }}). Accounts without it get German: they are the ones that
// existed before the app had languages.
import { LOCALES, type Locale } from "@study/shared";

interface Mail {
  title: string;
  text: string;
  button: string;
  after: string;
}

interface Chrome {
  /** Under the button, for when it does not work. */
  fallback: string;
}

const CHROME: Record<Locale, Chrome> = {
  en: { fallback: "If the button does not work, copy this link into your browser:" },
  de: { fallback: "Falls der Knopf nicht geht, kopiere diesen Link in den Browser:" },
};

export const MAIL_KINDS = ["invite", "recovery", "magic_link", "email_change", "confirmation", "reauthentication"] as const;
export type MailKind = (typeof MAIL_KINDS)[number];

export const MAILS: Record<Locale, Record<MailKind, Mail>> = {
  en: {
    invite: {
      title: "You are invited to Study Manager",
      text: "Someone invited you to Study Manager – the study cloud for courses, scripts, deadlines and shared notes. With the button you set your name and your password.",
      button: "Accept invitation",
      after: "The link works once and expires after 24 hours. If you did not expect an invitation, you can ignore this mail.",
    },
    recovery: {
      title: "New password for Study Manager",
      text: "You asked for a new password. With the button you set it.",
      button: "Set new password",
      after: "The link works once and expires after one hour. If you did not ask for it, ignore this mail – your password stays as it is.",
    },
    magic_link: {
      title: "Your link to Study Manager",
      text: "With the button you sign in to Study Manager and, if you have not done so yet, set your password.",
      button: "Sign in",
      after: "The link works once and expires soon. If you did not ask for it, ignore this mail.",
    },
    email_change: {
      title: "Confirm your new email address",
      text: "The address of your Study Manager account is to change to {{ .NewEmail }}. Confirm this with the button. The change only applies once both addresses are confirmed.",
      button: "Confirm address",
      after: "If you did not make this change, ignore this mail and change your password to be safe.",
    },
    confirmation: {
      title: "Confirm your email address",
      text: "Please confirm your email address for Study Manager.",
      button: "Confirm address",
      after: "If you did not create an account, ignore this mail.",
    },
    reauthentication: {
      title: "Your confirmation code",
      text: "Enter this code in Study Manager: {{ .Token }}",
      button: "",
      after: "If you did not ask for anything, ignore this mail.",
    },
  },
  de: {
    invite: {
      title: "Du bist zum Study Manager eingeladen",
      text: "Jemand hat dich zum Study Manager eingeladen – der Studien-Cloud für Fächer, Skripte, Deadlines und gemeinsame Notizen. Über den Knopf legst du deinen Namen und dein Passwort fest.",
      button: "Einladung annehmen",
      after: "Der Link gilt einmal und läuft nach 24 Stunden ab. Hast du keine Einladung erwartet, kannst du diese Mail ignorieren.",
    },
    recovery: {
      title: "Neues Passwort für den Study Manager",
      text: "Du hast ein neues Passwort angefordert. Über den Knopf legst du es fest.",
      button: "Neues Passwort festlegen",
      after: "Der Link gilt einmal und läuft nach einer Stunde ab. Hast du nichts angefordert, ignoriere diese Mail – dein Passwort bleibt, wie es ist.",
    },
    magic_link: {
      title: "Dein Link zum Study Manager",
      text: "Über den Knopf meldest du dich im Study Manager an und legst, falls noch nicht geschehen, dein Passwort fest.",
      button: "Anmelden",
      after: "Der Link gilt einmal und läuft bald ab. Hast du ihn nicht angefordert, ignoriere diese Mail.",
    },
    email_change: {
      title: "Neue E-Mail-Adresse bestätigen",
      text: "Für dein Konto im Study Manager soll die Adresse zu {{ .NewEmail }} wechseln. Bestätige das über den Knopf. Die Änderung gilt erst, wenn beide Adressen bestätigt sind.",
      button: "Adresse bestätigen",
      after: "Hast du die Änderung nicht veranlasst, ignoriere diese Mail und ändere zur Sicherheit dein Passwort.",
    },
    confirmation: {
      title: "E-Mail-Adresse bestätigen",
      text: "Bitte bestätige deine E-Mail-Adresse für den Study Manager.",
      button: "Adresse bestätigen",
      after: "Hast du kein Konto angelegt, ignoriere diese Mail.",
    },
    reauthentication: {
      title: "Dein Bestätigungscode",
      text: "Gib diesen Code im Study Manager ein: {{ .Token }}",
      button: "",
      after: "Hast du nichts angefordert, ignoriere diese Mail.",
    },
  },
};

/** The language for accounts without one in their metadata. */
const UNSET: Locale = "de";

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Keeps the service's {{ … }} fields intact while escaping the rest. */
const fill = (text: string) => escapeHtml(text).replace(/\{\{ \.(\w+) \}\}/g, "{{ .$1 }}");

/**
 * Picks one text per language with Go template conditions, the language that
 * is not otherwise matched last. `printf "%v"` turns a missing key into text,
 * so that `eq` never compares against nothing.
 */
export function byLocale(texts: Record<Locale, string>): string {
  const others = LOCALES.filter((l) => l !== UNSET);
  const branches = others.map((l, i) => `{{ ${i === 0 ? "if" : "else if"} eq (printf "%v" .Data.locale) "${l}" }}${texts[l]}`);
  return `${branches.join("")}{{ else }}${texts[UNSET]}{{ end }}`;
}

function body(mail: Mail, locale: Locale): string {
  const button = mail.button
    ? `<p style="margin:28px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;border-radius:11px;background:#23211e;color:#f6f3ee;font-weight:600;text-decoration:none">${fill(mail.button)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#6b665e">${fill(CHROME[locale].fallback)}<br><span style="word-break:break-all">{{ .ConfirmationURL }}</span></p>`
    : "";
  return `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${fill(mail.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.55">${fill(mail.text)}</p>
${button}
<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b665e">${fill(mail.after)}</p>`;
}

/** The template for one kind of mail, with every language in it. */
export function mailPage(kind: MailKind): string {
  const pick = (part: (locale: Locale) => string) => byLocale(Object.fromEntries(LOCALES.map((l) => [l, part(l)])) as Record<Locale, string>);
  return `<!doctype html>
<html lang="${pick((l) => l)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${pick((l) => fill(MAILS[l][kind].title))}</title></head>
<body style="margin:0;padding:24px 12px;background:#f6f3ee;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#23211e">
<div style="max-width:520px;margin:0 auto;padding:28px;border-radius:16px;background:#ffffff;border:1px solid #e4ded4">
<p style="margin:0 0 20px;font-weight:700;font-size:15px">Study Manager</p>
${pick((l) => body(MAILS[l][kind], l))}
</div>
</body></html>`;
}

/** The subject for one kind of mail, for `GOTRUE_MAILER_SUBJECTS_*` in the compose files. */
export function mailSubject(kind: MailKind): string {
  return byLocale(Object.fromEntries(LOCALES.map((l) => [l, MAILS[l][kind].title])) as Record<Locale, string>);
}
