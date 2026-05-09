# Priority Inbox CloudMailin Manual Verification

Use this checklist any time the live inbound email path is changed or reconfigured.

## Preconditions

- `SUPABASE_SERVICE_ROLE_KEY` is set
- `NEXT_PUBLIC_SUPABASE_URL` is set
- `CLOUDMAILIN_BASIC_AUTH_USERNAME` and `CLOUDMAILIN_BASIC_AUTH_PASSWORD` are set for the live CloudMailin path
- `ENABLE_SUPABASE_BOOTSTRAP_FALLBACK=true` is set when production still runs in bootstrap single-user mode
- Supabase migrations through:
  - `20260428120000_priority_inbox_forwarded_email.sql`
  - `20260428143000_priority_inbox_inbound_received_event.sql`
  - `20260428162000_priority_inbox_event_forwarded_email_source.sql`
- The forwarding destination exists in `priority_inbox_forwarding_configs`
- CloudMailin target points to `POST /api/inbox/cloudmailin`

## Live delivery check

1. Send a real email to the CloudMailin-generated address or its custom-domain alias.
2. Confirm CloudMailin shows a `2xx` delivery status for the webhook.
3. Open `/inbox` and confirm a new item appears.
4. Confirm the item is:
   - `source = forwarded_email`
   - `ingestion_mode = forwarded`
   - in `Needs Review` unless existing routing logic intentionally says otherwise
5. Confirm sender, subject, timestamp, summary, and attachment cues look reasonable.

## Detail check

1. Open the inbox item.
2. If there is no native source URL, confirm the CTA says `Open details`.
3. Confirm the detail view shows:
   - original sender
   - forwarded-by identity when available
   - destination address
   - recovered native link only if one truly exists
   - raw forwarded content and parsed detail content

## Persistence check

Verify Supabase rows exist in:

- `priority_inbox_items`
- `priority_inbox_forwarded_email_sources`
- `priority_inbox_events`
- `captures` after using `Create task`, `Save reference`, or `Add commitment`

Confirm the event row includes:

- `action = inbound_received`
- `source = forwarded_email`
- dedupe/provider metadata in `metadata`

## Canonical routing check

1. From a forwarded-email inbox item, use `Create task`.
2. Confirm the item moves to `Handled`.
3. Confirm the handled row links to a real downstream object, not just `/library`.
4. Verify the created `captures` row includes:
   - `priority_inbox_item_id`
   - `priority_inbox_source_metadata`
   - `native_source_link` only when a real native source URL exists
   - forwarded-email source linkage metadata when the item came through the forwarding path
5. Open the created Library item and confirm the `Source linkage` panel exposes the native link or forwarded-detail fallback truthfully.
6. Repeat for `Save reference`.

If Supabase is blocked in local/dev, use `/api/dev/priority-inbox-local-store` to inspect or reset the file-backed fallback state before repeating this flow. The resulting Library object should render as `Local only` and remain read-only until canonical storage is reachable again.

## Restore behavior

1. Restore from `Handled` should move the inbox item back into an active inbox state.
2. The created task/reference should remain intact; restore is inbox-state recovery, not object deletion.

## Duplicate check

1. Re-send the same message or trigger a CloudMailin retry.
2. Confirm Blackhawk does not create a second inbox item for the same external message id.
3. Confirm a new `inbound_received` event is recorded with `deduplicated = true`.

## Failure-path check

1. Send a request with bad auth and confirm the route returns `401`.
2. Send a malformed payload and confirm the route returns `4xx`.
3. Temporarily break storage/config and confirm ingest returns `5xx` instead of a false success.

## Troubleshooting

- If responses or logs contain `Unsanctioned Application Activity`, the current network is blocking Supabase access before Blackhawk can persist the inbox item.
- In that case, treat the integration as not operational from this network even if local UI wiring renders and the forwarding destination appears configured.
