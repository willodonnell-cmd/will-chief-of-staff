import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";

import type { ForwardedEmailInboundInput } from "@/lib/priority-inbox-forwarded";

export const INVESTMENT_COMMITTEE_BUNDLE_SUBJECT_PREFIX = "BLACKHAWK_IC_BUNDLE";
export const LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH = join(
  process.cwd(),
  ".local",
  "investment-committee-cycle.json"
);

export const FIXTURE_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH = join(
  process.cwd(),
  "fixtures",
  "chatgpt-agent-investment-committee-cycle.json"
);

export const INVESTMENT_COMMITTEE_AGENT_THREAD_KINDS = ["question", "answer", "package", "general"] as const;

export type InvestmentCommitteeAgentThreadKind = (typeof INVESTMENT_COMMITTEE_AGENT_THREAD_KINDS)[number];

export type InvestmentCommitteeAgentThread = {
  id: string;
  subject: string;
  sender: string;
  kind: InvestmentCommitteeAgentThreadKind;
  occurredAt: string;
  sourceUrl: string | null;
  summary: string;
  mentionsWill: boolean;
};

export type InvestmentCommitteeAgentDeal = {
  id: string;
  title: string;
  memoUrl: string | null;
  peerQuestionSummary: string | null;
  answerSummary: string | null;
  threads: InvestmentCommitteeAgentThread[];
};

export type InvestmentCommitteeAgentCycle = {
  weekOf: string;
  meetingDate: string | null;
  packageEmailSubject: string;
  packageEmailUrl: string | null;
  boxFolderUrl: string | null;
  questionsDueAt: string | null;
  resetAt: string | null;
};

export type InvestmentCommitteeAgentEnvelope = {
  producer: "chatgpt_agent";
  workflow: "investment_committee_weekly_cycle";
  producedAt: string;
  tenantLabel: string;
  cycle: InvestmentCommitteeAgentCycle;
  deals: InvestmentCommitteeAgentDeal[];
};

export type InvestmentCommitteeAgentLoadResult = {
  envelope: InvestmentCommitteeAgentEnvelope;
  source: "local" | "fixture";
};

export type ParsedInvestmentCommitteeBundle = {
  subject: string;
  rawEmailBody: string;
  envelope: InvestmentCommitteeAgentEnvelope;
  sourceMessageId: string | null;
};

type JsonExtraction = {
  value: unknown;
  start: number;
  end: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstHeaderValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim())?.trim() ?? null;
  }

  return value?.trim() || null;
}

function normalizeEmailBody(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function extractSourceMessageId(input: ForwardedEmailInboundInput) {
  const rawMessageId = firstHeaderValue(input.headers?.["message-id"]) ?? firstHeaderValue(input.headers?.["x-message-id"]);
  return rawMessageId?.replace(/^<|>$/g, "").trim() || null;
}

export function isInvestmentCommitteeBundleSubject(subject: string | null | undefined) {
  return Boolean(subject?.trim().toUpperCase().startsWith(INVESTMENT_COMMITTEE_BUNDLE_SUBJECT_PREFIX));
}

function asNonEmptyString(value: unknown, path: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return value;
}

function asNullableString(value: unknown, path: string) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${path} must be a string or null.`);
  }

  return value;
}

function asIsoTimestampOrNull(value: unknown, path: string) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = asNonEmptyString(value, path);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${path} must be a valid ISO timestamp or null.`);
  }

  return normalized;
}

