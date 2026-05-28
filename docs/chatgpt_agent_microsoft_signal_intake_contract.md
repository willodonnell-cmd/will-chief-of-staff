# ChatGPT Agent Microsoft Signal Intake Contract

This contract is intentionally narrow.

## Boundary

- ChatGPT Agent reads Outlook, Teams, and Calendar through its own Microsoft 365 connectors.
- This app consumes only the agent's structured JSON output.
- The app does not reuse ChatGPT connector tokens, Microsoft OAuth sessions, Microsoft Graph access tokens, or Outlook runtime route state.

## Local contract pieces

- Canonical signal model: `lib/chief-of-staff-signal.ts`
- Local agent-produced fixture: `fixtures/chatgpt-agent-microsoft-365-signals.json`
- Intake/parser: `lib/microsoft-signal-intake.ts`
- Daily Brief prototype adapter: `lib/prototype-daily-brief.ts`
- Local workflow seam: `trigger/microsoft-signal-intake.ts`

## Expected payload shape

The intake accepts one envelope with:

- `producer = "chatgpt_agent"`
- `connectorFamily = "microsoft_365"`
- `producedAt`
- `tenantLabel`
- `signals[]`

Each signal is normalized into the canonical `ChiefOfStaffSignal` model with:

- source enum: `outlook | teams | calendar`
- signal type enum: `decision | follow_up | meeting | status`
- attention enum: `high | medium | low`
- required title, summary, owner, source label, occurred timestamp, and participants
- optional due timestamp, source URL, and action request
- explicit `protectedContext` boolean

## Why this stays separate

- Connector access belongs to ChatGPT Agent.
- The app stays downstream of that connector boundary.
- The fixture and parser make the contract testable without live mailbox, calendar, or chat access.
