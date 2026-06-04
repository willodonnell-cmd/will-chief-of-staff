import { readFile } from "node:fs/promises";
import process from "node:process";
import { loadEnvConfig } from "@next/env";

import {
  CHIEF_OF_STAFF_SIGNAL_ATTENTION,
  CHIEF_OF_STAFF_SIGNAL_SOURCES
} from "../lib/chief-of-staff-signal";
import { importAgentSignals } from "../lib/agent-signals/import-agent-signals";
import { parseAgentProducedMicrosoft365SignalEnvelope } from "../lib/microsoft-signal-intake";

const FIXTURE_PATH = "fixtures/chatgpt-agent-microsoft-365-signals.json";

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
  const payload = await readFile(FIXTURE_PATH, "utf8");
  const parsed = JSON.parse(payload) as unknown;

  parseAgentProducedMicrosoft365SignalEnvelope(parsed);
  const summary = await importAgentSignals(parsed, {
    importSourceMode: "fixture_dev"
  });

  process.stdout.write(
    [
      "Agent signal fixture imported.",
      `Produced at: ${summary.producedAt}`,
      `Tenant: ${summary.tenantLabel}`,
      `Signal count: ${summary.receivedSignalCount}`,
      `Upserted source items: ${summary.upsertedSourceItemCount}`,
      `Upserted agent signals: ${summary.upsertedSignalCount}`,
      `By source: ${formatCounts(CHIEF_OF_STAFF_SIGNAL_SOURCES, summary.signalsBySource)}`,
      `By priority: ${formatCounts(CHIEF_OF_STAFF_SIGNAL_ATTENTION, summary.signalsByPriority)}`
    ].join("\n") + "\n"
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Agent signal fixture import failed."}\n`
  );
  process.exit(1);
});
