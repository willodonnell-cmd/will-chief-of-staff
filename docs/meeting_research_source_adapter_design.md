# Meeting Research Source Adapter Design

Phase 8C design only. This document defines the source adapters needed to turn manual Meeting Research from a calendar/prior-record-only summary into source-grounded meeting research.

Do not implement these adapters until the next approved implementation phase. Do not add schema, APIs, connectors, or provider calls from this document alone.

## Current State

Manual meeting research is reachable through `researchMeetingContextAction` and `runManualMeetingResearch`. It creates or loads a `MeetingRecord`, marks `researchStatus` as `researching`, builds bounded source context, calls the configured provider, and stores a `MeetingResearchSummary`.

The current source context includes:

- calendar event details supplied by the meeting card
- prior `MeetingRecord` research/post-meeting summary when already present
- explicit source coverage entries marking Outlook, Teams, PitchBook, and web/news unavailable

The existing output model should remain:

- `meetingRecordId`
- `generatedAt`
- `sourceCoverage`
- `calendarEventDetails`
- `highLevelContext`
- `recentRelevantActivity`
- `situationRead`
- `keyPriorities`
- `suggestedQuestions`
- `relevantLinks`
- `taskCandidates`

Rules that continue to apply:

- Include only source groups with actual findings.
- Omit empty source groups.
- `situationRead` only if evidence supports it.
- `keyPriorities`: 1 to 3 only if useful.
- `suggestedQuestions`: up to 3 only if clearly important.
- Task candidates only; no auto-create.
- Never fabricate source metadata, sentiment, links, people, companies, or priorities.

## Proposed Adapter Interface

Each adapter should return a source-bounded result before the OpenAI summarizer runs.

```ts
type MeetingResearchAdapterInput = {
  meetingRecord: MeetingRecord;
  title: string;
  startAt: string | null;
  endAt: string | null;
  attendees: JsonValue[];
  organizerName: string | null;
  organizerEmail: string | null;
  relatedCompanyNames: string[];
  relatedPeopleNames: string[];
  descriptionSummary: string | null;
  priorityReasons: string[];
  recentWindowDays: number;
};

type MeetingResearchAdapterResult = {
  sourceType: "outlook" | "vault_obsidian" | "pitchbook" | "web_news" | "teams";
  used: boolean;
  itemCount: number;
  internalOnlyReason: string | null;
  findings: RecentRelevantActivityGroup[];
  relevantLinks: JsonValue[];
  taskCandidates: MeetingTaskCandidate[];
};
```

Adapters should run before the provider prompt. The provider should receive structured adapter output, not raw inbox bodies, raw Teams transcripts, or long source excerpts.

## Adapter 1: Outlook Meeting-Specific Context

Purpose: gather recent relevant email context for a specific meeting.

When used: for any meeting with attendee emails, organizer email, related company/person names, or meaningful title/description keywords. It should run only on manual research click, not automatically during page load.

Inputs required:

- `calendarEventId`
- meeting title
- `startAt` / `endAt`
- attendees and emails
- organizer name/email
- `relatedCompanyNames`
- `relatedPeopleNames`
- keywords from title/description
- recent date window, default 30 to 60 days

Source query strategy:

- Use Microsoft Graph delegated mail access if available in the app runtime.
- Search recent mail by attendee emails, organizer email, related company/person names, and title keywords.
- Prefer threads with direct asks, decisions, approvals, prep, follow-ups, unresolved items, and meeting logistics.
- Exclude generic inbox results, newsletters, automated alerts, cold sales, PR, webinars, recruiting, and low-signal FYIs.
- Bound results to a small ranked set before summarization, such as top 5 threads.
- Include snippets only when needed and avoid raw body dumps.

Output shape:

- `sourceCoverage` entry: `sourceType = "outlook"`, `used = true` only when relevant threads are found.
- `recentRelevantActivity` groups with `sourceType = "outlook"`, title, bounded summary, and `sourceRefs`.
- `relevantLinks` for Outlook source links when available.
- `taskCandidates` only for explicit source-backed prep/follow-up tasks.

`sourceRefs` shape:

```json
{
  "sourceType": "outlook",
  "label": "email subject or thread label",
  "url": "real Outlook URL if available",
  "sourceSystemId": "Graph message or conversation id if available",
  "sourceItemId": "app source id if available",
  "relevanceReason": "direct ask, prep thread, decision, approval, or follow-up"
}
```

Omission rules:

- Omit Outlook section when no relevant email context exists.
- Do not show generic inbox search hits.
- Do not include raw email bodies or long quoted text.

Do-not-fabricate rules:

- Do not invent Outlook links, sender names, message IDs, thread IDs, decisions, asks, due dates, or urgency.

Failure behavior:

