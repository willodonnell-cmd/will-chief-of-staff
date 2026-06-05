import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

export const AGENT_RUN_REQUEST_STATUSES = [
  "requested",
  "claimed",
  "completed",
  "failed",
  "expired",
  "cancelled"
] as const;

export type AgentRunRequestStatus = (typeof AGENT_RUN_REQUEST_STATUSES)[number];

export type AgentRunRequestRow = {
  id: string;
  user_id: string;
  request_type: "manual";
  status: AgentRunRequestStatus;
  requested_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  expires_at: string;
  agent_signal_run_id: string | null;
  requested_by: string | null;
  request_context: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ManualAgentRunRequest = {
  id: string;
  status: AgentRunRequestStatus;
  requestedAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  agentSignalRunId: string | null;
  requestedBy: string | null;
  requestContext: Record<string, unknown>;
  errorMessage: string | null;
  isActive: boolean;
  isExpired: boolean;
};

export type PendingAgentRunRequest = ManualAgentRunRequest & {
  userId: string;
};

type AgentRunRequestInsertRow = {
  user_id: string;
  request_type: "manual";
  status: AgentRunRequestStatus;
  requested_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  expires_at: string;
  agent_signal_run_id: string | null;
  requested_by: string | null;
  request_context: Record<string, unknown>;
  error_message: string | null;
};

type AgentRunRequestUpdateRow = Partial<
  Pick<
    AgentRunRequestInsertRow,
    "status" | "claimed_at" | "completed_at" | "agent_signal_run_id" | "requested_by" | "request_context" | "error_message"
  >
>;

export type AgentRunRequestsRepository = {
  create(row: AgentRunRequestInsertRow): Promise<AgentRunRequestRow>;
  update(requestId: string, row: AgentRunRequestUpdateRow): Promise<AgentRunRequestRow | null>;
  findById(requestId: string): Promise<AgentRunRequestRow | null>;
  findLatestByUser(userId: string): Promise<AgentRunRequestRow | null>;
  findActiveByUser(userId: string, now: string): Promise<AgentRunRequestRow | null>;
  listPending(now: string): Promise<AgentRunRequestRow[]>;
  expire(now: string, userId?: string): Promise<number>;
};

export class AgentRunRequestConfigurationError extends Error {}
export class AgentRunRequestConflictError extends Error {}
export class AgentRunRequestNotFoundError extends Error {}

export const DEFAULT_AGENT_RUN_REQUEST_TTL_MS = 30 * 60 * 1000;

const ACTIVE_REQUEST_STATUSES: AgentRunRequestStatus[] = ["requested", "claimed"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestContext(value: unknown) {
  return isRecord(value) ? value : {};
}

function trimOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toIsoNow(now?: string) {
  return now ?? new Date().toISOString();
}

export function resolveAgentRunRequestSecret(env: NodeJS.ProcessEnv) {
  return env.AGENT_RUN_REQUEST_SECRET?.trim() || env.AGENT_SIGNALS_IMPORT_SECRET?.trim() || "";
}

export function extractManualRunRequestId(input: { headers?: Headers | null; payload?: unknown }) {
  const headerValue = input.headers?.get("x-agent-run-request-id")?.trim();
  if (headerValue) {
    return headerValue;
  }

  if (isRecord(input.payload) && typeof input.payload.manualRunRequestId === "string") {
    const payloadValue = input.payload.manualRunRequestId.trim();
    return payloadValue || null;
  }

  return null;
}

export function sanitizeAgentRunFailureMessage(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "The ChatGPT Agent did not complete the requested run.";
  }

  return normalized.slice(0, 240);
}

export function getEffectiveAgentRunRequestStatus(
  row: Pick<AgentRunRequestRow, "status" | "expires_at">,
  now = Date.now()
): AgentRunRequestStatus {
  if (!ACTIVE_REQUEST_STATUSES.includes(row.status)) {
    return row.status;
  }

  const expiresAtMs = Date.parse(row.expires_at);
  if (Number.isNaN(expiresAtMs)) {
    return row.status;
  }

  return expiresAtMs <= now ? "expired" : row.status;
}

export function mapAgentRunRequest(row: AgentRunRequestRow, now = Date.now()): ManualAgentRunRequest {
  const status = getEffectiveAgentRunRequestStatus(row, now);

  return {
    id: row.id,
    status,
    requestedAt: row.requested_at,
    claimedAt: row.claimed_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    agentSignalRunId: row.agent_signal_run_id,
    requestedBy: row.requested_by,
    requestContext: requestContext(row.request_context),
    errorMessage: row.error_message,
    isActive: status === "requested" || status === "claimed",
    isExpired: status === "expired"
  };
}

export function mapPendingAgentRunRequest(row: AgentRunRequestRow, now = Date.now()): PendingAgentRunRequest {
  return {
    userId: row.user_id,
    ...mapAgentRunRequest(row, now)
  };
}

export function getAgentRunRequestButtonState(request: ManualAgentRunRequest | null) {
  if (request?.isActive) {
    return {
      disabled: true,
      label: "Agent run requested"
    };
  }

  return {
    disabled: false,
    label: "Run Agent Now"
  };
}

export function getAgentRunRequestStatusLabel(status: AgentRunRequestStatus) {
  switch (status) {
    case "requested":
      return "Requested";
    case "claimed":
      return "Claimed";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
  }
}

export function getAgentRunRequestStatusDetail(request: ManualAgentRunRequest | null) {
  if (!request) {
    return "No manual ChatGPT Agent run request has been created yet.";
  }

  switch (request.status) {
    case "requested":
      return "A manual run has been requested. The saved ChatGPT Agent has not claimed it yet.";
    case "claimed":
      return "The saved ChatGPT Agent claimed this request and should post a durable run soon.";
    case "completed":
      return request.agentSignalRunId
        ? `The last manual request completed and is attached to durable run ${request.agentSignalRunId}.`
        : "The last manual request completed.";
    case "failed":
      return request.errorMessage
        ? `The last manual request failed: ${request.errorMessage}`
        : "The last manual request failed before posting a durable run.";
    case "expired":
      return "The last manual request expired before the ChatGPT Agent completed it.";
    case "cancelled":
      return "The last manual request was cancelled.";
  }
}

export async function createSupabaseAgentRunRequestsRepository(
  client?: SupabaseClient | null
): Promise<AgentRunRequestsRepository> {
  const resolvedClient = client ?? createSupabaseAdminClient();
  if (!resolvedClient) {
    throw new AgentRunRequestConfigurationError(
      "SUPABASE_SERVICE_ROLE_KEY is required for durable agent run requests."
    );
  }

  const selectClause =
    "id, user_id, request_type, status, requested_at, claimed_at, completed_at, expires_at, agent_signal_run_id, requested_by, request_context, error_message, created_at, updated_at";

  return {
    async create(row) {
      const response = await withSupabaseTimeout(
        resolvedClient.from("agent_run_requests").insert(row).select(selectClause).single<AgentRunRequestRow>()
      );

      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? "Agent run request could not be created.");
      }

      return response.data;
    },
    async update(requestId, row) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("agent_run_requests")
          .update(row)
          .eq("id", requestId)
          .select(selectClause)
          .maybeSingle<AgentRunRequestRow>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Agent run request could not be updated.");
      }

      return response.data ?? null;
    },
    async findById(requestId) {
      const response = await withSupabaseTimeout(
        resolvedClient.from("agent_run_requests").select(selectClause).eq("id", requestId).maybeSingle<AgentRunRequestRow>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Agent run request could not be read.");
      }

      return response.data ?? null;
    },
    async findLatestByUser(userId) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("agent_run_requests")
          .select(selectClause)
          .eq("user_id", userId)
          .order("requested_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<AgentRunRequestRow>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Latest agent run request could not be read.");
      }

      return response.data ?? null;
    },
    async findActiveByUser(userId, now) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("agent_run_requests")
          .select(selectClause)
          .eq("user_id", userId)
          .in("status", ACTIVE_REQUEST_STATUSES)
          .gt("expires_at", now)
          .order("requested_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<AgentRunRequestRow>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Active agent run request could not be read.");
      }

      return response.data ?? null;
    },
    async listPending(now) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("agent_run_requests")
          .select(selectClause)
          .eq("status", "requested")
          .gt("expires_at", now)
          .order("requested_at", { ascending: true })
          .returns<AgentRunRequestRow[]>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Pending agent run requests could not be read.");
      }

      return response.data ?? [];
    },
    async expire(now, userId) {
      let query = resolvedClient
        .from("agent_run_requests")
        .update({
          status: "expired",
          completed_at: now
        })
        .in("status", ACTIVE_REQUEST_STATUSES)
        .lt("expires_at", now);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const response = await withSupabaseTimeout(query.select("id"));

      if (response.error) {
        throw new Error(response.error.message ?? "Expired agent run requests could not be updated.");
      }

      return response.data?.length ?? 0;
    }
  };
}

