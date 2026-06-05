import type { SupabaseClient } from "@supabase/supabase-js";

import {
  completeAgentRunRequest,
  createSupabaseAgentRunRequestsRepository,
  extractManualRunRequestId,
  getEffectiveAgentRunRequestStatus,
  type AgentRunRequestsRepository
} from "@/lib/agent-run-requests";
import {
  CHIEF_OF_STAFF_SIGNAL_ATTENTION,
  CHIEF_OF_STAFF_SIGNAL_SOURCES,
  type ChiefOfStaffSignal,
  type ChiefOfStaffSignalAttention,
  type ChiefOfStaffSignalSource
} from "@/lib/chief-of-staff-signal";
import {
  buildPriorityInboxCandidateFromAgentSignal,
  routeAgentSignal,
  type AgentSignalRouteDecision,
  type AgentSignalRoutingOutcome
} from "@/lib/agent-signals/routing";
import {
  parseAgentProducedMicrosoft365SignalEnvelope,
  type AgentProducedMicrosoft365SignalEnvelope,
  type Microsoft365SourceCoverage
} from "@/lib/microsoft-signal-intake";
import { formatPriorityInboxTimestamp, type PriorityInboxSourceCandidate } from "@/lib/priority-inbox";
import { BOOTSTRAP_USER_ID, resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

type SourceItemRow = {
  id: string;
  source_type: ChiefOfStaffSignalSource;
  external_id: string;
};

type AgentSignalRunRow = {
  id: string;
};

type AgentSignalStatusRow = {
  external_signal_id: string;
  status: string;
};

type ExistingPriorityInboxItemRow = {
  id: string;
  agent_signal_id: string;
};

export type AgentSignalImportSourceMode = "agent_run" | "fixture_dev";

export type SourceItemUpsertRow = {
  user_id: string;
  source_system: "microsoft_365";
  source_type: ChiefOfStaffSignalSource;
  external_id: string;
  external_thread_id: null;
  external_conversation_id: null;
  received_at: string;
  source_url: string | null;
  title: string;
  snippet: string;
  participants: string[];
  raw_payload: ChiefOfStaffSignal;
  source_payload_kind: "agent_signal_stub";
};

export type AgentSignalRunInsertRow = {
  user_id: string;
  producer: "chatgpt_agent";
  connector_family: "microsoft_365";
  agent_run_request_id?: string | null;
  tenant_label: string;
  run_status: "failed" | "succeeded";
  sources_checked: string[];
  source_coverage: Microsoft365SourceCoverage | Record<string, never>;
  window_start: string | null;
  window_end: string | null;
  produced_at: string;
  completed_at: string;
  total_submitted_signal_count: number;
  accepted_signal_count: number;
  investment_committee_routed_count: number;
  suppressed_meta_admin_count: number;
  suppressed_low_signal_count: number;
  rejected_invalid_count: number;
  error_message: string | null;
  raw_metadata: Record<string, unknown>;
};

export type AgentSignalRunUpdateRow = Partial<Omit<AgentSignalRunInsertRow, "user_id" | "producer" | "connector_family">>;

export type AgentSignalUpsertRow = {
  user_id: string;
  run_id: string;
  external_signal_id: string;
  source_item_id: string;
  source: ChiefOfStaffSignalSource;
  signal_type: ChiefOfStaffSignal["signalType"];
  priority: ChiefOfStaffSignalAttention;
  title: string;
  summary: string;
  owner: string;
  source_label: string;
  occurred_at: string;
  due_at: string | null;
  source_url: string | null;
  suggested_next_step: string | null;
  desired_outcome: null;
  people: string[];
  protected_context: boolean;
  status: string;
  confidence: null;
  rationale: null;
  produced_at: string;
  imported_at: string;
  tenant_label: string;
  import_source_mode: AgentSignalImportSourceMode;
  category: string | null;
  why_it_matters: string | null;
  source_reference: string | null;
  routing_outcome: AgentSignalRoutingOutcome;
  routing_reason: string;
  validation_errors: string[];
  raw_payload: ChiefOfStaffSignal;
};

export type ImportedAgentSignalRecord = {
  id: string;
  externalSignalId: string;
  routingOutcome: AgentSignalRoutingOutcome;
  status: string;
  title: string;
  summary: string;
  priority: ChiefOfStaffSignalAttention;
  signalType: ChiefOfStaffSignal["signalType"];
  suggestedNextStep: string | null;
  people: string[];
  occurredAt: string;
  sourceItemId: string;
  source: ChiefOfStaffSignalSource;
};

type PriorityInboxItemUpsertRow = {
  user_id: string;
  source: PriorityInboxSourceCandidate["source"];
  source_label: string;
  source_family: PriorityInboxSourceCandidate["sourceFamily"];
  ingestion_mode: "agent_run";
  source_link: string | null;
  external_message_id: string;
  external_thread_id: string | null;
  received_at: string;
  sender: string;
  sender_role: string | null;
  thread_title: string;
  primary_line: string;
  summary: string;
  time_label: string;
  visible_state: PriorityInboxSourceCandidate["visibleState"];
  prior_visible_state: PriorityInboxSourceCandidate["visibleState"];
  deferred_until: null;
  deferred_label: null;
  deferred_reason: null;
  disposition: null;
  disposition_reason: string | null;
  disposition_label: null;
  updated_cue: string | null;
  relationship_cue: string | null;
  sensitive_context: string | null;
  attachment_cue: string | null;
  grouped_cue: string | null;
  why_surfaced: string;
  supporting_signals: string[];
  recommended_action: PriorityInboxSourceCandidate["recommendedAction"];
  task_prefill: PriorityInboxSourceCandidate["taskPrefill"] | null;
  commitment_prefill: PriorityInboxSourceCandidate["commitmentPrefill"] | null;
  initiative_prefill: PriorityInboxSourceCandidate["initiativePrefill"] | null;
  reference_prefill: PriorityInboxSourceCandidate["referencePrefill"] | null;
  created_object: null;
  source_metadata: Record<string, unknown>;
  agent_signal_id: string;
  agent_run_id: string;
  sort_order: number;
  last_changed_at: string;
};

export type AgentSignalsImportSummary = {
  runId: string;
  runStatus: "failed" | "succeeded";
  producedAt: string;
  tenantLabel: string;
  sourceCoverage?: Microsoft365SourceCoverage;
  sourcesChecked: string[];
  windowStart: string | null;
  windowEnd: string | null;
  submittedSignalCount: number;
  receivedSignalCount: number;
  icRoutedSignalCount: number;
  rejectedSignalCount: number;
  acceptedSignalCount: number;
  investmentCommitteeRoutedCount: number;
  suppressedMetaAdminCount: number;
  suppressedLowSignalCount: number;
  rejectedInvalidCount: number;
  upsertedSourceItemCount: number;
  upsertedSignalCount: number;
  upsertedPriorityInboxItemCount: number;
  signalsBySource: Record<ChiefOfStaffSignalSource, number>;
  signalsByPriority: Record<ChiefOfStaffSignalAttention, number>;
  importedAt: string;
};

export type AgentSignalsImportRepository = {
  userId: string;
  createRun(row: AgentSignalRunInsertRow): Promise<AgentSignalRunRow>;
  updateRun(runId: string, row: AgentSignalRunUpdateRow): Promise<void>;
  listExistingSignalStatuses(externalSignalIds: string[]): Promise<Map<string, string>>;
  upsertSourceItems(rows: SourceItemUpsertRow[]): Promise<SourceItemRow[]>;
  upsertAgentSignals(rows: AgentSignalUpsertRow[]): Promise<ImportedAgentSignalRecord[]>;
  upsertPriorityInboxItems(rows: PriorityInboxItemUpsertRow[]): Promise<number>;
};

export class AgentSignalsImportValidationError extends Error {}

export class AgentSignalsImportConfigurationError extends Error {}

export async function writePriorityInboxItemsWithoutConflictTarget(params: {
  client: SupabaseClient;
  userId: string;
  rows: PriorityInboxItemUpsertRow[];
}) {
  const { client, userId, rows } = params;

  if (rows.length === 0) {
    return 0;
  }

  const agentSignalIds = rows.map((row) => row.agent_signal_id);
  const existingResponse = await withSupabaseTimeout(
    client
      .from("priority_inbox_items")
      .select("id, agent_signal_id")
      .eq("user_id", userId)
      .in("agent_signal_id", agentSignalIds)
      .returns<ExistingPriorityInboxItemRow[]>()
  );

  if (existingResponse.error) {
    throw new Error(existingResponse.error.message ?? "Priority Inbox items could not be queried.");
  }

  const existingByAgentSignalId = new Map(
    (existingResponse.data ?? []).map((row) => [row.agent_signal_id, row.id])
  );

  const rowsToInsert = rows.filter((row) => !existingByAgentSignalId.has(row.agent_signal_id));
  const rowsToUpdate = rows.filter((row) => existingByAgentSignalId.has(row.agent_signal_id));

  let affectedCount = 0;

  if (rowsToInsert.length > 0) {
    const insertResponse = await withSupabaseTimeout(
      client
        .from("priority_inbox_items")
        .insert(rowsToInsert)
        .select("id")
    );

    if (insertResponse.error) {
      throw new Error(insertResponse.error.message ?? "Priority Inbox items could not be inserted.");
    }

    affectedCount += insertResponse.data?.length ?? rowsToInsert.length;
  }

  if (rowsToUpdate.length > 0) {
    const updateResults = await Promise.all(
      rowsToUpdate.map(async (row) => {
        const existingId = existingByAgentSignalId.get(row.agent_signal_id);
        if (!existingId) {
          throw new Error(`Priority Inbox item could not be resolved for ${row.agent_signal_id}.`);
        }

        const updateResponse = await withSupabaseTimeout(
          client
            .from("priority_inbox_items")
            .update(row)
            .eq("user_id", userId)
            .eq("id", existingId)
            .select("id")
        );

        if (updateResponse.error) {
          throw new Error(updateResponse.error.message ?? "Priority Inbox item could not be updated.");
        }

        return updateResponse.data?.length ?? 1;
      })
    );

    affectedCount += updateResults.reduce((sum, count) => sum + count, 0);
  }

  return affectedCount;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildCountRecord<TKey extends string>(keys: readonly TKey[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>;
}

function toValidationError(error: unknown) {
  if (error instanceof AgentSignalsImportValidationError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Agent signal payload is invalid.";
  return new AgentSignalsImportValidationError(message);
}

function safeIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function normalizeSourcesChecked(envelope: AgentProducedMicrosoft365SignalEnvelope) {
  if (envelope.sourcesChecked && envelope.sourcesChecked.length > 0) {
    return envelope.sourcesChecked;
  }

  if (envelope.sourceCoverage) {
    return CHIEF_OF_STAFF_SIGNAL_SOURCES.filter((source) => envelope.sourceCoverage?.[source] !== undefined);
  }

  return [...new Set(envelope.signals.map((signal) => signal.source))];
}

function topLevelSignalCount(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.signals)) {
    return 0;
  }

  return payload.signals.length;
}

function extractRunDraftFromInvalidPayload(
  payload: unknown,
  importedAt: string,
  errorMessage: string
): AgentSignalRunInsertRow | null {
  if (!isRecord(payload) || payload.producer !== "chatgpt_agent" || payload.connectorFamily !== "microsoft_365") {
    return null;
  }

  const tenantLabel =
    typeof payload.tenantLabel === "string" && payload.tenantLabel.trim()
      ? payload.tenantLabel.trim()
      : "Unknown tenant";

  return {
    user_id: BOOTSTRAP_USER_ID,
    producer: "chatgpt_agent",
    connector_family: "microsoft_365",
    tenant_label: tenantLabel,
    run_status: "failed",
    sources_checked:
      Array.isArray(payload.sourcesChecked) ? payload.sourcesChecked.filter((value): value is string => typeof value === "string") : [],
    source_coverage: isRecord(payload.sourceCoverage) ? (payload.sourceCoverage as Microsoft365SourceCoverage) : {},
    window_start: safeIsoTimestamp(payload.windowStart),
    window_end: safeIsoTimestamp(payload.windowEnd),
    produced_at: safeIsoTimestamp(payload.producedAt) ?? importedAt,
    completed_at: importedAt,
    total_submitted_signal_count: topLevelSignalCount(payload),
    accepted_signal_count: 0,
    investment_committee_routed_count: 0,
    suppressed_meta_admin_count: 0,
    suppressed_low_signal_count: 0,
    rejected_invalid_count: topLevelSignalCount(payload) || 1,
    error_message: errorMessage,
    raw_metadata: {
      status: payload.status ?? null,
      validationFailure: true
    }
  };
}

export function normalizeAgentSignalsImportInput(input: unknown) {
  if (typeof input !== "string") {
    return input;
  }

  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    throw new AgentSignalsImportValidationError(
      `Agent signal payload must be valid JSON: ${error instanceof Error ? error.message : "Unknown parse error."}`
    );
  }
}

export function buildSourceItemUpsertRow(userId: string, signal: ChiefOfStaffSignal): SourceItemUpsertRow {
  return {
    user_id: userId,
    source_system: "microsoft_365",
    source_type: signal.source,
    external_id: signal.id,
    external_thread_id: null,
    external_conversation_id: null,
    received_at: signal.occurredAt,
    source_url: signal.sourceUrl,
    title: signal.title,
    snippet: signal.summary,
    participants: signal.participants,
    raw_payload: signal,
    source_payload_kind: "agent_signal_stub"
  };
}

export function buildAgentSignalUpsertRow(params: {
  userId: string;
  runId: string;
  signal: ChiefOfStaffSignal;
  route: AgentSignalRouteDecision;
  envelope: AgentProducedMicrosoft365SignalEnvelope;
  sourceItemId: string;
  importedAt: string;
  importSourceMode: AgentSignalImportSourceMode;
  preservedStatus?: string;
}): AgentSignalUpsertRow {
  const { userId, runId, signal, route, envelope, sourceItemId, importedAt, importSourceMode, preservedStatus } = params;

  return {
    user_id: userId,
    run_id: runId,
    external_signal_id: signal.id,
    source_item_id: sourceItemId,
    source: signal.source,
    signal_type: signal.signalType,
    priority: signal.attention,
    title: signal.title,
    summary: signal.summary,
    owner: signal.owner,
    source_label: signal.sourceLabel,
    occurred_at: signal.occurredAt,
    due_at: signal.dueAt,
    source_url: signal.sourceUrl,
    suggested_next_step: signal.actionRequest,
    desired_outcome: null,
    people: signal.participants,
    protected_context: signal.protectedContext,
    status: preservedStatus ?? "new",
    confidence: null,
    rationale: null,
    produced_at: envelope.producedAt,
    imported_at: importedAt,
    tenant_label: envelope.tenantLabel,
    import_source_mode: importSourceMode,
    category: signal.category ?? null,
    why_it_matters: signal.whyItMatters ?? null,
    source_reference: signal.sourceReference ?? null,
    routing_outcome: route.outcome,
    routing_reason: route.reason,
    validation_errors: route.outcome === "rejected_invalid" ? [route.reason] : [],
    raw_payload: signal
  };
}

function buildPriorityInboxItemUpsertRow(params: {
  userId: string;
  runId: string;
  agentSignalId: string;
  signal: ChiefOfStaffSignal;
  route: AgentSignalRouteDecision;
  sortOrder: number;
  importedAt: string;
}): PriorityInboxItemUpsertRow {
  const { userId, runId, agentSignalId, signal, route, sortOrder, importedAt } = params;
  const candidate = buildPriorityInboxCandidateFromAgentSignal(signal, route);

  return {
    user_id: userId,
    source: candidate.source,
    source_label: candidate.sourceLabel,
    source_family: candidate.sourceFamily,
    ingestion_mode: "agent_run",
    source_link: candidate.sourceLink,
    external_message_id: candidate.externalMessageId,
    external_thread_id: candidate.conversationId ?? null,
    received_at: candidate.receivedAt,
    sender: candidate.sender,
    sender_role: candidate.senderRole ?? null,
    thread_title: candidate.subject,
    primary_line: candidate.primaryLine,
    summary: candidate.snippet,
    time_label: formatPriorityInboxTimestamp(candidate.receivedAt),
    visible_state: candidate.visibleState,
    prior_visible_state: candidate.visibleState,
    deferred_until: null,
    deferred_label: null,
    deferred_reason: null,
    disposition: null,
    disposition_reason: candidate.dispositionReason ?? null,
    disposition_label: null,
    updated_cue: candidate.updatedCue ?? null,
    relationship_cue: candidate.relationshipCue ?? null,
    sensitive_context: candidate.sensitiveContext ?? null,
    attachment_cue: candidate.attachmentCue ?? null,
    grouped_cue: candidate.groupedCue ?? null,
    why_surfaced: candidate.whySurfaced,
    supporting_signals: candidate.supportingSignals,
    recommended_action: candidate.recommendedAction,
    task_prefill: candidate.taskPrefill ?? null,
    commitment_prefill: candidate.commitmentPrefill ?? null,
    initiative_prefill: candidate.initiativePrefill ?? null,
    reference_prefill: candidate.referencePrefill ?? null,
    created_object: null,
    source_metadata: {
      ...(candidate.sourceMetadata ?? {}),
      agentRoutingOutcome: route.outcome,
      routingReason: route.reason,
      importedAt
    },
    agent_signal_id: agentSignalId,
    agent_run_id: runId,
    sort_order: sortOrder,
    last_changed_at: importedAt
  };
}

async function resolveAgentSignalsImportUserId() {
  const resolved = await resolveCurrentAppUser();
  return resolved?.user.id ?? BOOTSTRAP_USER_ID;
}

export async function createSupabaseAgentSignalsImportRepository(
  client?: SupabaseClient | null,
  userId?: string
): Promise<AgentSignalsImportRepository> {
  const resolvedClient =
    client ??
    (await import("@/lib/supabase/admin").then((module) => module.createSupabaseAdminClient()));
  if (!resolvedClient) {
    throw new AgentSignalsImportConfigurationError(
      "SUPABASE_SERVICE_ROLE_KEY is required for agent signal imports."
    );
  }

  const resolvedUserId = userId ?? (await resolveAgentSignalsImportUserId());

  return {
    userId: resolvedUserId,
    async createRun(row) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("agent_signal_runs")
          .insert(row)
          .select("id")
          .single<AgentSignalRunRow>()
      );

      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? "Agent signal run could not be created.");
      }

      return response.data;
    },
    async updateRun(runId, row) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("agent_signal_runs")
          .update(row)
          .eq("user_id", resolvedUserId)
          .eq("id", runId)
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Agent signal run could not be updated.");
      }
    },
    async listExistingSignalStatuses(externalSignalIds) {
      if (externalSignalIds.length === 0) {
        return new Map();
      }

      const response = await withSupabaseTimeout(
        resolvedClient
          .from("agent_signals")
          .select("external_signal_id, status")
          .eq("user_id", resolvedUserId)
          .in("external_signal_id", externalSignalIds)
          .returns<AgentSignalStatusRow[]>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Agent signals could not be read.");
      }

      return new Map((response.data ?? []).map((row) => [row.external_signal_id, row.status]));
    },
    async upsertSourceItems(rows) {
      if (rows.length === 0) {
        return [];
      }

      const response = await withSupabaseTimeout(
        resolvedClient
          .from("source_items")
          .upsert(rows, {
            onConflict: "user_id,source_system,source_type,external_id"
          })
          .select("id, source_type, external_id")
          .returns<SourceItemRow[]>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Source items could not be upserted.");
      }

      return response.data ?? [];
    },
    async upsertAgentSignals(rows) {
      if (rows.length === 0) {
        return [];
      }

      const response = await withSupabaseTimeout(
        resolvedClient
          .from("agent_signals")
          .upsert(rows, {
            onConflict: "user_id,external_signal_id"
          })
          .select(
            "id, external_signal_id, routing_outcome, status, title, summary, priority, signal_type, suggested_next_step, people, occurred_at, source_item_id, source"
          )
          .returns<
            Array<{
              id: string;
              external_signal_id: string;
              routing_outcome: AgentSignalRoutingOutcome;
              status: string;
              title: string;
              summary: string;
              priority: ChiefOfStaffSignalAttention;
              signal_type: ChiefOfStaffSignal["signalType"];
              suggested_next_step: string | null;
              people: string[];
              occurred_at: string;
              source_item_id: string;
              source: ChiefOfStaffSignalSource;
            }>
          >()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Agent signals could not be upserted.");
      }

      return (response.data ?? []).map((row) => ({
        id: row.id,
        externalSignalId: row.external_signal_id,
        routingOutcome: row.routing_outcome,
        status: row.status,
        title: row.title,
        summary: row.summary,
        priority: row.priority,
        signalType: row.signal_type,
        suggestedNextStep: row.suggested_next_step,
        people: row.people,
        occurredAt: row.occurred_at,
        sourceItemId: row.source_item_id,
        source: row.source
      }));
    },
    async upsertPriorityInboxItems(rows) {
      return await writePriorityInboxItemsWithoutConflictTarget({
        client: resolvedClient,
        userId: resolvedUserId,
        rows
      });
    }
  };
}

