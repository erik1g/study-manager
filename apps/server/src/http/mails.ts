// The mails of the sign-in service, in German and in the app's look. The
// service fills in {{ .ConfirmationURL }} and the other fields itself.

interface Mail {
  title: string;
  text: string;
  button: string;
  after: string;
}

export const MAILS: Record<string, Mail> = {
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
};

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Keeps the service's {{ … }} fields intact while escaping the rest. */
const fill = (text: string) => escapeHtml(text).replace(/\{\{ \.(\w+) \}\}/g, "{{ .$1 }}");

export function mailPage(mail: Mail): string {
  const button = mail.button
    ? `<p style="margin:28px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;border-radius:11px;background:#23211e;color:#f6f3ee;font-weight:600;text-decoration:none">${fill(mail.button)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#6b665e">Falls der Knopf nicht geht, kopiere diesen Link in den Browser:<br><span style="word-break:break-all">{{ .ConfirmationURL }}</span></p>`
    : "";
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${fill(mail.title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f6f3ee;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#23211e">
<div style="max-width:520px;margin:0 auto;padding:28px;border-radius:16px;background:#ffffff;border:1px solid #e4ded4">
<p style="margin:0 0 20px;font-weight:700;font-size:15px">Study Manager</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${fill(mail.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.55">${fill(mail.text)}</p>
${button}
<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b665e">${fill(mail.after)}</p>
</div>
</body></html>`;
}