- Permission/config failure: `used = false`, `itemCount = 0`, clear internal reason such as `Outlook mail access unavailable.`
- Search returns no relevant matches: omit findings; source coverage may say no relevant Outlook context found.
- API/network failure: fail the adapter, not the whole research run, unless every required source fails and no usable calendar context exists.

Tests needed:

- Ranks direct asks above generic FYIs.
- Omits generic inbox results.
- Preserves real Outlook `sourceRefs`.
- Handles missing Graph mail scope cleanly.
- Never includes Outlook section with zero findings.

Security/env requirements:

- Microsoft Graph delegated OAuth must include `Mail.Read`.
- Token storage/encryption must use existing Microsoft Graph auth path.
- Do not log mail bodies or raw source text.

Placement:

- App-side first, because the app already has Microsoft Graph runtime infrastructure.
- Agent-side can also enrich future `BLACKHAWK_BRIEF_BUNDLE` meeting metadata, but manual research should not depend on Agent email delivery.

## Adapter 2: Vault/Obsidian Prior Meeting Notes

Purpose: retrieve prior meeting notes or durable memory for the same company, person, or topic.

When used: when `relatedCompanyNames`, `relatedPeopleNames`, meeting title keywords, prior `MeetingRecords`, transcript refs, or TaskRobin/Obsidian references exist.

Inputs required:

- `relatedCompanyNames`
- `relatedPeopleNames`
- meeting title keywords
- `calendarEventId`
- prior `MeetingRecords`
- exported TaskRobin/Obsidian reference if available

Source query strategy:

- Use accessible prior `MeetingRecords` first; they are already durable app objects.
- Search prior MeetingRecords by company/person/title keyword overlap and nearby time windows.
- Use Obsidian/Vault only through an explicitly supported app/runtime path.
- If no supported Vault path exists in production, mark Vault unavailable rather than pretending it was searched.
- Prefer prior meeting summaries, decisions, open follow-ups, and transcript-derived summaries.

Output shape:

- `sourceCoverage` entry: `sourceType = "vault_obsidian"` or `prior_meeting_record`.
- `recentRelevantActivity` groups for prior notes or prior MeetingRecord summaries.
- `relevantLinks` to app MeetingRecord URLs, TaskRobin/Obsidian refs, or supported vault links when available.
- `taskCandidates` only for source-backed unresolved follow-ups.

`sourceRefs` shape:

```json
{
  "sourceType": "obsidian",
  "label": "prior note or MeetingRecord title",
  "url": "supported vault/app URL if available",
  "sourceSystemId": "vault note path or MeetingRecord id if available",
  "sourceItemId": "meetingRecordId or note id",
  "relevanceReason": "prior meeting note, unresolved follow-up, prior decision, or durable context"
}
```

Omission rules:

- Omit Vault/Obsidian section if no accessible prior notes exist.
- Do not say Obsidian was searched if there is no supported runtime access.
- Do not show empty source groups.

Do-not-fabricate rules:

- Do not invent prior notes, note paths, exported refs, or unresolved follow-ups.

Failure behavior:

- Prior MeetingRecord search failure should fail cleanly and continue with other adapters.
- Vault unavailable should appear only in source coverage, not as a visible empty research section.

Tests needed:

- Uses prior MeetingRecords before external vault lookup.
- Omits Vault when unsupported.
- Preserves TaskRobin/Obsidian references when real.
- Does not claim Obsidian search without access.

Security/env requirements:

- App-side prior MeetingRecords require Supabase access.
- Vault/Obsidian runtime access needs explicit supported path/config before implementation.
- Do not expose private note bodies; send bounded summaries/snippets only.

Placement:

- App-side for prior MeetingRecords.
- Vault/Obsidian can be app-side only if a supported runtime path exists; otherwise Agent-side or not enabled.

## Adapter 3: PitchBook External-Meeting Context

Purpose: provide company/person context for external meetings only.

When used:

- `internalExternalClassification` is `external` or `mixed`.
- Meeting title, attendee domains, related companies, or related people indicate a relevant external company/person.
- Internal meetings only when clearly about an external company/person and PitchBook is relevant.

Inputs required:

- `internalExternalClassification`
- `relatedCompanyNames`
- `relatedPeopleNames`
- attendee domains
- meeting title/description

Source query strategy:

- Query only actual PitchBook connector/API data.
- Resolve candidate company/person matches conservatively.
- Prefer current financing, ownership, investors, executive/person context, and relevant transaction/company facts only when tied to the meeting.
- Do not include generic background unless it directly helps the meeting.

Output shape:

- `sourceCoverage` entry: `sourceType = "pitchbook"`.
- `recentRelevantActivity` group or `highLevelContext` evidence only when PitchBook returns useful data.
- `relevantLinks`/`sourceRefs` if the connector/API exposes stable links or source identifiers.
- No task candidates unless PitchBook data creates a concrete source-backed prep action.

