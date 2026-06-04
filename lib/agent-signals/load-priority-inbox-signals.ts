import {
  hasLocalAgentProducedMicrosoft365SignalPayload,
  loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource
} from "@/lib/microsoft-signal-intake";
import {
  buildPriorityInboxDatabaseResult,
  resolvePriorityInboxSignalEnvelopeWithSource,
  type PriorityInboxAgentSignalRow,
  type PriorityInboxSignalEnvelopeLoadResult
} from "@/lib/agent-signals/priority-inbox-source-resolution";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

export type {
  PriorityInboxAgentSignalRow,
  PriorityInboxSignalEnvelopeLoadResult,
  PriorityInboxSignalSourceMode
} from "@/lib/agent-signals/priority-inbox-source-resolution";
export { buildPriorityInboxDatabaseResult } from "@/lib/agent-signals/priority-inbox-source-resolution";

function isMissingAgentSignalsTableError(message: string) {
  return (
    message.includes("Could not find the table 'public.agent_signals'") ||
    message.includes('relation "agent_signals" does not exist')
  );
}

async function loadDatabaseBackedSignals(): Promise<PriorityInboxSignalEnvelopeLoadResult | null> {
  const client = createSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const response = await withSupabaseTimeout(
    client
      .from("agent_signals")
      .select(
        "external_signal_id, source, signal_type, priority, title, summary, owner, source_label, occurred_at, due_at, source_url, suggested_next_step, people, protected_context, produced_at, imported_at, import_source_mode, tenant_label, created_at, updated_at"
      )
      .returns<PriorityInboxAgentSignalRow[]>()
  );

  if (response.error) {
    if (isMissingAgentSignalsTableError(response.error.message ?? "")) {
      return buildPriorityInboxDatabaseResult([]);
    }

    throw new Error(response.error.message ?? "Database-backed agent signals could not be loaded.");
  }

  return buildPriorityInboxDatabaseResult(response.data ?? []);
}

export async function loadPriorityInboxSignalEnvelopeWithSource() {
  return await resolvePriorityInboxSignalEnvelopeWithSource({
    env: process.env,
    hasLocalPayload: hasLocalAgentProducedMicrosoft365SignalPayload,
    loadDatabaseSignals: loadDatabaseBackedSignals,
    loadLocalSignals: loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource
  });
}
