import type { SupabaseClient } from "@supabase/supabase-js";

import type { ForwardedEmailInboundInput } from "@/lib/priority-inbox-forwarded";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

export const EXECUTIVE_BRIEF_BUNDLE_SUBJECT_PREFIX = "BLACKHAWK_BRIEF_BUNDLE";
export const EXECUTIVE_BRIEF_SLOT_LABELS = ["7 AM", "11 AM", "1 PM", "3 PM", "5 PM", "7 PM", "Manual"] as const;

export type ExecutiveBriefSlotLabel = (typeof EXECUTIVE_BRIEF_SLOT_LABELS)[number];
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

export type ParsedExecutiveBriefBundle = {
  subject: string;
  slot: ExecutiveBriefSlotLabel;
  generatedAt: string | null;
  displayDate: string | null;
  rawEmailBody: string;
  humanBrief: string | null;
  jsonBundle: JsonValue | null;
  structuredBrief: StructuredExecutiveBrief | null;
  contractVersion: string | null;
  validationWarnings: string[];
  sourceMessageId: string | null;
};

export type ExecutiveBriefSnapshot = ParsedExecutiveBriefBundle & {
  id: string;
  createdAt: string;
};

type ExecutiveBriefSnapshotRow = {
  id: string;
  subject: string;
  slot: ExecutiveBriefSlotLabel;
  generated_at: string | null;
  display_date: string | null;
  raw_email_body: string;
  human_brief: string | null;
  json_bundle: JsonValue | null;
  structured_brief: JsonValue | null;
  contract_version: string | null;
  validation_warnings: string[] | null;
  source_message_id: string | null;
  created_at: string;
};

export type StructuredExecutiveBriefItem = {
  id: string;
  title: string;
  summary: string | null;
  source: string | null;
  sourceLane?: "email" | "calendar_meetings" | "teams" | null;
  sourceRefs?: JsonValue[];
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  receivedAt?: string | null;
  priority: "high" | "medium" | "low" | null;
  recommendedAction: string | null;
  dueAt: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timezone?: string | null;
  attendees?: JsonValue[];
  organizerName?: string | null;
  organizerEmail?: string | null;
  locationOrLink?: string | null;
  calendarEventId?: string | null;
  calendarSourceSystemId?: string | null;
  descriptionSummary?: string | null;
  relatedCompanyNames?: string[];
  relatedPeopleNames?: string[];
  internalExternalClassification?: "internal" | "external" | "mixed" | "unknown" | null;
  priorityReasons?: string[];
};

export type StructuredExecutiveBrief = {
  commandSummary: string[];
  topMoves: StructuredExecutiveBriefItem[];
  decisionsNeeded: StructuredExecutiveBriefItem[];
  meetingPrep: StructuredExecutiveBriefItem[];
  carryForward: StructuredExecutiveBriefItem[];
  taskCandidates: StructuredExecutiveBriefItem[];
};

type JsonExtraction = {
  value: JsonValue;
  start: number;
  end: number;
};

const EXECUTIVE_BRIEF_SNAPSHOT_SELECT =
  "id, subject, slot, generated_at, display_date, raw_email_body, human_brief, json_bundle, structured_brief, contract_version, validation_warnings, source_message_id, created_at";

function firstHeaderValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim())?.trim() ?? null;
  }

  return value?.trim() || null;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return Number.isFinite(value) || valueType !== "number";
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (value && valueType === "object") {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function toJsonRecord(value: JsonValue | null): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function isJsonRecord(value: JsonValue | undefined): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeSpace(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function stripWillEmailSignature(value: string | null) {
  if (!value) {
    return null;
  }

  const withoutSignature = value
    .replace(/\n\s*Will O'Donnell\s*\n\s*\|[\s\S]*$/i, "")
    .replace(/\n\s*signature for O'Donnell, Will\s*$/i, "");
  const normalized = normalizeSpace(withoutSignature);
  return normalized || null;
}

function normalizeOneLine(value: unknown) {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : null;
}

function parseDateLike(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeSourceUrl(value: unknown) {
  const candidate = normalizeOneLine(value);
  if (!candidate) {
    return null;
  }

  return candidate.match(/https?:\/\/[^\s)\]]+/i)?.[0] ?? candidate;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeOneLine).filter((entry): entry is string => Boolean(entry));
}

function normalizeSourceRefs(value: unknown): JsonValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is JsonValue => isJsonValue(entry));
}

function normalizeSourceLane(value: unknown): StructuredExecutiveBriefItem["sourceLane"] {
  const normalized = normalizeOneLine(value)?.toLowerCase();
  if (normalized === "email" || normalized === "calendar_meetings" || normalized === "teams") {
    return normalized;
  }

  return null;
}

