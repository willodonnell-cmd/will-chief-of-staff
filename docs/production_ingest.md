# Production Executive Brief Ingest

Blackhawk production ingest currently uses the CloudMailIn email envelope. Preserve this path until the ChatGPT Workspace Agent has a real direct HTTP/API action.

## Current Production Path

```text
Chief of Staff Agent
-> Outlook Email send
-> CloudMailIn recipient
-> Blackhawk CloudMailIn endpoint
-> D1 latest Executive Brief snapshot
-> /brief page in the ChatGPT Team Site app
```

- Production app: `https://will-chief-of-staff.prologis.chatgpt-team.site`
- CloudMailIn recipient: `2ae55e8794c00d406710@cloudmailin.net`
- CloudMailIn app endpoint: `POST /api/inbox/cloudmailin`
- Direct Worker bridge: `https://will-chief-of-staff-brief-ingest.blackhawk-will.workers.dev`
- Worker health: `GET /health`
- Direct Worker ingest: `POST /api/brief/agent-ingest`

## Protected App Endpoint Warning

Do not use this protected ChatGPT Team Site URL for machine ingest:

```text
https://will-chief-of-staff.prologis.chatgpt-team.site/api/brief/agent-ingest
```

That route is behind ChatGPT Team Site auth and machine callers receive the sign-in wall before the request reaches the ingest handler. The public Worker bridge exists for direct machine ingest when a caller can POST JSON with the shared secret header.

## Agent Behavior

The Chief of Staff Agent sends the Executive Brief by Outlook Email to the CloudMailIn address. The email body should include a human-readable Executive Brief followed by a fenced JSON bundle. The subject should follow the existing `BLACKHAWK_BRIEF_BUNDLE` pattern.

The agent should not claim to POST directly to Blackhawk unless a real HTTP/API action exists. Today, the active production delivery path is email through CloudMailIn.

## Worker Bridge Configuration

The public bridge Worker is configured in `wrangler.public-brief-ingest.jsonc`.

- `workers_dev` is enabled because production currently depends on the `workers.dev` URL.
- `preview_urls` is disabled because preview Worker URLs are not part of the production ingest path.
- The Worker exposes only `GET /health` and `POST /api/brief/agent-ingest`.
- The Worker validates the shared secret header before writing a snapshot.

Do not commit secret values. Configure `BLACKHAWK_AGENT_INGEST_SECRET` or `BLACKHAWK_BRIEF_INGEST_SECRET` as Worker secrets.
