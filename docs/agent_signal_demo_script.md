# Agent Signal Demo Script

## Purpose

- Demonstrate the chief-of-staff loop from a Microsoft 365 signal to an editable Task or Note.
- Keep the workflow on the current import bridge. This does not add app-owned Microsoft integration, OAuth, Graph access, connector reuse, or fake raw provider metadata.

## Preflight

- The saved Blackhawk ChatGPT agent exists and has Outlook Email available.
- Outlook Calendar and Teams connectors should be available if possible, but they are optional for the demo.
- `AGENT_SIGNALS_IMPORT_SECRET` is configured for the app environment.
- `npm run verify` passes.
- The local dev server may run on port `3000`, `3001`, `3002`, or another available port. Use the port printed by `npm run dev`.

## Demo Flow

1. Run the saved Blackhawk ChatGPT agent so it emits the Microsoft 365 Priority Inbox payload.
2. POST the JSON-only output to `/api/agent-signals/import` with `x-agent-signals-import-secret`.
3. Start the app with `npm run dev`.
4. Open `http://localhost:<active-port>/inbox`.
5. Confirm `Source mode` says `Database`.
6. Confirm `Latest imported` is populated.
7. Confirm connector health shows Teams or Calendar gaps as status signals if those connectors were unavailable.
8. Confirm Outlook-derived signals render cleanly without raw email bodies or noisy raw URLs in user-facing text.
9. Click `Create Task` on an actionable signal.
10. Confirm `/capture` opens with editable `Task Description`, `Next Step`, `Desired Outcome`, `Priority`, and passive `Signal context`.
11. Return to `/inbox`.
12. Click `Create Note` on an actionable signal.
13. Confirm `/capture` opens with editable `Title`, `Body`, and passive `Signal context`.

## Acceptance Checklist

- Styled shell renders correctly.
- Database-backed signal provenance is correct.
- Task handoff works.
- Note handoff works.
- The user can edit the draft before saving.
- No real Agent JSON is committed.

## Troubleshooting

- If `/inbox` shows `Fixture/dev data`, confirm a live payload was POSTed to `/api/agent-signals/import` successfully.
- If you intentionally want to test the dev fallback, save a payload to `.local/agent-signals.json` and run `npm run validate:agent-signals`.
- If styling disappears, run `rm -rf .next` and restart the dev server.
- If validation fails, use the repair prompt in [chatgpt_agent_signal_prompt.md](./chatgpt_agent_signal_prompt.md).
- If connectors are unavailable, status signals are acceptable for Teams or Calendar. Outlook Email is required for a meaningful run.
- If `http://localhost:3000` does not work, use the active port printed by `npm run dev`, such as `3002`.
