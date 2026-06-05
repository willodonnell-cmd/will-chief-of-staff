# Microsoft 365 Ingestion Roadmap

Current bridge:

- `app/api/agent-signals/import` imports ChatGPT Agent-derived Microsoft 365 signal envelopes.
- `source_items` stores derived source stubs only.
- `agent_signals` stores executive-ready inbox signals for Priority Inbox.

Future Graph ingestion:

- Source: Microsoft Graph delegated OAuth
- Objects: Outlook messages, calendar events, Teams messages
- Sync strategy: initial polling, then delta queries and/or webhooks
- Tables: populate `source_items` with true raw Graph object IDs, thread or conversation IDs, sender and recipient metadata, and raw provider payloads

This bridge intentionally does not implement Microsoft login, Graph OAuth, or fake Graph metadata.
