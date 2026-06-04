import type { ChiefOfStaffSignal, ChiefOfStaffSignalAttention } from "@/lib/chief-of-staff-signal";
import type {
  AgentProducedMicrosoft365SignalEnvelope,
  AgentProducedMicrosoft365SignalEnvelopeSource
} from "@/lib/microsoft-signal-intake";

export type PriorityInboxSignalSourceMode = "database" | "local" | "fixture" | "empty";

export type PriorityInboxAgentSignalRow = {
  external_signal_id: string;
  source: ChiefOfStaffSignal["source"];
  signal_type: ChiefOfStaffSignal["signalType"];
  priority: ChiefOfStaffSignalAttention;
  title: string;
  summary: string;
  owner: string | null;
  source_label: string | null;
  occurred_at: string | null;
  due_at: string | null;
  source_url: string | null;
  suggested_next_step: string | null;
  people: string[] | null;
  protected_context: boolean;
  produced_at: string | null;
  imported_at: string | null;
  import_source_mode: "database" | "agent_run" | "fixture_dev";
  tenant_label: string | null;
  created_at: string;
  updated_at: string;
};

export type PriorityInboxSignalEnvelopeLoadResult = {
  envelope: AgentProducedMicrosoft365SignalEnvelope;
  source: PriorityInboxSignalSourceMode;
  latestImportedAt: string | null;
  liveSignalCount: number;
};

export type PriorityInboxSignalLoaderDeps = {
  env?: NodeJS.ProcessEnv;
  hasLocalPayload?: () => Promise<boolean>;
  loadDatabaseSignals?: () => Promise<PriorityInboxSignalEnvelopeLoadResult | null>;
  loadLocalSignals?: () => Promise<{
    envelope: AgentProducedMicrosoft365SignalEnvelope;
    source: AgentProducedMicrosoft365SignalEnvelopeSource;
  }>;
};

const PRIORITY_ORDER: Record<ChiefOfStaffSignalAttention, number> = {
  high: 0,
  medium: 1,
  low: 2
};

export function isNonProductionPriorityInboxEnv(env: NodeJS.ProcessEnv) {
  return env.NODE_ENV !== "production";
}

export function isPriorityInboxFixtureFallbackEnabled(env: NodeJS.ProcessEnv) {
  return (
    isNonProductionPriorityInboxEnv(env) &&
    env.ENABLE_AGENT_SIGNAL_FIXTURE_FALLBACK === "true"
  );
}

export function createEmptyPriorityInboxEnvelope(
  now: string
): AgentProducedMicrosoft365SignalEnvelope {
  return {
    producer: "chatgpt_agent",
    connectorFamily: "microsoft_365",
    producedAt: now,
    tenantLabel: "Priority Inbox agent signals",
    signals: []
  };
}

export function createEmptyPriorityInboxLoadResult(
  now = new Date().toISOString()
): PriorityInboxSignalEnvelopeLoadResult {
  return {
    envelope: createEmptyPriorityInboxEnvelope(now),
    source: "empty",
    latestImportedAt: null,
    liveSignalCount: 0
  };
}

function compareImportedSignals(a: ChiefOfStaffSignal, b: ChiefOfStaffSignal) {
  const priorityDelta = PRIORITY_ORDER[a.attention] - PRIORITY_ORDER[b.attention];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  if (a.dueAt && b.dueAt) {
    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  }

  if (a.dueAt) {
    return -1;
  }

  if (b.dueAt) {
    return 1;
  }

  return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
}

function mapAgentSignalRow(row: PriorityInboxAgentSignalRow): ChiefOfStaffSignal {
  return {
    id: row.external_signal_id,
    source: row.source,
    signalType: row.signal_type,
    attention: row.priority,
    title: row.title,
    summary: row.summary,
    owner: row.owner ?? "Chief of Staff",
    sourceLabel: row.source_label ?? "Microsoft 365",
    occurredAt: row.occurred_at ?? row.created_at,
    dueAt: row.due_at,
    sourceUrl: row.source_url,
    actionRequest: row.suggested_next_step,
    participants: row.people ?? [],
    protectedContext: row.protected_context
  };
}

function getRowBatchTimestampMs(
  row: Pick<PriorityInboxAgentSignalRow, "imported_at" | "produced_at" | "updated_at">
) {
  const importedAtMs = row.imported_at ? Date.parse(row.imported_at) : Number.NaN;
  if (Number.isFinite(importedAtMs)) {
    return importedAtMs;
  }

  const producedAtMs = row.produced_at ? Date.parse(row.produced_at) : Number.NaN;
  if (Number.isFinite(producedAtMs)) {
    return producedAtMs;
  }

  return Date.parse(row.updated_at);
}

