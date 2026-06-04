import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  CHIEF_OF_STAFF_SIGNAL_ATTENTION,
  CHIEF_OF_STAFF_SIGNAL_SOURCES,
  CHIEF_OF_STAFF_SIGNAL_TYPES,
  type ChiefOfStaffSignal,
  type ChiefOfStaffSignalAttention,
  type ChiefOfStaffSignalSource,
  type ChiefOfStaffSignalType
} from "./chief-of-staff-signal";

export const MICROSOFT_365_SOURCE_COVERAGE_STATUSES = [
  "included",
  "empty",
  "skipped",
  "unavailable",
  "permission_denied",
  "error",
  "unknown"
] as const;

export type Microsoft365SourceCoverageStatus =
  (typeof MICROSOFT_365_SOURCE_COVERAGE_STATUSES)[number];

export type Microsoft365SourceCoverageEntry = {
  status: Microsoft365SourceCoverageStatus;
  checkedAt?: string;
  signalCount?: number;
  reason?: string | null;
};

export type Microsoft365SourceCoverage = Partial<
  Record<ChiefOfStaffSignalSource, Microsoft365SourceCoverageEntry>
>;

export const LOCAL_MICROSOFT_365_FIXTURE_URL = pathToFileURL(
  join(process.cwd(), "fixtures", "chatgpt-agent-microsoft-365-signals.json")
);

export const LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH = join(
  process.cwd(),
  ".local",
  "agent-signals.json"
);

export type AgentProducedMicrosoft365SignalEnvelope = {
  producer: "chatgpt_agent";
  connectorFamily: "microsoft_365";
  producedAt: string;
  tenantLabel: string;
  status?: "succeeded" | "failed";
  sourcesChecked?: ChiefOfStaffSignalSource[];
  windowStart?: string | null;
  windowEnd?: string | null;
  sourceCoverage?: Microsoft365SourceCoverage;
  signals: ChiefOfStaffSignal[];
};

export type AgentProducedMicrosoft365SignalEnvelopeSource = "local" | "fixture";

export type AgentProducedMicrosoft365SignalEnvelopeLoadResult = {
  envelope: AgentProducedMicrosoft365SignalEnvelope;
  source: AgentProducedMicrosoft365SignalEnvelopeSource;
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

function asOptionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of strings.`);
  }

  return value.map((entry, index) => asNonEmptyString(entry, `${path}[${index}]`));
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

function asOptionalNonNegativeNumber(value: unknown, path: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new Error(`${path} must be a non-negative number.`);
  }

  return value;
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

function asOptionalRecord(value: unknown, path: string) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error(`${path} must be an object or null.`);
  }

  return value;
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
    whyItMatters:
      input.whyItMatters === undefined
        ? null
        : asOptionalNullableString(input.whyItMatters, `${path}.whyItMatters`),
    owner: asNonEmptyString(input.owner, `${path}.owner`),
    sourceLabel: asNonEmptyString(input.sourceLabel, `${path}.sourceLabel`),
    sourceReference:
      input.sourceReference === undefined
        ? null
        : asOptionalNullableString(input.sourceReference, `${path}.sourceReference`),
    occurredAt: asIsoTimestamp(input.occurredAt, `${path}.occurredAt`),
    dueAt: input.dueAt === undefined ? null : asOptionalNullableString(input.dueAt, `${path}.dueAt`),
    sourceUrl:
      input.sourceUrl === undefined
        ? null
        : asOptionalNullableString(input.sourceUrl, `${path}.sourceUrl`),
    category:
      input.category === undefined
        ? null
        : asOptionalNullableString(input.category, `${path}.category`),
    actionRequest:
      input.actionRequest === undefined
        ? null
        : asOptionalNullableString(input.actionRequest, `${path}.actionRequest`),
    participants: asStringArray(input.participants, `${path}.participants`),
    protectedContext: asBoolean(input.protectedContext, `${path}.protectedContext`),
    metadata: asOptionalRecord(input.metadata, `${path}.metadata`)
  };
}

function parseSourceCoverageEntry(
  input: unknown,
  path: string
): Microsoft365SourceCoverageEntry {
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  const entry: Microsoft365SourceCoverageEntry = {
    status: asEnum<Microsoft365SourceCoverageStatus>(
      input.status,
      MICROSOFT_365_SOURCE_COVERAGE_STATUSES,
      `${path}.status`
    )
  };

  if (input.checkedAt !== undefined) {
    entry.checkedAt = asIsoTimestamp(input.checkedAt, `${path}.checkedAt`);
  }

  if (input.signalCount !== undefined) {
    entry.signalCount = asOptionalNonNegativeNumber(input.signalCount, `${path}.signalCount`);
  }

  if (input.reason !== undefined) {
    entry.reason = asOptionalNullableString(input.reason, `${path}.reason`);
  }

  return entry;
}

function parseSourceCoverage(input: unknown): Microsoft365SourceCoverage {
  if (!isRecord(input)) {
    throw new Error("sourceCoverage must be an object.");
  }

  for (const key of Object.keys(input)) {
    if (!CHIEF_OF_STAFF_SIGNAL_SOURCES.includes(key as ChiefOfStaffSignalSource)) {
      throw new Error(`sourceCoverage.${key} is not supported.`);
    }
  }

  const sourceCoverage: Microsoft365SourceCoverage = {};

  for (const source of CHIEF_OF_STAFF_SIGNAL_SOURCES) {
    const entry = input[source];
    if (entry !== undefined) {
      sourceCoverage[source] = parseSourceCoverageEntry(entry, `sourceCoverage.${source}`);
    }
  }

  return sourceCoverage;
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
    status:
      input.status === undefined
        ? "succeeded"
        : asEnum(input.status, ["succeeded", "failed"] as const, "status"),
    sourcesChecked:
      input.sourcesChecked === undefined
        ? undefined
        : asOptionalStringArray(input.sourcesChecked, "sourcesChecked")?.map((source, index) =>
            asEnum(source, CHIEF_OF_STAFF_SIGNAL_SOURCES, `sourcesChecked[${index}]`)
          ),
    windowStart:
      input.windowStart === undefined
        ? null
        : input.windowStart === null
          ? null
          : asIsoTimestamp(input.windowStart, "windowStart"),
    windowEnd:
      input.windowEnd === undefined
        ? null
        : input.windowEnd === null
          ? null
          : asIsoTimestamp(input.windowEnd, "windowEnd"),
    sourceCoverage:
      input.sourceCoverage === undefined ? undefined : parseSourceCoverage(input.sourceCoverage),
    signals: input.signals.map((signal, index) => parseChiefOfStaffSignal(signal, index))
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

export async function hasLocalAgentProducedMicrosoft365SignalPayload() {
  return await fileExists(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH);
}

export async function loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource(): Promise<AgentProducedMicrosoft365SignalEnvelopeLoadResult> {
  const hasLocalPayload = await hasLocalAgentProducedMicrosoft365SignalPayload();
  const source: AgentProducedMicrosoft365SignalEnvelopeSource = hasLocalPayload
    ? "local"
    : "fixture";
  const payload = hasLocalPayload
    ? await readFile(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH, "utf8")
    : await readFile(LOCAL_MICROSOFT_365_FIXTURE_URL, "utf8");
  return {
    envelope: parseAgentProducedMicrosoft365SignalEnvelope(JSON.parse(payload) as unknown),
    source
  };
}

export async function loadLocalAgentProducedMicrosoft365SignalEnvelope() {
  const { envelope } = await loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource();
  return envelope;
}
