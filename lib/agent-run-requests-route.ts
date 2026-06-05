import { NextResponse } from "next/server";

import {
  AgentRunRequestConfigurationError,
  AgentRunRequestConflictError,
  AgentRunRequestNotFoundError,
  claimAgentRunRequest,
  completeAgentRunRequest,
  createManualAgentRunRequest,
  createSupabaseAgentRunRequestsRepository,
  failAgentRunRequest,
  getLatestAgentRunRequest,
  listPendingAgentRunRequests,
  resolveAgentRunRequestSecret
} from "@/lib/agent-run-requests";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

type RouteDeps = {
  env?: NodeJS.ProcessEnv;
  now?: () => string;
  resolveAppUser?: typeof resolveCurrentAppUser;
  createUserRepository?: typeof createSupabaseAgentRunRequestsRepository;
  createAdminRepository?: typeof createSupabaseAgentRunRequestsRepository;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getNow(deps: RouteDeps) {
  return deps.now?.() ?? new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestedByFromInput(input: unknown) {
  if (!isRecord(input) || typeof input.requestedBy !== "string") {
    return null;
  }

  const trimmed = input.requestedBy.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requestContextFromInput(input: unknown) {
  if (!isRecord(input) || !isRecord(input.requestContext)) {
    return {};
  }

  return input.requestContext;
}

function agentSignalRunIdFromInput(input: unknown) {
  if (!isRecord(input) || typeof input.agentSignalRunId !== "string") {
    return null;
  }

  const trimmed = input.agentSignalRunId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function errorMessageFromInput(input: unknown) {
  if (!isRecord(input) || typeof input.errorMessage !== "string") {
    return null;
  }

  const trimmed = input.errorMessage.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function parseOptionalJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function resolveUserContext(deps: RouteDeps) {
  const resolved = await (deps.resolveAppUser ?? resolveCurrentAppUser)();
  if (!resolved) {
    return null;
  }

  const repository = await (deps.createUserRepository ?? createSupabaseAgentRunRequestsRepository)(resolved.client);
  return {
    resolved,
    repository
  };
}

async function requireAgentSecret(request: Request, deps: RouteDeps) {
  const expectedSecret = resolveAgentRunRequestSecret(deps.env ?? process.env);
  if (!expectedSecret) {
    return jsonError("Agent run request APIs are not configured.", 500);
  }

  const providedSecret =
    request.headers.get("x-agent-run-request-secret")?.trim() ||
    request.headers.get("x-agent-signals-import-secret")?.trim() ||
    "";

  if (!providedSecret || providedSecret !== expectedSecret) {
    return jsonError("Agent run request access is not authorized.", 401);
  }

  return null;
}

export async function handleCreateAgentRunRequest(request: Request, deps: RouteDeps = {}) {
  const context = await resolveUserContext(deps);
  if (!context) {
    return jsonError("No active app user could be resolved.", 401);
  }

  let input: unknown = null;
  try {
    input = await parseOptionalJsonBody(request);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Request body must be valid JSON.", 400);
  }

  const created = await createManualAgentRunRequest(context.repository, {
    userId: context.resolved.user.id,
    requestedBy: requestedByFromInput(input) ?? context.resolved.user.full_name,
    requestContext: requestContextFromInput(input),
    now: getNow(deps)
  });

  return NextResponse.json({
    requestId: created.id,
    status: created.status,
    requestedAt: created.requestedAt,
    expiresAt: created.expiresAt
  });
}

export async function handleGetLatestAgentRunRequest(_request: Request, deps: RouteDeps = {}) {
  const context = await resolveUserContext(deps);
  if (!context) {
    return jsonError("No active app user could be resolved.", 401);
  }

  const latest = await getLatestAgentRunRequest(context.repository, {
    userId: context.resolved.user.id,
    now: getNow(deps)
  });

  return NextResponse.json({
    request: latest
  });
}

export async function handleGetPendingAgentRunRequests(request: Request, deps: RouteDeps = {}) {
  const authError = await requireAgentSecret(request, deps);
  if (authError) {
    return authError;
  }

  const repository = await (deps.createAdminRepository ?? createSupabaseAgentRunRequestsRepository)();
  const requests = await listPendingAgentRunRequests(repository, getNow(deps));

  return NextResponse.json({ requests });
}

async function handleTransition(
  request: Request,
  requestId: string,
  transition: "claim" | "complete" | "fail",
  deps: RouteDeps = {}
) {
  const authError = await requireAgentSecret(request, deps);
  if (authError) {
    return authError;
  }

  const repository = await (deps.createAdminRepository ?? createSupabaseAgentRunRequestsRepository)();
  const now = getNow(deps);

  try {
    if (transition === "claim") {
      const claimed = await claimAgentRunRequest(repository, {
        requestId,
        now
      });
      return NextResponse.json({ request: claimed });
    }

    const input = await parseOptionalJsonBody(request);

    if (transition === "complete") {
      const agentSignalRunId = agentSignalRunIdFromInput(input);
      if (!agentSignalRunId) {
        return jsonError("agentSignalRunId is required.", 400);
      }

      const completed = await completeAgentRunRequest(repository, {
        requestId,
        agentSignalRunId,
        now
      });
      return NextResponse.json({ request: completed });
    }

    const failed = await failAgentRunRequest(repository, {
      requestId,
      errorMessage: errorMessageFromInput(input),
      now
    });
    return NextResponse.json({ request: failed });
  } catch (error) {
    if (error instanceof AgentRunRequestNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof AgentRunRequestConflictError) {
      return jsonError(error.message, 409);
    }

    if (error instanceof AgentRunRequestConfigurationError) {
      return jsonError("Agent run request APIs are unavailable.", 500);
    }

    console.error("[agent-run-requests]", error);
    return jsonError("Agent run request transition failed.", 500);
  }
}

export async function handleClaimAgentRunRequest(request: Request, requestId: string, deps: RouteDeps = {}) {
  return await handleTransition(request, requestId, "claim", deps);
}

export async function handleCompleteAgentRunRequest(request: Request, requestId: string, deps: RouteDeps = {}) {
  return await handleTransition(request, requestId, "complete", deps);
}

export async function handleFailAgentRunRequest(request: Request, requestId: string, deps: RouteDeps = {}) {
  return await handleTransition(request, requestId, "fail", deps);
}