function asDateOnly(value: unknown, path: string) {
  const normalized = asNonEmptyString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${path} must be a YYYY-MM-DD string.`);
  }

  return normalized;
}

function asBoolean(value: unknown, path: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }

  return value;
}

function asEnum<TValue extends string>(value: unknown, allowed: readonly TValue[], path: string): TValue {
  const normalized = asNonEmptyString(value, path);
  if (!allowed.includes(normalized as TValue)) {
    throw new Error(`${path} must be one of: ${allowed.join(", ")}.`);
  }

  return normalized as TValue;
}

function parseThread(input: unknown, index: number): InvestmentCommitteeAgentThread {
  const path = `deals[].threads[${index}]`;
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  return {
    id: asNonEmptyString(input.id, `${path}.id`),
    subject: asNonEmptyString(input.subject, `${path}.subject`),
    sender: asNonEmptyString(input.sender, `${path}.sender`),
    kind: asEnum(input.kind, INVESTMENT_COMMITTEE_AGENT_THREAD_KINDS, `${path}.kind`),
    occurredAt: asIsoTimestampOrNull(input.occurredAt, `${path}.occurredAt`) ?? (() => {
      throw new Error(`${path}.occurredAt must not be null.`);
    })(),
    sourceUrl: asNullableString(input.sourceUrl, `${path}.sourceUrl`),
    summary: asNonEmptyString(input.summary, `${path}.summary`),
    mentionsWill: asBoolean(input.mentionsWill, `${path}.mentionsWill`)
  };
}

function parseDeal(input: unknown, index: number): InvestmentCommitteeAgentDeal {
  const path = `deals[${index}]`;
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  if (!Array.isArray(input.threads)) {
    throw new Error(`${path}.threads must be an array.`);
  }

  return {
    id: asNonEmptyString(input.id, `${path}.id`),
    title: asNonEmptyString(input.title, `${path}.title`),
    memoUrl: asNullableString(input.memoUrl, `${path}.memoUrl`),
    peerQuestionSummary: asNullableString(input.peerQuestionSummary, `${path}.peerQuestionSummary`),
    answerSummary: asNullableString(input.answerSummary, `${path}.answerSummary`),
    threads: input.threads.map((thread, threadIndex) => parseThread(thread, threadIndex))
  };
}

export function parseInvestmentCommitteeAgentEnvelope(input: unknown): InvestmentCommitteeAgentEnvelope {
  if (!isRecord(input)) {
    throw new Error("Payload must be an object.");
  }

  if (input.producer !== "chatgpt_agent") {
    throw new Error("producer must be 'chatgpt_agent'.");
  }

  if (input.workflow !== "investment_committee_weekly_cycle") {
    throw new Error("workflow must be 'investment_committee_weekly_cycle'.");
  }

  if (!isRecord(input.cycle)) {
    throw new Error("cycle must be an object.");
  }

  if (!Array.isArray(input.deals)) {
    throw new Error("deals must be an array.");
  }

  return {
    producer: "chatgpt_agent",
    workflow: "investment_committee_weekly_cycle",
    producedAt: asIsoTimestampOrNull(input.producedAt, "producedAt") ?? (() => {
      throw new Error("producedAt must not be null.");
    })(),
    tenantLabel: asNonEmptyString(input.tenantLabel, "tenantLabel"),
    cycle: {
      weekOf: asDateOnly(input.cycle.weekOf, "cycle.weekOf"),
      meetingDate: asIsoTimestampOrNull(input.cycle.meetingDate, "cycle.meetingDate"),
      packageEmailSubject: asNonEmptyString(input.cycle.packageEmailSubject, "cycle.packageEmailSubject"),
      packageEmailUrl: asNullableString(input.cycle.packageEmailUrl, "cycle.packageEmailUrl"),
      boxFolderUrl: asNullableString(input.cycle.boxFolderUrl, "cycle.boxFolderUrl"),
      questionsDueAt: asIsoTimestampOrNull(input.cycle.questionsDueAt, "cycle.questionsDueAt"),
      resetAt: asIsoTimestampOrNull(input.cycle.resetAt, "cycle.resetAt")
    },
    deals: input.deals.map((deal, index) => parseDeal(deal, index))
  };
}

function parseJsonCandidate(raw: string, start: number, end: number): JsonExtraction | null {
  try {
    return { value: JSON.parse(raw.slice(start, end)) as unknown, start, end };
  } catch {
    return null;
  }
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

function extractInvestmentCommitteeJsonBundle(raw: string) {
  return extractMarkedJson(raw) ?? extractFencedJson(raw) ?? extractInlineJson(raw);
}

export function parseInvestmentCommitteeBundleEmail(input: ForwardedEmailInboundInput): ParsedInvestmentCommitteeBundle {
  const subject = input.subject?.trim() || INVESTMENT_COMMITTEE_BUNDLE_SUBJECT_PREFIX;
  const rawEmailBody = normalizeEmailBody(input.rawText);
  const jsonExtraction = extractInvestmentCommitteeJsonBundle(rawEmailBody);

  if (!jsonExtraction) {
    throw new Error("Investment Committee bundle did not contain JSON.");
  }

  return {
    subject,
    rawEmailBody,
    envelope: parseInvestmentCommitteeAgentEnvelope(jsonExtraction.value),
    sourceMessageId: extractSourceMessageId(input)
  };
}

async function fileExists(path: string) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function loadInvestmentCommitteeAgentEnvelopeWithSource(): Promise<InvestmentCommitteeAgentLoadResult> {
  const hasLocalPayload = await fileExists(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH);
  const source = hasLocalPayload ? "local" : "fixture";
  const path = hasLocalPayload
    ? LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH
    : FIXTURE_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH;
  const payload = await readFile(path, "utf8");

  return {
    envelope: parseInvestmentCommitteeAgentEnvelope(JSON.parse(payload) as unknown),
    source
  };
}

export async function loadLocalInvestmentCommitteeAgentEnvelope(): Promise<InvestmentCommitteeAgentEnvelope | null> {
  const hasLocalPayload = await fileExists(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH);
  if (!hasLocalPayload) {
    return null;
  }

  const payload = await readFile(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH, "utf8");
  return parseInvestmentCommitteeAgentEnvelope(JSON.parse(payload) as unknown);
}
