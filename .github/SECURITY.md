# Sicherheit

Der Study Manager verwaltet Accounts, Dokumente und Notizen von Studierenden. Sicherheitslücken nehmen wir ernst.

## Eine Lücke melden

**Bitte melde Sicherheitslücken nicht öffentlich in einem Issue.** Nutze stattdessen die privaten Meldungen von GitHub:

[Sicherheitslücke melden](https://github.com/erik1g/study-manager/security/advisories/new)

Beschreibe, was du gefunden hast, wie man es nachstellt und welche Version betroffen ist. Wir antworten so schnell wie möglich, in der Regel innerhalb weniger Tage, und halten dich über die Behebung auf dem Laufenden. Auf Wunsch nennen wir dich in den Hinweisen zum Release.

## Welche Versionen Fehlerbehebungen bekommen

Solange das Projekt vor Version 1.0 steht, bekommt nur die **neueste Version** Sicherheitskorrekturen. Aktualisiere regelmäßig (`docker compose pull && docker compose up -d`).

## Was du als Betreiber selbst tun solltest

- Halte deine Installation aktuell und setze `STUDY_VERSION` auf eine feste Version.
- Betreibe sie nur hinter HTTPS (siehe die Admin-Dokumentation).
- Bewahre deine `.env` und das `BACKUP_PASSPHRASE` sicher auf; ohne die Passphrase lassen sich Backups nicht lesen.