export async function createManualAgentRunRequest(
  repository: AgentRunRequestsRepository,
  input: {
    userId: string;
    requestedBy?: string | null;
    requestContext?: Record<string, unknown>;
    now?: string;
    ttlMs?: number;
  }
) {
  const now = toIsoNow(input.now);
  await repository.expire(now, input.userId);

  const existing = await repository.findActiveByUser(input.userId, now);
  if (existing) {
    return mapAgentRunRequest(existing, Date.parse(now));
  }

  const ttlMs = input.ttlMs ?? DEFAULT_AGENT_RUN_REQUEST_TTL_MS;
  const expiresAt = new Date(Date.parse(now) + ttlMs).toISOString();
  const created = await repository.create({
    user_id: input.userId,
    request_type: "manual",
    status: "requested",
    requested_at: now,
    claimed_at: null,
    completed_at: null,
    expires_at: expiresAt,
    agent_signal_run_id: null,
    requested_by: trimOrNull(input.requestedBy),
    request_context: requestContext(input.requestContext),
    error_message: null
  });

  return mapAgentRunRequest(created, Date.parse(now));
}

export async function getLatestAgentRunRequest(
  repository: AgentRunRequestsRepository,
  input: { userId: string; now?: string }
) {
  const now = toIsoNow(input.now);
  await repository.expire(now, input.userId);
  const latest = await repository.findLatestByUser(input.userId);
  return latest ? mapAgentRunRequest(latest, Date.parse(now)) : null;
}

