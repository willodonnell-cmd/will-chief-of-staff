# Investment Committee

`/investment-committee` is a first-class weekly workflow surface. It is intentionally separate from both Library and Inbox.

## Why it is separate

- `Library` remains the durable working-memory store for captures and executive objects.
- `Inbox` remains the routed Microsoft 365 signal surface.
- `Investment Committee` is the weekly operating workflow for memo packages, deal review progress, and Friday question submission.

This means IC state is not stored as Library captures and is not modeled as an Inbox-only filter.

## System of record

The section is backed by two owner-scoped Supabase tables:

- `investment_committee_cycles`
- `investment_committee_deals`

These store:

- weekly cycle timing
- Box package link
- deal rows
- memo review progress
- question drafting / sent state

## Current model

The page now aims to stay much simpler:

- capture Susan Pi's weekly package email as the weekly anchor
- show the Box folder link for that week
- show one breakout card per deal
- show peer-question and Q&A answer traffic grouped under the matching deal
- refresh to the next week after the Tuesday reset boundary

The page prefers a dedicated weekly IC agent payload when present:

- `.local/investment-committee-cycle.json`

The generic Microsoft 365 signal payload still supports:

- IC routing counts
- Inbox review lane links

The page does not try to be:

- a full email client
- a giant process explainer
- a Library-backed capture board
- a document-analysis agent workbench
