import { mapPriorityInboxRow, type PriorityInboxRow } from "@/lib/priority-inbox-store";
import {
  formatPriorityInboxTimestamp,
  type PriorityInboxItem,
  type PriorityInboxSourceCandidate
} from "@/lib/priority-inbox";
import {
  buildPriorityInboxCandidateFromAgentSignal,
  routeAgentSignal
} from "@/lib/agent-signals/routing";
import {
  loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource,
  type AgentProducedMicrosoft365SignalEnvelope,
  type AgentProducedMicrosoft365SignalEnvelopeSource
} from "@/lib/microsoft-signal-intake";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";
import type { Microsoft365SourceCoverage } from "@/lib/microsoft-signal-intake";

export type AgentRunInboxState = "never_run" | "failed" | "zero_signals" | "stale" | "succeeded";
export type PriorityInboxPageSourceMode = "database" | "local" | "fixture";

type AgentSignalRunRow = {
  id: string;
  run_status: "failed" | "succeeded";
  tenant_label: string;
  produced_at: string;
  completed_at: string;
  sources_checked: string[] | null;
  source_coverage: unknown;
  total_submitted_signal_count: number;
  accepted_signal_count: number;
  investment_committee_routed_count: number;
  suppressed_meta_admin_count: number;
  suppressed_low_signal_count: number;
  rejected_invalid_count: number;
  error_message: string | null;
  created_at: string;
};

export type PriorityInboxLatestRun = {
  id: string;
  runStatus: "failed" | "succeeded";
  tenantLabel: string;
  producedAt: string;
  completedAt: string;
  sourcesChecked: string[];
  sourceCoverage: Microsoft365SourceCoverage | null;
  totalSubmittedSignalCount: number;
  acceptedSignalCount: number;
  investmentCommitteeRoutedCount: number;
  suppressedMetaAdminCount: number;
  suppressedLowSignalCount: number;
  rejectedInvalidCount: number;
  errorMessage: string | null;
};

export type PriorityInboxPageData = {
  state: AgentRunInboxState;
  latestRun: PriorityInboxLatestRun | null;
  items: PriorityInboxItem[];
  sourceMode: PriorityInboxPageSourceMode;
};

export type LoadPriorityInboxPageDataDeps = {
  env?: NodeJS.ProcessEnv;
  resolveAppUser?: typeof resolveCurrentAppUser;
  loadFallbackEnvelope?: typeof loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource;
};

const STALE_RUN_MS = 48 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapRun(row: AgentSignalRunRow): PriorityInboxLatestRun {
  return {
    id: row.id,
    runStatus: row.run_status,
    tenantLabel: row.tenant_label,
    producedAt: row.produced_at,
    completedAt: row.completed_at,
    sourcesChecked: row.sources_checked ?? [],
    sourceCoverage: isRecord(row.source_coverage) ? (row.source_coverage as Microsoft365SourceCoverage) : null,
    totalSubmittedSignalCount: row.total_submitted_signal_count,
    acceptedSignalCount: row.accepted_signal_count,
    investmentCommitteeRoutedCount: row.investment_committee_routed_count,
    suppressedMetaAdminCount: row.suppressed_meta_admin_count,
    suppressedLowSignalCount: row.suppressed_low_signal_count,
    rejectedInvalidCount: row.rejected_invalid_count,
    errorMessage: row.error_message
  };
}

function deriveState(run: PriorityInboxLatestRun | null): AgentRunInboxState {
  if (!run) {
    return "never_run";
  }

  if (run.runStatus === "failed") {
    return "failed";
  }

  if (run.acceptedSignalCount === 0) {
    return "zero_signals";
  }

  const completedAtMs = Date.parse(run.completedAt);
  if (!Number.isNaN(completedAtMs) && Date.now() - completedAtMs > STALE_RUN_MS) {
    return "stale";
  }

  return "succeeded";
}

function normalizeSourcesChecked(envelope: AgentProducedMicrosoft365SignalEnvelope) {
  if (envelope.sourcesChecked && envelope.sourcesChecked.length > 0) {
    return envelope.sourcesChecked;
  }

  if (envelope.sourceCoverage) {
    return (Object.keys(envelope.sourceCoverage) as Array<keyof Microsoft365SourceCoverage>).filter(
      (source) => envelope.sourceCoverage?.[source] !== undefined
    );
  }

  return [...new Set(envelope.signals.map((signal) => signal.source))];
}

