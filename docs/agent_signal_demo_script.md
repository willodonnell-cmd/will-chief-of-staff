# Agent Signal Demo Script

## Purpose

- Demonstrate the chief-of-staff loop from a Microsoft 365 signal to an editable Task or Note.
- Keep the workflow local-only. This does not add app-owned Microsoft integration, OAuth, Graph access, connector reuse, live sync, or new backend behavior.

## Preflight

- ChatGPT Agent exists and has Outlook Email available.
- Outlook Calendar and Teams connectors should be available if possible, but they are optional for the demo.
- `.local/agent-signals.json` is gitignored, stays local, and must never be committed.
- `npm run verify` passes.
- `npm run validate:agent-signals` validates only the local payload at `.local/agent-signals.json`.
- The local dev server may run on port `3000`, `3001`, `3002`, or another available port. Use the port printed by `npm run dev`.

## Demo Flow

1. Run the Microsoft 365 Signal JSON Agent using [chatgpt_agent_signal_prompt.md](./chatgpt_agent_signal_prompt.md).
2. Save the JSON-only output to `.local/agent-signals.json`.
3. Run `npm run validate:agent-signals`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:<active-port>/inbox`.
6. Confirm `Payload source` says `Local Agent JSON`.
7. Confirm connector health shows Teams or Calendar gaps as status signals if those connectors were unavailable.
8. Confirm Outlook-derived signals render cleanly without raw email bodies or noisy raw URLs in user-facing text.
9. Click `Create Task` on an actionable signal.
10. Confirm `/capture` opens with editable `Task Description`, `Next Step`, `Desired Outcome`, `Priority`, and passive `Signal context`.
11. Return to `/inbox`.
12. Click `Create Note` on an actionable signal.
13. Confirm `/capture` opens with editable `Title`, `Body`, and passive `Signal context`.

## Acceptance Checklist

- Styled shell renders correctly.
- Local payload provenance is correct.
- Validation passes.
- Task handoff works.
- Note handoff works.
- The user can edit the draft before saving.
- No real Agent JSON is committed.

## Troubleshooting

- If the viewer shows `Sanitized fixture`, confirm `.local/agent-signals.json` exists and `npm run validate:agent-signals` passes.
- If styling disappears, run `rm -rf .next` and restart the dev server.
- If validation fails, use the repair prompt in [chatgpt_agent_signal_prompt.md](./chatgpt_agent_signal_prompt.md).
- If connectors are unavailable, status signals are acceptable for Teams or Calendar. Outlook Email is required for a meaningful run.
- If `http://localhost:3000` does not work, use the active port printed by `npm run dev`, such as `3002`.