`sourceRefs` shape:

```json
{
  "sourceType": "pitchbook",
  "label": "PitchBook company or person record",
  "url": "PitchBook URL if available",
  "sourceSystemId": "PitchBook entity id if available",
  "sourceItemId": "company/person id if available",
  "relevanceReason": "external company/person context for this meeting"
}
```

Omission rules:

- Omit for internal meetings unless clearly about an external company/person.
- Omit when entity matching is ambiguous.
- Omit when data is generic or not meeting-relevant.

Do-not-fabricate rules:

- Do not invent market, financing, investor, valuation, company, or person data.
- Do not infer private company facts without source data.

Failure behavior:

- Connector unavailable: mark source coverage unavailable and continue.
- Ambiguous match: omit findings and record internal reason.
- No relevant PitchBook data: omit visible section.

Tests needed:

- Suppresses PitchBook for internal meetings.
- Uses PitchBook for external/mixed meetings with source-backed company names.
- Omits ambiguous company/person matches.
- Preserves PitchBook `sourceRefs`.

Security/env requirements:

- PitchBook connector/API access must be approved and available.
- Respect PitchBook usage/licensing constraints.
- Do not cache or expose more PitchBook data than needed for the meeting.

Placement:

- Agent-side is likely best if the ChatGPT Agent has the PitchBook connector.
- App-side only if a production-approved PitchBook API/connector is available to the app.

## Adapter 4: Web/News External-Meeting Context

Purpose: provide current public context for relevant external meetings.

When used:

- External or mixed meetings with source-backed related companies/people.
- Meeting prep indicates public current context would matter.
- Click-time manual research only.

Inputs required:

- `relatedCompanyNames`
- `relatedPeopleNames`
- meeting title/description
- topics from meeting prep

Source query strategy:

- Run only on manual research click.
- Search current, reputable, source-linked public information.
- Prefer recent, relevant news/events over generic company background.
- Use a small number of high-confidence sources.
- Include dates and links in source refs where possible.

Output shape:

- `sourceCoverage` entry: `sourceType = "web_news"`.
- `recentRelevantActivity` groups for actual current/relevant public context.
- `relevantLinks` with URLs, labels, and dates when available.
- `situationRead` only when public evidence supports it.

`sourceRefs` shape:

```json
{
  "sourceType": "web",
  "label": "source title",
  "url": "public source URL",
  "sourceSystemId": "publisher/source id if available",
  "sourceItemId": "article/page id if available",
  "relevanceReason": "current public context relevant to this meeting"
}
```

Omission rules:

- Omit if no useful current information exists.
- Omit generic company background unless meeting-relevant.
- Omit if only low-quality or unverifiable sources are available.

Do-not-fabricate rules:

- Do not invent public news, sentiment, dates, links, or facts.
- Do not use model memory as a substitute for clicked/current sources.

Failure behavior:

- Search unavailable: source coverage unavailable; continue with other adapters.
- No useful current results: no visible web/news group.

Tests needed:

- Runs only for external/relevant meetings.
- Omits generic background.
- Requires source links for web/news findings.
- Handles search failure without fake success.

Security/env requirements:

- Approved search provider/tool or Agent-side web access.
- Avoid leaking private meeting details into overly broad public queries; query with minimal necessary company/person/topic terms.

Placement:

- Agent-side is likely best when the Agent has web browsing/search.
- App-side only if production has an approved web/news search API and privacy review.

## Adapter 5: Teams Meeting-Specific Context

Purpose: gather internal coordination, direct asks, escalation, and follow-up context related to a meeting.

When used: for meetings with attendees/organizer, company/person names, title keywords, or prior Teams-sourced source refs.

Inputs required:

- attendees
- organizer
- meeting title keywords
- `relatedCompanyNames`
- `relatedPeopleNames`
- recent date window

Source query strategy:

- Use Microsoft Graph Teams/chat access if available.
- Search recent direct messages/chats/channels by attendee names/emails and meeting keywords.
- Prioritize direct asks, mentions, urgent coordination, escalations, meeting prep, decisions, and follow-ups.
- Suppress generic channel noise.
- Bound findings to a small ranked set.

Output shape:

- `sourceCoverage` entry: `sourceType = "teams"`.
- `recentRelevantActivity` groups with Teams-specific coordination context.
- `relevantLinks` when Teams message/thread links are available.
- `taskCandidates` only for explicit source-backed asks/follow-ups.

`sourceRefs` shape:

```json
{
  "sourceType": "teams",
  "label": "Teams chat/thread/channel label",
  "url": "Teams URL if available",
  "sourceSystemId": "Graph chat/message/thread id if available",
  "sourceItemId": "app source id if available",
  "relevanceReason": "direct ask, mention, escalation, prep, or follow-up"
}
```

Omission rules:

