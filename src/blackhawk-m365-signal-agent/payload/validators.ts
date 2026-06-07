import {
  ENVELOPE_STATUSES,
  ROUTING_SURFACES,
  SIGNAL_ATTENTION,
  SIGNAL_SOURCES,
  SIGNAL_TYPES,
  SOURCE_COVERAGE_STATUSES,
  type BlackhawkImportSuccess,
  type BlackhawkSignal,
  type BlackhawkSignalPayload,
  type SignalSource
} from "./schemas";
import { isValidIsoTimestamp } from "../utils/iso";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, path: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return value;
}

function asOptionalNullableString(value: unknown, path: string) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${path} must be a string or null.`);
  }

  return value;
}

function asIsoString(value: unknown, path: string) {
  const normalized = asString(value, path);
  if (!isValidIsoTimestamp(normalized)) {
    throw new Error(`${path} must be a valid ISO timestamp.`);
  }

  return normalized;
}

function asEnum<T extends string>(value: unknown, values: readonly T[], path: string) {
  const normalized = asString(value, path);
  if (!values.includes(normalized as T)) {
    throw new Error(`${path} must be one of ${values.join(", ")}.`);
  }

  return normalized as T;
}

function parseSignal(input: unknown, index: number): BlackhawkSignal {
  const path = `signals[${index}]`;
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  if (!Array.isArray(input.participants)) {
    throw new Error(`${path}.participants must be an array.`);
  }

  if (!isRecord(input.routingHints)) {
    throw new Error(`${path}.routingHints must be an object.`);
  }

  if (input.protectedContext !== true) {
    throw new Error(`${path}.protectedContext must be true.`);
  }

  return {
    id: asString(input.id, `${path}.id`),
    source: asEnum(input.source, SIGNAL_SOURCES, `${path}.source`),
    signalType: asEnum(input.signalType, SIGNAL_TYPES, `${path}.signalType`),
    attention: asEnum(input.attention, SIGNAL_ATTENTION, `${path}.attention`),
    title: asString(input.title, `${path}.title`),
    summary: asString(input.summary, `${path}.summary`),
    owner: asString(input.owner, `${path}.owner`),
    sourceLabel: asString(input.sourceLabel, `${path}.sourceLabel`),
    occurredAt: asIsoString(input.occurredAt, `${path}.occurredAt`),
    dueAt:
      input.dueAt === null || input.dueAt === undefined
        ? null
        : asIsoString(input.dueAt, `${path}.dueAt`),
    sourceUrl: asOptionalNullableString(input.sourceUrl, `${path}.sourceUrl`),
    actionRequest: asOptionalNullableString(input.actionRequest, `${path}.actionRequest`),
    participants: input.participants.map((participant, participantIndex) =>
      asString(participant, `${path}.participants[${participantIndex}]`)
    ),
    protectedContext: true,
    routingHints: {
      recommendedSurface: asEnum(
        input.routingHints.recommendedSurface,
        ROUTING_SURFACES,
        `${path}.routingHints.recommendedSurface`
      ),
      reason: asString(input.routingHints.reason, `${path}.routingHints.reason`)
    }
  };
}

export function validateBlackhawkSignalPayload(input: unknown): BlackhawkSignalPayload {
  if (!isRecord(input)) {
    throw new Error("Payload must be an object.");
  }

  if (input.producer !== "chatgpt_agent") {
    throw new Error("producer must be 'chatgpt_agent'.");
  }

  if (input.connectorFamily !== "microsoft_365") {
    throw new Error("connectorFamily must be 'microsoft_365'.");
  }

  if (!Array.isArray(input.sourcesChecked)) {
    throw new Error("sourcesChecked must be an array.");
  }

  if (!isRecord(input.sourceCoverage)) {
    throw new Error("sourceCoverage must be an object.");
  }

  if (!Array.isArray(input.signals)) {
    throw new Error("signals must be an array.");
  }

  const payload: BlackhawkSignalPayload = {
    producer: "chatgpt_agent",
    connectorFamily: "microsoft_365",
    producedAt: asIsoString(input.producedAt, "producedAt"),
    tenantLabel: asString(input.tenantLabel, "tenantLabel"),
    status: asEnum(input.status, ENVELOPE_STATUSES, "status"),
    sourcesChecked: input.sourcesChecked.map((source, index) =>
      asEnum(source, SIGNAL_SOURCES, `sourcesChecked[${index}]`)
    ),
    windowStart: asIsoString(input.windowStart, "windowStart"),
    windowEnd: asIsoString(input.windowEnd, "windowEnd"),
    sourceCoverage: {
      outlook: parseSourceCoverageEntry(input.sourceCoverage.outlook, "sourceCoverage.outlook"),
      calendar: parseSourceCoverageEntry(input.sourceCoverage.calendar, "sourceCoverage.calendar"),
      teams: parseSourceCoverageEntry(input.sourceCoverage.teams, "sourceCoverage.teams")
    },
    signals: input.signals.map((signal, index) => parseSignal(signal, index))
  };

  if (typeof input.manualRunRequestId === "string" && input.manualRunRequestId.trim()) {
    payload.manualRunRequestId = input.manualRunRequestId.trim();
  }

  assertSourceCoverageCounts(payload);
  return payload;
}

function parseSourceCoverageEntry(input: unknown, path: string) {
  if (!isRecord(input)) {
    throw new Error(`${path} must be an object.`);
  }

  const checkedAt = asIsoString(input.checkedAt, `${path}.checkedAt`);
  const signalCount = Number(input.signalCount);
  if (!Number.isFinite(signalCount) || signalCount < 0) {
    throw new Error(`${path}.signalCount must be a non-negative number.`);
  }

  return {
    status: asEnum(input.status, SOURCE_COVERAGE_STATUSES, `${path}.status`),
    checkedAt,
    signalCount,
    reason: asOptionalNullableString(input.reason, `${path}.reason`)
  };
}

export function assertSourceCoverageCounts(payload: BlackhawkSignalPayload) {
  const countsBySource = SIGNAL_SOURCES.reduce<Record<SignalSource, number>>(
    (accumulator, source) => ({
      ...accumulator,
      [source]: payload.signals.filter((signal) => signal.source === source).length
    }),
    {
      outlook: 0,
      calendar: 0,
      teams: 0
    }
  );

  for (const source of SIGNAL_SOURCES) {
    if (payload.sourceCoverage[source].signalCount !== countsBySource[source]) {
      throw new Error(
        `sourceCoverage.${source}.signalCount must equal the number of payload signals from ${source}.`
      );
    }
  }
}

export function parseBlackhawkImportSuccess(input: unknown): BlackhawkImportSuccess {
  if (!isRecord(input)) {
    throw new Error("Blackhawk import response must be an object.");
  }

  const runId =
    typeof input.runId === "string"
      ? input.runId
      : typeof input.agentSignalRunId === "string"
        ? input.agentSignalRunId
        : null;

  if (!runId) {
    throw new Error("Blackhawk import response did not include a run id.");
  }

  const submittedCount =
    typeof input.submittedCount === "number"
      ? input.submittedCount
      : typeof input.submittedSignalCount === "number"
        ? input.submittedSignalCount
        : 0;

  const acceptedCount =
    typeof input.acceptedCount === "number"
      ? input.acceptedCount
      : typeof input.acceptedSignalCount === "number"
        ? input.acceptedSignalCount
        : 0;

  const investmentCommitteeRoutedCount =
    typeof input.investmentCommitteeRoutedCount === "number"
      ? input.investmentCommitteeRoutedCount
      : typeof input.icRoutedSignalCount === "number"
        ? input.icRoutedSignalCount
        : 0;

  const suppressedCount =
    typeof input.suppressedCount === "number"
      ? input.suppressedCount
      : (typeof input.suppressedMetaAdminCount === "number" ? input.suppressedMetaAdminCount : 0) +
        (typeof input.suppressedLowSignalCount === "number" ? input.suppressedLowSignalCount : 0);

  const rejectedCount =
    typeof input.rejectedCount === "number"
      ? input.rejectedCount
      : typeof input.rejectedInvalidCount === "number"
        ? input.rejectedInvalidCount
        : 0;

  return {
    runId,
    submittedCount,
    acceptedCount,
    investmentCommitteeRoutedCount,
    suppressedCount,
    rejectedCount
  };
}
