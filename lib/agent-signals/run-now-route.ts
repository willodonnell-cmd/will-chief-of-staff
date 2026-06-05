import { NextResponse } from "next/server";

import {
  AgentSignalsImportConfigurationError,
  AgentSignalsImportValidationError,
  importAgentSignals,
  type AgentSignalsImportSummary
} from "@/lib/agent-signals/import-agent-signals";
import {
  getMicrosoftGraphConnectionStatusForCurrentUser,
} from "@/lib/microsoft-graph/auth";
import { MicrosoftGraphConnectionRequiredError } from "@/lib/microsoft-graph/client";
import type { MicrosoftGraphConnectionRepository } from "@/lib/microsoft-graph/types";
import { runMicrosoft365SignalPullForUser } from "@/lib/microsoft-365-signal-runner";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

export type NativeRunNowResult = AgentSignalsImportSummary & {
  sourceErrors: Array<{
    source: "outlook" | "calendar" | "teams";
    status: string;
    reason: string;
  }>;
};

export type NativeRunNowDeps = {
  env?: NodeJS.ProcessEnv;
  resolveAppUser?: typeof resolveCurrentAppUser;
  connectionRepository?: MicrosoftGraphConnectionRepository;
  now?: () => string;
  fetchImpl?: typeof fetch;
  runPull?: typeof runMicrosoft365SignalPullForUser;
  importPayload?: typeof importAgentSignals;
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

export async function executeNativeMicrosoft365RunNow(
  deps: NativeRunNowDeps = {}
): Promise<NativeRunNowResult> {
  const resolved = await (deps.resolveAppUser ?? resolveCurrentAppUser)();
  if (!resolved) {
    throw new Error("No active app user could be resolved.");
  }

  const status = await getMicrosoftGraphConnectionStatusForCurrentUser({
    env: deps.env,
    repository: deps.connectionRepository,
    resolveAppUser: async () => resolved
  });

  if (!status.connected) {
    throw new MicrosoftGraphConnectionRequiredError("Connect Microsoft 365 to run native Blackhawk signal pulls.");
  }

  const runResult = await (deps.runPull ?? runMicrosoft365SignalPullForUser)({
    userId: resolved.user.id,
    now: deps.now?.(),
    runSource: "blackhawk_native_graph",
    connectionRepository: deps.connectionRepository,
    env: deps.env,
    fetchImpl: deps.fetchImpl
  });
  const summary = await (deps.importPayload ?? importAgentSignals)(runResult.envelope);

  return {
    ...summary,
    sourceErrors: runResult.sourceErrors.map((error) => ({
      source: error.source,
      status: error.status,
      reason: error.reason
    }))
  };
}

export async function handleNativeMicrosoft365RunNowRequest(
  _request: Request,
  deps: NativeRunNowDeps = {}
) {
  try {
    const summary = await executeNativeMicrosoft365RunNow(deps);
    return NextResponse.json({
      runId: summary.runId,
      status: summary.runStatus,
      submittedCount: summary.submittedSignalCount,
      acceptedCount: summary.acceptedSignalCount,
      investmentCommitteeRoutedCount: summary.investmentCommitteeRoutedCount,
      suppressedMetaAdminCount: summary.suppressedMetaAdminCount,
      suppressedLowSignalCount: summary.suppressedLowSignalCount,
      rejectedInvalidCount: summary.rejectedInvalidCount,
      sourceCoverage: summary.sourceCoverage,
      sourceErrors: summary.sourceErrors
    });
  } catch (error) {
    if (error instanceof MicrosoftGraphConnectionRequiredError) {
      return jsonError(
        409,
        "microsoft_not_connected",
        "Connect Microsoft 365 to run native Blackhawk signal pulls."
      );
    }

    if (error instanceof AgentSignalsImportValidationError) {
      return jsonError(400, "invalid_native_signal_payload", error.message);
    }

    if (error instanceof AgentSignalsImportConfigurationError) {
      return jsonError(500, "agent_signal_import_unavailable", "Agent signal import is unavailable.");
    }

    console.error("[agent-signals.run-now]", error);
    return jsonError(500, "native_run_failed", "Native Microsoft 365 signal run failed.");
  }
}
