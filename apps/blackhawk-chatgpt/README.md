# Blackhawk ChatGPT app — Phase 1 checkpoint

This package exposes the compact Blackhawk executive brief as a ChatGPT MCP App. It currently serves explicitly fictional preview data; the live-state adapter is the next binding step.

ChatGPT is the user interface. The Cloudflare Worker in this package is only the hidden MCP transport that makes the brief tools and interactive card available to ChatGPT. It is separate from, and does not modify, the existing Sites project.

## Safety boundary

- Local development defaults to `BLACKHAWK_AUTH_MODE=preview`.
- `NODE_ENV=production` refuses to start in preview mode.
- Authenticated mode validates Supabase JWT signature, issuer, Blackhawk-specific audience, expiry/not-before, OAuth scopes, client ID, and Will's allowlisted identity.
- Use `BLACKHAWK_PRIMARY_OWNER_USER_ID` for the immutable primary identity and `BLACKHAWK_RECOVERY_USER_IDS` for explicitly approved recovery identities. Email-only authorization remains a transitional fallback.
- Every tool advertises OAuth and returns an MCP `mcp/www_authenticate` challenge when no authenticated identity is attached.
- No tool sends email or Teams messages.

## Local verification

```bash
npm install
npm run typecheck
npm run build
npm run smoke
npm run worker:smoke
```

The smoke suite covers the fictional preview contract plus protected-resource discovery and an unauthenticated tool challenge in Supabase mode. It does not use a real Supabase token or live Blackhawk data.

## Required authenticated environment

```text
NODE_ENV=production
BLACKHAWK_AUTH_MODE=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
BLACKHAWK_MCP_RESOURCE_URL=https://<blackhawk-host>/mcp
BLACKHAWK_PRIMARY_OWNER_USER_ID=<immutable primary Supabase auth user UUID>
BLACKHAWK_RECOVERY_USER_IDS=<optional comma-separated recovery user UUIDs>
```

The expected token audience defaults to `BLACKHAWK_MCP_RESOURCE_URL`. The Supabase OAuth server must echo ChatGPT's OAuth `resource` value into the access token audience. Blackhawk intentionally rejects generic project-audience tokens.

## Supabase OAuth checklist

1. Enable the Supabase OAuth 2.1 server and require user approval.
2. Enable dynamic client registration only for the test period, or pre-register ChatGPT when its callback URL is available.
3. Allow the exact ChatGPT callback URL shown in app management.
4. Confirm discovery is available at `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`.
5. Confirm issued access tokens contain:
   - `iss`: `https://<project-ref>.supabase.co/auth/v1`
   - `aud` or equivalent configured audience: the exact Blackhawk MCP resource URL
   - `sub`: Will's allowlisted user UUID
   - `client_id` or `azp`
   - `scope`: at least `openid email`
   - a valid `exp`
6. Keep database Row Level Security enabled when the live-state adapter is connected.

## Hosted checkpoint

After deployment to a public HTTPS host:

- `GET /health` should return `{ "status": "ok", "mode": "supabase" }`.
- `GET /.well-known/oauth-protected-resource` should identify the exact `/mcp` resource and Supabase issuer.
- ChatGPT developer mode should list three tools and prompt for account linking before a tool returns the fictional checkpoint brief.

Do not connect live Outlook, Teams, Obsidian, or task data until this authenticated checkpoint passes end to end.

## Fictional-data Worker checkpoint

`wrangler.jsonc` packages the same three MCP tools and widget for Cloudflare's Web Standards runtime. The Worker is deliberately locked to the fictional fixture adapter: its health response and every MCP response include a fictional-preview marker, and there are no live connector or Supabase data imports. This public test surface is suitable only for the fictional checkpoint. Before any live data is bound, switch the Worker to Supabase OAuth mode and pass the authenticated identity into the MCP transport.
