# Blackhawk Microsoft 365 Source Model

## Decision

Blackhawk should not depend on the old pattern where a separate ChatGPT Agent reviews Outlook and emails a summary back into Blackhawk as the primary data path.

The preferred product structure is:

```text
Microsoft 365 live sources
  -> bounded source collectors / connected-app-capable adapters
  -> normalized source signals
  -> noise suppression
  -> person/company/topic/meeting/decision matching
  -> cross-source clustering
  -> Executive Items and Suggested Actions
  -> Blackhawk homepage and detail views
```

The old summary-email path should be treated as a fallback or bootstrap fixture, not the durable source of truth.

## Important constraint

ChatGPT connected apps and MCP tools are available inside the ChatGPT runtime. They are not automatically available to the deployed Blackhawk web app running on Vercel or Cloudflare.

That means Blackhawk has two valid source-access modes:

1. **Blackhawk-native Microsoft 365 collection**, using delegated Microsoft Graph or a hosted MCP bridge controlled by Blackhawk.
2. **External ChatGPT / connected-app collection**, where ChatGPT reads Outlook, Calendar, and Teams, then posts a strict structured signal envelope into Blackhawk.

The app should not pretend that ChatGPT connected apps are directly callable from arbitrary server-side code unless a real MCP bridge or connector runtime is installed for that environment.

## Current repo state

The repo already contains the more durable direction under `src/blackhawk-m365-signal-agent`.

That worker:

- loads Microsoft 365 and Blackhawk configuration from environment variables,
- uses `GraphMicrosoft365Client`,
- collects Outlook, Calendar, and Teams signals,
- classifies and deduplicates candidates,
- builds a structured Microsoft 365 signal payload,
- posts the payload to `/api/agent-signals/import`,
- supports scheduled and manual run requests.

The import route already accepts structured Microsoft 365 signal envelopes at `/api/agent-signals/import`. The schema supports both `chatgpt_agent` and `blackhawk_native` producers.

So the right migration is not to keep emailing summaries into Blackhawk. The right migration is to make the native structured signal path the primary path and keep the old email-summary path only as fallback evidence or a test fixture.

## Target operating model

Blackhawk should consume source data as structured signals, not prose summaries.

Each run should produce:

- source coverage by source,
- bounded windows checked,
- strict signal objects,
- source references,
- candidate actions,
- suppressed / rejected counts,
- coverage notes when Teams or other sources are partial.

The homepage should never show raw Outlook, Teams, and Calendar feeds. These are evidence streams. The homepage object remains the Executive Item.

## Source-specific doctrine

### Outlook

Outlook is the strongest source for explicit asks, approvals, document review, customer/investor/vendor threads, unread/flagged items, and evidence that Will has or has not responded.

The collector should prioritize:

- recent inbox threads,
- unread and flagged items,
- priority senders,
- direct asks,
- approvals/signatures,
- deadlines,
- threads without a sent reply from Will.

### Calendar

Calendar is the timing and prep source.

The collector should prioritize:

- today,
- tomorrow,
- near-term prep-sensitive meetings,
- high-value attendees,
- meeting body/materials,
- meetings connected to active topics, companies, people, or decisions.

Calendar events should not all become Executive Items. Routine and low-value meetings should remain quiet unless they create prep, follow-through, or timing risk.

### Teams

Teams must be treated as scoped and permission-aware.

The connector test showed that broad Teams recent-thread reads can hit permission boundaries. Narrow chat reads work. Therefore Blackhawk should:

- list accessible chats first,
- inspect selected accessible chats,
- skip inaccessible threads without failing the whole run,
- record skipped/inaccessible threads in source coverage,
- avoid treating Teams as tenant-wide omniscience.

The Teams collector should never let one inaccessible chat or meeting thread zero out all Teams coverage. Partial coverage is a normal state, not a fatal state.

## Required source coverage statuses

Use source coverage honestly:

- `included`, source checked and yielded candidates.
- `empty`, source checked and yielded no candidates.
- `permission_denied`, source could not be read because the app lacks permission.
- `unavailable`, source was temporarily unavailable.
- `error`, source failed unexpectedly.
- `partial`, source was partly checked but some bounded reads failed or were inaccessible.

If the current shared schema does not yet allow `partial`, either add it deliberately or encode partial Teams coverage as `included` / `empty` with a reason string until the schema is migrated.

## Recommended migration stance

1. Treat the email-summary agent path as legacy intake.
2. Treat `src/blackhawk-m365-signal-agent` as the primary source architecture.
3. Keep `/api/agent-signals/import` as the stable ingestion contract.
4. Improve Teams collection so inaccessible chats are skipped individually rather than failing the whole Teams source.
5. Continue to support `chatgpt_agent` payloads only for prototyping, backup, and manual connected-app runs.
6. Prefer `blackhawk_native` producer for scheduled Blackhawk-owned source collection.

## Product principle

MCPs and connected apps fetch. Blackhawk judges. Obsidian remembers. The homepage focuses.

Outlook, Teams, and Calendar are evidence streams. They are not the product surface.
