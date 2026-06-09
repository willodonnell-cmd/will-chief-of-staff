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

- the Sites `oai-authenticated-user-email` header, matched to `BLACKHAWK_PRIMARY_USER_EMAIL` when configured; or
- `x-blackhawk-agent-ingest-secret`, matched to `BLACKHAWK_AGENT_INGEST_SECRET`.

The sample proof payload is checked in at `fixtures/codex-sites-executive-brief-payload.json`. It intentionally includes raw/protected fields so the sanitizer tests can prove those fields do not land in D1.

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
