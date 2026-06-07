# ChatGPT Agent Investment Committee Prompt

Use this prompt with ChatGPT Agent when you want a strict weekly IC JSON handoff for `/Users/willodonnell/Documents/will-chief-of-staff/.local/investment-committee-cycle.json`.

This weekly IC payload is separate from the general Microsoft 365 handoff at `.local/agent-signals.json`. Save the result only to `.local/investment-committee-cycle.json`; do not overwrite the general Inbox handoff payload.

## Copy/Paste Prompt

```text
Review my Outlook email for the current Investment Committee cycle and produce one strict JSON object for the local Investment Committee workspace.

Instructions:

1. Focus on the current weekly Investment Committee cycle only.
2. Start with Susan Pi’s weekly package email.
3. Use Susan’s package email to extract:
   - week of
   - meeting date/time if stated
   - package email subject
   - package email link
   - Box folder link with the memos
   - the deal names for that week
4. Then find related IC email threads for those same deals by matching the subject line and deal name.
5. Capture:
   - peer committee questions
   - Q&A or response packets from the presenting team
   - whether Will is explicitly mentioned
6. Do not turn this into a mailbox dump.
7. Return exactly one JSON object only.
8. Start with `{` and end with `}`.
9. Output JSON only. No markdown. No commentary. No code fences.
10. Do not include raw email bodies or long quoted text.
11. Summaries must be concise and operational.
12. Conform exactly to this schema:

Top-level object:
- `producer`: exactly `"chatgpt_agent"`
- `workflow`: exactly `"investment_committee_weekly_cycle"`
- `producedAt`: valid ISO timestamp
- `tenantLabel`: string
- `cycle`: object
- `deals`: array

`cycle` object:
- `weekOf`: YYYY-MM-DD
- `meetingDate`: ISO timestamp or `null`
- `packageEmailSubject`: string
- `packageEmailUrl`: string or `null`
- `boxFolderUrl`: string or `null`
- `questionsDueAt`: ISO timestamp or `null`
- `resetAt`: ISO timestamp or `null`

Each `deal` object:
- `id`: stable slug-like string
- `title`: string
- `memoUrl`: string or `null`
- `peerQuestionSummary`: string or `null`
- `answerSummary`: string or `null`
- `threads`: array

Each `thread` object:
- `id`
- `subject`
- `sender`
- `kind`: `"question"` or `"answer"` or `"package"` or `"general"`
- `occurredAt`: valid ISO timestamp
- `sourceUrl`: string or `null`
- `summary`
- `mentionsWill`: boolean

13. Keep every required field present.
14. Use `null` only for nullable fields.
15. Do not omit nullable fields.
16. If a deal has no peer-question or answer thread yet, still include the deal if Susan’s package email listed it.
17. If Asia IC is cancelled or has no deals, do not create fake deals for it.
18. If you cannot find Susan’s package email, return:
   - an empty `deals` array
   - `packageEmailSubject` = `"Not found"`
   - `packageEmailUrl` = null
   - `boxFolderUrl` = null
   - `meetingDate` = null
19. `resetAt` should be Tuesday end of day for the current cycle when you can infer it; otherwise `null`.

Before returning, verify all of the following:

- response is one JSON object only
- response starts with `{` and ends with `}`
- `producer` is exactly `"chatgpt_agent"`
- `workflow` is exactly `"investment_committee_weekly_cycle"`
- every deal has all required fields
- every thread has all required fields
- `kind` uses only `"question"`, `"answer"`, `"package"`, or `"general"`
- timestamps are valid ISO strings where required
- `weekOf` is YYYY-MM-DD
- no markdown, no code fences, no commentary
- no raw email bodies or long quoted text

Return only the final JSON object.
```

## Operator Flow

1. Run the prompt above in ChatGPT Agent.
2. Save the JSON-only response to `.local/investment-committee-cycle.json`.
3. Run `npm run validate:investment-committee-cycle`.
4. Open `/investment-committee`.
5. Confirm the page shows:
   - the current week
   - the Box folder link
   - one breakout card per deal
   - peer-question and Q&A answer summaries per deal
