# Working agreements

- **Language:** The project language is **English**: code, comments, documentation, `.claude/`, `.github/`, commits, pull requests and issues. Answer the user in the language they write in. The interface speaks English (`apps/web/src/i18n/en.ts`, the source) and German (`de.ts`); every text goes into both. Write German texts with all umlauts (ä, ö, ü, ß) and use the terms fixed in the glossary.
- **Invented data:** In tests, examples, fixtures and docs use only invented people, universities, addresses and credentials (e.g. "Beispieluniversität", `example.org`, Mira/Jonas/Sina). **Never** real names, email addresses, timetables or domains of the maintainers. Real data you need to reproduce something, you anonymise first.
- **No assumptions about the user's servers** in the repository: no fixed IP addresses, domains or paths, not even in comments.
- **Check before you say "done".** Say exactly what you checked and what you did not. If something is only derived from the code and not run, say so.
- **Small, traceable steps:** one thing per commit and pull request; the why goes in the description.
- **Permissions belong in the domain logic** (`apps/server/src/domain`), never only in the interface. The web app and MCP are then treated the same.
- **Keep the documentation up to date:** If you change behaviour, update the matching docs (users, admins or developers in `apps/docs/docs/`) and, if needed, `README.md`.
- **Ask first when unclear, then build:** If a change affects permissions, database migrations, operators (new environment variables, compose file) or publishing, clear it with the user before you implement it.
