# Technical Architecture Memo

## Current foundation

- One responsive web app built with Next.js App Router, React, TypeScript, and Tailwind.
- Deployment target is Vercel.
- Supabase is the default backend surface for Postgres, auth, and storage.
- The first real data slice uses a single-user bootstrap mode in Supabase so data-backed screens can land before auth/session wiring is complete.
- Supabase auth/session plumbing now exists alongside bootstrap mode, with one shared current-user resolver that prefers session-backed users and falls back to the bootstrap user in local/dev.
- The Initiatives page can now follow the same single-user bootstrap pattern as People, adding initiative-specific tables without requiring auth/session work first.
- Trigger.dev is reserved for background automation and asynchronous workflows.
- Capture is now implemented as a route-level flow inside the shared shell.
- Dev and production verification use separate Next output directories so local preview does not get corrupted by build checks.
- Production verification uses its own TypeScript config file and restores dev-facing generated references after each build check so local preview stays stable across implementation steps.

## Shell decisions

- The shell follows the product rules: dark, architectural navigation around a light mineral content plane.
- Mobile uses a 5-slot bottom navigation with Capture centered and elevated.
- Admin is directly reachable from shell navigation rather than only through secondary or indirect paths.
- Desktop notifications are exposed as a light tray from the existing shell header rather than as a separate full notifications page.
- The desktop notifications bell uses the same shell-object design principles as Capture and Corvette, but stays quieter than Capture and uses Corvette red only for the new-notification indicator.
- iPad and Mac expand into a persistent sidebar shell instead of becoming separate native apps.
- The shell owns the viewport height and keeps page content scrolling independently inside the main content region.
- Capture stays anchored to the visible shell on every device rather than moving with page length.
- Components are token-driven so palette, spacing, elevation, and typography can evolve without rewriting layouts.
- The first pass stays intentionally structural: shell, navigation, responsive layout, and route scaffolding only.

## Capture decisions

- Capture is always available from the center slot of the iPhone bottom nav and from a persistent shell action on iPad and Mac.
- Mobile Capture remains fixed to the visible viewport inside the bottom nav while content scrolls behind it.
- Desktop and iPad Capture remain in a persistent shell location while page content scrolls independently.
- The Capture action inherits route context by passing the current path into the `/capture` route.
- The Capture surface supports `note` and `task` patterns in one shared flow.
- Privacy supports `open`, `protected`, and `hybrid` modes.
- Hybrid capture keeps the main note attached to working context while sensitive detail stays in a protected field.
- Confirmation is intentionally subtle: one line of feedback with adjacent `Undo` and `Edit` actions.
- The top Capture CTA is `Voice Note`, which uses browser speech-to-text when supported rather than promising full audio recording.
- Typed capture writes through a server action to Supabase and clears the form only after a successful server save or an explicit local-only save choice.
- In local/dev, if Node HTTPS cannot reach Supabase because of the machine certificate chain, Capture retries the same write through a narrow `curl -k` server-side fallback so the app can still persist to Supabase without changing the UI flow.
- If Supabase is temporarily unavailable, Capture keeps the draft in place and offers an explicit local queueing fallback rather than presenting a local save as a committed server save.
- Capture shows both recently saved items and locally queued pending items inside the flow so save outcomes remain visible and unambiguous.
- Voice Note failures or unsupported browsers transition clearly back into the typed note flow without breaking the page.
- Corvette red appears only inside protected and hybrid privacy states.
- The Capture control is icon-only in shell navigation and uses a custom old-school microphone so it stays in the same symbolic family as Corvette rather than reading as a generic utility action.

## Initial project structure

- `app/` contains App Router routes and the top-level layout.
- `components/` contains reusable shell and content primitives.
- `lib/` contains navigation config, utilities, and backend client helpers.
- `trigger/` is reserved for Trigger.dev jobs and task definitions.
- `components/capture/` contains the route-level capture flow.
- `components/icons/` contains custom symbolic UI icons such as the Capture microphone.

## Next steps

- Add real route-level product surfaces after the shell is approved.
- Add Supabase auth/session wiring and schema-backed data models.
- Introduce Trigger.dev jobs for summarization, inbox processing, and recurring chief-of-staff workflows.

## Inbox decisions

