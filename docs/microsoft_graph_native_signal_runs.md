# Blackhawk-native Microsoft Graph signal runs

Blackhawk can run Microsoft 365 signal pulls directly through Microsoft Graph. The production runtime does not use Codex, ChatGPT, Outlook, Calendar, or Teams connector plugins. Those connectors are development tools only.

## Runtime architecture

1. A user connects Microsoft 365 from Blackhawk.
2. Blackhawk stores an encrypted delegated Microsoft Graph access token and refresh token in `microsoft_graph_connections`.
3. A user clicks **Run Now from Microsoft 365**, or a future scheduler calls `runMicrosoft365SignalPullForUser(...)`.
4. Blackhawk refreshes the Graph token when needed.
5. Blackhawk pulls Outlook inbox, Calendar view, and Teams chat data through Microsoft Graph.
6. Source adapters keep only metadata, links, and safe previews by default.
7. The native runner normalizes records into the existing Microsoft 365 signal envelope with `producer: "blackhawk_native"`.
8. The existing `importAgentSignals(...)` path writes `agent_signal_runs`, `agent_signals`, and accepted `priority_inbox_items`.
9. `/inbox` reads the latest successful database-backed run and displays only signals routed to Priority Inbox.

The legacy `/api/agent-signals/import` endpoint remains available for external Agent/import fallback payloads.

## Microsoft Entra setup

1. Create an app registration in Microsoft Entra.
2. Add a Web redirect URI matching `MICROSOFT_GRAPH_REDIRECT_URI`, for example `https://your-domain.example/api/microsoft/callback`.
3. Add delegated Microsoft Graph permissions:
   - `offline_access`
   - `User.Read`
   - `Mail.Read`
   - `Calendars.Read`
   - `Chat.Read`
4. Grant user or admin consent as required by the tenant.
5. Set the environment variables from `.env.example`.
6. Open `/agent-signals/health` and choose **Connect Microsoft 365**.
7. After connection, choose **Run Now from Microsoft 365**.

## Environment variables

```dotenv
MICROSOFT_GRAPH_CLIENT_ID=
MICROSOFT_GRAPH_CLIENT_SECRET=
MICROSOFT_GRAPH_TENANT_ID=organizations
MICROSOFT_GRAPH_REDIRECT_URI=https://your-production-blackhawk-url.example/api/microsoft/callback
MICROSOFT_GRAPH_SCOPES=offline_access User.Read Mail.Read Calendars.Read Chat.Read
MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY=base64:<base64-encoded-32-random-bytes>
```

`MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY` must decode to exactly 32 bytes. The helper accepts `base64:...`, `hex:...`, a raw 64-character hex key, or a raw 32-byte UTF-8 value.

## Source coverage

Each source returns coverage independently:

- `included`
- `empty`
- `skipped`
- `unavailable`
- `permission_denied`
- `error`
- `unknown`

One source failure does not fail the whole run. For example, Teams can return `permission_denied` while Outlook and Calendar still import successfully.

## Teams caveat

The initial Teams implementation uses delegated `Chat.Read` and v1.0 chat/message endpoints. Some tenants may still block chat reads through admin consent, Teams policy, or tenant configuration. When that happens Blackhawk records Teams coverage as `permission_denied` or `unavailable` and keeps the Outlook/Calendar run usable.

## Scheduling foundation

The server-side scheduler entry point is:

```ts
runMicrosoft365SignalPullForUser(...)
```

The intended future production schedule is Monday through Friday at:

- 7:30 AM Eastern
- 12:00 PM Eastern
- 5:00 PM Eastern

No brittle pseudo-scheduler is enabled in this pass. Run Now is the production path.

## Classification

Phase 1 uses deterministic classification only. It looks for direct asks, follow-ups, meeting prep, executive/customer/partner/vendor/board context, strategic keywords, Investment Committee material, and obvious low-signal material. Final routing and suppression still run through the existing server-side `routeAgentSignal(...)` path.

Optional AI classification can be added later behind environment flags if the app standardizes a server-side AI provider pattern.

## Fallback paths

- `/api/agent-signals/import` remains the structured import channel for external Agent payloads.
- Local JSON and fixture fallback remain development-only read paths where already supported.
- The manual ChatGPT Agent request queue remains visible as a legacy fallback, but it may not complete when IT blocks custom outbound apps.
