import {
  updateMeetingPostMeetingSummary,
  updateMeetingTranscriptRefs,
  type JsonValue,
  type MeetingRecord,
  type MeetingRecordsRepository,
  type MeetingTaskCandidate,
  type PostMeetingSummary
} from "@/lib/meetings/meeting-records";

export type TranscriptSourceType = "zoom" | "plaud";
export type TranscriptMatchConfidence = "high" | "medium" | "low";
export type TranscriptProcessingError = "no_match" | "needs_confirmation" | "no_provider" | "upstream" | "parse" | "network" | "storage";

export type TranscriptCandidate = {
  id: string;
  sourceType: TranscriptSourceType;
  title: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  attendees: string[];
  zoomMeetingId: string | null;
  recordingTimestamp: string | null;
  plaudTranscriptTimestamp: string | null;
  keywords: string[];
  text: string | null;
  url: string | null;
};

export type TranscriptMatch = {
  candidate: TranscriptCandidate;
  confidence: TranscriptMatchConfidence;
  score: number;
  reasons: string[];
};

export type PostMeetingSummaryProvider = (input: {
  meetingRecord: MeetingRecord;
  transcript: TranscriptCandidate;
  transcriptRef: JsonValue;
  generatedAt: string;
}) => Promise<{ ok: true; summary: PostMeetingSummary } | { ok: false; error: Exclude<TranscriptProcessingError, "no_match" | "needs_confirmation" | "storage"> }>;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "prep",
  "sync",
  "the",
  "to",
  "with"
]);

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalize(value: string | null | undefined) {
  return compactText(value).toLowerCase();
}

function parseTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function tokens(value: string | null | undefined) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function tokenOverlap(a: string[], b: string[]) {
  const bSet = new Set(b);
  return [...new Set(a)].filter((token) => bSet.has(token)).length;
}

function attendeeLabels(record: MeetingRecord) {
  return record.attendees
    .map((attendee) => {
      if (typeof attendee === "string") {
        return attendee;
      }
      if (attendee && typeof attendee === "object" && !Array.isArray(attendee)) {
        const object = attendee as Record<string, JsonValue>;
        return [object.name, object.email].filter((value): value is string => typeof value === "string").join(" ");
      }
      return "";
    })
    .map(normalize)
    .filter(Boolean);
}

