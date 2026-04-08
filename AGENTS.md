# Agent instructions — will-chief-of-staff

This repository is **Will O'Donnell’s agentic chief of staff**: tooling and workflows where AI agents help plan, execute, and review work.

## Where guidance lives

| Location | Role |
|----------|------|
| [`.cursor/rules/`](.cursor/rules/) | Cursor rules (`.mdc`): scoped or always-on behavior |
| [`docs/`](docs/) | Human-oriented notes, architecture, and pointers |
| This file | Repo-wide defaults for any agent (Cursor, CI bots, etc.) |

## Operating defaults

1. **Real environment** — Prefer running commands and inspecting results here; do not only suggest commands for the user to run when execution is safe and appropriate.
2. **Small, purposeful changes** — Match existing style; avoid drive-by refactors; keep diffs easy to review.
3. **Skills and rules** — When the repo adds [Cursor skills](https://docs.cursor.com) or project rules, read and follow them before improvising.
4. **Documentation** — Update `docs/` when you introduce non-obvious architecture or operational steps worth remembering.

## Stack and tooling

The stack will evolve with the project. Infer conventions from existing code, `package.json`, `pyproject.toml`, or equivalent manifests once they exist.
