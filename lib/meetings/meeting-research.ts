import {
  getOrCreateMeetingRecordForCalendarEvent,
  updateMeetingResearchSummary,
  type CalendarEventDetails,
  type JsonValue,
  type MeetingInternalExternalClassification,
  type MeetingRecord,
  type MeetingRecordsRepository,
  type MeetingResearchSummary,
  type MeetingTaskCandidate,
  type SourceCoverage
} from "@/lib/meetings/meeting-records";

export type MeetingResearchRunError = "missing_key" | "no_provider" | "upstream" | "parse" | "network" | "storage";

export type ManualMeetingResearchInput = {
  userId: string;
  calendarEventId: string;
  calendarSourceSystemId?: string | null;
  title: string;
  startAt?: string | null;
  endAt?: string | null;
  timezone?: string | null;
  organizerName?: string | null;
  organizerEmail?: string | null;
  attendees?: JsonValue[] | null;
  locationOrLink?: string | null;
  descriptionSummary?: string | null;
  relatedCompanyNames?: string[] | null;
  relatedPeopleNames?: string[] | null;
  internalExternalClassification?: MeetingInternalExternalClassification | null;
  priorityReasons?: string[] | null;
  sourceRefs?: JsonValue[] | null;
};

export type MeetingResearchSourceContext = {
  calendarEventDetails: CalendarEventDetails;
  sourceCoverage: SourceCoverage[];
  priorResearchSummary: JsonValue | null;
  priorPostMeetingSummary: JsonValue | null;
};

export type MeetingResearchProviderInput = {
  meetingRecord: MeetingRecord;
  sourceContext: MeetingResearchSourceContext;
  generatedAt: string;
};

export type MeetingResearchProvider = (
  input: MeetingResearchProviderInput
) => Promise<{ ok: true; summary: MeetingResearchSummary } | { ok: false; error: MeetingResearchRunError }>;

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = compactText(value);
  return normalized.length > 0 ? normalized : null;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence?.[1]) {
    text = fence[1].trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function extractOpenAiAssistantText(data: { output?: unknown[] }) {
  if (!Array.isArray(data.output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of data.output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const outputItem = item as { type?: string; content?: unknown[] };
    if (outputItem.type !== "message" || !Array.isArray(outputItem.content)) {
      continue;
    }
    for (const part of outputItem.content) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const outputPart = part as { type?: string; text?: string };
      if (typeof outputPart.text === "string" && (outputPart.type === "output_text" || outputPart.type === "text")) {
        chunks.push(outputPart.text);
      }
    }
  }

  return chunks.join("\n");
}

function asJsonArray(value: unknown): JsonValue[] {
  return Array.isArray(value) ? value.filter((entry): entry is JsonValue => isJsonValue(entry)) : [];
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function normalizeTaskCandidates(value: unknown, meetingRecordId: string): MeetingTaskCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((candidate, index): MeetingTaskCandidate | null => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return null;
      }
      const record = candidate as Record<string, unknown>;
      const title = typeof record.title === "string" ? compactText(record.title) : "";
      if (!title) {
        return null;
      }
      const taskType = typeof record.taskType === "string" ? record.taskType : "prep";
      const allowedTypes = ["prep", "follow_up", "decision", "review", "delegate", "schedule", "monitor"];

      return {
        title,
        description: typeof record.description === "string" ? normalizeOptionalText(record.description) : null,
        owner: typeof record.owner === "string" ? normalizeOptionalText(record.owner) : null,
        priority: record.priority === "low" || record.priority === "medium" || record.priority === "high" ? record.priority : null,
        dueDate: typeof record.dueDate === "string" ? normalizeOptionalText(record.dueDate) : null,
        sourceRefs: asJsonArray(record.sourceRefs),
        dedupeKey:
          typeof record.dedupeKey === "string" && compactText(record.dedupeKey)
            ? compactText(record.dedupeKey)
            : `${meetingRecordId}:${index + 1}:${title.toLowerCase()}`,
        meetingRecordId,
        taskType: allowedTypes.includes(taskType) ? taskType as MeetingTaskCandidate["taskType"] : "prep"
      };
    })
    .filter((candidate): candidate is MeetingTaskCandidate => Boolean(candidate));
}

