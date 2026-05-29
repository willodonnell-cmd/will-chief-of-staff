import { readFile } from "node:fs/promises";
import process from "node:process";

import {
  CHIEF_OF_STAFF_SIGNAL_ATTENTION,
  CHIEF_OF_STAFF_SIGNAL_SOURCES,
  type ChiefOfStaffSignalAttention,
  type ChiefOfStaffSignalSource
} from "../lib/chief-of-staff-signal";
import {
  LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH,
  parseAgentProducedMicrosoft365SignalEnvelope
} from "../lib/microsoft-signal-intake";

function buildCountRecord<TKey extends string>(keys: readonly TKey[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>;
}

function formatCounts<TKey extends string>(keys: readonly TKey[], counts: Record<TKey, number>) {
  return keys.map((key) => `${key}=${counts[key]}`).join(" ");
}

async function main() {
  const payload = await readFile(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH, "utf8");
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(JSON.parse(payload) as unknown);

  const countsBySource = buildCountRecord<ChiefOfStaffSignalSource>(CHIEF_OF_STAFF_SIGNAL_SOURCES);
  const countsByAttention = buildCountRecord<ChiefOfStaffSignalAttention>(
    CHIEF_OF_STAFF_SIGNAL_ATTENTION
  );

  for (const signal of envelope.signals) {
    countsBySource[signal.source] += 1;
    countsByAttention[signal.attention] += 1;
  }

  process.stdout.write(
    [
      "Agent signal payload is valid.",
      `Path: ${LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH}`,
      `Produced at: ${envelope.producedAt}`,
      `Tenant: ${envelope.tenantLabel}`,
      `Signal count: ${envelope.signals.length}`,
      `By source: ${formatCounts(CHIEF_OF_STAFF_SIGNAL_SOURCES, countsBySource)}`,
      `By attention: ${formatCounts(CHIEF_OF_STAFF_SIGNAL_ATTENTION, countsByAttention)}`
    ].join("\n") + "\n"
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as NodeJS.ErrnoException | undefined)?.code;

  if (code === "ENOENT") {
    process.stderr.write(
      `Agent signal payload not found at ${LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH}. Save ChatGPT Agent output there before running validation.\n`
    );
    process.exit(1);
  }

  process.stderr.write(
    `Agent signal payload validation failed for ${LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH}: ${message}\n`
  );
  process.exit(1);
});
