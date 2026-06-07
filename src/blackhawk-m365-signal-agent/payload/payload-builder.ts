import type { BlackhawkSignalPayload, SignalSource } from "./schemas";
import type { ClassifiedSignalCandidate, ManualRunContext, ReviewWindows, WorkflowSourceResult } from "../types";
import { SIGNAL_SOURCES } from "./schemas";
import { validateBlackhawkSignalPayload } from "./validators";
import { addDays, subtractHours } from "../utils/iso";

function countSignalsBySource(signals: ClassifiedSignalCandidate[], source: SignalSource) {
  return signals.filter((signal) => signal.source === source).length;
}

export function buildBlackhawkSignalPayload(params: {
  now: string;
  tenantLabel: string;
  ownerName: string;
  windows: ReviewWindows;
  sourceResults: WorkflowSourceResult[];
  signals: ClassifiedSignalCandidate[];
  manualRun?: ManualRunContext | null;
}): BlackhawkSignalPayload {
  const sourceResultsBySource = new Map(params.sourceResults.map((result) => [result.source, result]));
  const windowStart = subtractHours(
    params.now,
    Math.max(params.windows.emailLookbackHours, params.windows.teamsLookbackHours, params.windows.calendarLookbackHours)
  );
  const windowEnd = addDays(params.now, params.windows.calendarLookaheadDays);
  const successfulChecks = params.sourceResults.filter(
    (result) => result.status === "included" || result.status === "empty"
  );

  const payload: BlackhawkSignalPayload = {
    producer: "chatgpt_agent",
    connectorFamily: "microsoft_365",
    producedAt: params.now,
    tenantLabel: params.tenantLabel,
    status: successfulChecks.length > 0 ? "succeeded" : "failed",
    sourcesChecked: [...SIGNAL_SOURCES],
    windowStart,
    windowEnd,
    sourceCoverage: {
      outlook: {
        status: "unknown",
        checkedAt: params.now,
        signalCount: 0,
        reason: null
      },
      calendar: {
        status: "unknown",
        checkedAt: params.now,
        signalCount: 0,
        reason: null
      },
      teams: {
        status: "unknown",
        checkedAt: params.now,
        signalCount: 0,
        reason: null
      }
    },
    signals: params.signals.map((signal) => ({
      id: signal.id,
      source: signal.source,
      signalType: signal.signalType,
      attention: signal.attention,
      title: signal.title,
      summary: signal.summary,
      owner: params.ownerName,
      sourceLabel: signal.sourceLabel,
      occurredAt: signal.occurredAt,
      dueAt: signal.dueAt,
      sourceUrl: signal.sourceUrl,
      actionRequest: signal.actionRequest,
      participants: signal.participants,
      protectedContext: true,
      routingHints: {
        recommendedSurface: signal.routingSurface,
        reason: signal.routingReason
      }
    }))
  };

  if (params.manualRun) {
    payload.manualRunRequestId = params.manualRun.requestId;
  }

  for (const source of SIGNAL_SOURCES) {
    const result = sourceResultsBySource.get(source);
    payload.sourceCoverage[source] = {
      status:
        result?.status && (result.status === "error" || result.status === "permission_denied" || result.status === "unavailable")
          ? result.status
          : countSignalsBySource(params.signals, source) > 0
            ? "included"
            : "empty",
      checkedAt: result?.checkedAt ?? params.now,
      signalCount: countSignalsBySource(params.signals, source),
      reason: result?.reason ?? null
    };
  }

  return validateBlackhawkSignalPayload(payload);
}
