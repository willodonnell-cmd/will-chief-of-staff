import { readFile } from "node:fs/promises";
import process from "node:process";

import {
  INVESTMENT_COMMITTEE_AGENT_THREAD_KINDS,
  LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH,
  parseInvestmentCommitteeAgentEnvelope,
  type InvestmentCommitteeAgentThreadKind
} from "../lib/investment-committee-agent";

function buildCountRecord<TKey extends string>(keys: readonly TKey[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>;
}

function formatCounts<TKey extends string>(keys: readonly TKey[], counts: Record<TKey, number>) {
  return keys.map((key) => `${key}=${counts[key]}`).join(" ");
}

async function main() {
  const payload = await readFile(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH, "utf8");
  const envelope = parseInvestmentCommitteeAgentEnvelope(JSON.parse(payload) as unknown);
  const threadCounts = buildCountRecord<InvestmentCommitteeAgentThreadKind>(INVESTMENT_COMMITTEE_AGENT_THREAD_KINDS);

  for (const deal of envelope.deals) {
    for (const thread of deal.threads) {
      threadCounts[thread.kind] += 1;
    }
  }

  process.stdout.write(
    [
      "Investment Committee cycle payload is valid.",
      `Path: ${LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH}`,
      `Produced at: ${envelope.producedAt}`,
      `Tenant: ${envelope.tenantLabel}`,
      `Week of: ${envelope.cycle.weekOf}`,
      `Deal count: ${envelope.deals.length}`,
      `Package subject: ${envelope.cycle.packageEmailSubject}`,
      `Box folder: ${envelope.cycle.boxFolderUrl ?? "not provided"}`,
      `Threads: ${formatCounts(INVESTMENT_COMMITTEE_AGENT_THREAD_KINDS, threadCounts)}`
    ].join("\n") + "\n"
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as NodeJS.ErrnoException | undefined)?.code;

  if (code === "ENOENT") {
    process.stderr.write(
      `Investment Committee cycle payload not found at ${LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH}. Save ChatGPT Agent output there before running validation.\n`
    );
    process.exit(1);
  }

  process.stderr.write(
    `Investment Committee cycle payload validation failed for ${LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH}: ${message}\n`
  );
  process.exit(1);
});