function extractZoomMeetingId(record: MeetingRecord) {
  const sourceText = [record.title, JSON.stringify(record.sourceRefs), record.researchSummary ? JSON.stringify(record.researchSummary) : ""].join(" ");
  return sourceText.match(/\b(?:zoom\s*)?(?:meeting\s*)?(?:id[:#\s]*)?(\d{9,12})\b/i)?.[1] ?? null;
}

function timeOverlapScore(record: MeetingRecord, candidate: TranscriptCandidate) {
  const start = parseTime(record.startAt);
  const end = parseTime(record.endAt);
  const candidateStart = parseTime(candidate.startedAt ?? candidate.recordingTimestamp ?? candidate.plaudTranscriptTimestamp);
  const candidateEnd = parseTime(candidate.endedAt);
  if (!start || !candidateStart) {
    return { score: 0, reason: null };
  }

  const windowStart = start - 30 * 60 * 1000;
  const windowEnd = (end ?? start + 60 * 60 * 1000) + 30 * 60 * 1000;
  if (candidateStart >= windowStart && candidateStart <= windowEnd) {
    return { score: 35, reason: "transcript timestamp is inside the meeting window" };
  }

  if (candidateEnd && candidateEnd >= windowStart && candidateEnd <= windowEnd) {
    return { score: 25, reason: "transcript end time overlaps the meeting window" };
  }

  const distanceMinutes = Math.abs(candidateStart - start) / 60_000;
  if (distanceMinutes <= 180) {
    return { score: 15, reason: "transcript timestamp is near the meeting window" };
  }

  return { score: 0, reason: null };
}

function durationScore(record: MeetingRecord, candidate: TranscriptCandidate) {
  const start = parseTime(record.startAt);
  const end = parseTime(record.endAt);
  if (!start || !end || !candidate.durationMinutes) {
    return { score: 0, reason: null };
  }

  const meetingMinutes = Math.max(1, Math.round((end - start) / 60_000));
  const delta = Math.abs(meetingMinutes - candidate.durationMinutes);
  if (delta <= 10) {
    return { score: 15, reason: "transcript duration matches the calendar duration" };
  }
  if (delta <= 25) {
    return { score: 8, reason: "transcript duration is close to the calendar duration" };
  }
  return { score: 0, reason: null };
}

function confidenceFromScore(score: number, reasons: string[]): TranscriptMatchConfidence {
  const hasTimeEvidence = reasons.some((reason) => reason.includes("time") || reason.includes("window"));
  const hasNonTitleEvidence = reasons.some(
    (reason) =>
      reason.includes("attendee") ||
      reason.includes("duration") ||
      reason.includes("zoom") ||
      reason.includes("keyword") ||
      reason.includes("MeetingRecord")
  );

  if (score >= 75 && hasTimeEvidence && hasNonTitleEvidence) {
    return "high";
  }
  if (score >= 45 && (hasTimeEvidence || hasNonTitleEvidence)) {
    return "medium";
  }
  return "low";
}

export function matchTranscriptCandidate(meetingRecord: MeetingRecord, candidate: TranscriptCandidate): TranscriptMatch {
  let score = 0;
  const reasons: string[] = [];
  const zoomMeetingId = extractZoomMeetingId(meetingRecord);

  if (zoomMeetingId && candidate.zoomMeetingId && zoomMeetingId === candidate.zoomMeetingId) {
    score += 45;
    reasons.push("zoom meeting id matches");
  }

  const timeScore = timeOverlapScore(meetingRecord, candidate);
  score += timeScore.score;
  if (timeScore.reason) {
    reasons.push(timeScore.reason);
  }

  const duration = durationScore(meetingRecord, candidate);
  score += duration.score;
  if (duration.reason) {
    reasons.push(duration.reason);
  }

  const titleOverlap = tokenOverlap(tokens(meetingRecord.title), tokens(candidate.title));
  if (titleOverlap >= 2) {
    score += Math.min(18, titleOverlap * 6);
    reasons.push("title tokens overlap");
  }

  const meetingAttendees = attendeeLabels(meetingRecord);
  const candidateAttendees = candidate.attendees.map(normalize).filter(Boolean);
  const attendeeOverlap = meetingAttendees.filter((attendee) =>
    candidateAttendees.some((candidateAttendee) => candidateAttendee.includes(attendee) || attendee.includes(candidateAttendee))
  ).length;
  if (attendeeOverlap > 0) {
    score += Math.min(20, attendeeOverlap * 10);
    reasons.push("attendees overlap");
  }

  const recordKeywords = [
    ...tokens(meetingRecord.title),
    ...meetingRecord.relatedCompanyNames.flatMap(tokens),
    ...meetingRecord.relatedPeopleNames.flatMap(tokens),
    ...meetingRecord.priorityReasons.flatMap(tokens),
    ...tokens(meetingRecord.calendarEventId)
  ];
  const keywordOverlap = tokenOverlap(recordKeywords, candidate.keywords.flatMap(tokens));
  if (keywordOverlap > 0) {
    score += Math.min(15, keywordOverlap * 5);
    reasons.push("company/person keywords overlap");
  }

  if (candidate.keywords.includes(meetingRecord.id) || candidate.keywords.includes(meetingRecord.calendarEventId)) {
    score += 20;
    reasons.push("prior MeetingRecord identifier matches");
  }

  return {
    candidate,
    score,
    reasons,
    confidence: confidenceFromScore(score, reasons)
  };
}

export function findBestTranscriptMatch(meetingRecord: MeetingRecord, candidates: TranscriptCandidate[]) {
  return candidates
    .map((candidate) => matchTranscriptCandidate(meetingRecord, candidate))
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

function transcriptRef(candidate: TranscriptCandidate, match: TranscriptMatch): JsonValue {
  return {
    sourceType: candidate.sourceType,
    id: candidate.id,
    title: candidate.title,
    url: candidate.url,
    startedAt: candidate.startedAt,
    endedAt: candidate.endedAt,
    confidence: match.confidence,
    score: match.score,
    reasons: match.reasons
  };
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
  if (value === null || typeof value === "string" || typeof value === "boolean") {
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
      const taskType = typeof record.taskType === "string" ? record.taskType : "follow_up";
      const allowedTypes = ["prep", "follow_up", "decision", "review", "delegate", "schedule", "monitor"];

      return {
        title,
        description: typeof record.description === "string" ? compactText(record.description) || null : null,
        owner: typeof record.owner === "string" ? compactText(record.owner) || null : null,
        priority: record.priority === "low" || record.priority === "medium" || record.priority === "high" ? record.priority : null,
        dueDate: typeof record.dueDate === "string" ? compactText(record.dueDate) || null : null,
        sourceRefs: asJsonArray(record.sourceRefs),
        dedupeKey:
          typeof record.dedupeKey === "string" && compactText(record.dedupeKey)
            ? compactText(record.dedupeKey)
            : `${meetingRecordId}:post-meeting:${index + 1}:${title.toLowerCase()}`,
        meetingRecordId,
        taskType: allowedTypes.includes(taskType) ? taskType as MeetingTaskCandidate["taskType"] : "follow_up"
      };
    })
    .filter((candidate): candidate is MeetingTaskCandidate => Boolean(candidate));
}

function normalizePostMeetingSummary(input: {
  raw: Record<string, unknown>;
  meetingRecord: MeetingRecord;
  transcriptRef: JsonValue;
  generatedAt: string;
}): PostMeetingSummary {
  const summary = typeof input.raw.summary === "string" ? compactText(input.raw.summary) : "";
  return {
    generatedAt: typeof input.raw.generatedAt === "string" ? input.raw.generatedAt : input.generatedAt,
    sourceTranscriptRefs: [input.transcriptRef],
    summary: summary || "Transcript attached; no supported summary was generated.",
    decisions: asJsonArray(input.raw.decisions),
    actionItemCandidates: normalizeTaskCandidates(input.raw.actionItemCandidates, input.meetingRecord.id),
    risksOrOpenIssues: asJsonArray(input.raw.risksOrOpenIssues),
    followUpDraftAvailable: input.raw.followUpDraftAvailable === true
  };
}

export async function runOpenAiPostMeetingSummaryProvider(
  input: Parameters<PostMeetingSummaryProvider>[0]
): ReturnType<PostMeetingSummaryProvider> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "no_provider" };
  }
  if (!compactText(input.transcript.text)) {
    return { ok: false, error: "parse" };
  }

  const model = process.env.OPENAI_MEETING_TRANSCRIPT_MODEL?.trim() || process.env.OPENAI_RESEARCH_MODEL?.trim() || "gpt-4.1";
  const orgId = process.env.OPENAI_ORG_ID?.trim();
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
          {
            role: "system",
            content:
              "Summarize a meeting transcript for Blackhawk. Return one JSON object only with generatedAt, summary, decisions, actionItemCandidates, risksOrOpenIssues, followUpDraftAvailable. Extract task candidates only; do not create tasks. Do not invent facts."
          },
          {
            role: "user",
            content: JSON.stringify({
              meetingRecord: {
                id: input.meetingRecord.id,
                title: input.meetingRecord.title,
                startAt: input.meetingRecord.startAt,
                endAt: input.meetingRecord.endAt
              },
              transcript: {
                sourceType: input.transcript.sourceType,
                title: input.transcript.title,
                startedAt: input.transcript.startedAt,
                text: input.transcript.text
              }
            })
          }
        ],
        max_output_tokens: 1800
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "(unreadable)");
      console.error("[meeting-transcripts] OpenAI error", response.status, detail);
      return { ok: false, error: "upstream" };
    }

    const parsed = extractJsonObject(extractOpenAiAssistantText((await response.json()) as { output?: unknown[] }));
    if (!parsed) {
      return { ok: false, error: "parse" };
    }

    return {
      ok: true,
      summary: normalizePostMeetingSummary({
        raw: parsed,
        meetingRecord: input.meetingRecord,
        transcriptRef: input.transcriptRef,
        generatedAt: input.generatedAt
      })
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function attachTranscriptAndGeneratePostMeetingSummary(
  repository: MeetingRecordsRepository,
  input: {
    meetingRecord: MeetingRecord;
    candidates: TranscriptCandidate[];
    now?: string;
    provider?: PostMeetingSummaryProvider;
    allowMediumConfidence?: boolean;
  }
): Promise<
  | { ok: true; record: MeetingRecord; match: TranscriptMatch; summary: PostMeetingSummary }
  | { ok: false; error: TranscriptProcessingError; record: MeetingRecord; match: TranscriptMatch | null }
> {
  const match = findBestTranscriptMatch(input.meetingRecord, input.candidates);
  if (!match || match.confidence === "low") {
    return { ok: false, error: "no_match", record: input.meetingRecord, match };
  }
  if (match.confidence === "medium" && !input.allowMediumConfidence) {
    return { ok: false, error: "needs_confirmation", record: input.meetingRecord, match };
  }

  const ref = transcriptRef(match.candidate, match);
  let attached = await updateMeetingTranscriptRefs(repository, {
    userId: input.meetingRecord.userId,
    meetingRecordId: input.meetingRecord.id,
    transcriptStatus: "processing",
    transcriptRefs: [...input.meetingRecord.transcriptRefs, ref],
    postMeetingStatus: "pending"
  });
  attached = attached ?? input.meetingRecord;

  const provider = input.provider ?? runOpenAiPostMeetingSummaryProvider;
  const generatedAt = input.now ?? new Date().toISOString();
  const providerResult = await provider({
    meetingRecord: attached,
    transcript: match.candidate,
    transcriptRef: ref,
    generatedAt
  });

  if (!providerResult.ok) {
    const failed = await updateMeetingTranscriptRefs(repository, {
      userId: attached.userId,
      meetingRecordId: attached.id,
      transcriptStatus: "failed",
      transcriptRefs: attached.transcriptRefs,
      postMeetingStatus: "failed",
      postMeetingSummary: {
        generatedAt,
        error: providerResult.error,
        sourceTranscriptRefs: [ref]
      }
    });
    return { ok: false, error: providerResult.error, record: failed ?? attached, match };
  }

  const summarized = await updateMeetingPostMeetingSummary(repository, {
    userId: attached.userId,
    meetingRecordId: attached.id,
    postMeetingStatus: "summarized",
    postMeetingSummary: providerResult.summary,
    taskCandidates: providerResult.summary.actionItemCandidates
  });
  const finalRecord = await updateMeetingTranscriptRefs(repository, {
    userId: attached.userId,
    meetingRecordId: attached.id,
    transcriptStatus: "summarized",
    transcriptRefs: attached.transcriptRefs
  });

  return {
    ok: true,
    record: finalRecord ?? summarized ?? attached,
    match,
    summary: providerResult.summary
  };
}
