import { readFile } from "node:fs/promises";
import process from "node:process";
import { loadEnvConfig } from "@next/env";

import {
  CHIEF_OF_STAFF_SIGNAL_ATTENTION,
  CHIEF_OF_STAFF_SIGNAL_SOURCES
} from "../lib/chief-of-staff-signal";
import { importAgentSignals } from "../lib/agent-signals/import-agent-signals";
import { parseAgentProducedMicrosoft365SignalEnvelope } from "../lib/microsoft-signal-intake";

const LOCAL_PAYLOAD_PATH = ".local/agent-signals.json";

loadEnvConfig(process.cwd());

if (
  process.env.NODE_ENV !== "production" &&
  (process.env.SUPABASE_DEV_ALLOW_INSECURE_TLS === "true" || process.env.SUPABASE_DEV_ALLOW_INSECURE_TLS === "1")
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

function formatCounts<TKey extends string>(keys: readonly TKey[], counts: Record<TKey, number>) {
  return keys.map((key) => `${key}=${counts[key]}`).join(" ");
}

async function ensureNodeWebSocketSupport() {
  if (typeof globalThis.WebSocket !== "undefined") {
    return;
  }

  const wsModule = await import("ws");
  globalThis.WebSocket = wsModule.default as typeof globalThis.WebSocket;
}

async function main() {
  await ensureNodeWebSocketSupport();
  const payload = await readFile(LOCAL_PAYLOAD_PATH, "utf8");
  const parsed = JSON.parse(payload) as unknown;

  parseAgentProducedMicrosoft365SignalEnvelope(parsed);
  const summary = await importAgentSignals(parsed, {
    importSourceMode: "agent_run"
  });

  process.stdout.write(
    [
      "Local Agent signal payload imported.",
      `Path: ${LOCAL_PAYLOAD_PATH}`,
      `Run id: ${summary.runId}`,
      `Produced at: ${summary.producedAt}`,
      `Tenant: ${summary.tenantLabel}`,
      `Signal count: ${summary.receivedSignalCount}`,
      `Accepted: ${summary.acceptedSignalCount}`,
      `IC routed: ${summary.investmentCommitteeRoutedCount}`,
      `Suppressed meta/admin: ${summary.suppressedMetaAdminCount}`,
      `Suppressed low signal: ${summary.suppressedLowSignalCount}`,
      `Rejected invalid: ${summary.rejectedInvalidCount}`,
      `Upserted source items: ${summary.upsertedSourceItemCount}`,
      `Upserted agent signals: ${summary.upsertedSignalCount}`,
      `Upserted priority inbox items: ${summary.upsertedPriorityInboxItemCount}`,
      `By source: ${formatCounts(CHIEF_OF_STAFF_SIGNAL_SOURCES, summary.signalsBySource)}`,
      `By priority: ${formatCounts(CHIEF_OF_STAFF_SIGNAL_ATTENTION, summary.signalsByPriority)}`
    ].join("\n") + "\n"
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Local Agent signal import failed."}\n`
  );
  process.exit(1);
});