function normalizeResearchSummary(input: {
  raw: Record<string, unknown>;
  meetingRecordId: string;
  generatedAt: string;
  sourceContext: MeetingResearchSourceContext;
}): MeetingResearchSummary {
  const raw = input.raw;
  return {
    meetingRecordId: input.meetingRecordId,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : input.generatedAt,
    sourceCoverage: input.sourceContext.sourceCoverage,
    calendarEventDetails: input.sourceContext.calendarEventDetails,
    highLevelContext: typeof raw.highLevelContext === "string" ? normalizeOptionalText(raw.highLevelContext) : null,
    recentRelevantActivity: asJsonArray(raw.recentRelevantActivity).filter(
      (entry): entry is MeetingResearchSummary["recentRelevantActivity"][number] =>
        Boolean(entry && typeof entry === "object" && !Array.isArray(entry))
    ),
    situationRead:
      raw.situationRead && typeof raw.situationRead === "object" && !Array.isArray(raw.situationRead)
        ? raw.situationRead as MeetingResearchSummary["situationRead"]
        : null,
    keyPriorities: asJsonArray(raw.keyPriorities)
      .filter((entry): entry is MeetingResearchSummary["keyPriorities"][number] =>
        Boolean(entry && typeof entry === "object" && !Array.isArray(entry))
      )
      .slice(0, 3),
    suggestedQuestions: asJsonArray(raw.suggestedQuestions)
      .filter((entry): entry is MeetingResearchSummary["suggestedQuestions"][number] =>
        Boolean(entry && typeof entry === "object" && !Array.isArray(entry))
      )
      .slice(0, 3),
    relevantLinks: asJsonArray(raw.relevantLinks),
    taskCandidates: normalizeTaskCandidates(raw.taskCandidates, input.meetingRecordId)
  };
}

function buildSourceContext(input: ManualMeetingResearchInput, meetingRecord: MeetingRecord): MeetingResearchSourceContext {
  const calendarEventDetails: CalendarEventDetails = {
    title: compactText(input.title) || meetingRecord.title,
    startAt: input.startAt ?? meetingRecord.startAt,
    endAt: input.endAt ?? meetingRecord.endAt,
    organizer: normalizeOptionalText(input.organizerName) ?? normalizeOptionalText(input.organizerEmail),
    attendees: input.attendees ?? meetingRecord.attendees,
    locationOrLink: normalizeOptionalText(input.locationOrLink),
    descriptionSummary: normalizeOptionalText(input.descriptionSummary)
  };
  const hasCalendarDetails = Boolean(
    calendarEventDetails.title ||
      calendarEventDetails.startAt ||
      calendarEventDetails.endAt ||
      calendarEventDetails.organizer ||
      calendarEventDetails.attendees.length > 0 ||
      calendarEventDetails.locationOrLink ||
      calendarEventDetails.descriptionSummary
  );
  const hasPriorMeetingRecord = Boolean(meetingRecord.researchSummary || meetingRecord.postMeetingSummary);

  return {
    calendarEventDetails,
    sourceCoverage: [
      {
        sourceType: "calendar_event_details",
        used: hasCalendarDetails,
        itemCount: hasCalendarDetails ? 1 : 0,
        internalOnlyReason: null
      },
      {
        sourceType: "prior_meeting_record",
        used: hasPriorMeetingRecord,
        itemCount: hasPriorMeetingRecord ? 1 : 0,
        internalOnlyReason: hasPriorMeetingRecord ? null : "No prior MeetingRecord research or post-meeting summary exists."
      },
      {
        sourceType: "outlook",
        used: false,
        itemCount: 0,
        internalOnlyReason: "Meeting-specific Outlook source adapter is not available in this phase."
      },
      {
        sourceType: "teams",
        used: false,
        itemCount: 0,
        internalOnlyReason: "Meeting-specific Teams source adapter is not available in this phase."
      },
      {
        sourceType: "pitchbook",
        used: false,
        itemCount: 0,
        internalOnlyReason: "PitchBook connector is not available to this code path."
      },
      {
        sourceType: "web_news",
        used: false,
        itemCount: 0,
        internalOnlyReason: "Web/news adapter is not enabled for meeting research in this phase."
      }
    ],
    priorResearchSummary: meetingRecord.researchSummary,
    priorPostMeetingSummary: meetingRecord.postMeetingSummary
  };
}

function buildPrompt(input: MeetingResearchProviderInput) {
  const system = `You produce source-bounded meeting research for Blackhawk. Return one JSON object only. Do not use outside knowledge. Omit unsupported sections by returning null or empty arrays. Do not invent facts, links, priorities, questions, sentiment, PitchBook, web, Outlook, Teams, transcript, or Obsidian information. Create task candidates only; do not create tasks.`;
  const userContent = JSON.stringify({
    requiredShape: {
      meetingRecordId: input.meetingRecord.id,
      generatedAt: input.generatedAt,
      highLevelContext: "string or null",
      recentRelevantActivity: [],
      situationRead: "object or null",
      keyPriorities: "array, max 3, omit unsupported",
      suggestedQuestions: "array, max 3, omit unsupported",
      relevantLinks: [],
      taskCandidates: []
    },
    sourceContext: input.sourceContext
  });

  return { system, userContent };
}