function mapCandidateToFallbackItem(candidate: PriorityInboxSourceCandidate, itemId: string): PriorityInboxItem {
  return {
    id: itemId,
    source: candidate.source,
    sourceLabel: candidate.sourceLabel,
    sourceFamily: candidate.sourceFamily,
    ingestionMode: "agent_run",
    sourceLink: candidate.sourceLink,
    externalMessageId: candidate.externalMessageId,
    conversationId: candidate.conversationId,
    receivedAt: candidate.receivedAt,
    sender: candidate.sender,
    senderRole: candidate.senderRole ?? undefined,
    threadTitle: candidate.subject,
    primaryLine: candidate.primaryLine,
    summary: candidate.snippet,
    timeLabel: formatPriorityInboxTimestamp(candidate.receivedAt),
    visibleState: candidate.visibleState,
    updatedCue: candidate.updatedCue ?? null,
    relationshipCue: candidate.relationshipCue ?? null,
    sensitiveContext: candidate.sensitiveContext ?? null,
    attachmentCue: candidate.attachmentCue ?? null,
    groupedCue: candidate.groupedCue ?? null,
    whySurfaced: candidate.whySurfaced,
    supportingSignals: candidate.supportingSignals,
    recommendedAction: candidate.recommendedAction,
    taskPrefill: candidate.taskPrefill,
    commitmentPrefill: candidate.commitmentPrefill,
    initiativePrefill: candidate.initiativePrefill,
    referencePrefill: candidate.referencePrefill,
    dispositionReason: candidate.dispositionReason ?? null,
    sourceMetadata: {
      ...(candidate.sourceMetadata ?? {}),
      localDevFallback: true
    }
  };
}

export function buildFallbackPriorityInboxPageData(
  envelope: AgentProducedMicrosoft365SignalEnvelope,
  source: AgentProducedMicrosoft365SignalEnvelopeSource
): PriorityInboxPageData {
  const items: PriorityInboxItem[] = [];
  let acceptedSignalCount = 0;
  let investmentCommitteeRoutedCount = 0;
  let suppressedMetaAdminCount = 0;
  let suppressedLowSignalCount = 0;
  let rejectedInvalidCount = 0;

  for (const signal of envelope.signals) {
    const route = routeAgentSignal(signal);

    switch (route.outcome) {
      case "priority_inbox": {
        acceptedSignalCount += 1;
        const candidate = buildPriorityInboxCandidateFromAgentSignal(signal, route);
        items.push(mapCandidateToFallbackItem(candidate, `local-${signal.id}`));
        break;
      }
      case "investment_committee":
        investmentCommitteeRoutedCount += 1;
        break;
      case "suppressed_meta_admin":
        suppressedMetaAdminCount += 1;
        break;
      case "suppressed_low_signal":
        suppressedLowSignalCount += 1;
        break;
      case "rejected_invalid":
        rejectedInvalidCount += 1;
        break;
    }
  }

  const latestRun: PriorityInboxLatestRun = {
    id: "local-dev-fallback",
    runStatus: envelope.status === "failed" ? "failed" : "succeeded",
    tenantLabel: envelope.tenantLabel,
    producedAt: envelope.producedAt,
    completedAt: envelope.producedAt,
    sourcesChecked: normalizeSourcesChecked(envelope),
    sourceCoverage: envelope.sourceCoverage ?? null,
    totalSubmittedSignalCount: envelope.signals.length,
    acceptedSignalCount,
    investmentCommitteeRoutedCount,
    suppressedMetaAdminCount,
    suppressedLowSignalCount,
    rejectedInvalidCount,
    errorMessage: envelope.status === "failed" ? "The local Agent payload reported a failed run." : null
  };

  return {
    state: deriveState(latestRun),
    latestRun,
    items,
    sourceMode: source
  };
}

export function buildLocalPriorityInboxPageData(
  envelope: AgentProducedMicrosoft365SignalEnvelope
): PriorityInboxPageData {
  return buildFallbackPriorityInboxPageData(envelope, "local");
}

