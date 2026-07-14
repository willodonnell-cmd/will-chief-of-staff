# Blackhawk Phase 1 — Live Brief Foundation

## Outcome

Opening Blackhawk in ChatGPT immediately renders the current timestamped brief from the existing backend. Blackhawk then refreshes Outlook, Calendar, and Teams, stores a new canonical live brief only after validation succeeds, and replaces the card with one complete refreshed brief. Scheduled refreshes use the same pipeline and update the live state silently.

## Reuse from the existing repository

- Supabase user resolution and current Blackhawk backend.
- Microsoft 365 signal collectors, source coverage, deterministic IDs, and cross-source dedupe.
- Existing executive-brief snapshots during migration; they are read compatibility data, not the final live contract.
- Existing task, meeting, research, dismiss, and feedback actions as later tool handlers.
- Existing brief card visual language as design reference.

## New Phase 1 boundary

ChatGPT is the primary interface. A thin Apps SDK MCP server exposes tools and a compact stacked widget. The existing Next.js app remains the system backend and an operational fallback.

The app should use the MCP Apps standard bridge (`_meta.ui.resourceUri`, `ui/*`, and `tools/call`) and Streamable HTTP. Tool responses return concise `structuredContent`; authoritative item detail and source URLs remain in the backend response used by the widget.

## Initial tool surface

| Tool | Mutation | Purpose |
| --- | --- | --- |
| `get_live_brief` | No | Return the current canonical brief immediately. |
| `request_brief_refresh` | Yes, idempotent | Start or join an opening/manual refresh and return its status. |
| `get_brief_refresh` | No | Return completed refresh state and the new brief when ready. |
| `dismiss_brief_item` | Yes | Move an item to quiet searchable history. |
| `get_brief_item` | No | Return concise expanded context, evidence, conflict details, and allowed actions. |

Task, Waiting On, drafting, research, and Adjust handlers are represented in the contract but implemented in later Phase 1/Phase 2 slices so the first release cannot write to the wrong destination.

## Refresh transaction

1. Read and render the canonical current brief.
2. Acquire an idempotency lock for the user and refresh window.
3. Collect Outlook, Calendar, and Teams signals and full relevant threads; load attachments only when necessary to understand a candidate.
4. Route Investment Committee candidates away from the main brief.
5. Combine signals with the same `canonicalIssueKey` and preserve all evidence references.
6. Carry forward unresolved items, re-rank them, and label `new`, `changed`, or `reranked` changes.
7. Validate the complete candidate brief.
8. Atomically replace the canonical live state only when validation passes. On failure, preserve the prior brief and expose a small coverage/status warning.

## Phase 1 acceptance gates

- No more than five top actions and no more than one low-confidence visible item.
- No displayed item without a supporting source.
- No duplicate `canonicalIssueKey` across sections.
- Investment Committee work never enters the main brief.
- Partial/unavailable connectors produce a bottom-of-card coverage warning.
- A failed or invalid refresh never replaces a valid current brief.
- Opening refresh returns one complete updated brief, not a stream of partial rankings.
- Only Will's authenticated user can read or mutate the brief.
- No email or Teams message can be sent by any Phase 1 tool.

## Delivery slices

1. Canonical live-brief contract and validator (complete).
2. Supabase live-state repository and atomic refresh promotion (complete in code; migration not deployed).
3. Read/refresh MCP tools with OAuth and Will-only authorization.
4. Compact stacked ChatGPT widget with expanded item controls.
5. Connector orchestration, scheduled refresh handoff, and end-to-end launch-blocker evals.

## Deliberately deferred

- Obsidian writes and daily history.
- Meeting recap forwarding.
- Task and Waiting On mutations.
- Attention-learning proposals.
- Deeper-research persistence.
- Investment Committee UI beyond its persistent link.