function normalizeInternalExternalClassification(
  value: unknown
): StructuredExecutiveBriefItem["internalExternalClassification"] {
  const normalized = normalizeOneLine(value)?.toLowerCase();
  if (normalized === "internal" || normalized === "external" || normalized === "mixed" || normalized === "unknown") {
    return normalized;
  }

  return null;
}

function normalizeAttendees(value: unknown): JsonValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return normalizeOneLine(entry);
      }

      if (isJsonRecord(entry)) {
        const name = normalizeOneLine(entry.name) ?? normalizeOneLine(entry.displayName);
        const email = normalizeOneLine(entry.email) ?? normalizeOneLine(entry.address);
        const responseStatus = normalizeOneLine(entry.responseStatus) ?? normalizeOneLine(entry.status);
        const normalized: JsonRecord = {};
        if (name) {
          normalized.name = name;
        }
        if (email) {
          normalized.email = email;
        }
        if (responseStatus) {
          normalized.responseStatus = responseStatus;
        }
        return Object.keys(normalized).length > 0 ? normalized : null;
      }

      return null;
    })
    .filter((entry): entry is string | JsonRecord => Boolean(entry));
}

function parseDisplayDate(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractSourceMessageId(input: ForwardedEmailInboundInput) {
  const rawMessageId = firstHeaderValue(input.headers?.["message-id"]) ?? firstHeaderValue(input.headers?.["x-message-id"]);
  return rawMessageId?.replace(/^<|>$/g, "").trim() || null;
}

export function isExecutiveBriefBundleSubject(subject: string | null | undefined) {
  return Boolean(subject?.trim().toUpperCase().startsWith(EXECUTIVE_BRIEF_BUNDLE_SUBJECT_PREFIX));
}

function slotFromText(value: string | null | undefined): ExecutiveBriefSlotLabel | null {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase();
  return EXECUTIVE_BRIEF_SLOT_LABELS.find((slot) => normalized.includes(slot.toUpperCase())) ?? null;
}

function slotFromJson(value: JsonRecord | null): ExecutiveBriefSlotLabel | null {
  const rawSlot = value?.slot ?? value?.brief_slot ?? value?.briefSlot;
  return typeof rawSlot === "string" ? slotFromText(rawSlot) : null;
}

function generatedAtFromJson(value: JsonRecord | null) {
  return (
    parseDateLike(value?.generated_at) ??
    parseDateLike(value?.generatedAt) ??
    parseDateLike(value?.generatedAtIso) ??
    parseDateLike(value?.created_at)
  );
}

function displayDateFromJson(value: JsonRecord | null) {
  return parseDisplayDate(value?.display_date) ?? parseDisplayDate(value?.displayDate) ?? parseDisplayDate(value?.date);
}

function humanBriefFromJson(value: JsonRecord | null) {
  const raw = value?.human_brief ?? value?.humanBrief ?? value?.brief;
  return typeof raw === "string" && raw.trim() ? stripWillEmailSignature(raw) : null;
}

function contractVersionFromJson(value: JsonRecord | null) {
  return (
    normalizeOneLine(value?.contract_version) ??
    normalizeOneLine(value?.contractVersion) ??
    normalizeOneLine(value?.schema_version) ??
    normalizeOneLine(value?.schemaVersion)
  );
}

function firstJsonValue(record: JsonRecord | null, keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  return undefined;
}

function jsonArrayFromKeys(record: JsonRecord | null, keys: string[]) {
  const value = firstJsonValue(record, keys);
  return Array.isArray(value) ? value : [];
}

function normalizePriority(value: unknown): StructuredExecutiveBriefItem["priority"] {
  const normalized = normalizeOneLine(value)?.toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return null;
}

function normalizeStructuredItem(value: JsonValue, fallbackPrefix: string, index: number): StructuredExecutiveBriefItem | null {
  if (typeof value === "string") {
    const title = normalizeOneLine(value);
    return title
      ? {
          id: `${fallbackPrefix}-${index + 1}`,
          title,
          summary: null,
          source: null,
          priority: null,
          recommendedAction: null,
          dueAt: null,
          attendees: []
        }
      : null;
  }

  if (!isJsonRecord(value)) {
    return null;
  }

  const title =
    normalizeOneLine(value.title) ??
    normalizeOneLine(value.headline) ??
    normalizeOneLine(value.item) ??
    normalizeOneLine(value.name);

  if (!title) {
    return null;
  }

  return {
    id: normalizeOneLine(value.id) ?? `${fallbackPrefix}-${index + 1}`,
    title,
    summary: normalizeOneLine(value.summary) ?? normalizeOneLine(value.detail) ?? normalizeOneLine(value.why_it_matters),
    source: normalizeOneLine(value.source) ?? normalizeOneLine(value.source_type),
    sourceLane: normalizeSourceLane(value.source_lane ?? value.sourceLane),
    sourceRefs: normalizeSourceRefs(value.source_refs ?? value.sourceRefs),
    sourceLabel:
      normalizeOneLine(value.source_label) ??
      normalizeOneLine(value.sourceLabel) ??
      normalizeOneLine(value.thread) ??
      normalizeOneLine(value.threadLabel),
    sourceUrl:
      normalizeSourceUrl(value.source_url) ??
      normalizeSourceUrl(value.sourceUrl) ??
      normalizeSourceUrl(value.webLink) ??
      normalizeSourceUrl(value.url) ??
      normalizeSourceUrl(value.link),
    senderName:
      normalizeOneLine(value.sender_name) ??
      normalizeOneLine(value.senderName) ??
      normalizeOneLine(value.sender) ??
      normalizeOneLine(value.from),
    senderEmail:
      normalizeOneLine(value.sender_email) ??
      normalizeOneLine(value.senderEmail) ??
      normalizeOneLine(value.fromEmail) ??
      normalizeOneLine(value.from_email),
    receivedAt:
      parseDateLike(value.received_at) ??
      parseDateLike(value.receivedAt) ??
      parseDateLike(value.occurredAt) ??
      parseDateLike(value.occurred_at),
    priority: normalizePriority(value.priority ?? value.urgency),
    recommendedAction:
      normalizeOneLine(value.recommended_action) ??
      normalizeOneLine(value.recommendedAction) ??
      normalizeOneLine(value.action),
    dueAt: parseDateLike(value.due_at) ?? parseDateLike(value.dueAt),
    startAt:
      parseDateLike(value.start_at) ??
      parseDateLike(value.startAt) ??
      parseDateLike(value.meeting_start) ??
      parseDateLike(value.meetingStart),
    endAt:
      parseDateLike(value.end_at) ??
      parseDateLike(value.endAt) ??
      parseDateLike(value.meeting_end) ??
      parseDateLike(value.meetingEnd),
    timezone: normalizeOneLine(value.timezone) ?? normalizeOneLine(value.time_zone) ?? normalizeOneLine(value.tz),
    attendees: normalizeAttendees(value.attendees ?? value.participants),
    organizerName:
      normalizeOneLine(value.organizer_name) ??
      normalizeOneLine(value.organizerName) ??
      normalizeOneLine(value.organizer),
    organizerEmail: normalizeOneLine(value.organizer_email) ?? normalizeOneLine(value.organizerEmail),
    locationOrLink:
      normalizeOneLine(value.location_or_link) ??
      normalizeOneLine(value.locationOrLink) ??
      normalizeOneLine(value.location) ??
      normalizeSourceUrl(value.meetingLink),
    calendarEventId:
      normalizeOneLine(value.calendar_event_id) ??
      normalizeOneLine(value.calendarEventId) ??
      normalizeOneLine(value.event_id) ??
      normalizeOneLine(value.eventId),
    calendarSourceSystemId:
      normalizeOneLine(value.calendar_source_system_id) ??
      normalizeOneLine(value.calendarSourceSystemId) ??
      normalizeOneLine(value.calendar_source) ??
      normalizeOneLine(value.calendarSource),
    descriptionSummary:
      normalizeOneLine(value.description_summary) ??
      normalizeOneLine(value.descriptionSummary) ??
      normalizeOneLine(value.description),
    relatedCompanyNames: normalizeStringArray(value.related_company_names ?? value.relatedCompanyNames),
    relatedPeopleNames: normalizeStringArray(value.related_people_names ?? value.relatedPeopleNames),
    internalExternalClassification: normalizeInternalExternalClassification(
      value.internal_external_classification ?? value.internalExternalClassification
    ),
    priorityReasons: normalizeStringArray(value.priority_reasons ?? value.priorityReasons)
  };
}

function normalizeStructuredItems(record: JsonRecord | null, keys: string[], fallbackPrefix: string) {
  return jsonArrayFromKeys(record, keys)
    .map((value, index) => normalizeStructuredItem(value, fallbackPrefix, index))
    .filter((item): item is StructuredExecutiveBriefItem => Boolean(item));
}

function normalizeCommandSummary(record: JsonRecord | null) {
  return jsonArrayFromKeys(record, ["command_summary", "commandSummary", "summary"])
    .map((value) => (typeof value === "string" ? normalizeOneLine(value) : null))
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
}

export function normalizeExecutiveBriefJsonBundle(value: JsonValue | null) {
  const record = toJsonRecord(value);
  const warnings: string[] = [];

  if (!record) {
    return { structuredBrief: null, contractVersion: null, validationWarnings: ["No JSON object bundle was found."] };
  }

  const structuredBrief: StructuredExecutiveBrief = {
    commandSummary: normalizeCommandSummary(record),
    topMoves: normalizeStructuredItems(
      record,
      ["top_3_executive_moves", "topExecutiveMoves", "top_moves", "topMoves", "executive_moves", "moves"],
      "move"
    ),
    decisionsNeeded: normalizeStructuredItems(
      record,
      ["decisions_needed", "decisionsNeeded", "decision_required", "decisionRequired"],
      "decision"
    ),
    meetingPrep: normalizeStructuredItems(
      record,
      ["meeting_prep", "meetingPrep", "calendar_prep", "calendarPrep"],
      "meeting"
    ),
    carryForward: normalizeStructuredItems(
      record,
      ["carry_forward", "carryForward", "retained_context", "retainedContext"],
      "carry-forward"
    ),
    taskCandidates: normalizeStructuredItems(
      record,
      ["task_candidates", "taskCandidates", "recommended_tasks", "recommendedTasks"],
      "task"
    )
  };

  const itemCount =
    structuredBrief.commandSummary.length +
    structuredBrief.topMoves.length +
    structuredBrief.decisionsNeeded.length +
    structuredBrief.meetingPrep.length +
    structuredBrief.carryForward.length +
    structuredBrief.taskCandidates.length;

  if (itemCount === 0) {
    warnings.push("JSON bundle did not contain recognized Executive Brief sections.");
  }

  return {
    structuredBrief: itemCount > 0 ? structuredBrief : null,
    contractVersion: contractVersionFromJson(record),
    validationWarnings: warnings
  };
}

export function countStructuredExecutiveBriefItems(structuredBrief: StructuredExecutiveBrief | null) {
  if (!structuredBrief) {
    return 0;
  }

  return (
    structuredBrief.commandSummary.length +
    structuredBrief.topMoves.length +
    structuredBrief.decisionsNeeded.length +
    structuredBrief.meetingPrep.length +
    structuredBrief.carryForward.length +
    structuredBrief.taskCandidates.length
  );
}

function parseJsonCandidate(raw: string, start: number, end: number): JsonExtraction | null {
  try {
    const parsed = JSON.parse(raw.slice(start, end));
    return isJsonValue(parsed) ? { value: parsed, start, end } : null;
  } catch {
    return null;
  }
}

function extractFencedJson(raw: string): JsonExtraction | null {
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fencePattern.exec(raw))) {
    const candidate = match[1];
    if (!candidate) {
      continue;
    }

    const parsed = parseJsonCandidate(candidate.trim(), 0, candidate.trim().length);
    if (parsed) {
      return {
        value: parsed.value,
        start: match.index,
        end: match.index + match[0].length
      };
    }
  }

  return null;
}

