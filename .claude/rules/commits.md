# Commits and versions

Versions and the changelog are made **automatically** from the commit messages (`release-please`, Semantic Versioning, starting at `0.1.0`). That is why **every commit and every pull request title follows Conventional Commits, in English.** The PR title becomes the commit title on squash merge, and CI checks it.

```
<type>(<scope>): <short description, lower case, no full stop, in English>

<optional: the why, when it is not obvious>

<optional: BREAKING CHANGE: what operators must do when updating>
```

| Type | For | Effect |
|---|---|---|
| `feat` | a new feature | minor (`0.1.0` → `0.2.0`) |
| `fix` | a bug fix | patch |
| `perf` | faster | patch |
| `docs`, `test`, `refactor`, `style`, `build`, `ci`, `chore`, `revert` | everything else | no release on its own |
| `feat!`, `fix!` or `BREAKING CHANGE:` in the body | operators must do something | minor before 1.0, major from 1.0 |

- Set `BREAKING CHANGE` whenever operators must do something when updating: a new or changed environment variable, a changed compose file, a step outside the automatic migration.
- The scope is optional but helpful: `planning`, `course`, `deadlines`, `lecture-mode`, `server`, `mcp`, `ui`, `docs`, `docker`, `ci` …
- **One commit, one thing.** Do not mix tidying into a feature.
- **Never touch by hand:** version numbers in `package.json`, `CHANGELOG.md`, `.release-please-manifest.json`. The release PR does that.
- Commit trailer when you commit as an assistant: `Co-Authored-By: Claude <noreply@anthropic.com>` (with the model name the session gives).

Examples:

```
feat(lecture-mode): tabs and two halves side by side
fix(deadlines): editing crashed because hooks came after a return
docs(admin): add an example for Traefik
feat(docker)!: data now lives in named volumes

BREAKING CHANGE: If you use folders on the host, set DATA_DIR and DB_DIR in the .env.
```
