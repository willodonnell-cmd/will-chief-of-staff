# Codex Sites and D1 Migration

Blackhawk is moving toward a new Codex Sites project with D1 as the durable structured store. Vercel, Supabase, and CloudMailIn remain live fallback paths during the parallel run; they are not the target architecture.

## Target Runtime

- Sites hosting metadata lives in `.openai/hosting.json`.
- The logical D1 binding is `DB`.
- The initial D1 schema is `drizzle/0001_sites_d1_initial.sql`, with table names and slot constants mirrored in `db/schema.ts`.
- The app uses the Sites workspace-authenticated user email header for Will's single-user workspace mapping. Local fallback values are `BLACKHAWK_PRIMARY_USER_ID` and `BLACKHAWK_PRIMARY_USER_EMAIL`.

## Direct Agent Brief Ingest

Codex/GPT producers can post structured Executive Brief bundles to:

```text
POST /api/brief/agent-ingest
```

The endpoint accepts the existing Executive Brief JSON contract and writes:

- one structured brief snapshot;
- zero or more task candidates with `candidate` status only.

It does not create durable tasks. Durable task creation remains a separate user-confirmed workflow.

Authentication uses either:

- the Sites `oai-authenticated-user-email` header, matched to `BLACKHAWK_PRIMARY_USER_EMAIL` when configured, only when `BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST=true`; or
- `x-blackhawk-agent-ingest-secret`, matched to `BLACKHAWK_AGENT_INGEST_SECRET`.

The ingest route also accepts `BLACKHAWK_BRIEF_INGEST_SECRET` and `x-blackhawk-brief-ingest-secret` as aliases for the manual proof workflow. Prefer `BLACKHAWK_AGENT_INGEST_SECRET` for new environments.

The unsafe sample proof payload is checked in at `fixtures/codex-sites-executive-brief-payload.json`. It intentionally includes raw/protected fields so the sanitizer tests can prove those fields do not land in D1. A clean contract fixture is checked in at `fixtures/codex-sites-executive-brief-valid-payload.json`.

## Manual Proof Workflow

Use this workflow to prove the D1 lane carries a real structured brief without changing the production `/brief` source.

Required runtime environment on the server:

```text
BLACKHAWK_PRIMARY_USER_ID=will-primary
BLACKHAWK_PRIMARY_USER_EMAIL=will@example.com
BLACKHAWK_AGENT_INGEST_SECRET=<shared-secret>
BLACKHAWK_BRIEF_SOURCE=supabase
BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE=true
```

Required local environment for the proof command:

```text
BLACKHAWK_BASE_URL=https://your-preview-or-sites-url.example
BLACKHAWK_AGENT_INGEST_SECRET=<same-shared-secret>
```

Run the proof against the unsafe sanitizer fixture:

```bash
npm run prove:sites-d1-brief-ingest
```

Or pass an explicit base URL and clean contract fixture:

```bash
npm run prove:sites-d1-brief-ingest -- \
  --base-url https://your-preview-or-sites-url.example \
  --payload fixtures/codex-sites-executive-brief-valid-payload.json
```

The script:

- posts the fixture to `POST /api/brief/agent-ingest`;
- requires the response to include `ok`, `snapshotId`, `slot`, `generatedAt`, and `taskPersistence: candidate_only`;
- reads `GET /api/sites-d1-health`;
- fails unless the health response reports the ingested snapshot as the latest D1 snapshot.

If this fails, keep `BLACKHAWK_BRIEF_SOURCE=supabase`, keep `BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE=true`, and treat D1 as non-production until the proof lane is repaired.

## Live Proof Checklist

Use this checklist before attempting a real Sites/D1 proof against a preview or hosted runtime. This PR is safe to merge only as a non-production proof lane. It does not deploy Sites, does not make D1 the production source of truth, and does not remove CloudMailIn.

