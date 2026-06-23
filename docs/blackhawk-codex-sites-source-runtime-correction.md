# Blackhawk Codex Sites Source Runtime Clarification

## Correction

Blackhawk is now using Codex Sites, not Vercel or Cloudflare as the primary deployment surface.

The relevant architecture constraint is therefore not `Vercel versus Cloudflare`. The relevant constraint is the runtime and credential boundary.

## Correct framing

ChatGPT connected apps and MCP tools are available inside the ChatGPT runtime. Codex Sites may host and run the Blackhawk app, but Blackhawk does not automatically inherit the connected-app session from an individual ChatGPT conversation unless Codex Sites exposes or is configured with a connector/MCP runtime that Blackhawk can call.

So the accurate doctrine is:

```text
Codex Sites can run Blackhawk.
ChatGPT connected apps can retrieve Outlook, Calendar, and Teams data inside ChatGPT.
Blackhawk can use that data only through an explicit bridge, hosted MCP runtime, structured import, or Blackhawk-owned Microsoft 365 collection path.
```

## Product implication

The preferred architecture remains structured source ingestion, not summary emails.

Valid paths are:

1. **Blackhawk-native source collection**, using a Blackhawk-controlled Microsoft 365 adapter, delegated Graph setup, or hosted MCP bridge available to the Codex Sites runtime.
2. **External ChatGPT connected-app collection**, where ChatGPT reads Outlook, Calendar, and Teams and posts a strict structured signal envelope to `/api/agent-signals/import`.
3. **Legacy summary-email intake**, kept only as fallback/bootstrap evidence and not the durable operating model.

## Do not overstate

Do not say that Codex Sites automatically solves Microsoft 365 connected-app access. It may solve hosting and runtime deployment. It does not, by itself, erase OAuth/session/tool-boundary questions.

## Updated doctrine sentence

Use this instead of the earlier Vercel/Cloudflare language:

> Blackhawk runs on Codex Sites, but connected-app access still depends on what connector or MCP runtime is available to that deployed app. ChatGPT connected apps are proven useful for manual and agent-assisted retrieval, but Blackhawk should only rely on them directly if there is an explicit bridge or hosted MCP runtime available to Codex Sites. Otherwise, use Blackhawk-native Microsoft 365 collection or structured imports through `/api/agent-signals/import`.