async function loadLatestAgentSignalRun(
  resolved: NonNullable<Awaited<ReturnType<typeof resolveCurrentAppUser>>>,
  runStatus?: AgentSignalRunRow["run_status"]
) {
  let query = resolved.client
    .from("agent_signal_runs")
    .select(
      "id, run_status, tenant_label, produced_at, completed_at, sources_checked, source_coverage, total_submitted_signal_count, accepted_signal_count, investment_committee_routed_count, suppressed_meta_admin_count, suppressed_low_signal_count, rejected_invalid_count, error_message, created_at"
    )
    .eq("user_id", resolved.user.id);

  if (runStatus) {
    query = query.eq("run_status", runStatus);
  }

  return await withSupabaseTimeout(
    query
      .order("completed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AgentSignalRunRow>()
  );
}

export async function loadPriorityInboxPageDataWithDeps(
  deps: LoadPriorityInboxPageDataDeps = {}
): Promise<PriorityInboxPageData> {
  const env = deps.env ?? process.env;
  const loadFallbackEnvelope =
    deps.loadFallbackEnvelope ?? loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource;
  const resolveAppUser = deps.resolveAppUser ?? resolveCurrentAppUser;
  let devFallbackPromise: Promise<Awaited<ReturnType<typeof loadFallbackEnvelope>> | null> | null = null;
  const loadDevFallback = async () => {
    if (env.NODE_ENV === "production") {
      return null;
    }

    devFallbackPromise ??= loadFallbackEnvelope().catch(() => null);
    return await devFallbackPromise;
  };

  const resolved = await resolveAppUser();
  if (!resolved) {
    const devFallback = await loadDevFallback();
    if (devFallback) {
      return buildFallbackPriorityInboxPageData(devFallback.envelope, devFallback.source);
    }

    return {
      state: "never_run",
      latestRun: null,
      items: [],
      sourceMode: "database"
    };
  }

  const latestRunResponse = await loadLatestAgentSignalRun(resolved);
  if (latestRunResponse.error || !latestRunResponse.data) {
    const devFallback = await loadDevFallback();
    if (devFallback) {
      return buildFallbackPriorityInboxPageData(devFallback.envelope, devFallback.source);
    }

    return {
      state: "never_run",
      latestRun: null,
      items: [],
      sourceMode: "database"
    };
  }

  const latestSuccessfulRunResponse = await loadLatestAgentSignalRun(resolved, "succeeded");
  const latestRun = latestSuccessfulRunResponse.data
    ? mapRun(latestSuccessfulRunResponse.data)
    : mapRun(latestRunResponse.data);

  if (!latestSuccessfulRunResponse.data) {
    return {
      state: deriveState(latestRun),
      latestRun,
      items: [],
      sourceMode: "database"
    };
  }

  const itemResponse = await withSupabaseTimeout(
    resolved.client
      .from("priority_inbox_items")
      .select(
        "id, user_id, source, source_label, source_family, ingestion_mode, source_link, external_message_id, external_thread_id, received_at, sender, sender_role, thread_title, primary_line, summary, time_label, visible_state, prior_visible_state, deferred_until, deferred_label, deferred_reason, disposition, disposition_reason, disposition_label, updated_cue, relationship_cue, sensitive_context, attachment_cue, grouped_cue, why_surfaced, supporting_signals, recommended_action, task_prefill, commitment_prefill, initiative_prefill, reference_prefill, created_object, source_metadata, sort_order, last_changed_at, created_at, updated_at"
      )
      .eq("user_id", resolved.user.id)
      .eq("agent_run_id", latestRun.id)
      .order("sort_order", { ascending: true })
      .order("last_changed_at", { ascending: false })
      .returns<PriorityInboxRow[]>()
  );

  return {
    state: deriveState(latestRun),
    latestRun,
    items: itemResponse.error ? [] : (itemResponse.data ?? []).map(mapPriorityInboxRow),
    sourceMode: "database"
  };
}

export async function loadPriorityInboxPageData(): Promise<PriorityInboxPageData> {
  return await loadPriorityInboxPageDataWithDeps();
}
