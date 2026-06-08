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
  source_message_id: string | null;
  created_at: string;
};

type JsonExtraction = {
  value: JsonValue;
  start: number;
  end: number;
};

const EXECUTIVE_BRIEF_SNAPSHOT_SELECT =
  "id, subject, slot, generated_at, display_date, raw_email_body, human_brief, json_bundle, source_message_id, created_at";

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

function normalizeSpace(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
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
  return typeof raw === "string" && raw.trim() ? normalizeSpace(raw) : null;
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
  return extractFencedJson(raw) ?? extractInlineJson(raw);
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

  const normalized = normalizeSpace(candidate);
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
    humanBrief: row.human_brief,
    jsonBundle: row.json_bundle,
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

  return {
    subject,
    slot,
    generatedAt: generatedAtFromJson(jsonRecord) ?? parseDateLike(input.forwardedAt),
    displayDate: displayDateFromJson(jsonRecord),
    rawEmailBody,
    humanBrief: extractHumanBrief(rawEmailBody, jsonExtraction, jsonRecord),
    jsonBundle,
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
