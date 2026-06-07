# blackhawk-m365-signal-agent

`blackhawk-m365-signal-agent` is a production-oriented backend worker that scans Will O'Donnell's Microsoft 365 workstream, emits one strict signal payload, and persists that payload into Blackhawk through the durable import workflow.

## What it does

- checks Blackhawk for pending manual run requests before every scan
- claims the oldest unexpired manual request when one exists
- collects Outlook inbox and sent-mail context, Outlook calendar events, and relevant Teams DMs or high-priority group chats
- applies transparent rules-based scoring, suppression, routing, and deduplication
- validates exactly one payload before import
- posts the payload to Blackhawk and treats the run as successful only when a run id is returned
- completes or fails the manual request after claim when needed

## Architecture

Service layout:

- `clients/`
  - `blackhawk-client.ts` for pending request, claim, import, complete, and fail calls
  - `microsoft/graph-client.ts` for Microsoft Graph reads using client credentials
- `collectors/`
  - Outlook, Calendar, and Teams collectors that turn raw provider records into normalized candidates
- `classifiers/`
  - rules-based scoring and routing classifiers
- `dedupe/`
  - overlapping signal merge logic with canonical-source preference
- `payload/`
  - strict runtime payload schemas, validation, and payload assembly
- `scheduler/`
  - weekday cron definitions in `America/New_York`
- `workflows/`
  - the end-to-end run orchestration

## Environment

Required:

- `BLACKHAWK_BASE_URL`
- `BLACKHAWK_IMPORT_SECRET`
- `M365_TENANT_ID`
- `M365_CLIENT_ID`
- `M365_CLIENT_SECRET`
- `M365_USER_EMAIL` or `M365_USER_ID`
- `TZ=America/New_York`

Optional:

- `LOG_LEVEL`
- `DEFAULT_LOOKBACK_HOURS`
- `DEFAULT_CALENDAR_LOOKBACK_HOURS`
- `DEFAULT_CALENDAR_LOOKAHEAD_DAYS`
- `BLACKHAWK_TENANT_LABEL`
- `BLACKHAWK_OWNER_NAME`
- `BLACKHAWK_REQUEST_TIMEOUT_MS`
- `M365_GRAPH_BASE_URL`

## Run locally

From the repo root:

```bash
tsx src/blackhawk-m365-signal-agent/index.ts
```

The CLI prints only the final worker status object:

```json
{
  "status": "succeeded",
  "runId": "run-123",
  "counts": {
    "submitted": 4,
    "accepted": 3,
    "investmentCommitteeRouted": 1,
    "suppressed": 1,
    "rejected": 0
  }
}
```

## Run tests

```bash
tsx --test tests/blackhawk-m365-signal-agent.test.ts
```

## Scheduling

The scheduler abstraction exposes these weekday schedules in `America/New_York`:

- `30 7 * * 1-5`
- `0 12 * * 1-5`
- `0 17 * * 1-5`

Those schedules live in `scheduler/schedule-config.ts`, not inside collectors.

## Manual runs

Workflow order:

1. `GET /api/agent-run-requests/pending`
2. claim the oldest unexpired request
3. run the scan with any request-context window overrides
4. include `manualRunRequestId` in the payload and `x-agent-run-request-id` in the import request
5. complete the manual request only after Blackhawk import succeeds with a run id
6. fail the manual request if any post-claim step fails

## Payload contract

The worker emits one envelope with:

- `producer = "chatgpt_agent"`
- `connectorFamily = "microsoft_365"`
- `status = "succeeded" | "failed"`
- `sourceCoverage` for `outlook`, `calendar`, and `teams`
- `signals[]` using strict enums for source, signal type, attention, and routing surface

Each signal always uses `protectedContext: true` and includes `routingHints.recommendedSurface`.

## Security notes

- secrets are required only through env vars
- logs are structured and pass through shared redaction utilities
- the worker never logs the Blackhawk import secret, Microsoft client secret, bearer tokens, or full raw content bodies
- manual request failure messages are truncated and redacted before callbacks

## Deployment notes

- the Graph client assumes the tenant and app registration have the necessary application permissions for mail, calendar, and Teams chat reads
- if the deployed Blackhawk import endpoint still enforces the older intake contract, this worker payload remains compatible with the current repo parser because the new fields are additive
- idempotency is request-based for manual runs and window-based for scheduled runs through `x-idempotency-key`