- Omit if no relevant Teams context exists.
- Do not show generic channel noise.
- Do not include Teams content without a meeting-specific match.

Do-not-fabricate rules:

- Do not invent Teams links, sender names, message IDs, urgency, asks, or escalations.

Failure behavior:

- Permission denied: mark source coverage unavailable and continue.
- No relevant messages: omit visible section.
- API failure: fail adapter only.

Tests needed:

- Keeps direct asks and suppresses generic channel chatter.
- Handles `Chat.Read` permission denial cleanly.
- Preserves Teams `sourceRefs`.
- Omits Teams group when empty.

Security/env requirements:

- Microsoft Graph delegated OAuth must include appropriate Teams/chat scopes.
- Tenant policy may block Teams APIs; failure must be explicit and non-fatal.
- Do not log message bodies.

Placement:

- App-side if production Microsoft Graph Teams access is approved and reliable.
- Agent-side may be better if the ChatGPT Agent connector has richer Teams context, but app manual research should not claim Teams coverage unless it actually receives Teams findings.

## Recommended Build Order

1. Adapter orchestration layer: introduce a small adapter interface and tests while preserving current calendar/prior-record behavior.
2. Prior MeetingRecords / durable app memory: lowest external dependency and most aligned with existing schema.
3. Outlook meeting-specific context: highest product value for prep and follow-up, existing Microsoft Graph mail path is the natural app-side foundation.
4. Teams meeting-specific context: useful for internal coordination, but permission risk is higher.
5. PitchBook: external/mixed meetings only, likely connector/API-dependent.
6. Web/news: external/mixed meetings only, click-time, source-linked, and privacy-reviewed.
7. Vault/Obsidian runtime search: only after a supported production access path is chosen; until then rely on prior MeetingRecords and TaskRobin export refs.

## App-Side vs Agent-Side

App-side should own:

- MeetingRecord persistence
- manual research status transitions
- prior MeetingRecord lookup
- app-native Microsoft Graph Outlook/Teams adapters when production auth supports them
- final source coverage truthfulness
- Task Library candidate creation workflow

Agent-side should own or assist with:

- richer `BLACKHAWK_BRIEF_BUNDLE` metadata
- PitchBook context if only the Agent has PitchBook connector access
- web/news context if only the Agent has approved browsing/search access
- optional supplemental context sent back through structured bundles

Both sides must follow the same source-ref and do-not-fabricate rules.

## Env Vars

Existing env vars relevant to current/future research:

- `OPENAI_API_KEY`: required for the current OpenAI meeting research provider.
- `OPENAI_MEETING_RESEARCH_MODEL`: optional model override.
- `OPENAI_RESEARCH_MODEL`: optional fallback model override.
- `MICROSOFT_GRAPH_CLIENT_ID`: required for app-native Microsoft Graph OAuth.
- `MICROSOFT_GRAPH_CLIENT_SECRET`: required for app-native Microsoft Graph OAuth.
- `MICROSOFT_GRAPH_TENANT_ID`: required/optional depending tenant mode; defaults can remain `organizations`.
- `MICROSOFT_GRAPH_REDIRECT_URI`: required for production OAuth.
- `MICROSOFT_GRAPH_SCOPES`: must include `Mail.Read`, `Calendars.Read`, and any approved Teams/chat scopes.
- `MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY`: required for storing Graph tokens.

Future env/config may be needed only after approval:

- PitchBook app/API credentials or connector configuration, if app-side.
- Web/news search API credentials, if app-side.
- Vault/Obsidian path or connector configuration, if app-side.

TaskRobin/Obsidian export remains separate:

- `RESEND_API_KEY`
- `TASKROBIN_EMAIL_FROM`

## Supabase

No immediate Supabase schema change is needed. Existing `meeting_records.research_summary`, `source_refs`, `task_candidates`, and status timestamps can store adapter outputs.

Possible future schema only if evidence requires it:

- A separate adapter run log table for auditing/debugging source coverage over time.
- A separate source artifact table if raw source refs need durable normalized indexing.

Do not add either unless implementation proves the current `research_summary` JSON is insufficient.

## Risks

- Microsoft Teams API permissions may be blocked by tenant policy.
- Web/news queries can leak private meeting intent if query construction is too broad.
- PitchBook licensing/access may constrain what can be stored or displayed.
- LLM summarization can overstate weak source evidence unless prompts and normalizers enforce omissions.
- Adapter results can create visual noise unless empty groups remain omitted.
- Duplicate source findings across Outlook/Teams/Agent bundle need sourceRef-based dedupe.
- Production and local connector availability may differ; source coverage must expose that truthfully.

## Recommended Next Implementation Phase

Implement only the adapter orchestration layer and prior MeetingRecord durable-memory adapter first. That establishes the source coverage contract, tests omission/failure behavior, and avoids external connector complexity before adding Outlook or Teams.
