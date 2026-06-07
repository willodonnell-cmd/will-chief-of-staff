# Agent Signal Import Handoff

The ChatGPT Agent Microsoft 365 signal flow in this repo now imports into the database-backed Priority Inbox.

- ChatGPT Agent reads Microsoft 365 data through ChatGPT connectors, not through this app.
- The app consumes only structured JSON that matches the Agent signal intake contract.
- The canonical `/inbox` source is the latest database-backed `agent_signal_runs` batch plus accepted `priority_inbox_items` materialized from that run.
- `source_items` stores per-signal source stubs derived from the Agent payload. It does not invent raw Graph metadata.
- `agent_signals` is the audited per-signal ledger for routing outcomes such as `priority_inbox`, `investment_committee`, `suppressed_meta_admin`, `suppressed_low_signal`, and `rejected_invalid`.
- This general Microsoft handoff is the non-IC executive surface for `/inbox`. It should stay broader than the weekly Investment Committee workflow and should not be overwritten by the dedicated IC board payload.
- Weekly Investment Committee workflow output belongs in `.local/investment-committee-cycle.json`, not this Priority Inbox import flow.
- `.local/` is gitignored and must not be committed.
- `.local/agent-signals.json` remains available as a development fallback only.
- `/inbox` must not silently fall back to `.local/agent-signals.json` or fixtures as the product data path.
- Checked-in fixtures remain for validation and demo tooling only.
- When `.local/agent-signals.json` exists but contains malformed JSON or schema-invalid payloads, loading fails loudly instead of silently falling back.

Production source of truth:

- the saved Blackhawk ChatGPT agent runs on schedule in ChatGPT
- that agent reads Microsoft 365 through ChatGPT connectors
- that agent POSTs the strict JSON envelope to `/api/agent-signals/import`

Anything that shells out through a local repo runner is development-only bridge behavior and must not be treated as the canonical production path.

Use `npm run verify` for normal repo verification. It runs `npm test`, `npm run lint`, `npm run build`, and `npm run typecheck` in the known-good order and does not require `.local/` to exist.

`npm run validate:agent-signals` is separate and intentionally strict. It depends on a real local payload at `.local/agent-signals.json`.

Fixture import uses the same service as the API route:

- `npm run import:agent-signals:fixture`
- Fixture imports remain labeled `fixture/dev` in `/inbox`.
- `npm run import:agent-signals:local`
- Local import reads `.local/agent-signals.json` and writes the latest durable Agent run into the database-backed inbox.
- `npm run import:agent-signals:live-example`

On `/inbox`, `Create Task` and `Create Note` open the existing `/capture` flow with an editable draft prefilled from the selected signal. The draft is suggested only; it is not auto-saved.

For a known-good local walkthrough, use [agent_signal_demo_script.md](./agent_signal_demo_script.md).

## Operator Flow

1. Run the saved Blackhawk ChatGPT agent on schedule or on demand.
2. POST the JSON-only result to `/api/agent-signals/import` with `x-agent-signals-import-secret`.
3. Run `npm run verify`.
4. Open `/inbox`.
5. Confirm the latest run timestamp is populated.
6. Confirm accepted counts and source-grouped Outlook, Calendar, and Teams sections render from the imported run.

If you want to exercise the dev fallback path instead:

1. Save the payload to `.local/agent-signals.json`.
2. Run `npm run validate:agent-signals`.
3. Use only local validation or isolated demo tooling; do not treat that path as the product inbox source.

`npm run validate:agent-signals` is expected to fail if `.local/agent-signals.json` does not exist yet. That failure is a prompt to save a local fallback payload first, not a signal to use the fixture as canonical live data. If the payload exists but fails validation, use the repair prompt in `docs/chatgpt_agent_signal_prompt.md` and rerun validation.

This preserves the current bridge boundary:

- No OAuth
- No Microsoft Graph
- No connector calls
- No token handling
- No fake Graph metadata
