# will-chief-of-staff

Will O'Donnell's Agentic Chief of Staff.

**Agent & docs:** see [`AGENTS.md`](AGENTS.md) and [`docs/`](docs/).

## Codex Sites / D1 migration foundation

- The repo now includes a new Sites hosting contract at [`.openai/hosting.json`](/Users/willodonnell/Documents/will-chief-of-staff/.openai/hosting.json) with logical D1 binding `DB`.
- The initial structured D1 schema is in [`drizzle/0001_sites_d1_initial.sql`](/Users/willodonnell/Documents/will-chief-of-staff/drizzle/0001_sites_d1_initial.sql), with table and slot constants in [`db/schema.ts`](/Users/willodonnell/Documents/will-chief-of-staff/db/schema.ts).
- Direct Codex/GPT Executive Brief ingestion is available at `POST /api/brief/agent-ingest`. It writes structured snapshots and task candidates only; it does not auto-create durable tasks.
- Sites/D1 parallel-run status is available at `/sites-d1-health` and `/api/sites-d1-health`.
- The manual proof script is `npm run prove:sites-d1-brief-ingest`; it posts a fixture payload and verifies `/api/sites-d1-health` sees the new D1 snapshot.
- Supabase, Vercel, and CloudMailIn remain parallel-run fallback infrastructure until D1 structured-read parity is verified.
- See [`docs/sites_d1_migration.md`](/Users/willodonnell/Documents/will-chief-of-staff/docs/sites_d1_migration.md) for the structured-only migration rules and cutover notes.

## Supabase auth + bootstrap mode

- The app now includes Supabase auth/session plumbing through:
  - [middleware.ts](/Users/willodonnell/Documents/will-chief-of-staff/middleware.ts) for session refresh
  - [app/auth/callback/route.ts](/Users/willodonnell/Documents/will-chief-of-staff/app/auth/callback/route.ts) for exchanging auth codes into sessions
  - [lib/supabase/current-user.ts](/Users/willodonnell/Documents/will-chief-of-staff/lib/supabase/current-user.ts) for resolving the current app user
- Current user resolution works in this order:
  - authenticated Supabase session matched by `users.auth_user_id`
  - authenticated Supabase session matched by `users.email`
  - bootstrap fallback user when local/dev fallback is enabled
- The default bootstrap user is defined in [lib/supabase/current-user.ts](/Users/willodonnell/Documents/will-chief-of-staff/lib/supabase/current-user.ts) as `BOOTSTRAP_USER_EMAIL` and seeded in [supabase/seed.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/seed.sql).
- Bootstrap fallback stays on by default in local/dev. It is disabled in production unless `ENABLE_SUPABASE_BOOTSTRAP_FALLBACK=true` is set.
- To remove bootstrap mode later:
  - stop using the bootstrap branch in `resolveCurrentAppUser`
  - require an auth-mapped `users` row
  - remove the bootstrap seed user if it is no longer needed

## Agent signal Priority Inbox import bridge

- The canonical `/inbox` source is now the latest database-backed `agent_signal_runs` batch plus accepted `priority_inbox_items`, with raw/stub provenance stored in `source_items` and audited per-signal outcomes stored in `agent_signals`.
- The old `.local/agent-signals.json` path is now a dev fallback only. It should not be treated as the canonical Priority Inbox source.
- The checked-in seeded fixture is no longer a silent default. `/inbox` only uses it in local/dev when `ENABLE_AGENT_SIGNAL_FIXTURE_FALLBACK=true`.
- This bridge imports ChatGPT Agent-derived Microsoft 365 signal envelopes. It is not full Microsoft Graph OAuth ingestion.
- Current ingest flow:
  - scheduled or on-demand Blackhawk ChatGPT agent
  - ChatGPT Outlook / Calendar / Teams connectors
  - Blackhawk-generated Microsoft 365 signal envelope
  - `POST /api/agent-signals/import`
  - Supabase `agent_signal_runs`, `source_items`, `agent_signals`, and accepted `priority_inbox_items`
  - Priority Inbox UI

### Importing a payload

Required environment:

- `AGENT_SIGNALS_IMPORT_SECRET`
- `ENABLE_AGENT_SIGNAL_FIXTURE_FALLBACK=false`
- `SUPABASE_SERVICE_ROLE_KEY`

Example:

```bash
curl -X POST "$APP_URL/api/agent-signals/import" \
  -H "content-type: application/json" \
  -H "x-agent-signals-import-secret: $AGENT_SIGNALS_IMPORT_SECRET" \
  --data-binary @fixtures/chatgpt-agent-microsoft-365-signals.json
```

Local fixture import:

```bash
npm run import:agent-signals:fixture
```

Local Outlook-derived live example import:

```bash
npm run import:agent-signals:live-example
```

Local import scripts and `.local/agent-signals.json` are development tools only. They are not the production automation path.

Future Microsoft Graph work should be implemented separately and should populate `source_items` with true provider metadata such as Graph object IDs, thread or conversation IDs, sender and recipient fields, and raw Graph payloads.