export async function importAgentSignals(
  input: unknown,
  options: {
    importedAt?: string;
    importSourceMode?: AgentSignalImportSourceMode;
    repository?: AgentSignalsImportRepository;
    manualRunRequestId?: string | null;
    requestRepository?: AgentRunRequestsRepository | null;
  } = {}
): Promise<AgentSignalsImportSummary> {
  const payload = normalizeAgentSignalsImportInput(input);
  const importedAt = options.importedAt ?? new Date().toISOString();
  const importSourceMode = options.importSourceMode ?? "agent_run";
  const repository = options.repository ?? (await createSupabaseAgentSignalsImportRepository());
  const manualRunRequestId =
    options.manualRunRequestId ?? extractManualRunRequestId({ payload });
  const requestRepository =
    options.requestRepository === undefined
      ? manualRunRequestId
        ? await createSupabaseAgentRunRequestsRepository()
        : null
      : options.requestRepository;

  let envelope: AgentProducedMicrosoft365SignalEnvelope;
  try {
    envelope = parseAgentProducedMicrosoft365SignalEnvelope(payload);
  } catch (error) {
    const validationError = toValidationError(error);
    const failedRunDraft = extractRunDraftFromInvalidPayload(payload, importedAt, validationError.message);

    if (failedRunDraft) {
      await repository.createRun({
        ...failedRunDraft,
        user_id: repository.userId
      });
    }

    throw validationError;
  }

  const signalsBySource = buildCountRecord(CHIEF_OF_STAFF_SIGNAL_SOURCES);
  const signalsByPriority = buildCountRecord(CHIEF_OF_STAFF_SIGNAL_ATTENTION);

  for (const signal of envelope.signals) {
    signalsBySource[signal.source] += 1;
    signalsByPriority[signal.attention] += 1;
  }

  const sourcesChecked = normalizeSourcesChecked(envelope);
  const routeResults = envelope.signals.map((signal) => ({
    signal,
    route: routeAgentSignal(signal)
  }));
  const acceptedSignals = routeResults.filter((entry) => entry.route.outcome === "priority_inbox");
  const investmentCommitteeSignals = routeResults.filter((entry) => entry.route.outcome === "investment_committee");
  const suppressedMetaAdminSignals = routeResults.filter((entry) => entry.route.outcome === "suppressed_meta_admin");
  const suppressedLowSignalSignals = routeResults.filter((entry) => entry.route.outcome === "suppressed_low_signal");
  const rejectedInvalidSignals = routeResults.filter((entry) => entry.route.outcome === "rejected_invalid");
  let attachableManualRunRequestId: string | null = null;

  if (manualRunRequestId && requestRepository) {
    const manualRequest = await requestRepository.findById(manualRunRequestId);
    if (
      manualRequest &&
      manualRequest.user_id === repository.userId &&
      (getEffectiveAgentRunRequestStatus(manualRequest, Date.parse(importedAt)) === "requested" ||
        getEffectiveAgentRunRequestStatus(manualRequest, Date.parse(importedAt)) === "claimed")
    ) {
      attachableManualRunRequestId = manualRequest.id;
    }
  }

  const runDraft: AgentSignalRunInsertRow = {
    user_id: repository.userId,
    producer: "chatgpt_agent",
    connector_family: "microsoft_365",
    agent_run_request_id: attachableManualRunRequestId,
    tenant_label: envelope.tenantLabel,
    run_status: envelope.status === "failed" ? "failed" : "succeeded",
    sources_checked: sourcesChecked,
    source_coverage: envelope.sourceCoverage ?? {},
    window_start: envelope.windowStart ?? null,
    window_end: envelope.windowEnd ?? null,
    produced_at: envelope.producedAt,
    completed_at: importedAt,
    total_submitted_signal_count: envelope.signals.length,
    accepted_signal_count: acceptedSignals.length,
    investment_committee_routed_count: investmentCommitteeSignals.length,
    suppressed_meta_admin_count: suppressedMetaAdminSignals.length,
    suppressed_low_signal_count: suppressedLowSignalSignals.length,
    rejected_invalid_count: rejectedInvalidSignals.length,
    error_message: envelope.status === "failed" ? "Agent reported a failed Microsoft 365 run." : null,
    raw_metadata: {
      status: envelope.status ?? "succeeded",
      manualRunRequestId: attachableManualRunRequestId
    }
  };

  const createdRun = await repository.createRun(runDraft);

  if (envelope.status === "failed") {
    await repository.updateRun(createdRun.id, {
      run_status: "failed",
      completed_at: importedAt
    });

    throw new AgentSignalsImportValidationError("Agent reported a failed Microsoft 365 run.");
  }

  try {
    const sourceItemRows = envelope.signals.map((signal) => buildSourceItemUpsertRow(repository.userId, signal));
    const existingStatuses = await repository.listExistingSignalStatuses(
      envelope.signals.map((signal) => signal.id)
    );
    const sourceItems = await repository.upsertSourceItems(sourceItemRows);
    const sourceItemIdsByKey = new Map(
      sourceItems.map((row) => [`${row.source_type}:${row.external_id}`, row.id])
    );

    const signalRows = routeResults.map(({ signal, route }) => {
      const sourceItemId = sourceItemIdsByKey.get(`${signal.source}:${signal.id}`);
      if (!sourceItemId) {
        throw new Error(`Imported source item could not be resolved for ${signal.source}:${signal.id}.`);
      }

      return buildAgentSignalUpsertRow({
        userId: repository.userId,
        runId: createdRun.id,
        signal,
        route,
        envelope,
        sourceItemId,
        importedAt,
        importSourceMode,
        preservedStatus: existingStatuses.get(signal.id)
      });
    });

    const importedSignals = await repository.upsertAgentSignals(signalRows);
    const importedSignalIdsByExternalId = new Map(
      importedSignals.map((signal) => [signal.externalSignalId, signal.id])
    );

    const priorityInboxRows = acceptedSignals.map(({ signal, route }, index) => {
      const agentSignalId = importedSignalIdsByExternalId.get(signal.id);
      if (!agentSignalId) {
        throw new Error(`Imported agent signal could not be resolved for ${signal.id}.`);
      }

      return buildPriorityInboxItemUpsertRow({
        userId: repository.userId,
        runId: createdRun.id,
        agentSignalId,
        signal,
        route,
        sortOrder: index,
        importedAt
      });
    });

    const upsertedPriorityInboxItemCount = await repository.upsertPriorityInboxItems(priorityInboxRows);

    if (attachableManualRunRequestId && requestRepository) {
      await completeAgentRunRequest(requestRepository, {
        requestId: attachableManualRunRequestId,
        agentSignalRunId: createdRun.id,
        now: importedAt
      });
    }

    await repository.updateRun(createdRun.id, {
      run_status: "succeeded",
      completed_at: importedAt,
      accepted_signal_count: acceptedSignals.length,
      investment_committee_routed_count: investmentCommitteeSignals.length,
      suppressed_meta_admin_count: suppressedMetaAdminSignals.length,
      suppressed_low_signal_count: suppressedLowSignalSignals.length,
      rejected_invalid_count: rejectedInvalidSignals.length,
      total_submitted_signal_count: envelope.signals.length,
      error_message: null
    });

    return {
      runId: createdRun.id,
      runStatus: "succeeded",
      producedAt: envelope.producedAt,
      tenantLabel: envelope.tenantLabel,
      sourceCoverage: envelope.sourceCoverage,
      sourcesChecked,
      windowStart: envelope.windowStart ?? null,
      windowEnd: envelope.windowEnd ?? null,
      submittedSignalCount: envelope.signals.length,
      receivedSignalCount: envelope.signals.length,
      icRoutedSignalCount: investmentCommitteeSignals.length,
      rejectedSignalCount: rejectedInvalidSignals.length,
      acceptedSignalCount: acceptedSignals.length,
      investmentCommitteeRoutedCount: investmentCommitteeSignals.length,
      suppressedMetaAdminCount: suppressedMetaAdminSignals.length,
      suppressedLowSignalCount: suppressedLowSignalSignals.length,
      rejectedInvalidCount: rejectedInvalidSignals.length,
      upsertedSourceItemCount: sourceItems.length,
      upsertedSignalCount: importedSignals.length,
      upsertedPriorityInboxItemCount,
      signalsBySource,
      signalsByPriority,
      importedAt
    };
  } catch (error) {
    await repository.updateRun(createdRun.id, {
      run_status: "failed",
      completed_at: importedAt,
      error_message: error instanceof Error ? error.message : "Agent signal import failed."
    });
    throw error;
  }
}
