import { readFile } from "node:fs/promises";

import {
  CHIEF_OF_STAFF_SIGNAL_ATTENTION,
  CHIEF_OF_STAFF_SIGNAL_SOURCES,
  CHIEF_OF_STAFF_SIGNAL_TYPES,
  type ChiefOfStaffSignal,
  type ChiefOfStaffSignalAttention,
  type ChiefOfStaffSignalSource,
  type ChiefOfStaffSignalType
} from "./chief-of-staff-signal";

export const LOCAL_MICROSOFT_365_FIXTURE_URL = new URL(
  "../fixtures/chatgpt-agent-microsoft-365-signals.json",
  import.meta.url
);

export type AgentProducedMicrosoft365SignalEnvelope = {
  producer: "chatgpt_agent";
  connectorFamily: "microsoft_365";
  producedAt: string;
  tenantLabel: string;
  signals: ChiefOfStaffSignal[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return value;
}

function asOptionalNullableString(value: unknown, path: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${path} must be a string or null.`);
  }

  return value;
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }

  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of strings.`);
  }

  return value.map((entry, index) => asNonEmptyString(entry, `${path}[${index}]`));
}

function asIsoTimestamp(value: unknown, path: string): string {
  const normalized = asNonEmptyString(value, path);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${path} must be a valid ISO timestamp.`);
  }

  return normalized;
}

function asEnum<TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  path: string
): TValue {
  const normalized = asNonEmptyString(value, path);

  if (!allowed.includes(normalized as TValue)) {
    throw new Error(`${path} must be one of: ${allowed.join(", ")}.`);
  }

  return normalized as TValue;
}

function parseChiefOfStaffSignal(input: unknown, index: number): ChiefOfStaffSignal {
  const path = `signals[${index}]`;
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  return {
    id: asNonEmptyString(input.id, `${path}.id`),
    source: asEnum<ChiefOfStaffSignalSource>(
      input.source,
      CHIEF_OF_STAFF_SIGNAL_SOURCES,
      `${path}.source`
    ),
    signalType: asEnum<ChiefOfStaffSignalType>(
      input.signalType,
      CHIEF_OF_STAFF_SIGNAL_TYPES,
      `${path}.signalType`
    ),
    attention: asEnum<ChiefOfStaffSignalAttention>(
      input.attention,
      CHIEF_OF_STAFF_SIGNAL_ATTENTION,
      `${path}.attention`
    ),
    title: asNonEmptyString(input.title, `${path}.title`),
    summary: asNonEmptyString(input.summary, `${path}.summary`),
    owner: asNonEmptyString(input.owner, `${path}.owner`),
    sourceLabel: asNonEmptyString(input.sourceLabel, `${path}.sourceLabel`),
    occurredAt: asIsoTimestamp(input.occurredAt, `${path}.occurredAt`),
    dueAt: input.dueAt === undefined ? null : asOptionalNullableString(input.dueAt, `${path}.dueAt`),
    sourceUrl:
      input.sourceUrl === undefined
        ? null
        : asOptionalNullableString(input.sourceUrl, `${path}.sourceUrl`),
    actionRequest:
      input.actionRequest === undefined
        ? null
        : asOptionalNullableString(input.actionRequest, `${path}.actionRequest`),
    participants: asStringArray(input.participants, `${path}.participants`),
    protectedContext: asBoolean(input.protectedContext, `${path}.protectedContext`)
  };
}

export function parseAgentProducedMicrosoft365SignalEnvelope(
  input: unknown
): AgentProducedMicrosoft365SignalEnvelope {
  if (!isRecord(input)) {
    throw new Error("Payload must be an object.");
  }

  if (input.producer !== "chatgpt_agent") {
    throw new Error("producer must be 'chatgpt_agent'.");
  }

  if (input.connectorFamily !== "microsoft_365") {
    throw new Error("connectorFamily must be 'microsoft_365'.");
  }

  if (!Array.isArray(input.signals)) {
    throw new Error("signals must be an array.");
  }

  return {
    producer: "chatgpt_agent",
    connectorFamily: "microsoft_365",
    producedAt: asIsoTimestamp(input.producedAt, "producedAt"),
    tenantLabel: asNonEmptyString(input.tenantLabel, "tenantLabel"),
    signals: input.signals.map((signal, index) => parseChiefOfStaffSignal(signal, index))
  };
}

export async function loadLocalAgentProducedMicrosoft365SignalEnvelope() {
  const payload = await readFile(LOCAL_MICROSOFT_365_FIXTURE_URL, "utf8");
  return parseAgentProducedMicrosoft365SignalEnvelope(JSON.parse(payload) as unknown);
}
