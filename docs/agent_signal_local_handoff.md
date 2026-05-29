# Agent Signal Local Handoff

The ChatGPT Agent Microsoft 365 signal flow in this repo is local-only.

- ChatGPT Agent reads Microsoft 365 data through ChatGPT connectors, not through this app.
- The app consumes only structured JSON that matches the Agent signal intake contract.
- Real Agent-produced JSON should be saved locally at `.local/agent-signals.json`.
- `.local/` is gitignored and must not be committed.
- When `.local/agent-signals.json` is missing, the app falls back to `fixtures/chatgpt-agent-microsoft-365-signals.json`.
- When `.local/agent-signals.json` exists but contains malformed JSON or schema-invalid payloads, loading fails loudly instead of silently falling back.

Use `npm run verify` for normal repo verification. It runs `npm test`, `npm run lint`, `npm run build`, and `npm run typecheck` in the known-good order and does not require `.local/` to exist.

`npm run validate:agent-signals` is separate and intentionally strict. It depends on a real local payload at `.local/agent-signals.json`.

On `/inbox`, `Create Task` and `Create Note` open the existing `/capture` flow with an editable draft prefilled from the selected signal. The draft is suggested only; it is not auto-saved.

For a known-good local walkthrough, use [agent_signal_demo_script.md](./agent_signal_demo_script.md).

## Operator Flow

1. Run the prompt in `docs/chatgpt_agent_signal_prompt.md` with ChatGPT Agent.
2. Save the JSON-only result to `.local/agent-signals.json`.
3. Run `npm run verify`.
4. Run `npm run validate:agent-signals`.
5. Open `/inbox`.
6. Confirm `Payload source` says `Local Agent JSON`.

`npm run validate:agent-signals` is expected to fail if `.local/agent-signals.json` does not exist yet. That failure is a prompt to save a local payload first, not a signal to use the fixture instead. If the payload exists but fails validation, use the repair prompt in `docs/chatgpt_agent_signal_prompt.md` and rerun validation.

This preserves the local-only handoff boundary:

- No OAuth
- No Microsoft Graph
- No connector calls
- No token handling
- No live sync
- No Supabase schema changes
