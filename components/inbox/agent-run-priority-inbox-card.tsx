"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  demotePriorityInboxItemAction,
  openPriorityInboxSourceAction,
  promotePriorityInboxItemAction,
  restorePriorityInboxItemAction,
  transitionPriorityInboxItemAction
} from "@/app/inbox/actions";
import {
  formatPriorityInboxTimestamp,
  getPriorityInboxOpenTarget,
  getResolvedVisibleState,
  titleCaseDispositionReason,
  type PriorityInboxItem
} from "@/lib/priority-inbox";

type Props = {
  item: PriorityInboxItem;
  readOnly?: boolean;
};

function stateLabel(item: PriorityInboxItem) {
  const resolved = getResolvedVisibleState(item);
  switch (resolved) {
    case "high_priority":
      return "High Priority";
    case "needs_review":
      return "Needs Review";
    case "deferred":
      return "Deferred";
    case "handled":
      return "Handled";
    case "dismissed":
      return "Dismissed";
  }
}

export function AgentRunPriorityInboxCard({ item, readOnly = false }: Props) {
  const router = useRouter();
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const openTarget = getPriorityInboxOpenTarget(item);
  const resolvedState = getResolvedVisibleState(item);
  const isClosed = item.visibleState === "handled" || item.visibleState === "dismissed";
  const expiredConfirmationWindow = new Date(Date.now() - 1_000).toISOString();

  function runMutation(label: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setPendingLabel(label);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "The inbox action failed.");
        setPendingLabel(null);
        return;
      }

      setPendingLabel(null);
      router.refresh();
    });
  }

  function handleOpen() {
    if (!openTarget) {
      return;
    }

    window.open(openTarget.href, "_blank", "noopener,noreferrer");

    if (readOnly) {
      return;
    }

    runMutation("Opening source", () => openPriorityInboxSourceAction(item.id));
  }

  function handleCreateTask() {
    runMutation("Creating task", async () => {
      const result = await transitionPriorityInboxItemAction(item.id, {
        nextState: "handled",
        disposition: "task_created",
        dispositionLabel: "Task created",
        confirmationExpiresAt: expiredConfirmationWindow,
        canonicalTask: {
          description: item.taskPrefill?.description ?? item.primaryLine,
          nextStep: item.taskPrefill?.nextStep ?? item.primaryLine,
          desiredOutcome: item.taskPrefill?.desiredOutcome ?? item.summary,
          priority: item.taskPrefill?.priority ?? null
        }
      });

      return result.ok ? { ok: true } : result;
    });
  }

  function handleSaveReference() {
    runMutation("Saving reference", async () => {
      const result = await transitionPriorityInboxItemAction(item.id, {
        nextState: "handled",
        disposition: "reference_saved",
        dispositionLabel: "Saved reference",
        confirmationExpiresAt: expiredConfirmationWindow,
        canonicalReference: {
          title: item.referencePrefill?.title ?? item.threadTitle,
          summary: item.referencePrefill?.summary ?? item.summary
        }
      });

      return result.ok ? { ok: true } : result;
    });
  }

  function handleMarkHandled() {
    runMutation("Marking handled", () =>
      transitionPriorityInboxItemAction(item.id, {
        nextState: "handled",
        disposition: "marked_handled",
        dispositionLabel: "Marked handled",
        confirmationExpiresAt: expiredConfirmationWindow
      })
    );
  }

  function handleDismiss() {
    runMutation("Dismissing", () =>
      transitionPriorityInboxItemAction(item.id, {
        nextState: "dismissed",
        disposition: "dismissed",
        dispositionLabel: "Dismissed",
        dispositionReason: "not_actionable",
        confirmationExpiresAt: expiredConfirmationWindow
      })
    );
  }

  function handlePromote() {
    runMutation("Promoting", () => promotePriorityInboxItemAction(item.id));
  }

  function handleDemote() {
    runMutation("Moving to review", () => demotePriorityInboxItemAction(item.id));
  }

  function handleRestore() {
    runMutation("Restoring", () => restorePriorityInboxItemAction(item.id));
  }

  return (
    <article className="rounded-[1.4rem] border border-line/75 bg-white/72 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.18em] text-text-subtle">
        <span>{stateLabel(item)}</span>
        <span>·</span>
        <span>{item.sourceLabel}</span>
        <span>·</span>
        <span>{item.timeLabel || formatPriorityInboxTimestamp(item.receivedAt)}</span>
      </div>

      <h4 className="mt-3 text-[1.02rem] font-medium leading-6 text-text">{item.threadTitle}</h4>
      <p className="mt-2 text-sm font-medium text-text-muted">{item.sender}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{item.summary}</p>

      {item.relationshipCue ? (
        <p className="mt-3 text-sm leading-6 text-text-subtle">{item.relationshipCue}</p>
      ) : null}

      {item.dispositionLabel || item.dispositionReason ? (
        <p className="mt-3 text-sm leading-6 text-text-subtle">
          {[item.dispositionLabel, titleCaseDispositionReason(item.dispositionReason)].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isClosed ? (
          <button
            type="button"
            onClick={handleRestore}
            disabled={isPending}
            className="rounded-full border border-line/75 bg-white/80 px-3.5 py-2 text-sm text-text transition hover:bg-white disabled:opacity-55"
          >
            Restore
          </button>
        ) : (
          <>
            {openTarget ? (
              <button
                type="button"
                onClick={handleOpen}
                disabled={isPending}
                className="rounded-full border border-line/85 bg-[rgb(var(--color-shell))] px-3.5 py-2 text-sm text-white transition hover:bg-[rgb(var(--color-shell))] disabled:opacity-55"
              >
                Open
              </button>
            ) : null}
            {!readOnly ? (
              <>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={isPending}
                  className="rounded-full border border-line/75 bg-white/80 px-3.5 py-2 text-sm text-text transition hover:bg-white disabled:opacity-55"
                >
                  Create task
                </button>
                <button
                  type="button"
                  onClick={handleSaveReference}
                  disabled={isPending}
                  className="rounded-full border border-line/75 bg-white/80 px-3.5 py-2 text-sm text-text transition hover:bg-white disabled:opacity-55"
                >
                  Save reference
                </button>
                <button
                  type="button"
                  onClick={handleMarkHandled}
                  disabled={isPending}
                  className="rounded-full border border-line/75 bg-white/80 px-3.5 py-2 text-sm text-text transition hover:bg-white disabled:opacity-55"
                >
                  Mark handled
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isPending}
                  className="rounded-full border border-line/75 bg-white/80 px-3.5 py-2 text-sm text-text transition hover:bg-white disabled:opacity-55"
                >
                  Dismiss
                </button>
              </>
            ) : null}
            {!readOnly && resolvedState === "needs_review" ? (
              <button
                type="button"
                onClick={handlePromote}
                disabled={isPending}
                className="rounded-full border border-line/75 bg-white/80 px-3.5 py-2 text-sm text-text transition hover:bg-white disabled:opacity-55"
              >
                Promote
              </button>
            ) : null}
            {!readOnly && resolvedState === "high_priority" ? (
              <button
                type="button"
                onClick={handleDemote}
                disabled={isPending}
                className="rounded-full border border-line/75 bg-white/80 px-3.5 py-2 text-sm text-text transition hover:bg-white disabled:opacity-55"
              >
                Move to review
              </button>
            ) : null}
          </>
        )}
      </div>

      {readOnly ? (
        <p className="mt-3 text-sm text-text-subtle">
          Development preview only. Import a real Agent run to enable durable inbox actions and review state.
        </p>
      ) : null}
      {isPending && pendingLabel ? <p className="mt-3 text-sm text-text-subtle">{pendingLabel}…</p> : null}
      {error ? <p className="mt-3 text-sm text-[rgb(125,35,31)]">{error}</p> : null}
    </article>
  );
}
