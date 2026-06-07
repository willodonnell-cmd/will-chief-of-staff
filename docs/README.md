# Documentation

Project notes, architecture sketches, and runbooks live here as the chief-of-staff setup grows.

## Pointers

- `**[../AGENTS.md](../AGENTS.md)**` — Repo-wide agent defaults and where other guidance lives.
- `**[../.cursor/rules/](../.cursor/rules/)**` — Cursor rule files (`.mdc`) for persistent AI behavior.
- `chatgpt_agent_microsoft_signal_intake_contract.md` — Narrow contract for agent-produced Outlook, Teams, and Calendar signals.
- `microsoft_graph_native_signal_runs.md` — Production architecture and setup for Blackhawk-native Microsoft Graph signal runs.
- `chatgpt_agent_signal_prompt.md` — Copy/paste-ready ChatGPT Agent prompt for generating contract-valid Microsoft 365 signal JSON for import.
- `chatgpt_agent_investment_committee_prompt.md` — Copy/paste-ready ChatGPT Agent prompt for the weekly Investment Committee cycle payload.
- `agent_signal_local_handoff.md` — Notes for the canonical database import flow and the remaining local/dev fallback path.
- `investment_committee_agent_handoff.md` — Local-only handoff notes for the dedicated weekly IC payload.
- `agent_signal_demo_script.md` — Known-good local demo runbook for the Agent signal to Task/Note workflow.

Add topic-specific files (for example `architecture.md`, `integrations.md`) when they help future you or collaborators.