function extractMarkedJson(raw: string): JsonExtraction | null {
  const markerPattern = /BLACKHAWK_JSON_START([\s\S]*?)BLACKHAWK_JSON_END/i;
  const match = markerPattern.exec(raw);
  if (!match?.[1]) {
    return null;
  }

  const candidate = match[1].trim();
  const parsed = parseJsonCandidate(candidate, 0, candidate.length);
  if (!parsed) {
    return null;
  }

  return {
    value: parsed.value,
    start: match.index,
    end: match.index + match[0].length
  };
}

function findMatchingJsonEnd(raw: string, start: number) {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
      continue;
    }

    if (char === "}" || char === "]") {
      if (stack.pop() !== char) {
        return null;
      }

      if (stack.length === 0) {
        return index + 1;
      }
    }
  }

  return null;
}

function extractInlineJson(raw: string): JsonExtraction | null {
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char !== "{" && char !== "[") {
      continue;
    }

    const end = findMatchingJsonEnd(raw, index);
    if (!end) {
      continue;
    }

    const parsed = parseJsonCandidate(raw, index, end);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractJsonBundle(raw: string) {
  return extractMarkedJson(raw) ?? extractFencedJson(raw) ?? extractInlineJson(raw);
}

function extractHumanBrief(raw: string, jsonExtraction: JsonExtraction | null, jsonRecord: JsonRecord | null) {
  const fromJson = humanBriefFromJson(jsonRecord);
  let candidate = raw;

  if (jsonExtraction) {
    candidate = `${raw.slice(0, jsonExtraction.start)}\n${raw.slice(jsonExtraction.end)}`;
  }

  candidate = candidate
    .replace(/^\s*human[-_\s]*brief\s*:\s*/im, "")
    .replace(/^\s*(begin|start)[-_\s]*human[-_\s]*brief\s*$/gim, "")
    .replace(/^\s*(end)[-_\s]*human[-_\s]*brief\s*$/gim, "")
    .replace(/^\s*(begin|start|end)[-_\s]*json[-_\s]*bundle\s*$/gim, "");

  const normalized = stripWillEmailSignature(candidate);
  return normalized || fromJson;
}