- Priority Inbox now uses a five-state visible model: `High Priority`, `Needs Review`, `Deferred`, `Handled`, and `Dismissed`.
- The route remains a decision layer rather than a mailbox client: each surfaced item preserves a native source link and `Open` never changes inbox state by itself.
- Rows are ask-first when confidence is high, but keep sender/source context visible enough to preserve trust in why the item is here.
- High-priority actions use a short inline confirmation-and-undo step before the item leaves the active layer; lower-priority items transition immediately with a lighter undo affordance.
- High-priority confirmation is now enforced by both the client timer and the server mutation path so canonical routing or handled/dismissed transitions cannot commit before the undo window expires.
- Deferred items are stored separately, then re-enter the active view when their return time is due rather than staying hidden in the collapsed deferred section.
- Manual routing is supported through an internal `/inbox?manual=1` entry path so Blackhawk-native captures can enter the same triage model without being forced into mail semantics.
- Priority Inbox now persists its item state and action history in Supabase, while still treating Outlook, Gmail, and Teams as native systems of record.
- Local/dev bootstrap mode lazily seeds the inbox from the existing mock definitions so the surface stays populated before live ingestion exists; production empty inboxes remain empty until real inputs or manual adds arrive.
- `Create task` and `Save reference` now create real canonical Library objects in `captures`, then mark the inbox item handled with stored created-object metadata.
- The server mutation path now enforces that `task_created`, `reference_saved`, and `commitment_created` transitions include canonical payloads, so callers cannot silently downgrade those actions into metadata-only handled-state updates.
- Canonical Library items created from Priority Inbox retain backlinks to both the inbox item and the native source so future routing or audit work can trace them cleanly.
- Forwarded-email canonical routing also preserves the forwarded-detail record and fallback detail path inside `priority_inbox_source_metadata`, so source linkage remains truthful even when no native mailbox URL exists.
- Restore remains intentionally simple: it reopens the inbox item for triage, but does not delete or archive the canonical object that was already created.
- Returning an item to an active state clears stale handled/dismissed disposition metadata on the inbox row, while defer events now persist their defer reason in the event audit trail.
- Outlook is the first live source adapter:
  - Microsoft identity delegated OAuth connects a user mailbox without replacing app auth
  - Microsoft Graph ingestion is bounded, read-only, Inbox-scoped, and now split into reusable server-side foundation modules under `lib/microsoft/`
  - connection state and encrypted delegated tokens live in `priority_inbox_source_connections`
  - synced items persist source-specific metadata such as external message id, conversation id, received time, and native Outlook link in `priority_inbox_items`
  - existing Outlook Priority Inbox candidate ingestion remains unchanged in behavior even though OAuth, token refresh, encrypted token handling, and raw Graph mail/profile fetches have been extracted behind a Microsoft foundation layer
  - a canonical `WorkSignal` model now lives under `lib/work-signals/` so future Calendar, Teams, People, and file adapters can normalize into the same internal executive-intelligence shape without rewriting the Outlook sync path
- Forwarded email is now the interim real-world intake path when live Outlook access is blocked:
  - forwarding destinations live in `priority_inbox_forwarding_configs`
  - forwarded email detail, raw content, and truthful parsing metadata live in `priority_inbox_forwarded_email_sources`
  - forwarded items still become normal `priority_inbox_items` and default to `Needs Review`
  - `Open` uses a native link only when one is actually recoverable; otherwise it opens a stored forwarded-detail view rather than faking Outlook
  - dev and local testing use the same forwarded parser and normalization path through an internal simulator, not a separate fake-only model
  - when Supabase is unreachable from a local/dev network, Priority Inbox can fall back to a local file-backed store for forwarding config, forwarded-email intake, detail views, triage state changes, and local-only Library placeholders so the UX remains testable without pretending live persistence succeeded
  - the dev-only route `/api/dev/priority-inbox-local-store` can inspect, reset, and locally transition that fallback state to speed up repeated verification loops on blocked networks
  - CloudMailin is the first explicit live provider path for this workflow:
    - live target route is `/api/inbox/cloudmailin`
    - auth uses CloudMailin-compatible HTTP Basic Auth when configured, with the generic token path retained for internal/dev ingestion
    - the route accepts CloudMailin normalized multipart and normalized JSON payloads, then maps them into the same forwarded-email ingest seam as local/dev
    - malformed payloads reject with clear 4xx responses, while ingest failures return 5xx so provider retry semantics stay truthful
    - duplicate provider retries deduplicate on the forwarded external message id while still recording an `inbound_received` event with dedupe metadata
    - the event log schema must allow `source = forwarded_email` on `priority_inbox_events`, not just on `priority_inbox_items`
    - production deployments that still run the app in bootstrap single-user mode need `ENABLE_SUPABASE_BOOTSTRAP_FALLBACK=true` so `/inbox` resolves the same user context that inbound routes write into
- The ingestion seam is adapter-based so Gmail and Teams can be added later without rewriting the Priority Inbox state machine or action surface.

## People decisions

- People pages are relationship briefs first rather than activity feeds.
- Top-layer order is `current read`, `next interaction` when it is soon or important, `open loops / commitments`, then `recent interactions`.
- Deeper relationship context stays collapsed by default so the page can remain glanceable.
- Explicit `no attention needed` language is allowed when the relationship is in a quiet state.
- Corvette appears only when protected relationship context exists.

## Initiative decisions

- Initiative pages are strategic briefs first rather than project dashboards.
- The top layer is ordered as `why this matters now`, `summary / context`, `current risks / tensions`, then `key changes since last review`.
- Deeper sections stay collapsed by default and expand progressively for stakeholders, signals, open loops, history, linked briefings, and success markers.
- The system is allowed to explicitly say an initiative does not currently need attention.
- Refined B treatment is reserved for the initiative element that truly carries the current strategic gravity.

## Commitment decisions

- Commitments is an obligation surface over canonical Library task objects rather than its own stored model.
- The page order is `overdue`, `due soon`, `active with no due date`, then backgrounded later-dated and recently completed work.
- Every commitment row navigates back to the existing canonical Library detail rather than to a commitments-specific editor.
- Backgrounded and completed commitments stay reachable, but out of the top layer unless they are operationally useful.

## Admin decisions

- Admin is a layered hybrid control surface rather than a systems console.
- The landing page keeps one visible `Recommended changes` module above the broader settings groups.
- Recommended changes must explain the summary, what each change impacts, and why it deserves attention.
- Primary groups are `Agent Behavior`, `Communications`, `Privacy`, and `Views & Navigation`.
- Secondary groups are `Learning` and `Devices & Notifications`.
- Change history stores only material operating changes; cosmetic tuning and minor copy edits stay out of the log.
