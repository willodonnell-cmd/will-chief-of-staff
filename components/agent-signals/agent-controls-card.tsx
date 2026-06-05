import { requestAgentRunNowAction } from "@/app/agent-signals/actions";
import {
  getAgentRunRequestButtonState,
  getAgentRunRequestStatusDetail,
  getAgentRunRequestStatusLabel,
  type ManualAgentRunRequest
} from "@/lib/agent-run-requests";
import type {
  AgentRunInboxState,
  PriorityInboxLatestRun,
  PriorityInboxPageSourceMode
} from "@/lib/agent-signals/load-priority-inbox-page-data";

type AgentControlsCardProps = {
  latestRun: PriorityInboxLatestRun | null;
  latestManualRequest: ManualAgentRunRequest | null;
  sourceMode: PriorityInboxPageSourceMode;
  state: AgentRunInboxState;
};

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

function ControlStat(props: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.05rem] border border-line/70 bg-white/72 px-4 py-3">
      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{props.label}</p>
      <p className="mt-2 text-sm font-medium text-text">{props.value}</p>
    </div>
  );
}

export function AgentControlsCard(props: AgentControlsCardProps) {
  const buttonState = getAgentRunRequestButtonState(props.latestManualRequest);
  const latestRequestStatus = props.latestManualRequest
    ? getAgentRunRequestStatusLabel(props.latestManualRequest.status)
    : "None";

  return (
    <section className="rounded-[1.55rem] border border-line/75 bg-white/74 p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Agent Controls</p>
          <h3 className="mt-2 text-[1.1rem] font-semibold tracking-[-0.01em] text-text">
            Run Agent Now
          </h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Requests the scheduled ChatGPT Agent to run at its next check-in. Blackhawk will update when the Agent posts a new durable run.
          </p>
        </div>

        <form action={requestAgentRunNowAction}>
          <button
            type="submit"
            disabled={buttonState.disabled}
            className="rounded-full border border-line/85 bg-[rgb(var(--color-shell))] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(var(--color-shell))] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {buttonState.label}
          </button>
        </form>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ControlStat label="Latest run time" value={formatTimestamp(props.latestRun?.completedAt)} />
        <ControlStat label="Latest source mode" value={sourceModeLabel(props.sourceMode)} />
        <ControlStat label="Latest run status" value={props.latestRun?.runStatus ?? runStateLabel(props.state)} />
        <ControlStat label="Manual request" value={latestRequestStatus} />
      </div>

      <div className="mt-4 rounded-[1.1rem] border border-line/70 bg-white/70 px-4 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Manual request detail</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{getAgentRunRequestStatusDetail(props.latestManualRequest)}</p>
        {props.latestManualRequest?.agentSignalRunId ? (
          <p className="mt-2 text-sm font-medium text-text">
            Resulting run id: {props.latestManualRequest.agentSignalRunId}
          </p>
        ) : null}
        {props.latestManualRequest ? (
          <p className="mt-2 text-xs text-text-subtle">
            Requested {formatTimestamp(props.latestManualRequest.requestedAt)} · Expires {formatTimestamp(props.latestManualRequest.expiresAt)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