## Blackhawk Microsoft 365 signal agent

- The repo now also contains an isolated backend worker scaffold at [src/blackhawk-m365-signal-agent/README.md](/Users/willodonnell/Documents/will-chief-of-staff/src/blackhawk-m365-signal-agent/README.md).
- This worker is separate from the UI and the current local fixture-based handoff path.
- It is responsible for:
  - checking pending manual run requests
  - collecting Outlook, Calendar, and Teams data through Microsoft Graph
  - classifying and deduplicating executive signals
  - importing one validated payload into Blackhawk

## Outlook Priority Inbox ingestion

- Blackhawk now supports an Outlook-first, read-only Priority Inbox source integration.
- Connection/auth is handled through Microsoft identity delegated OAuth, with Microsoft Graph used only for read access.
- Outlook remains the system of record:
  - synced inbox candidates keep the native Outlook `webLink`
  - `Open` still launches Outlook and does not change inbox state by itself
  - no reply or send behavior is implemented
- Synced source items are stored in `priority_inbox_items`, while connection state and encrypted delegated tokens are stored in `priority_inbox_source_connections`.
- Canonical Library objects created from Outlook-origin Priority Inbox items retain backlinks through:
  - `captures.priority_inbox_item_id`
  - `captures.native_source_link`
  - the inbox item's stored external Outlook message and conversation ids

### Required environment

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
  - optional, defaults to `organizations`
- `MICROSOFT_OUTLOOK_REDIRECT_URI`
  - optional override; otherwise the app derives `/api/integrations/outlook/callback` from the current origin
- `OUTLOOK_TOKEN_ENCRYPTION_KEY`
  - required for encrypted delegated token storage

## Forwarded email Priority Inbox ingestion

- Blackhawk now supports a dedicated forwarded-email intake path for Priority Inbox as the interim real-world workflow while live mailbox OAuth/admin access is blocked.
- This stays intentionally bounded:
  - it creates real `priority_inbox_items` in the existing five-state model
  - it preserves truthful source metadata and raw forwarded content in `priority_inbox_forwarded_email_sources`
  - it does not become mailbox sync, reply/send, full thread reconstruction, or archive-grade storage
- When a recoverable native mail link exists, `Open` uses it.
- When no native link can be recovered, `Open` falls back to the stored forwarded detail view at `/inbox/[id]`.
- The inbound webhook path is `POST /api/inbox/forwarded-email` and requires:
  - `BLACKHAWK_FORWARDING_INGEST_TOKEN`
  - `SUPABASE_SERVICE_ROLE_KEY`
- The CloudMailin-specific live webhook path is `POST /api/inbox/cloudmailin` and supports:
  - CloudMailin `Multipart - Normalized`
  - CloudMailin `JSON - Normalized`
  - HTTP Basic Auth recommended by CloudMailin
  - server-side Supabase persistence via `SUPABASE_SERVICE_ROLE_KEY`
- The inbox UI also includes:
  - a forwarding destination configuration card backed by `priority_inbox_forwarding_configs`
  - a dev-only forwarded-email simulator that uses the same parser and canonical item creation path as the real webhook

### CloudMailin live intake

- Use the CloudMailin-generated inbound address or a custom-domain alias that forwards into CloudMailin.
- Configure CloudMailin to send to:
  - `POST /api/inbox/cloudmailin`
- Recommended auth for CloudMailin:
  - `CLOUDMAILIN_BASIC_AUTH_USERNAME`
  - `CLOUDMAILIN_BASIC_AUTH_PASSWORD`
- Production single-user deployments that still rely on the bootstrap app user also need:
  - `ENABLE_SUPABASE_BOOTSTRAP_FALLBACK=true`
- Fallback/internal auth for the generic JSON ingest path:
  - `BLACKHAWK_FORWARDING_INGEST_TOKEN`
- The live inbox destination must also exist in `priority_inbox_forwarding_configs` or the inbound request will be rejected.
- Live schema must include:
  - `20260428120000_priority_inbox_forwarded_email.sql`
  - `20260428143000_priority_inbox_inbound_received_event.sql`
  - `20260428162000_priority_inbox_event_forwarded_email_source.sql`
- Duplicate delivery or retry from CloudMailin is deduplicated by `external_message_id` on the forwarded-email inbox source, while still recording an inbound event with dedupe metadata.
- Canonical routing from Priority Inbox is enforced server-side:
  - `Create task` must include canonical task input and creates a real `captures` task row
  - `Save reference` must include canonical reference input and creates a real `captures` note row
  - `Add commitment` must include canonical commitment input and creates a real commitment-backed `captures` task row
  - these dispositions are rejected if a caller tries to send metadata-only handled-state transitions
  - canonical captures retain source linkage in both structured columns and `priority_inbox_source_metadata`, including forwarded-email fallback detail when no native mailbox URL exists
  - restoring the inbox item later only reopens triage visibility; it does not auto-delete or archive the created canonical task/reference
