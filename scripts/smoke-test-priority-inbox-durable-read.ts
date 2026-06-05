import process from "node:process";
import { loadEnvConfig } from "@next/env";

import { BOOTSTRAP_USER_ID } from "../lib/supabase/current-user";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { withSupabaseTimeout } from "../lib/supabase/request-timeout";

loadEnvConfig(process.cwd());

type AgentSignalRunRow = {
  id: string;
  run_status: "failed" | "succeeded";
  produced_at: string;
  completed_at: string;
  total_submitted_signal_count: number;
  accepted_signal_count: number;
  investment_committee_routed_count: number;
  rejected_invalid_count: number;
};

async function main() {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for the durable read smoke test.");
  }

  const userId = process.env.AGENT_SIGNALS_USER_ID?.trim() || BOOTSTRAP_USER_ID;
  const expectedRunId = process.env.EXPECTED_RUN_ID?.trim() || null;

  const latestRunResponse = await withSupabaseTimeout(
    client
      .from("agent_signal_runs")
      .select(
        "id, run_status, produced_at, completed_at, total_submitted_signal_count, accepted_signal_count, investment_committee_routed_count, rejected_invalid_count"
      )
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AgentSignalRunRow>()
  );

  if (latestRunResponse.error) {
    throw new Error(latestRunResponse.error.message ?? "Latest durable agent run could not be read.");
  }

  if (!latestRunResponse.data) {
    throw new Error("No durable agent run exists for the configured app user.");
  }

  const latestRun = latestRunResponse.data;
  if (expectedRunId && latestRun.id !== expectedRunId) {
    throw new Error(`Latest durable agent run ${latestRun.id} did not match EXPECTED_RUN_ID ${expectedRunId}.`);
  }

  const itemsResponse = await withSupabaseTimeout(
    client
      .from("priority_inbox_items")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_run_id", latestRun.id)
  );

  if (itemsResponse.error) {
    throw new Error(itemsResponse.error.message ?? "Priority Inbox items for the latest durable run could not be read.");
  }

  const itemCount = itemsResponse.data?.length ?? 0;
  if (latestRun.accepted_signal_count > 0 && itemCount === 0) {
    throw new Error("Latest durable agent run accepted Priority Inbox signals, but no durable Priority Inbox items were found.");
  }

  process.stdout.write(
    [
      `Run id: ${latestRun.id}`,
      `Status: ${latestRun.run_status}`,
      `Produced at: ${latestRun.produced_at}`,
      `Completed at: ${latestRun.completed_at}`,
      `Submitted: ${latestRun.total_submitted_signal_count}`,
      `Accepted: ${latestRun.accepted_signal_count}`,
      `IC routed: ${latestRun.investment_committee_routed_count}`,
      `Rejected invalid: ${latestRun.rejected_invalid_count}`,
      `Priority Inbox items for latest run: ${itemCount}`
    ].join("\n") + "\n"
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Durable Priority Inbox smoke test failed."}\n`);
  process.exit(1);
});
