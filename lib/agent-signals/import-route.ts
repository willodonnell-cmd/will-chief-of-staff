import { NextResponse } from "next/server";

import {
  AgentSignalsImportConfigurationError,
  AgentSignalsImportValidationError,
  importAgentSignals,
  type AgentSignalsImportSummary
} from "@/lib/agent-signals/import-agent-signals";

export type AgentSignalsImportHandlerDeps = {
  env?: NodeJS.ProcessEnv;
  importPayload?: (input: unknown) => Promise<AgentSignalsImportSummary>;
};

function getExpectedSecret(env: NodeJS.ProcessEnv) {
  return env.AGENT_SIGNALS_IMPORT_SECRET?.trim() ?? "";
}

function unauthorized() {
  return NextResponse.json(
    {
      error: "Agent signal import is not authorized."
    },
    { status: 401 }
  );
}

export async function handleAgentSignalsImportRequest(
  request: Request,
  deps: AgentSignalsImportHandlerDeps = {}
) {
  const env = deps.env ?? process.env;
  const expectedSecret = getExpectedSecret(env);

  if (!expectedSecret) {
    return NextResponse.json(
      {
        error: "Agent signal import is not configured."
      },
      { status: 500 }
    );
  }

  const providedSecret = request.headers.get("x-agent-signals-import-secret")?.trim();
  if (!providedSecret || providedSecret !== expectedSecret) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json(
      {
        error: "Agent signal payload must be valid JSON."
      },
      { status: 400 }
    );
  }

  try {
    const summary = await (deps.importPayload ?? importAgentSignals)(payload);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AgentSignalsImportValidationError) {
      return NextResponse.json(
        {
          error: error.message
        },
        { status: 400 }
      );
    }

    if (error instanceof AgentSignalsImportConfigurationError) {
      return NextResponse.json(
        {
          error: "Agent signal import is unavailable."
        },
        { status: 500 }
      );
    }

    console.error("[agent-signals.import]", error);
    return NextResponse.json(
      {
        error: "Agent signal import failed."
      },
      { status: 500 }
    );
  }
}
