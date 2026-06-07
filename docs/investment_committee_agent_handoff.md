# Investment Committee Agent Handoff

The Investment Committee page can now consume a dedicated weekly-cycle agent payload in addition to the generic Microsoft 365 signal payload.

## Local payload path

- `.local/investment-committee-cycle.json`

This file is local-only and gitignored.

## Why a separate payload exists

The weekly IC workflow is not the same thing as a general Outlook signal list.

The page needs:

- Susan Pi’s weekly package email
- the Box folder link
- the explicit deal list for the week
- matched committee question threads per deal
- matched Q&A answer threads per deal
- a Tuesday reset boundary

That is a weekly workflow handoff, not a generic executive signal feed.

## Local contract pieces

- Prompt: [chatgpt_agent_investment_committee_prompt.md](./chatgpt_agent_investment_committee_prompt.md)
- Parser: [../lib/investment-committee-agent.ts](../lib/investment-committee-agent.ts)
- Fixture: [../fixtures/chatgpt-agent-investment-committee-cycle.json](../fixtures/chatgpt-agent-investment-committee-cycle.json)
- Validator: `npm run validate:investment-committee-cycle`

## Runtime behavior

`/investment-committee` renders from `.local/investment-committee-cycle.json`.

If that file is missing, or if the payload's `resetAt` has already passed, the page shows a clean empty weekly state instead of older residue or generic IC signal inference.

The generic `.local/agent-signals.json` payload is still used elsewhere for:

- Inbox routing
- Today routing summaries
