import type { BlackhawkM365SignalAgentConfig } from "../config";
import { classifySignalCandidate } from "../classifiers/signal-classifier";
import { dedupeSignals } from "../dedupe/signal-deduper";
import { buildBlackhawkSignalPayload } from "../payload/payload-builder";
import type { SignalCollector, ManualRunContext, ReviewWindows, WorkflowSourceResult } from "../types";
import type { StructuredLogger } from "../utils/logging";
import { createStructuredLogger } from "../utils/logging";
import { sanitizeErrorMessage } from "../utils/redact";
import { BlackhawkClaimConflictError, BlackhawkHttpError } from "../clients/blackhawk-client";

export type BlackhawkClientLike = {
  getPendingRunRequests(): Promise<
    Array<{
      id: string;
      status: string;
      requestedAt: string;
      expiresAt: string;
      requestContext: Record<string, unknown>;
    }>
  >;
  claimRunRequest(requestId: string): Promise<{
    id: string;
    status: string;
    requestedAt: string;
    expiresAt: string;
    requestContext: Record<string, unknown>;
  }>;
  importSignals(
    payload: Parameters<import("../clients/blackhawk-client").BlackhawkClient["importSignals"]>[0],
    options?: Parameters<import("../clients/blackhawk-client").BlackhawkClient["importSignals"]>[1]
  ): ReturnType<import("../clients/blackhawk-client").BlackhawkClient["importSignals"]>;
  completeRunRequest(requestId: string, runId: string): Promise<void>;
  retrySafeFailRunRequest(requestId: string, errorMessage: string): Promise<void>;
};

export type BlackhawkM365SignalAgentRunResult = {
  status: "succeeded" | "failed" | "skipped";
  runId: string | null;
  counts: {
    submitted: number;
    accepted: number;
    investmentCommitteeRouted: number;
    suppressed: number;
    rejected: number;
  };
};

function asPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function resolveReviewWindows(defaults: ReviewWindows, manualRun: ManualRunContext | null): ReviewWindows {
  if (!manualRun) {
    return defaults;
  }

  const context = manualRun.requestContext;
  const lookbackHours = asPositiveNumber(context.lookbackHours);
  const calendarLookaheadDays = asPositiveNumber(context.calendarLookaheadDays);
  const calendarLookbackHours = asPositiveNumber(context.calendarLookbackHours);

  return {
    emailLookbackHours: lookbackHours ?? defaults.emailLookbackHours,
    teamsLookbackHours: lookbackHours ?? defaults.teamsLookbackHours,
    calendarLookbackHours: calendarLookbackHours ?? defaults.calendarLookbackHours,
    calendarLookaheadDays: calendarLookaheadDays ?? defaults.calendarLookaheadDays
  };
}

function oldestUnexpiredRequest(
  requests: Awaited<ReturnType<BlackhawkClientLike["getPendingRunRequests"]>>,
  now: string
) {
  return [...requests]
    .filter((request) => Date.parse(request.expiresAt) > Date.parse(now))
    .sort((left, right) => Date.parse(left.requestedAt) - Date.parse(right.requestedAt))[0];
}

export class RunWorkflow {
  private readonly config: BlackhawkM365SignalAgentConfig;
  private readonly blackhawkClient: BlackhawkClientLike;
  private readonly collectors: SignalCollector[];
  private readonly logger: StructuredLogger;
  private readonly now: () => string;

  constructor(params: {
    config: BlackhawkM365SignalAgentConfig;
    blackhawkClient: BlackhawkClientLike;
    collectors: SignalCollector[];
    logger?: StructuredLogger;
    now?: () => string;
  }) {
    this.config = params.config;
    this.blackhawkClient = params.blackhawkClient;
    this.collectors = params.collectors;
    this.now = params.now ?? (() => new Date().toISOString());
    this.logger =
      params.logger ??
      createStructuredLogger({
        service: "blackhawk-m365-signal-agent",
        level: this.config.logLevel
      });
  }

