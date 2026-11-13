# Security

Study Manager manages students' accounts, documents and notes. We take security vulnerabilities seriously.

## Reporting a vulnerability

**Please do not report security vulnerabilities publicly in an issue.** Use GitHub's private reports instead:

[Report a vulnerability](https://github.com/erik1g/study-manager/security/advisories/new)

Describe what you found, how to reproduce it and which version is affected. We answer as quickly as we can, usually within a few days, and keep you posted on the fix. If you like, we credit you in the release notes.

## Which versions get fixes

As long as the project is before version 1.0, only the **latest version** gets security fixes. Update regularly (`docker compose pull && docker compose up -d`).

## What you should do yourself as an operator

- Keep your installation up to date and set `STUDY_VERSION` to a fixed version.
- Run it only behind HTTPS (see the admin documentation).
- Keep your `.env` and the `BACKUP_PASSPHRASE` safe; without the passphrase, backups cannot be read.
