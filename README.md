# will-chief-of-staff

Will O'Donnell's Agentic Chief of Staff.

**Agent & docs:** see [`AGENTS.md`](AGENTS.md) and [`docs/`](docs/).

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