export function buildPriorityInboxDatabaseResult(
  rows: PriorityInboxAgentSignalRow[]
): PriorityInboxSignalEnvelopeLoadResult {
  if (rows.length === 0) {
    return {
      envelope: createEmptyPriorityInboxEnvelope(new Date().toISOString()),
      source: "database",
      latestImportedAt: null,
      liveSignalCount: 0
    };
  }

  const latestBatchTimestampMs = rows
    .map(getRowBatchTimestampMs)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  const latestBatchRows =
    typeof latestBatchTimestampMs === "number" && Number.isFinite(latestBatchTimestampMs)
      ? rows.filter((row) => getRowBatchTimestampMs(row) === latestBatchTimestampMs)
      : rows;
  const signals = latestBatchRows.map(mapAgentSignalRow).sort(compareImportedSignals);
  const latestImportedAt = latestBatchRows
    .map((row) => (row.imported_at ? Date.parse(row.imported_at) : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  const latestProducedAt = latestBatchRows
    .map((row) => (row.produced_at ? Date.parse(row.produced_at) : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  const producedAtMs = Number.isFinite(latestProducedAt)
    ? latestProducedAt
    : Number.isFinite(latestImportedAt)
      ? latestImportedAt
      : Date.now();
  const tenantLabel =
    latestBatchRows
      .map((row) => row.tenant_label?.trim())
      .find((value): value is string => Boolean(value)) ?? "Imported Microsoft 365 signals";
  const source: PriorityInboxSignalSourceMode = latestBatchRows.every(
    (row) => row.import_source_mode === "fixture_dev"
  )
    ? "fixture"
    : "database";

  return {
    envelope: {
      producer: "chatgpt_agent",
      connectorFamily: "microsoft_365",
      producedAt: new Date(producedAtMs).toISOString(),
      tenantLabel,
      signals
    },
    source,
    latestImportedAt:
      typeof latestImportedAt === "number" && Number.isFinite(latestImportedAt)
        ? new Date(latestImportedAt).toISOString()
        : null,
    liveSignalCount: latestBatchRows.length
  };
}

export async function resolvePriorityInboxSignalEnvelopeWithSource(
  deps: PriorityInboxSignalLoaderDeps
): Promise<PriorityInboxSignalEnvelopeLoadResult> {
  const env = deps.env ?? process.env;
  const loadDatabaseSignals = deps.loadDatabaseSignals;
  const hasLocalPayload = deps.hasLocalPayload;
  const loadLocalSignals = deps.loadLocalSignals;

  if (!loadDatabaseSignals || !hasLocalPayload || !loadLocalSignals) {
    throw new Error("Priority Inbox source resolution dependencies are incomplete.");
  }

  try {
    const databaseResult = await loadDatabaseSignals();
    if (databaseResult && databaseResult.liveSignalCount > 0) {
      return databaseResult;
    }

    if (isNonProductionPriorityInboxEnv(env) && (await hasLocalPayload())) {
      const fallback = await loadLocalSignals();
      return {
        envelope: fallback.envelope,
        source: "local",
        latestImportedAt: null,
        liveSignalCount: 0
      };
    }

    if (isPriorityInboxFixtureFallbackEnabled(env)) {
      const fallback = await loadLocalSignals();
      return {
        envelope: fallback.envelope,
        source: "fixture",
        latestImportedAt: null,
        liveSignalCount: 0
      };
    }

    if (databaseResult && databaseResult.liveSignalCount === 0) {
      return createEmptyPriorityInboxLoadResult(databaseResult.envelope.producedAt);
    }

    return databaseResult ?? createEmptyPriorityInboxLoadResult();
  } catch (error) {
    if (isNonProductionPriorityInboxEnv(env) && (await hasLocalPayload())) {
      const fallback = await loadLocalSignals();
      return {
        envelope: fallback.envelope,
        source: "local",
        latestImportedAt: null,
        liveSignalCount: 0
      };
    }

    if (isPriorityInboxFixtureFallbackEnabled(env)) {
      const fallback = await loadLocalSignals();
      return {
        envelope: fallback.envelope,
        source: "fixture",
        latestImportedAt: null,
        liveSignalCount: 0
      };
    }

    throw error;
  }
}
