import { AgentControlsCard } from "@/components/agent-signals/agent-controls-card";
import { AgentRunPriorityInboxCard } from "@/components/inbox/agent-run-priority-inbox-card";
import { PageIntro } from "@/components/shell/page-intro";
import {
  loadPriorityInboxPageData,
  type AgentRunInboxState,
  type PriorityInboxPageSourceMode
} from "@/lib/agent-signals/load-priority-inbox-page-data";
import type { PriorityInboxItem } from "@/lib/priority-inbox";

const SOURCE_ORDER = [
  { id: "outlook", label: "Outlook" },
  { id: "calendar", label: "Calendar" },
  { id: "teams", label: "Teams" }
] as const;

function isDevPreviewSource(sourceMode: PriorityInboxPageSourceMode) {
  return sourceMode === "local" || sourceMode === "fixture";
}

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

function stateTitle(state: AgentRunInboxState, sourceMode: PriorityInboxPageSourceMode) {
  if (sourceMode === "local") {
    switch (state) {
      case "failed":
        return "Priority Inbox is showing a failed local Agent payload.";
      case "zero_signals":
        return "The local Agent payload produced no accepted Priority Inbox signals.";
      case "stale":
        return "Priority Inbox is showing a stale local Agent payload.";
      case "succeeded":
      default:
        return "Priority Inbox is showing the local Agent payload saved in this workspace.";
    }
  }

  if (sourceMode === "fixture") {
    switch (state) {
      case "failed":
        return "Priority Inbox is showing a failed checked-in Agent fixture.";
      case "zero_signals":
        return "The checked-in Agent fixture produced no accepted Priority Inbox signals.";
      case "stale":
        return "Priority Inbox is showing a stale checked-in Agent fixture.";
      case "succeeded":
      default:
        return "Priority Inbox is showing the checked-in Agent fixture for localhost.";
    }
  }

  switch (state) {
    case "failed":
      return "The latest Agent run failed.";
    case "zero_signals":
      return "The latest Agent run produced no accepted Priority Inbox signals.";
    case "stale":
      return "The latest Agent run is stale.";
    case "succeeded":
      return "Priority Inbox is showing the latest accepted Agent-produced signals.";
    case "never_run":
    default:
      return "No database-backed Agent run has been received yet.";
  }
}

function stateDetail(state: AgentRunInboxState, sourceMode: PriorityInboxPageSourceMode) {
  if (sourceMode === "local") {
    switch (state) {
      case "failed":
        return "This localhost view is reading `.local/agent-signals.json`, but that payload reports a failed run. Replace it with a newer Blackhawk agent payload or import a durable run.";
      case "zero_signals":
        return "This localhost view is reading `.local/agent-signals.json`. Everything in that payload was routed away, suppressed, or rejected, so Priority Inbox is correctly empty.";
      case "stale":
        return "This localhost view is using `.local/agent-signals.json`, and that payload is older than 48 hours. Replace it with a newer Blackhawk agent payload or import a durable run.";
      case "succeeded":
      default:
        return "This localhost view is reading `.local/agent-signals.json`. That file remains a development fallback only and does not replace the durable database-backed inbox.";
    }
  }

  if (sourceMode === "fixture") {
    switch (state) {
      case "failed":
        return "This localhost view fell back to the checked-in Agent fixture, but that fixture reports a failed run. Replace it with a current local payload or import a durable run.";
      case "zero_signals":
        return "This localhost view is reading the checked-in Agent fixture. Everything in that fixture was routed away, suppressed, or rejected, so Priority Inbox is correctly empty.";
      case "stale":
        return "This localhost view is using the checked-in Agent fixture, and that fixture is older than 48 hours. Replace it with a fresh local payload or import a durable run.";
      case "succeeded":
      default:
        return "This localhost view is using the checked-in Agent fixture because no local payload or durable Agent run is available yet. It stays read-only and clearly labeled as development data.";
    }
  }

  switch (state) {
    case "failed":
      return "Fix the intake or rerun the Agent. The inbox stays honest instead of falling back to local or fixture data.";
    case "zero_signals":
      return "Everything in the latest run was routed away, suppressed, or rejected, so Priority Inbox is correctly empty.";
    case "stale":
      return "The last successful run is older than 48 hours. Review it carefully before trusting it as current.";
    case "succeeded":
      return "Only signals routed to Priority Inbox are shown here. Investment Committee and meta/admin signals stay out.";
    case "never_run":
    default:
      return "Priority Inbox is waiting for the scheduled Blackhawk agent to POST a new payload into `/api/agent-signals/import`. Production does not fall back to local files or fixtures.";
  }
}

function sourcePanelLabel(sourceMode: PriorityInboxPageSourceMode) {
  switch (sourceMode) {
    case "database":
      return "Database-backed ChatGPT Agent run";
    case "local":
      return "Local Agent payload fallback";
    case "fixture":
      return "Sanitized fixture fallback";
  }
}

function sourcePanelDetail(sourceMode: PriorityInboxPageSourceMode) {
  switch (sourceMode) {
    case "database":
      return "Loaded from the latest successful durable Agent run stored in Supabase. Local and fixture payloads stay fallback-only.";
    case "local":
      return "Loaded from `.local/agent-signals.json`. This localhost view is a fallback only and does not replace the durable database-backed inbox.";
    case "fixture":
      return "Loaded from `fixtures/chatgpt-agent-microsoft-365-signals.json`. This sanitized fixture is a fallback only and stays separate from durable inbox data.";
  }
}