export async function listPendingAgentRunRequests(
  repository: AgentRunRequestsRepository,
  now?: string
) {
  const resolvedNow = toIsoNow(now);
  await repository.expire(resolvedNow);
  const rows = await repository.listPending(resolvedNow);
  return rows.map((row) => mapPendingAgentRunRequest(row, Date.parse(resolvedNow)));
}

async function loadOpenRequest(
  repository: AgentRunRequestsRepository,
  requestId: string,
  now?: string
) {
  const resolvedNow = toIsoNow(now);
  await repository.expire(resolvedNow);
  const request = await repository.findById(requestId);

  if (!request) {
    throw new AgentRunRequestNotFoundError("Agent run request could not be found.");
  }

  return {
    now: resolvedNow,
    request,
    status: getEffectiveAgentRunRequestStatus(request, Date.parse(resolvedNow))
  };
}

export async function claimAgentRunRequest(
  repository: AgentRunRequestsRepository,
  input: { requestId: string; now?: string }
) {
  const { now, request, status } = await loadOpenRequest(repository, input.requestId, input.now);

  if (status !== "requested") {
    throw new AgentRunRequestConflictError(
      status === "expired" ? "Agent run request has expired." : `Agent run request cannot be claimed from status ${status}.`
    );
  }

  const updated = await repository.update(request.id, {
    status: "claimed",
    claimed_at: now,
    completed_at: null,
    error_message: null
  });

  return mapAgentRunRequest(updated ?? request, Date.parse(now));
}

export async function completeAgentRunRequest(
  repository: AgentRunRequestsRepository,
  input: { requestId: string; agentSignalRunId: string; now?: string }
) {
  const { now, request, status } = await loadOpenRequest(repository, input.requestId, input.now);

  if (status === "completed" && request.agent_signal_run_id === input.agentSignalRunId) {
    return mapAgentRunRequest(request, Date.parse(now));
  }

  if (status !== "requested" && status !== "claimed") {
    throw new AgentRunRequestConflictError(
      status === "expired" ? "Agent run request has expired." : `Agent run request cannot be completed from status ${status}.`
    );
  }

  const updated = await repository.update(request.id, {
    status: "completed",
    claimed_at: request.claimed_at ?? now,
    completed_at: now,
    agent_signal_run_id: input.agentSignalRunId,
    error_message: null
  });

  return mapAgentRunRequest(updated ?? request, Date.parse(now));
}

export async function failAgentRunRequest(
  repository: AgentRunRequestsRepository,
  input: { requestId: string; errorMessage?: string | null; now?: string }
) {
  const { now, request, status } = await loadOpenRequest(repository, input.requestId, input.now);

  if (status === "failed") {
    return mapAgentRunRequest(request, Date.parse(now));
  }

  if (status !== "requested" && status !== "claimed") {
    throw new AgentRunRequestConflictError(
      status === "expired" ? "Agent run request has expired." : `Agent run request cannot be failed from status ${status}.`
    );
  }

  const updated = await repository.update(request.id, {
    status: "failed",
    completed_at: now,
    error_message: sanitizeAgentRunFailureMessage(input.errorMessage)
  });

  return mapAgentRunRequest(updated ?? request, Date.parse(now));
}
