# ChatGPT Agent Signal Prompt

Use this prompt with ChatGPT Agent when you want a local JSON handoff for `/Users/willodonnell/Documents/will-chief-of-staff/.local/agent-signals.json`.

## Copy/Paste Prompt

```text
Review my Microsoft 365 signals and produce a strict JSON envelope for a local app handoff.

Instructions:

1. Review Outlook first.
2. Review Teams and Calendar only if they are available through ChatGPT connectors in this session.
3. If Teams or Calendar connectors are unavailable, inaccessible, or fail, do not treat that as a fatal error. Represent that condition as one or more `status` signals instead.
4. Return exactly one JSON object only.
5. The response must start with `{` and end with `}`.
6. Output JSON only. Do not output markdown. Do not output commentary. Do not wrap the JSON in code fences. Do not include any text before the opening `{` or after the closing `}`.
7. Do not cite sources inside the JSON. Do not add notes, confidence labels, provenance prose, or explanation fields beyond the schema below.
8. Conform exactly to this schema:
   - Top-level object:
     - `producer`: exactly `"chatgpt_agent"`
     - `connectorFamily`: exactly `"microsoft_365"`
     - `producedAt`: valid ISO timestamp
     - `tenantLabel`: string
     - `signals`: array
   - Each signal object must include:
     - `id`
     - `source`: `"outlook"` or `"teams"` or `"calendar"`
     - `signalType`: `"decision"` or `"follow_up"` or `"meeting"` or `"status"`
     - `attention`: `"high"` or `"medium"` or `"low"`
     - `title`
     - `summary`
     - `owner`
     - `sourceLabel`
     - `occurredAt`: valid ISO timestamp
     - `dueAt`: valid ISO timestamp or `null`
     - `sourceUrl`: string or `null`
     - `actionRequest`: string or `null`
     - `participants`: array of strings
     - `protectedContext`: boolean
9. Keep every required field present. Use `null` only for nullable fields. Do not omit nullable fields.
10. Do not include raw email bodies, raw Teams messages, long quoted text, confidential blocks, or unnecessary personal data.
11. Summarize sensitive or protected context instead of reproducing it verbatim.
12. Prefer executive-priority signals, especially:
   - direct asks
   - decisions needed
   - implied follow-ups
   - people waiting on Will
   - time-sensitive meetings
   - Board, ELT, customer, or strategic items
   - corporate development
   - M&A
   - partnerships
   - new business creation
   - AI
   - automation
   - robotics
   - supply chain
   - capital allocation
   - venture portfolio
   - regulation
   - tariffs
   - logistics
13. Aggressively filter out:
   - newsletters
   - promotions
   - cold sales outreach
   - webinar invites
   - PR pitches
   - recruiting noise
   - automated notifications unless they create a real action or decision
14. Keep the output concise:
   - target 5 to 15 signals
   - include fewer if fewer matter
   - do not pad the list
15. If nothing meaningful is present, return a small number of `status` signals explaining the quiet state or connector availability rather than inventing importance.
16. `summary` should be concise and useful to an executive chief-of-staff workflow.
17. `owner` should identify who appears responsible for the next move, using a short human-readable string.
18. `sourceLabel` should be a short human-readable source description such as a mailbox folder, meeting title, or chat/thread label.
19. `protectedContext` should be `true` when the signal involves sensitive personnel, legal, finance, board, transaction, or similarly protected material.
20. Connector gaps must be emitted as `status` signals. If a connector is unavailable, inaccessible, blocked, not reviewed, not inspected, failed, or could not be reviewed, include a concise `status` signal describing that gap instead of silently omitting it.

Before returning, verify all of the following:

- `producer` is exactly `"chatgpt_agent"`
- `connectorFamily` is exactly `"microsoft_365"`
- the response is one JSON object only
- the response starts with `{` and ends with `}`
- there is no markdown, no code fence, and no commentary before or after the JSON
- every signal has all required fields
- nullable fields use `null`, not missing fields
- `source` uses only `"outlook"`, `"teams"`, or `"calendar"`
- `signalType` uses only `"decision"`, `"follow_up"`, `"meeting"`, or `"status"`
- `attention` uses only `"high"`, `"medium"`, or `"low"`
- `producedAt`, `occurredAt`, and any non-null `dueAt` values are valid ISO timestamp strings
- `participants` is always an array of strings
- `protectedContext` is always boolean
- no field contains markdown formatting, code fences, raw email bodies, long quoted text, or source citations
- connector gaps are represented as `status` signals when relevant

Return only the final JSON object.
```