export async function runOpenAiMeetingResearchProvider(
  input: MeetingResearchProviderInput
): Promise<{ ok: true; summary: MeetingResearchSummary } | { ok: false; error: MeetingResearchRunError }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "no_provider" };
  }

  const model = process.env.OPENAI_MEETING_RESEARCH_MODEL?.trim() || process.env.OPENAI_RESEARCH_MODEL?.trim() || "gpt-4.1";
  const orgId = process.env.OPENAI_ORG_ID?.trim();
  const { system, userContent } = buildPrompt(input);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };
  if (orgId) {
    headers["OpenAI-Organization"] = orgId;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: userContent }
        ],
        max_output_tokens: 1800
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "(unreadable)");
      console.error("[meeting-research] OpenAI error", response.status, detail);
      return { ok: false, error: "upstream" };
    }

    const data = (await response.json()) as { output?: unknown[] };
    const parsed = extractJsonObject(extractOpenAiAssistantText(data));
    if (!parsed) {
      return { ok: false, error: "parse" };
    }

    return {
      ok: true,
      summary: normalizeResearchSummary({
        raw: parsed,
        meetingRecordId: input.meetingRecord.id,
        generatedAt: input.generatedAt,
        sourceContext: input.sourceContext
      })
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function runManualMeetingResearch(
  repository: MeetingRecordsRepository,
  input: ManualMeetingResearchInput,
  options: {
    now?: string;
    provider?: MeetingResearchProvider;
  } = {}
): Promise<{ ok: true; record: MeetingRecord } | { ok: false; error: MeetingResearchRunError; record: MeetingRecord | null }> {
  const requestedAt = options.now ?? new Date().toISOString();
  let meetingRecord: MeetingRecord;

  try {
    meetingRecord = await getOrCreateMeetingRecordForCalendarEvent(repository, {
      userId: input.userId,
      calendarEventId: input.calendarEventId,
      calendarSourceSystemId: input.calendarSourceSystemId ?? "executive_brief",
      title: input.title,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      timezone: input.timezone ?? null,
      organizerName: input.organizerName ?? null,
      organizerEmail: input.organizerEmail ?? null,
      attendees: input.attendees ?? [],
      internalExternalClassification: input.internalExternalClassification ?? null,
      relatedCompanyNames: input.relatedCompanyNames ?? [],
      relatedPeopleNames: input.relatedPeopleNames ?? [],
      priorityReasons: input.priorityReasons ?? [],
      sourceRefs: input.sourceRefs ?? []
    });
    const researchingRecord = await repository.update({
      userId: input.userId,
      meetingRecordId: meetingRecord.id,
      row: {
        research_status: "researching",
        research_requested_at: requestedAt,
        research_completed_at: null
      }
    });
    meetingRecord = researchingRecord ?? meetingRecord;
  } catch {
    return { ok: false, error: "storage", record: null };
  }

  const sourceContext = buildSourceContext(input, meetingRecord);
  const provider = options.provider ?? runOpenAiMeetingResearchProvider;
  const providerResult = await provider({
    meetingRecord,
    sourceContext,
    generatedAt: requestedAt
  });

  if (!providerResult.ok) {
    const failedRecord = await repository.update({
      userId: input.userId,
      meetingRecordId: meetingRecord.id,
      row: {
        research_status: "failed",
        research_completed_at: new Date().toISOString(),
        research_summary: {
          meetingRecordId: meetingRecord.id,
          generatedAt: requestedAt,
          error: providerResult.error,
          sourceCoverage: sourceContext.sourceCoverage
        }
      }
    });
    return { ok: false, error: providerResult.error, record: failedRecord ?? meetingRecord };
  }

  const updated = await updateMeetingResearchSummary(repository, {
    userId: input.userId,
    meetingRecordId: meetingRecord.id,
    researchSummary: providerResult.summary,
    sourceRefs: input.sourceRefs ?? [],
    taskCandidates: providerResult.summary.taskCandidates,
    researchStatus: "researched",
    researchRequestedAt: requestedAt,
    researchCompletedAt: providerResult.summary.generatedAt
  });

  return {
    ok: true,
    record: updated ?? meetingRecord
  };
}