function activeCount(items: PriorityInboxItem[]) {
  return items.filter((item) => item.visibleState === "high_priority" || item.visibleState === "needs_review").length;
}

export default async function InboxPage() {
  const { state, latestRun, latestManualRequest, items, sourceMode } = await loadPriorityInboxPageData();
  const bySource = SOURCE_ORDER.map((source) => ({
    ...source,
    items: items.filter((item) => item.source === source.id)
  }));

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Priority Inbox"
        title="Priority Inbox"
        description="Agent-produced Outlook, Calendar, and Teams priorities that survived server-side validation, routing, and suppression."
      />

      <AgentControlsCard
        latestRun={latestRun}
        latestManualRequest={latestManualRequest}
        sourceMode={sourceMode}
        state={state}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {bySource.map((group) => (
          <div key={group.id} className="rounded-[1.2rem] border border-line/70 bg-white/72 px-4 py-3">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{group.label}</p>
            <p className="mt-2 text-sm font-medium text-text">{group.items.length} visible items</p>
            <p className="mt-1 text-xs text-text-subtle">{activeCount(group.items)} active</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">By source</p>
          <h3 className="mt-2 text-[1.2rem] font-semibold leading-snug tracking-[-0.01em] text-text md:text-[1.35rem]">
            Outlook, Calendar, and Teams priorities
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
            Accepted signals stay grouped by source so the inbox remains an executive triage view rather than a mailbox clone.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {bySource.map((group) => (
            <section key={group.id} className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{group.label}</p>
                  <h4 className="mt-2 text-lg font-medium tracking-[-0.01em] text-text">{group.items.length} items</h4>
                </div>
                <span className="rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
                  {group.label}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {group.items.length > 0 ? (
                  group.items.map((item) => (
                    <AgentRunPriorityInboxCard
                      key={item.id}
                      item={item}
                      readOnly={isDevPreviewSource(sourceMode)}
                    />
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
                    <p className="text-sm font-medium text-text">No accepted {group.label} priorities in the latest run.</p>
                    <p className="mt-2 text-sm leading-6 text-text-muted">
                      This can mean the source had nothing qualifying, or everything from it was routed, suppressed, or rejected.
                    </p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>

      <details className="rounded-[1.3rem] border border-line/75 bg-white/74 px-4 py-4">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Run state</p>
            <h2 className="mt-2 text-[1.05rem] font-medium text-text">{stateTitle(state, sourceMode)}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{stateDetail(state, sourceMode)}</p>
          </div>
          <span className="rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
            Expand
          </span>
        </summary>

        <div className="mt-4 rounded-[1.1rem] border border-line/70 bg-white/70 px-4 py-3">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Data source</p>
          <p className="mt-2 text-sm font-medium text-text">{sourcePanelLabel(sourceMode)}</p>
          <p className="mt-1 text-sm leading-6 text-text-muted">{sourcePanelDetail(sourceMode)}</p>
        </div>

        {latestRun ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.1rem] border border-line/70 bg-white/72 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Latest run</p>
              <p className="mt-2 text-sm font-medium text-text">{formatTimestamp(latestRun.completedAt)}</p>
              <p className="mt-1 text-xs text-text-subtle">{latestRun.runStatus}</p>
            </div>
            <div className="rounded-[1.1rem] border border-line/70 bg-white/72 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Sources checked</p>
              <p className="mt-2 text-sm font-medium text-text">
                {latestRun.sourcesChecked.length > 0 ? latestRun.sourcesChecked.join(", ") : "None"}
              </p>
            </div>
            <div className="rounded-[1.1rem] border border-line/70 bg-white/72 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Accepted signals</p>
              <p className="mt-2 text-sm font-medium text-text">{latestRun.acceptedSignalCount}</p>
              <p className="mt-1 text-xs text-text-subtle">{latestRun.totalSubmittedSignalCount} submitted</p>
            </div>
            <div className="rounded-[1.1rem] border border-line/70 bg-white/72 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Routed or suppressed</p>
              <p className="mt-2 text-sm font-medium text-text">
                {latestRun.investmentCommitteeRoutedCount + latestRun.suppressedMetaAdminCount + latestRun.suppressedLowSignalCount + latestRun.rejectedInvalidCount}
              </p>
              <p className="mt-1 text-xs text-text-subtle">
                IC {latestRun.investmentCommitteeRoutedCount} · meta {latestRun.suppressedMetaAdminCount} · low {latestRun.suppressedLowSignalCount} · invalid {latestRun.rejectedInvalidCount}
              </p>
            </div>
          </div>
        ) : null}

        {latestRun?.investmentCommitteeRoutedCount ? (
          <div className="mt-4 rounded-[1.1rem] border border-line/70 bg-white/70 px-4 py-3">
            <p className="text-sm leading-6 text-text-muted">
              {latestRun.investmentCommitteeRoutedCount} signal{latestRun.investmentCommitteeRoutedCount === 1 ? "" : "s"} routed to Investment Committee and kept out of Priority Inbox.
            </p>
          </div>
        ) : null}

        {latestRun?.errorMessage ? (
          <p className="mt-4 text-sm leading-6 text-[rgb(125,35,31)]">{latestRun.errorMessage}</p>
        ) : null}
      </details>
    </div>
  );
}
