import Link from "next/link";

import { PageIntro } from "@/components/shell/page-intro";
import {
  loadPriorityInboxPageData,
  type AgentRunInboxState,
  type PriorityInboxPageSourceMode
} from "@/lib/agent-signals/load-priority-inbox-page-data";

const STALE_RUN_MS = 48 * 60 * 60 * 1000;

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "None";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "None";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(parsed);
}

function sourceModeLabel(sourceMode: PriorityInboxPageSourceMode) {
  switch (sourceMode) {
    case "database":
      return "Database-backed ChatGPT Agent run";
    case "local":
      return "Local Agent payload fallback";
    case "fixture":
      return "Sanitized fixture fallback";
  }
}

function runStateLabel(state: AgentRunInboxState) {
  switch (state) {
    case "failed":
      return "Failed";
    case "zero_signals":
      return "Zero accepted signals";
    case "stale":
      return "Stale";
    case "succeeded":
      return "Succeeded";
    case "never_run":
    default:
      return "Never run";
  }
}

function isRunStale(completedAt: string | null | undefined) {
  if (!completedAt) {
    return false;
  }

  const completedAtMs = Date.parse(completedAt);
  if (Number.isNaN(completedAtMs)) {
    return false;
  }

  return Date.now() - completedAtMs > STALE_RUN_MS;
}

function HealthStat(props: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.1rem] border border-line/70 bg-white/72 px-4 py-3">
      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{props.label}</p>
      <p className="mt-2 text-sm font-medium text-text">{props.value}</p>
    </div>
  );
}

export default async function AgentSignalsHealthPage() {
  const { state, latestRun, sourceMode } = await loadPriorityInboxPageData();
  const deployedCommitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const currentlyReadingDurableData = sourceMode === "database";
  const stale = state === "stale" || isRunStale(latestRun?.completedAt);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Agent Signals"
        title="Agent Signals Health"
        description="Operational status for the durable ChatGPT Agent Microsoft 365 import path and the Priority Inbox read path."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HealthStat label="Source mode" value={sourceModeLabel(sourceMode)} />
        <HealthStat label="Read path" value={currentlyReadingDurableData ? "Durable database-backed" : "Fallback"} />
        <HealthStat label="Run state" value={runStateLabel(state)} />
        <HealthStat label="Stale" value={stale ? "Yes" : "No"} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HealthStat label="Latest run id" value={latestRun?.id ?? "None"} />
        <HealthStat label="Run status" value={latestRun?.runStatus ?? "None"} />
        <HealthStat label="Produced at" value={formatTimestamp(latestRun?.producedAt)} />
        <HealthStat label="Completed at" value={formatTimestamp(latestRun?.completedAt)} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HealthStat label="Submitted" value={latestRun?.totalSubmittedSignalCount ?? 0} />
        <HealthStat label="Accepted" value={latestRun?.acceptedSignalCount ?? 0} />
        <HealthStat label="IC routed" value={latestRun?.investmentCommitteeRoutedCount ?? 0} />
        <HealthStat label="Rejected invalid" value={latestRun?.rejectedInvalidCount ?? 0} />
      </section>

      <section className="rounded-[1.3rem] border border-line/75 bg-white/74 px-4 py-4">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Deployment</p>
        <p className="mt-2 text-sm font-medium text-text">{deployedCommitSha ?? "Commit SHA unavailable"}</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          This page does not expose secrets or raw protected message content. It only shows run-level health and durable-read state.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/inbox"
            className="inline-flex rounded-full border border-line/75 bg-white/82 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white"
          >
            Open Priority Inbox
          </Link>
        </div>
      </section>
    </div>
  );
}