function mapSnapshotRow(row: ExecutiveBriefSnapshotRow): ExecutiveBriefSnapshot {
  return {
    id: row.id,
    subject: row.subject,
    slot: row.slot,
    generatedAt: row.generated_at,
    displayDate: row.display_date,
    rawEmailBody: row.raw_email_body,
    humanBrief: stripWillEmailSignature(row.human_brief),
    jsonBundle: row.json_bundle,
    structuredBrief: toJsonRecord(row.structured_brief) as StructuredExecutiveBrief | null,
    contractVersion: row.contract_version,
    validationWarnings: row.validation_warnings ?? [],
    sourceMessageId: row.source_message_id,
    createdAt: row.created_at
  };
}

export function parseExecutiveBriefBundleEmail(input: ForwardedEmailInboundInput): ParsedExecutiveBriefBundle {
  const subject = input.subject?.trim() || EXECUTIVE_BRIEF_BUNDLE_SUBJECT_PREFIX;
  const rawEmailBody = normalizeSpace(input.rawText);
  const jsonExtraction = extractJsonBundle(rawEmailBody);
  const jsonBundle = jsonExtraction?.value ?? null;
  const jsonRecord = toJsonRecord(jsonBundle);
  const slot = slotFromJson(jsonRecord) ?? slotFromText(subject) ?? slotFromText(rawEmailBody) ?? "Manual";
  const normalized = normalizeExecutiveBriefJsonBundle(jsonBundle);

  return {
    subject,
    slot,
    generatedAt: generatedAtFromJson(jsonRecord) ?? parseDateLike(input.forwardedAt),
    displayDate: displayDateFromJson(jsonRecord),
    rawEmailBody,
    humanBrief: extractHumanBrief(rawEmailBody, jsonExtraction, jsonRecord),
    jsonBundle,
    structuredBrief: normalized.structuredBrief,
    contractVersion: normalized.contractVersion,
    validationWarnings: normalized.validationWarnings,
    sourceMessageId: extractSourceMessageId(input)
  };
}