  async run(): Promise<BlackhawkM365SignalAgentRunResult> {
    const now = this.now();
    this.logger.info("Starting worker run.", { now });

    let manualRun: ManualRunContext | null = null;
    try {
      const pending = await this.blackhawkClient.getPendingRunRequests();
      const nextManualRequest = oldestUnexpiredRequest(pending, now);

      if (nextManualRequest) {
        try {
          const claimed = await this.blackhawkClient.claimRunRequest(nextManualRequest.id);
          manualRun = {
            requestId: claimed.id,
            requestedAt: claimed.requestedAt,
            expiresAt: claimed.expiresAt,
            requestContext: claimed.requestContext
          };
          this.logger.info("Claimed manual run request.", { requestId: manualRun.requestId });
        } catch (error) {
          if (error instanceof BlackhawkClaimConflictError) {
            this.logger.warn("Manual run request was already claimed elsewhere.");
            return {
              status: "skipped",
              runId: null,
              counts: {
                submitted: 0,
                accepted: 0,
                investmentCommitteeRouted: 0,
                suppressed: 0,
                rejected: 0
              }
            };
          }

          throw error;
        }
      }

      const windows = resolveReviewWindows(this.config.reviewWindows, manualRun);
      const sourceResults = await this.collectSources(now, windows);
      const classified = sourceResults
        .flatMap((result) => result.candidates)
        .map((candidate) => classifySignalCandidate(candidate, now));
      const deduped = dedupeSignals(classified);
      const payload = buildBlackhawkSignalPayload({
        now,
        tenantLabel: this.config.tenantLabel,
        ownerName: this.config.ownerName,
        windows,
        sourceResults,
        signals: deduped,
        manualRun
      });

      const importSummary = await this.blackhawkClient.importSignals(payload, {
        manualRunRequestId: manualRun?.requestId ?? null,
        idempotencyKey: manualRun?.requestId ?? `${payload.windowStart}:${payload.windowEnd}`
      });

      if (manualRun) {
        try {
          await this.blackhawkClient.completeRunRequest(manualRun.requestId, importSummary.runId);
        } catch (error) {
          this.logger.error("Manual request completion callback failed after a successful import.", {
            requestId: manualRun.requestId,
            runId: importSummary.runId,
            error: sanitizeErrorMessage(error, {
              secrets: [this.config.blackhawkImportSecret, this.config.m365ClientSecret]
            })
          });
        }
      }

      return {
        status: "succeeded",
        runId: importSummary.runId,
        counts: {
          submitted: importSummary.submittedCount,
          accepted: importSummary.acceptedCount,
          investmentCommitteeRouted: importSummary.investmentCommitteeRoutedCount,
          suppressed: importSummary.suppressedCount,
          rejected: importSummary.rejectedCount
        }
      };
    } catch (error) {
      const safeError = sanitizeErrorMessage(error, {
        secrets: [this.config.blackhawkImportSecret, this.config.m365ClientSecret],
        fallback: "The worker run failed."
      });

      this.logger.error("Worker run failed.", {
        error: safeError,
        statusCode: error instanceof BlackhawkHttpError ? error.statusCode : undefined,
        responseBody: error instanceof BlackhawkHttpError ? error.responseBody : undefined,
        manualRunRequestId: manualRun?.requestId ?? null
      });

      if (manualRun) {
        try {
          await this.blackhawkClient.retrySafeFailRunRequest(manualRun.requestId, safeError);
        } catch (callbackError) {
          this.logger.error("Manual request failure callback also failed.", {
            requestId: manualRun.requestId,
            callbackError: sanitizeErrorMessage(callbackError, {
              secrets: [this.config.blackhawkImportSecret, this.config.m365ClientSecret]
            })
          });
        }
      }

      return {
        status: "failed",
        runId: null,
        counts: {
          submitted: 0,
          accepted: 0,
          investmentCommitteeRouted: 0,
          suppressed: 0,
          rejected: 0
        }
      };
    }
  }

  private async collectSources(now: string, windows: ReviewWindows): Promise<WorkflowSourceResult[]> {
    const baseContext = {
      now,
      windows,
      tenantLabel: this.config.tenantLabel,
      ownerName: this.config.ownerName,
      userIdentifier: this.config.m365UserIdentifier
    };

    const results = await Promise.all(
      this.collectors.map((collector) =>
        collector.collect({
          ...baseContext,
          logger: this.logger.child({
            source: collector.source
          })
        })
      )
    );

    return results;
  }
}