## Sanitized Example

```json
{
  "producer": "chatgpt_agent",
  "connectorFamily": "microsoft_365",
  "producedAt": "2026-05-28T15:42:00.000Z",
  "tenantLabel": "Contoso Executive Workspace",
  "signals": [
    {
      "id": "outlook-board-followup-001",
      "source": "outlook",
      "signalType": "follow_up",
      "attention": "high",
      "title": "Board observer is waiting on revised KPI note",
      "summary": "A direct reply is needed on the updated KPI framing before tomorrow morning. The thread indicates the note is blocking packet finalization.",
      "owner": "Will O'Donnell",
      "sourceLabel": "Board packet email thread",
      "occurredAt": "2026-05-28T14:10:00.000Z",
      "dueAt": "2026-05-29T16:00:00.000Z",
      "sourceUrl": "https://outlook.office.com/mail/id/fake-board-thread",
      "actionRequest": "Send the revised KPI note and confirm packet timing.",
      "participants": [
        "Will O'Donnell",
        "Board Observer",
        "Finance Lead"
      ],
      "protectedContext": true
    },
    {
      "id": "calendar-customer-decision-002",
      "source": "calendar",
      "signalType": "meeting",
      "attention": "medium",
      "title": "Customer expansion meeting needs decision prep",
      "summary": "A late-afternoon customer meeting appears likely to require a pricing or scope decision. Prep should focus on tradeoffs and approval path.",
      "owner": "Will O'Donnell",
      "sourceLabel": "Customer expansion review",
      "occurredAt": "2026-05-28T15:00:00.000Z",
      "dueAt": "2026-05-28T23:30:00.000Z",
      "sourceUrl": "https://outlook.office.com/calendar/item/fake-customer-meeting",
      "actionRequest": "Confirm the decision owner and arrive with a recommendation.",
      "participants": [
        "Will O'Donnell",
        "Account Lead",
        "Customer COO"
      ],
      "protectedContext": false
    },
    {
      "id": "teams-connector-status-003",
      "source": "teams",
      "signalType": "status",
      "attention": "low",
      "title": "Teams connector was unavailable during review",
      "summary": "Outlook was reviewed successfully, but Teams messages could not be inspected in this session. No Teams-derived action signal was produced.",
      "owner": "ChatGPT Agent",
      "sourceLabel": "Teams connector status",
      "occurredAt": "2026-05-28T15:42:00.000Z",
      "dueAt": null,
      "sourceUrl": null,
      "actionRequest": "Reconnect Teams later if message coverage is needed.",
      "participants": [
        "ChatGPT Agent"
      ],
      "protectedContext": false
    }
  ]
}
```

Save the resulting JSON locally as `.local/agent-signals.json`. Do not commit real Agent output.

## Repair Prompt

Use this when ChatGPT Agent returns invalid JSON or `npm run validate:agent-signals` reports a schema error.

```text
Repair the JSON below so it passes the Agent signal validator.

Rules:

1. Return corrected JSON only.
2. Start with `{` and end with `}`.
3. Do not use markdown or code fences.
4. Preserve the original signal meaning.
5. Do not add new facts.
6. Do not remove signals unless a signal is impossible to repair while keeping the original meaning.
7. Keep every required field present.
8. Use `null` for nullable fields instead of omitting them.
9. Keep enum values within the allowed schema.
10. Keep timestamps as valid ISO strings.
11. Keep `participants` as an array of strings.
12. Keep `protectedContext` boolean.

Validator error:
[paste validator error here]

Invalid JSON:
[paste invalid Agent JSON here]
```

## Operator Flow

1. Run the prompt above in ChatGPT Agent.
2. Save the JSON-only response to `.local/agent-signals.json`.
3. Run `npm run validate:agent-signals`.
4. Open `/inbox`.
5. Confirm `Payload source` says `Local Agent JSON`.