1. Select or provision one Codex Sites project for this app. `.openai/hosting.json` currently declares only the logical binding metadata; it intentionally has no `project_id` until a Sites project is provisioned.
2. Bind a D1 database to the Sites project with logical binding name `DB`. The runtime guard returns `d1_binding_unavailable` from `POST /api/brief/agent-ingest` and reports `d1BindingAvailable: false` from `GET /api/sites-d1-health` until this binding exists.
3. Apply `drizzle/0001_sites_d1_initial.sql` to that D1 database before posting proof payloads.
4. Configure runtime env vars with `BLACKHAWK_BRIEF_SOURCE=supabase`, `BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE=true`, `BLACKHAWK_PRIMARY_USER_ID`, `BLACKHAWK_PRIMARY_USER_EMAIL`, and `BLACKHAWK_AGENT_INGEST_SECRET`. Keep `BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST=false` unless intentionally proving workspace-header writes.
5. Confirm the app still builds and tests locally with `npm run verify`.
6. Run `npm run prove:sites-d1-brief-ingest -- --base-url <preview-or-sites-url>` with `BLACKHAWK_AGENT_INGEST_SECRET` set locally to the same shared secret.
7. Verify both `GET /api/sites-d1-health` and `/sites-d1-health` show the latest D1 snapshot produced by the proof run.
8. Inspect the proof response and D1 records for structured-only storage. The unsafe fixture should report sanitized `excludedColumns`; the D1 schema should not contain raw email, raw Graph payload, protected-context, or CloudMailIn raw payload columns.
9. Confirm `/brief` remains Supabase-backed. Rendering from D1 is not implemented on this branch.
10. Roll back by leaving or restoring `BLACKHAWK_BRIEF_SOURCE=supabase`, keeping `BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE=true`, and stopping posts to `/api/brief/agent-ingest`.

## Parallel-Run Health

Use these routes to inspect the new lane without changing the current production brief path:

```text
/sites-d1-health
/api/sites-d1-health
```

They report:

- whether the `DB` binding is visible to the runtime;
- the configured brief source mode;
- whether the primary Sites user mapping and ingest secret are configured;
- whether CloudMailIn fallback is still active;
- the latest detected D1 snapshot when a binding is available.

## Structured-Only Migration Rule

Supabase export transforms must migrate live structured records only. The D1 path excludes raw or protected history, including:

- raw email bodies, raw HTML, raw headers, and CloudMailIn payloads;
- raw Graph payloads;
- protected context blobs;
- OAuth access and refresh tokens, encrypted or plaintext.

The sanitizer in `lib/d1/structured-migration.ts` removes these fields recursively from JSON bundles before D1 import while preserving source references, dedupe keys, slots, timestamps, task candidate status, and linked-task metadata.

## Parallel Run

During the parallel run:

- Supabase-backed pages remain the user-facing runtime.
- D1 receives structured snapshots and task candidates through the new ingest path.
- CloudMailIn remains a fallback intake path until D1 parity is verified.
- Cutover requires comparing Supabase and D1 structured reads for the same live records before retiring fallback routes and dependencies.

Recommended source modes:

```text
BLACKHAWK_BRIEF_SOURCE=supabase
BLACKHAWK_BRIEF_SOURCE=parallel
BLACKHAWK_BRIEF_SOURCE=d1
```

`supabase` is the production-safe default. `parallel` should expose comparison/status surfaces while keeping the Supabase-rendered brief as the primary user experience. `d1` should not be used until direct Sites ingestion has run reliably and D1 structured reads match or improve on the Supabase brief.

Rendering from D1 is not implemented yet. `/brief` remains on the existing Supabase-backed path unless a later change explicitly adds a feature-flagged D1 or parallel renderer.

## CloudMailIn Retirement Criteria

CloudMailIn can move from fallback to deprecated only after:

- direct Sites/GPT ingestion can produce valid structured brief payloads for all six slots and manual runs;
- D1 stores snapshots and task candidates without raw/protected fields;
- `/brief` can render or compare D1 snapshots behind `BLACKHAWK_BRIEF_SOURCE=parallel`;
- at least one parallel-run period proves D1 parity or superiority against the current CloudMailIn/Supabase brief;
- rollback is documented and tested by switching `BLACKHAWK_BRIEF_SOURCE` back to `supabase` and leaving CloudMailIn active.

Rollback is to keep `BLACKHAWK_BRIEF_SOURCE=supabase`, keep `BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE=true`, and stop posting to `/api/brief/agent-ingest` until the D1 lane is repaired.

## Known Deployment Blocker

This branch adds Sites metadata and D1 contracts, but the app still builds as a Next.js artifact. Before production Sites deployment, the repo needs a confirmed Cloudflare Worker-compatible build path, likely OpenNext or an equivalent Sites-supported build artifact. Until that is proven, this branch should be treated as the D1 proof lane rather than a deployable Sites cutover.
