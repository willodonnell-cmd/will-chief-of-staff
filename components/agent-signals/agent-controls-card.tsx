import React from "react";

import {
  disconnectMicrosoft365Action,
  requestAgentRunNowAction,
  runNativeMicrosoft365NowAction
} from "@/app/agent-signals/actions";
import {
  getAgentRunRequestButtonState,
  getAgentRunRequestStatusDetail,
  getAgentRunRequestStatusLabel,
  type ManualAgentRunRequest
} from "@/lib/agent-run-requests";
import type { MicrosoftGraphConnectionStatus } from "@/lib/microsoft-graph/types";
import type {
  AgentRunInboxState,
  PriorityInboxLatestRun,
  PriorityInboxPageSourceMode
} from "@/lib/agent-signals/load-priority-inbox-page-data";

type AgentControlsCardProps = {
  latestRun: PriorityInboxLatestRun | null;
  latestManualRequest: ManualAgentRunRequest | null;
  manualRunRequestsAvailable: boolean;
  microsoftGraphStatus: MicrosoftGraphConnectionStatus;
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

function producerLabel(run: PriorityInboxLatestRun | null) {
  if (!run) {
    return "None";
  }

  return run.producer === "blackhawk_native" ? "Native Blackhawk Graph" : "Legacy ChatGPT Agent import";
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
  const buttonState = getAgentRunRequestButtonState(props.latestManualRequest, {
    available: props.manualRunRequestsAvailable
  });
  const nativeConnected = props.microsoftGraphStatus.connected;
  const latestRequestStatus = props.latestManualRequest
    ? getAgentRunRequestStatusLabel(props.latestManualRequest.status)
    : props.manualRunRequestsAvailable
      ? "None"
      : "Unavailable";

  return (
    <section className="rounded-[1.55rem] border border-line/75 bg-white/74 p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Agent Controls</p>
          <h3 className="mt-2 text-[1.1rem] font-semibold tracking-[-0.01em] text-text">
            Native Microsoft 365 runs
          </h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Native runs are executed by Blackhawk using Microsoft Graph. No ChatGPT custom outbound app is required.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {nativeConnected ? (
            <form action={runNativeMicrosoft365NowAction}>
              <button
                type="submit"
                className="rounded-full border border-line/85 bg-[rgb(var(--color-shell))] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(var(--color-shell))]"
              >
                Run Now from Microsoft 365
              </button>
            </form>
          ) : (
            <a
              href={props.microsoftGraphStatus.connectHref}
              className="rounded-full border border-line/85 bg-[rgb(var(--color-shell))] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(var(--color-shell))]"
            >
              Connect Microsoft 365
            </a>
          )}

          {nativeConnected ? (
            <form action={disconnectMicrosoft365Action}>
              <button
                type="submit"
                className="rounded-full border border-line/75 bg-white/82 px-4 py-2 text-sm font-medium text-text transition hover:bg-white"
              >
                Disconnect Microsoft 365
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ControlStat label="Latest run time" value={formatTimestamp(props.latestRun?.completedAt)} />
        <ControlStat label="Latest run producer" value={producerLabel(props.latestRun)} />
        <ControlStat label="Latest run status" value={props.latestRun?.runStatus ?? runStateLabel(props.state)} />
        <ControlStat label="Microsoft 365" value={props.microsoftGraphStatus.connected ? "Connected" : "Not connected"} />
      </div>

      <div className="mt-4 rounded-[1.1rem] border border-line/70 bg-white/70 px-4 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Microsoft connection</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {props.microsoftGraphStatus.statusLabel}
        </p>
        {props.microsoftGraphStatus.accountEmail || props.microsoftGraphStatus.displayName ? (
          <p className="mt-2 text-sm font-medium text-text">
            {[props.microsoftGraphStatus.displayName, props.microsoftGraphStatus.accountEmail].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {props.microsoftGraphStatus.scopes.length > 0 ? (
          <p className="mt-2 text-xs text-text-subtle">
            Scopes: {props.microsoftGraphStatus.scopes.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-[1.1rem] border border-line/70 bg-white/70 px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Legacy fallback</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Legacy ChatGPT Agent requests remain available as a fallback, but may not complete if outbound custom apps are blocked by IT.
            </p>
            <p className="mt-2 text-xs text-text-subtle">Manual request: {latestRequestStatus}</p>
          </div>
          <form action={requestAgentRunNowAction}>
            <button
              type="submit"
              disabled={buttonState.disabled}
              className="rounded-full border border-line/75 bg-white/82 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              {buttonState.label}
            </button>
          </form>
        </div>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          {getAgentRunRequestStatusDetail(props.latestManualRequest, {
            available: props.manualRunRequestsAvailable
          })}
        </p>
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