export async function upsertExecutiveBriefSnapshot(params: {
  client: SupabaseClient;
  userId: string;
  parsed: ParsedExecutiveBriefBundle;
}) {
  const row = {
    user_id: params.userId,
    subject: params.parsed.subject,
    slot: params.parsed.slot,
    generated_at: params.parsed.generatedAt,
    display_date: params.parsed.displayDate,
    raw_email_body: params.parsed.rawEmailBody,
    human_brief: params.parsed.humanBrief,
    json_bundle: params.parsed.jsonBundle,
    structured_brief: params.parsed.structuredBrief,
    contract_version: params.parsed.contractVersion,
    validation_warnings: params.parsed.validationWarnings,
    source_message_id: params.parsed.sourceMessageId
  };

  const query = params.parsed.sourceMessageId
    ? params.client.from("executive_brief_snapshots").upsert(row, {
        onConflict: "user_id,source_message_id"
      })
    : params.client.from("executive_brief_snapshots").insert(row);

  const response = await withSupabaseTimeout(
    query.select(EXECUTIVE_BRIEF_SNAPSHOT_SELECT).single<ExecutiveBriefSnapshotRow>()
  );

  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? "Executive Brief snapshot could not be persisted.");
  }

  return mapSnapshotRow(response.data);
}

export async function listExecutiveBriefSnapshotsForUser(params: {
  client: SupabaseClient;
  userId: string;
}) {
  const response = await withSupabaseTimeout(
    params.client
      .from("executive_brief_snapshots")
      .select(EXECUTIVE_BRIEF_SNAPSHOT_SELECT)
      .eq("user_id", params.userId)
      .order("generated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<ExecutiveBriefSnapshotRow[]>()
  );

  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? "Executive Brief snapshots could not be loaded.");
  }

  return response.data.map(mapSnapshotRow);
}
