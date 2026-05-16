"use client";

import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { PriorityInboxDigestBar } from "@/components/inbox/priority-inbox-digest-bar";
import {
  deletePriorityInboxItemAction,
  demotePriorityInboxItemAction,
  openPriorityInboxSourceAction,
  promotePriorityInboxItemAction,
  restorePriorityInboxItemAction,
  transitionPriorityInboxItemAction
} from "@/app/inbox/actions";

import {
  formatTaskPriorityLabel,
  type InitiativeOption,
  type TaskCategoryOption,
  type TaskPriority
} from "@/lib/blackhawk-capture-model";
import {
  formatPriorityInboxDateTime,
  formatPriorityInboxTimestamp,
  getPriorityInboxOpenTarget,
  getResolvedVisibleState,
  getResurfacedCue,
  isDeferredDue,
  matchesPriorityInboxSourceFilter,
  titleCaseDispositionReason,
  type PriorityInboxActiveState,
  type PriorityInboxCreatedObject,
  type PriorityInboxDeferredReason,
  type PriorityInboxDisposition,
  type PriorityInboxDispositionReason,
  type PriorityInboxItem,
  type PriorityInboxRecommendedAction,
  type PriorityInboxSourceFilter,
  type PriorityInboxTransitionPayload,
  type PriorityInboxVisibleState
} from "@/lib/priority-inbox";
import {
  buildPriorityInboxTaskPrefill,
  resolvePrefillCategoryId,
  resolvePrefillInitiativeId
} from "@/lib/task-suggestions";
import { cn } from "@/lib/utils";

type LocalPriorityInboxItem = PriorityInboxItem & {
  openFollowUp?: boolean;
};

type ComposerKind = "task" | "commitment" | "initiative" | "defer";

type ComposerState =
  | {
      kind: ComposerKind;
      itemId: string | null;
    }
  | null;

type TransitionPayload = PriorityInboxTransitionPayload & {
  message: string;
};

type FlashState = {
  message: string;
  itemId?: string;
  snapshot?: LocalPriorityInboxItem;
};

type PendingTransition = {
  message: string;
  next: TransitionPayload;
  snapshot: LocalPriorityInboxItem;
};

const SOURCE_FILTERS: Array<{ id: PriorityInboxSourceFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "email", label: "Email" },
  { id: "teams", label: "Teams" }
];

const DEFER_REASON_OPTIONS: Array<{ value: PriorityInboxDeferredReason; label: string }> = [
  { value: "not_now", label: "Not now" },
  { value: "waiting_for_context", label: "Waiting for context" },
  { value: "follow_up_later", label: "Follow up later" },
  { value: "closer_to_meeting", label: "Closer to meeting" },
  { value: "waiting_for_reply", label: "Waiting for reply" }
];

const DISMISS_REASON_OPTIONS: Array<{ value: PriorityInboxDispositionReason; label: string }> = [
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "low_value", label: "Low value" },
  { value: "irrelevant", label: "Irrelevant" },
  { value: "duplicate", label: "Duplicate" },
  { value: "generic_update", label: "Generic update" },
  { value: "not_actionable", label: "Not actionable" }
];

const HIGH_PRIORITY_CONFIRMATION_MS = 3600;
const FLASH_MS = 5200;

function createLocalItems(items: PriorityInboxItem[]) {
  return items.map((item) => ({
    ...item,
    openFollowUp: false
  }));
}

function actionLabelForRecommendedAction(action: PriorityInboxRecommendedAction) {
  switch (action) {
    case "create_task":
      return "Create task";
    case "add_commitment":
      return "Add commitment";
    case "save_reference":
      return "Save reference";
    case "mark_handled":
      return "Mark handled";
    case "defer":
      return "Defer";
    default:
      return "Open";
  }
}

function actionSummaryLabel(disposition: PriorityInboxDisposition) {
  switch (disposition) {
    case "task_created":
      return "Task created";
    case "initiative_created":
      return "Initiative created";
    case "commitment_created":
      return "Commitment created";
    case "reference_saved":
      return "Saved reference";
    case "marked_handled":
      return "Marked handled";
    case "dismissed":
      return "Dismissed";
    case "deferred":
      return "Deferred";
    case "source_opened":
      return "Opened source";
    default:
      return "Updated";
  }
}

function buildHighPriorityConfirmationDeadline() {
  return new Date(Date.now() + HIGH_PRIORITY_CONFIRMATION_MS).toISOString();
}

function timeLabelForState(state: PriorityInboxVisibleState, deferredLabel?: string | null) {
  if (state === "deferred") {
    return deferredLabel ? `Deferred until ${deferredLabel}` : "Deferred";
  }

  if (state === "handled") {
    return "Handled just now";
  }

  if (state === "dismissed") {
    return "Dismissed just now";
  }

  return "Updated just now";
}

function sourceOpenedMessage(item: LocalPriorityInboxItem) {
  const openTarget = getPriorityInboxOpenTarget(item);
  if (openTarget?.kind === "detail") {
    return "Opened forwarded details";
  }

  return `Opened in ${item.sourceLabel}`;
}

function preservePriorActiveState(item: LocalPriorityInboxItem, now: number): PriorityInboxActiveState {
  const resolvedState = getResolvedVisibleState(item, now);
  if (resolvedState === "high_priority" || resolvedState === "needs_review") {
    return resolvedState;
  }

  return item.priorVisibleState ?? "needs_review";
}

function topButtonClass(isActive: boolean) {
  return cn(
    "rounded-full px-3.5 py-2 text-sm transition",
    isActive ? "bg-[rgb(var(--color-shell))] text-white" : "bg-white/78 text-text-muted hover:bg-white hover:text-text"
  );
}

function tertiaryButtonClass() {
  return "rounded-full border border-line/70 bg-[rgba(255,255,255,0.62)] px-3.5 py-2 text-sm text-text-muted transition hover:bg-white hover:text-text";
}

function primaryButtonClass(emphasized = false) {
  return cn(
    "rounded-full border px-3.5 py-2 text-sm font-medium transition",
    emphasized ? "border-line/85 bg-[rgb(var(--color-shell))] text-white" : "border-line/75 bg-white/80 text-text hover:bg-white"
  );
}

function subtleChipClass(kind: "default" | "warning" | "sensitive" = "default") {
  if (kind === "warning") {
    return "rounded-full border border-accent-red/18 bg-[rgba(125,35,31,0.06)] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-text-muted";
  }

  if (kind === "sensitive") {
    return "rounded-full border border-accent-red/18 bg-[rgba(125,35,31,0.05)] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle";
  }

  return "rounded-full border border-line/70 bg-white/70 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle";
}

function sourceLinkForCreatedObject(object: PriorityInboxCreatedObject) {
  return object.href;
}

function OverflowSection({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-[1.1rem] border border-line/70 bg-[rgba(255,255,255,0.56)] p-4">
      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

type DeferComposerProps = {
  item: LocalPriorityInboxItem;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function DeferComposer({ item, onCancel, onSubmit }: DeferComposerProps) {
  const [preset, setPreset] = useState("tomorrow");

  const now = new Date();
  const laterToday = new Date(now.getTime());
  laterToday.setHours(Math.max(now.getHours() + 3, 17), 0, 0, 0);
  const tomorrow = new Date(now.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const nextWeek = new Date(now.getTime());
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);

  return (
    <OverflowSection title="Defer">
      <form className="space-y-4" onSubmit={onSubmit}>
        <input type="hidden" name="itemId" value={item.id} />

        <div className="flex flex-wrap gap-2">
          {[
            { value: "later_today", label: "Later today", date: formatPriorityInboxDateTime(laterToday.toISOString()) },
            { value: "tomorrow", label: "Tomorrow", date: formatPriorityInboxDateTime(tomorrow.toISOString()) },
            { value: "next_week", label: "Next week", date: formatPriorityInboxDateTime(nextWeek.toISOString()) },
            { value: "custom", label: "Pick date", date: "" }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreset(option.value)}
              className={cn(topButtonClass(preset === option.value), "px-3 py-2")}
            >
              {option.label}
            </button>
          ))}
        </div>

        <input
          type="hidden"
          name="preset"
          value={preset}
        />

        <input
          type="hidden"
          name="presetDate"
          value={
            preset === "later_today"
              ? formatPriorityInboxDateTime(laterToday.toISOString())
              : preset === "tomorrow"
                ? formatPriorityInboxDateTime(tomorrow.toISOString())
                : preset === "next_week"
                  ? formatPriorityInboxDateTime(nextWeek.toISOString())
                  : ""
          }
        />

        {preset === "custom" ? (
          <label className="space-y-2 text-sm text-text-muted">
            <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Return time</span>
            <input
              name="customDate"
              type="datetime-local"
              required
              className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
            />
          </label>
        ) : null}

        <label className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Reason</span>
          <select
            name="reason"
            defaultValue="not_now"
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          >
            {DEFER_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primaryButtonClass(true)}>
            Save defer
          </button>
          <button type="button" onClick={onCancel} className={tertiaryButtonClass()}>
            Cancel
          </button>
        </div>
      </form>
    </OverflowSection>
  );
}

type BasicComposerProps = {
  item: LocalPriorityInboxItem;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type TaskComposerProps = BasicComposerProps & {
  categories: TaskCategoryOption[];
  commonCategories: TaskCategoryOption[];
  initiatives: InitiativeOption[];
};

function TaskComposer({ item, categories, commonCategories, initiatives, onCancel, onSubmit }: TaskComposerProps) {
  const prefill = buildPriorityInboxTaskPrefill(item);
  const [priority, setPriority] = useState<TaskPriority>(prefill.priority ?? "medium");
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(resolvePrefillCategoryId(categories, prefill));
  const [initiativeId, setInitiativeId] = useState<string | null>(resolvePrefillInitiativeId(initiatives, prefill));
  const [initiativeQuery, setInitiativeQuery] = useState(
    initiatives.find((initiative) => initiative.id === resolvePrefillInitiativeId(initiatives, prefill))?.title ?? ""
  );

  return (
    <OverflowSection title="Create task">
      <datalist id={`task-initiative-options-${item.id}`}>
        {initiatives.map((initiative) => (
          <option key={initiative.id} value={initiative.title} />
        ))}
      </datalist>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="priority" value={priority} />
        <input type="hidden" name="categoryId" value={categoryId ?? ""} />
        <input type="hidden" name="linkedInitiativeId" value={initiativeId ?? ""} />

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Task Description</span>
          <textarea
            name="description"
            required
            rows={4}
            defaultValue={prefill.description}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <div className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Priority</span>
          <div className="flex flex-wrap gap-2">
            {(["high", "medium", "low"] as TaskPriority[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPriority(value)}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                  priority === value
                    ? "border-line/85 bg-[rgb(var(--color-shell))] text-white"
                    : "border-line/75 bg-white/80 text-text hover:bg-white"
                )}
              >
                {formatTaskPriorityLabel(value)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Category</span>
          <div className="flex flex-wrap gap-2">
            {commonCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                  categoryId === category.id
                    ? "border-line/85 bg-[rgb(var(--color-shell))] text-white"
                    : "border-line/75 bg-white/80 text-text hover:bg-white"
                )}
              >
                {category.name}
              </button>
            ))}
            <button type="button" onClick={() => setShowMoreCategories((current) => !current)} className={tertiaryButtonClass()}>
              More
            </button>
          </div>
          {showMoreCategories ? (
            <select
              value={categoryId ?? ""}
              onChange={(event) => setCategoryId(event.target.value || null)}
              className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
            >
              <option value="">Leave uncategorized for now</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Next Step</span>
          <input
            name="nextStep"
            defaultValue={prefill.nextStep}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Desired Outcome</span>
          <textarea
            name="desiredOutcome"
            rows={3}
            defaultValue={prefill.desiredOutcome}
            className="w-full rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Linked Initiative</span>
          <input
            list={`task-initiative-options-${item.id}`}
            value={initiativeQuery}
            onChange={(event) => {
              const value = event.target.value;
              setInitiativeQuery(value);
              const match = initiatives.find((initiative) => initiative.title.toLowerCase() === value.trim().toLowerCase()) ?? null;
              setInitiativeId(match?.id ?? (value.trim() ? initiativeId : null));
              if (!value.trim()) {
                setInitiativeId(null);
              }
            }}
            placeholder="Optional initiative link"
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <p className="text-sm leading-6 text-text-muted md:col-span-2">
          Native source link and associated thread stay attached automatically. This is a compact prefill, not a blind create.
        </p>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button type="submit" className={primaryButtonClass(true)}>
            Save task
          </button>
          <button type="button" onClick={onCancel} className={tertiaryButtonClass()}>
            Cancel
          </button>
        </div>
      </form>
    </OverflowSection>
  );
}

function CommitmentComposer({ item, onCancel, onSubmit }: BasicComposerProps) {
  return (
    <OverflowSection title="Add commitment">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <input type="hidden" name="itemId" value={item.id} />

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Commitment statement</span>
          <input
            name="statement"
            required
            defaultValue={item.commitmentPrefill?.statement ?? item.primaryLine}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Owed to</span>
          <input
            name="owedTo"
            required
            defaultValue={item.commitmentPrefill?.owedTo ?? item.sender}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Timing</span>
          <input
            name="timing"
            defaultValue={item.commitmentPrefill?.dueLabel ?? ""}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Context note</span>
          <textarea
            name="contextNote"
            rows={3}
            defaultValue={item.commitmentPrefill?.contextNote ?? item.summary}
            className="w-full rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button type="submit" className={primaryButtonClass(true)}>
            Save commitment
          </button>
          <button type="button" onClick={onCancel} className={tertiaryButtonClass()}>
            Cancel
          </button>
        </div>
      </form>
    </OverflowSection>
  );
}

function InitiativeComposer({ item, onCancel, onSubmit }: BasicComposerProps) {
  return (
    <OverflowSection title="Create initiative">
      <form className="space-y-4" onSubmit={onSubmit}>
        <input type="hidden" name="itemId" value={item.id} />

        <label className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Initiative name</span>
          <input
            name="name"
            required
            defaultValue={item.initiativePrefill?.name ?? item.threadTitle}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Context note</span>
          <textarea
            name="contextNote"
            rows={3}
            defaultValue={item.initiativePrefill?.contextNote ?? item.summary}
            className="w-full rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Optional first step</span>
          <input
            name="firstStep"
            defaultValue={item.initiativePrefill?.suggestedFirstStep ?? ""}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primaryButtonClass(true)}>
            Save initiative
          </button>
          <button type="button" onClick={onCancel} className={tertiaryButtonClass()}>
            Cancel
          </button>
        </div>
      </form>
    </OverflowSection>
  );
}

type PriorityInboxRowProps = {
  item: LocalPriorityInboxItem;
  categories: TaskCategoryOption[];
  commonCategories: TaskCategoryOption[];
  initiatives: InitiativeOption[];
  now: number;
  isExpanded: boolean;
  isComposerOpen: boolean;
  composerKind: ComposerKind | null;
  pendingTransition: PendingTransition | undefined;
  onToggleExpand: (itemId: string) => void;
  onOpen: (item: LocalPriorityInboxItem) => void;
  onRecommendedAction: (item: LocalPriorityInboxItem) => void;
  onOpenComposer: (itemId: string, kind: ComposerKind) => void;
  onCancelComposer: () => void;
  onTaskSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCommitmentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onInitiativeSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDeferSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSaveReference: (item: LocalPriorityInboxItem) => void;
  onMarkHandled: (item: LocalPriorityInboxItem) => void;
  onDismiss: (item: LocalPriorityInboxItem, reason?: PriorityInboxDispositionReason) => void;
  onPromote: (item: LocalPriorityInboxItem) => void;
  onDemote: (item: LocalPriorityInboxItem) => void;
  onUndoPending: (itemId: string) => void;
  onRestore: (item: LocalPriorityInboxItem) => void;
  onDelete: (item: LocalPriorityInboxItem) => void;
};

function PriorityInboxRow({
  item,
  categories,
  commonCategories,
  initiatives,
  now,
  isExpanded,
  isComposerOpen,
  composerKind,
  pendingTransition,
  onToggleExpand,
  onOpen,
  onRecommendedAction,
  onOpenComposer,
  onCancelComposer,
  onTaskSubmit,
  onCommitmentSubmit,
  onInitiativeSubmit,
  onDeferSubmit,
  onSaveReference,
  onMarkHandled,
  onDismiss,
  onPromote,
  onDemote,
  onUndoPending,
  onRestore,
  onDelete
}: PriorityInboxRowProps) {
  const resolvedState = getResolvedVisibleState(item, now);
  const resurfacedCue = getResurfacedCue(item, now);
  const cueList = [item.attachmentCue, item.groupedCue, item.relationshipCue].filter(Boolean);
  const isHighPriority = resolvedState === "high_priority";
  const isSecondaryState = item.visibleState === "handled" || item.visibleState === "dismissed";
  const openTarget = getPriorityInboxOpenTarget(item);

  if (pendingTransition) {
    return (
      <article className="rounded-[1.35rem] border border-line/75 bg-[rgba(255,255,255,0.68)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-text">{item.threadTitle}</p>
            <p className="mt-1 text-sm text-text-muted">
              {pendingTransition.message} This stays visible briefly so you can undo before it leaves the active layer.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onUndoPending(item.id)} className={primaryButtonClass()}>
              Undo
            </button>
            <span className={subtleChipClass()}>{item.sourceLabel}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "rounded-[1.4rem] border px-4 py-4 transition-colors duration-200 md:px-5",
        isHighPriority ? "refined-b" : "border-line/70 bg-[rgba(255,255,255,0.64)]"
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={subtleChipClass()}>{item.sourceLabel}</span>
              <span className={subtleChipClass()}>{item.timeLabel}</span>
              {resurfacedCue ? <span className={subtleChipClass()}>{resurfacedCue}</span> : null}
              {item.updatedCue ? <span className={subtleChipClass()}>{item.updatedCue}</span> : null}
              {item.sensitiveContext ? <span className={subtleChipClass("sensitive")}>Sensitive context</span> : null}
            </div>

            <p className="mt-3 text-[1.02rem] font-medium leading-6 text-text md:text-[1.08rem]">{item.threadTitle}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line/70 bg-white/72 px-2.5 py-0.5 text-sm font-medium text-text">
                {item.sender}
              </span>
              {item.senderRole ? <span className="text-sm text-text-subtle">{item.senderRole}</span> : null}
            </p>
            <p className="mt-2 max-w-[60rem] text-sm leading-6 text-text-muted">{item.summary}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pl-4">
            {!isSecondaryState ? (
              <>
                {openTarget ? (
                  <button type="button" onClick={() => onOpen(item)} className={primaryButtonClass(isHighPriority)}>
                    {openTarget.label}
                  </button>
                ) : null}
                <button type="button" onClick={() => onRecommendedAction(item)} className={primaryButtonClass()}>
                  {actionLabelForRecommendedAction(item.recommendedAction)}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => onRestore(item)} className={primaryButtonClass()}>
                  Restore
                </button>
                <button type="button" onClick={() => onDelete(item)} className={tertiaryButtonClass()}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {cueList.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {cueList.map((cue) => (
              <span key={cue} className={subtleChipClass()}>
                {cue}
              </span>
            ))}
          </div>
        ) : null}

        {!isSecondaryState && item.openFollowUp ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[1.05rem] border border-line/70 bg-[rgba(255,255,255,0.52)] px-3.5 py-3 text-sm text-text-muted">
            <span>{sourceOpenedMessage(item)}</span>
            <span>·</span>
            <button type="button" onClick={() => onMarkHandled(item)} className="text-text transition hover:text-text-muted">
              Mark handled
            </button>
            <span>·</span>
            <button type="button" onClick={() => onOpenComposer(item.id, "defer")} className="text-text transition hover:text-text-muted">
              Defer
            </button>
          </div>
        ) : null}

        {item.visibleState === "handled" || item.visibleState === "dismissed" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span>{item.dispositionLabel ?? actionSummaryLabel(item.disposition ?? "marked_handled")}</span>
            {item.dispositionReason ? (
              <>
                <span>·</span>
                <span>{titleCaseDispositionReason(item.dispositionReason)}</span>
              </>
            ) : null}
            {item.createdObject ? (
              <>
                <span>·</span>
                <a
                  href={sourceLinkForCreatedObject(item.createdObject)}
                  className="inline-flex items-center gap-1 text-text transition hover:text-text-muted"
                >
                  {item.createdObject.title}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            ) : null}
            {item.sourceMetadata?.localOnly === true ? (
              <>
                <span>·</span>
                <span className={subtleChipClass()}>Local only</span>
              </>
            ) : null}
            {item.lastChangedAt ? (
              <>
                <span>·</span>
                <span>{formatPriorityInboxTimestamp(item.lastChangedAt)}</span>
              </>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onToggleExpand(item.id)}
              className="inline-flex items-center gap-2 text-sm text-text-muted transition hover:text-text"
            >
              Why surfaced
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            <div className="flex flex-wrap gap-2">
              {resolvedState === "needs_review" ? (
                <button type="button" onClick={() => onPromote(item)} className={tertiaryButtonClass()}>
                  Promote
                </button>
              ) : null}
              {resolvedState === "high_priority" ? (
                <button type="button" onClick={() => onDemote(item)} className={tertiaryButtonClass()}>
                  Move to review
                </button>
              ) : null}
            </div>
          </div>
        )}

        {isExpanded && item.visibleState !== "handled" && item.visibleState !== "dismissed" ? (
          <div className="space-y-3 border-t border-line/70 pt-4">
            <OverflowSection title="Why surfaced">
              <p className="text-sm leading-6 text-text">{item.whySurfaced}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.supportingSignals.slice(0, 2).map((signal) => (
                  <span key={signal} className={subtleChipClass()}>
                    {signal}
                  </span>
                ))}
              </div>
            </OverflowSection>

            {item.sensitiveContext ? (
              <OverflowSection title="Sensitive context">
                <p className="text-sm leading-6 text-text-muted">{item.sensitiveContext}</p>
              </OverflowSection>
            ) : null}

            <OverflowSection title="Available actions">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpenComposer(item.id, "defer")} className={tertiaryButtonClass()}>
                  Defer
                </button>
                <button type="button" onClick={() => onOpenComposer(item.id, "task")} className={tertiaryButtonClass()}>
                  Create task
                </button>
                <button type="button" onClick={() => onOpenComposer(item.id, "commitment")} className={tertiaryButtonClass()}>
                  Add commitment
                </button>
                <button type="button" onClick={() => onSaveReference(item)} className={tertiaryButtonClass()}>
                  Save reference
                </button>
                <button type="button" onClick={() => onMarkHandled(item)} className={tertiaryButtonClass()}>
                  Mark handled
                </button>
                <button type="button" onClick={() => onDismiss(item, "not_actionable")} className={tertiaryButtonClass()}>
                  Dismiss
                </button>
              </div>
            </OverflowSection>

            <OverflowSection title="More routing">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onOpenComposer(item.id, "initiative")} className={tertiaryButtonClass()}>
                  Create initiative
                </button>
                <span className="text-sm text-text-muted">Use this only when the item is actually opening a broader workstream.</span>
              </div>
            </OverflowSection>

            <OverflowSection title="Dismiss reason">
              <div className="flex flex-wrap gap-2">
                {DISMISS_REASON_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => onDismiss(item, option.value)} className={tertiaryButtonClass()}>
                    {option.label}
                  </button>
                ))}
              </div>
            </OverflowSection>

            {isComposerOpen && composerKind === "task" ? (
              <TaskComposer
                item={item}
                categories={categories}
                commonCategories={commonCategories}
                initiatives={initiatives}
                onCancel={onCancelComposer}
                onSubmit={onTaskSubmit}
              />
            ) : null}
            {isComposerOpen && composerKind === "commitment" ? (
              <CommitmentComposer item={item} onCancel={onCancelComposer} onSubmit={onCommitmentSubmit} />
            ) : null}
            {isComposerOpen && composerKind === "initiative" ? (
              <InitiativeComposer item={item} onCancel={onCancelComposer} onSubmit={onInitiativeSubmit} />
            ) : null}
            {isComposerOpen && composerKind === "defer" ? <DeferComposer item={item} onCancel={onCancelComposer} onSubmit={onDeferSubmit} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

type SectionProps = {
  title: string;
  summary: string;
  count: number;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  items: LocalPriorityInboxItem[];
  categories: TaskCategoryOption[];
  commonCategories: TaskCategoryOption[];
  initiatives: InitiativeOption[];
  emptyMessage?: string;
  now: number;
  expandedItemId: string | null;
  composerState: ComposerState;
  pendingTransitions: Record<string, PendingTransition>;
  onToggleExpand: (itemId: string) => void;
  onOpen: (item: LocalPriorityInboxItem) => void;
  onRecommendedAction: (item: LocalPriorityInboxItem) => void;
  onOpenComposer: (itemId: string, kind: ComposerKind) => void;
  onCancelComposer: () => void;
  onTaskSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCommitmentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onInitiativeSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDeferSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSaveReference: (item: LocalPriorityInboxItem) => void;
  onMarkHandled: (item: LocalPriorityInboxItem) => void;
  onDismiss: (item: LocalPriorityInboxItem, reason?: PriorityInboxDispositionReason) => void;
  onPromote: (item: LocalPriorityInboxItem) => void;
  onDemote: (item: LocalPriorityInboxItem) => void;
  onUndoPending: (itemId: string) => void;
  onRestore: (item: LocalPriorityInboxItem) => void;
  onDelete: (item: LocalPriorityInboxItem) => void;
};

function PriorityInboxSection({
  title,
  summary,
  count,
  defaultOpen = true,
  open = true,
  onToggle,
  items,
  categories,
  commonCategories,
  initiatives,
  emptyMessage,
  now,
  expandedItemId,
  composerState,
  pendingTransitions,
  onToggleExpand,
  onOpen,
  onRecommendedAction,
  onOpenComposer,
  onCancelComposer,
  onTaskSubmit,
  onCommitmentSubmit,
  onInitiativeSubmit,
  onDeferSubmit,
  onSaveReference,
  onMarkHandled,
  onDismiss,
  onPromote,
  onDemote,
  onUndoPending,
  onRestore,
  onDelete
}: SectionProps) {
  const isOpen = onToggle ? open : defaultOpen;

  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="section-title mt-0">{title}</h2>
            <span className="rounded-full border border-line/75 bg-white/68 px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-text-subtle">
              {count}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-muted">{summary}</p>
        </div>

        {onToggle ? (
          <button type="button" onClick={onToggle} className="inline-flex items-center gap-2 text-sm text-text-muted transition hover:text-text">
            {isOpen ? "Collapse" : "Expand"}
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="mt-5 space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <PriorityInboxRow
                key={item.id}
                item={item}
                categories={categories}
                commonCategories={commonCategories}
                initiatives={initiatives}
                now={now}
                isExpanded={expandedItemId === item.id}
                isComposerOpen={composerState?.itemId === item.id}
                composerKind={composerState?.itemId === item.id ? composerState.kind : null}
                pendingTransition={pendingTransitions[item.id]}
                onToggleExpand={onToggleExpand}
                onOpen={onOpen}
                onRecommendedAction={onRecommendedAction}
                onOpenComposer={onOpenComposer}
                onCancelComposer={onCancelComposer}
                onTaskSubmit={onTaskSubmit}
                onCommitmentSubmit={onCommitmentSubmit}
                onInitiativeSubmit={onInitiativeSubmit}
                onDeferSubmit={onDeferSubmit}
                onSaveReference={onSaveReference}
                onMarkHandled={onMarkHandled}
                onDismiss={onDismiss}
                onPromote={onPromote}
                onDemote={onDemote}
                onUndoPending={onUndoPending}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))
          ) : emptyMessage ? (
            <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] px-4 py-5 text-sm leading-6 text-text-muted">
              {emptyMessage}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-[1.3rem] border border-line/70 bg-[rgba(255,255,255,0.5)] px-4 py-4 text-sm leading-6 text-text-muted">
          {count === 0 ? "Nothing is currently held here." : `${count} item${count === 1 ? "" : "s"} kept in the background.`}
        </div>
      )}
    </section>
  );
}

export function PriorityInboxWorkspace({
  initialItems,
  categories,
  commonCategories,
  initiatives
}: {
  initialItems: PriorityInboxItem[];
  categories: TaskCategoryOption[];
  commonCategories: TaskCategoryOption[];
  initiatives: InitiativeOption[];
}) {
  const [items, setItems] = useState<LocalPriorityInboxItem[]>(() => createLocalItems(initialItems));
  const [sourceFilter, setSourceFilter] = useState<PriorityInboxSourceFilter>("all");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [composerState, setComposerState] = useState<ComposerState>(null);
  const [deferredOpen, setDeferredOpen] = useState(false);
  const [handledOpen, setHandledOpen] = useState(false);
  const [dismissedOpen, setDismissedOpen] = useState(false);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pendingTransitions, setPendingTransitions] = useState<Record<string, PendingTransition>>({});
  const [, startMutation] = useTransition();

  const flashTimeoutRef = useRef<number | null>(null);
  const pendingTimeoutsRef = useRef<Record<string, number>>({});
  const transitionMutationTokenRef = useRef(0);
  const latestTransitionTokenByItemRef = useRef<Record<string, number>>({});
  const ignoredTransitionSyncRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setItems(createLocalItems(initialItems));
  }, [initialItems]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }

      Object.values(pendingTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  function findItem(itemId: string) {
    return items.find((item) => item.id === itemId);
  }

  function setFlashMessage(nextFlash: FlashState | null) {
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }

    setFlash(nextFlash);

    if (nextFlash) {
      flashTimeoutRef.current = window.setTimeout(() => {
        setFlash(null);
        flashTimeoutRef.current = null;
      }, FLASH_MS);
    }
  }

  function replaceItem(itemId: string, nextItem: LocalPriorityInboxItem) {
    setItems((current) => current.map((item) => (item.id === itemId ? nextItem : item)));
  }

  function closeComposerIfNeeded(itemId: string) {
    if (composerState?.itemId === itemId) {
      setComposerState(null);
    }
  }

  function applyTransition(itemId: string, snapshot: LocalPriorityInboxItem, payload: TransitionPayload, shouldFlash = true) {
    const nextItem: LocalPriorityInboxItem = {
      ...snapshot,
      openFollowUp: false,
      visibleState: payload.nextState,
      priorVisibleState: preservePriorActiveState(snapshot, now),
      deferredUntil: payload.nextState === "deferred" ? payload.deferredUntil ?? null : null,
      deferredLabel: payload.nextState === "deferred" ? payload.deferredLabel ?? null : null,
      deferredReason: payload.nextState === "deferred" ? payload.deferredReason ?? null : null,
      disposition: payload.disposition,
      dispositionLabel: payload.dispositionLabel,
      dispositionReason: payload.dispositionReason ?? null,
      createdObject: payload.createdObject ?? null,
      timeLabel: timeLabelForState(payload.nextState, payload.deferredLabel),
      lastChangedAt: new Date().toISOString()
    };

    replaceItem(itemId, nextItem);
    closeComposerIfNeeded(itemId);
    setExpandedItemId((current) => (current === itemId ? null : current));

    if (shouldFlash) {
      setFlashMessage({
        itemId,
        message: payload.message,
        snapshot
      });
    }
  }

  function showErrorMessage(message: string) {
    setFlashMessage({
      message
    });
  }

  function syncServerItem(serverItem: PriorityInboxItem, options?: { preserveOpenFollowUp?: boolean }) {
    replaceItem(serverItem.id, {
      ...serverItem,
      openFollowUp: options?.preserveOpenFollowUp ? findItem(serverItem.id)?.openFollowUp ?? false : false
    });
  }

  function persistTransition(
    snapshot: LocalPriorityInboxItem,
    payload: PriorityInboxTransitionPayload,
    allowSessionLocalUndo = false
  ) {
    const mutationToken = allowSessionLocalUndo ? ++transitionMutationTokenRef.current : null;
    if (mutationToken) {
      latestTransitionTokenByItemRef.current[snapshot.id] = mutationToken;
    }
    startMutation(async () => {
      const result = await transitionPriorityInboxItemAction(snapshot.id, payload);
      if (!result.ok) {
        replaceItem(snapshot.id, snapshot);
        showErrorMessage(result.error);
        return;
      }

      if (mutationToken && ignoredTransitionSyncRef.current[snapshot.id] === mutationToken) {
        return;
      }

      syncServerItem(result.item);
    });
  }

  function persistPromote(snapshot: LocalPriorityInboxItem) {
    startMutation(async () => {
      const result = await promotePriorityInboxItemAction(snapshot.id);
      if (!result.ok) {
        replaceItem(snapshot.id, snapshot);
        showErrorMessage(result.error);
        return;
      }

      syncServerItem(result.item);
    });
  }

  function persistDemote(snapshot: LocalPriorityInboxItem) {
    startMutation(async () => {
      const result = await demotePriorityInboxItemAction(snapshot.id);
      if (!result.ok) {
        replaceItem(snapshot.id, snapshot);
        showErrorMessage(result.error);
        return;
      }

      syncServerItem(result.item);
    });
  }

  function persistRestore(snapshot: LocalPriorityInboxItem) {
    startMutation(async () => {
      const result = await restorePriorityInboxItemAction(snapshot.id);
      if (!result.ok) {
        replaceItem(snapshot.id, snapshot);
        showErrorMessage(result.error);
        return;
      }

      syncServerItem(result.item);
    });
  }

  function handleDelete(item: LocalPriorityInboxItem) {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    startMutation(async () => {
      const result = await deletePriorityInboxItemAction(item.id);
      if (!result.ok) {
        setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
        showErrorMessage(result.error);
      }
    });
  }

  function queueHighPriorityTransition(itemId: string, snapshot: LocalPriorityInboxItem, payload: TransitionPayload) {
    if (pendingTimeoutsRef.current[itemId]) {
      window.clearTimeout(pendingTimeoutsRef.current[itemId]);
    }

    const queuedPayload: TransitionPayload = {
      ...payload,
      confirmationExpiresAt: buildHighPriorityConfirmationDeadline()
    };

    const flushPendingTransition = () => {
      const remainingMs = Date.parse(queuedPayload.confirmationExpiresAt ?? "") - Date.now();

      if (remainingMs > 20) {
        pendingTimeoutsRef.current[itemId] = window.setTimeout(flushPendingTransition, remainingMs);
        return;
      }

      setPendingTransitions((current) => {
        const nextTransitions = { ...current };
        delete nextTransitions[itemId];
        return nextTransitions;
      });

      delete pendingTimeoutsRef.current[itemId];
      applyTransition(itemId, snapshot, queuedPayload, false);
      persistTransition(snapshot, queuedPayload, false);
    };

    pendingTimeoutsRef.current[itemId] = window.setTimeout(flushPendingTransition, HIGH_PRIORITY_CONFIRMATION_MS);

    setPendingTransitions((current) => ({
      ...current,
      [itemId]: {
        message: queuedPayload.message,
        next: queuedPayload,
        snapshot
      }
    }));

    closeComposerIfNeeded(itemId);
    setExpandedItemId((current) => (current === itemId ? null : current));
  }

  function transitionItem(item: LocalPriorityInboxItem, payload: TransitionPayload) {
    const resolvedState = getResolvedVisibleState(item, now);

    if (resolvedState === "high_priority") {
      queueHighPriorityTransition(item.id, item, payload);
      return;
    }

    applyTransition(item.id, item, payload, true);
    persistTransition(item, payload, true);
  }

  function handleOpen(item: LocalPriorityInboxItem) {
    const openTarget = getPriorityInboxOpenTarget(item);
    if (!openTarget) {
      return;
    }

    window.open(openTarget.href, "_blank", "noopener,noreferrer");

    setItems((current) =>
      current.map((entry) => ({
        ...entry,
        openFollowUp: entry.id === item.id
      }))
    );

    startMutation(async () => {
      const result = await openPriorityInboxSourceAction(item.id);
      if (!result.ok) {
        showErrorMessage(result.error);
      }
    });
  }

  function handleRecommendedAction(item: LocalPriorityInboxItem) {
    switch (item.recommendedAction) {
      case "create_task":
        setExpandedItemId(item.id);
        setComposerState({ kind: "task", itemId: item.id });
        return;
      case "add_commitment":
        setExpandedItemId(item.id);
        setComposerState({ kind: "commitment", itemId: item.id });
        return;
      case "save_reference":
        handleSaveReference(item);
        return;
      case "mark_handled":
        handleMarkHandled(item);
        return;
      case "defer":
        setExpandedItemId(item.id);
        setComposerState({ kind: "defer", itemId: item.id });
        return;
      default:
        return;
    }
  }

  function handleMarkHandled(item: LocalPriorityInboxItem) {
    transitionItem(item, {
      nextState: "handled",
      disposition: "marked_handled",
      dispositionLabel: "Marked handled",
      message: "Marked handled."
    });
  }

  function handleSaveReference(item: LocalPriorityInboxItem) {
    transitionItem(item, {
      nextState: "handled",
      disposition: "reference_saved",
      dispositionLabel: "Saved reference",
      createdObject: {
        type: "reference",
        title: item.referencePrefill?.title ?? item.threadTitle,
        href: "/library"
      },
      canonicalReference: {
        title: item.referencePrefill?.title ?? item.threadTitle,
        summary: item.referencePrefill?.summary ?? item.summary
      },
      message: "Saved as reference."
    });
  }

  function handleDismiss(item: LocalPriorityInboxItem, reason: PriorityInboxDispositionReason = "not_actionable") {
    transitionItem(item, {
      nextState: "dismissed",
      disposition: "dismissed",
      dispositionLabel: "Dismissed",
      dispositionReason: reason,
      message: "Dismissed."
    });
  }

  function handlePromote(item: LocalPriorityInboxItem) {
    replaceItem(item.id, {
      ...item,
      visibleState: "high_priority",
      priorVisibleState: "high_priority",
      deferredUntil: null,
      deferredLabel: null,
      deferredReason: null,
      timeLabel: "Updated just now",
      updatedCue: "Promoted"
    });
    persistPromote(item);
  }

  function handleDemote(item: LocalPriorityInboxItem) {
    replaceItem(item.id, {
      ...item,
      visibleState: "needs_review",
      priorVisibleState: "needs_review",
      timeLabel: "Updated just now",
      updatedCue: "Moved to review"
    });
    persistDemote(item);
  }

  function handleRestore(item: LocalPriorityInboxItem) {
    replaceItem(item.id, {
      ...item,
      visibleState: item.priorVisibleState ?? "needs_review",
      updatedCue: "Restored",
      timeLabel: "Restored just now",
      lastChangedAt: new Date().toISOString()
    });
    persistRestore(item);
  }

  function handleUndoPending(itemId: string) {
    if (pendingTimeoutsRef.current[itemId]) {
      window.clearTimeout(pendingTimeoutsRef.current[itemId]);
      delete pendingTimeoutsRef.current[itemId];
    }

    setPendingTransitions((current) => {
      const nextTransitions = { ...current };
      delete nextTransitions[itemId];
      return nextTransitions;
    });
  }

  function handleUndoFlash() {
    if (!flash?.snapshot || !flash.itemId) {
      return;
    }

    const activeMutationToken = latestTransitionTokenByItemRef.current[flash.itemId];
    if (activeMutationToken) {
      ignoredTransitionSyncRef.current[flash.itemId] = activeMutationToken;
    }

    replaceItem(flash.itemId, flash.snapshot);
    setFlashMessage(null);
  }

  function handleToggleExpand(itemId: string) {
    setExpandedItemId((current) => (current === itemId ? null : itemId));
    setComposerState((current) => (current?.itemId === itemId ? current : null));
  }

  function handleOpenComposer(itemId: string, kind: ComposerKind) {
    setExpandedItemId(itemId);
    setComposerState({ kind, itemId });
  }

  function parseRequiredItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const itemId = `${formData.get("itemId") ?? ""}`;
    const item = findItem(itemId);

    if (!item) {
      return null;
    }

    return { formData, item };
  }

  function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = parseRequiredItem(event);
    if (!parsed) {
      return;
    }

    const description = `${parsed.formData.get("description") ?? ""}`.trim();

    transitionItem(parsed.item, {
      nextState: "handled",
      disposition: "task_created",
      dispositionLabel: "Task created",
      createdObject: {
        type: "task",
        title: description || parsed.item.taskPrefill?.description || parsed.item.primaryLine,
        href: "/library/tasks"
      },
      canonicalTask: {
        description: description || parsed.item.taskPrefill?.description || parsed.item.primaryLine,
        nextStep: `${parsed.formData.get("nextStep") ?? ""}`.trim() || null,
        desiredOutcome: `${parsed.formData.get("desiredOutcome") ?? ""}`.trim() || null,
        priority: (() => {
          const value = `${parsed.formData.get("priority") ?? ""}`.trim();
          return value === "high" || value === "medium" || value === "low" ? value : null;
        })(),
        categoryId: `${parsed.formData.get("categoryId") ?? ""}`.trim() || null,
        linkedInitiativeId: `${parsed.formData.get("linkedInitiativeId") ?? ""}`.trim() || null
      },
      message: "Task created."
    });
  }

  function handleCommitmentSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = parseRequiredItem(event);
    if (!parsed) {
      return;
    }

    const statement = `${parsed.formData.get("statement") ?? ""}`.trim();

    transitionItem(parsed.item, {
      nextState: "handled",
      disposition: "commitment_created",
      dispositionLabel: "Commitment created",
      createdObject: {
        type: "commitment",
        title: statement || parsed.item.commitmentPrefill?.statement || parsed.item.primaryLine,
        href: "/commitments"
      },
      canonicalCommitment: {
        statement: statement || parsed.item.commitmentPrefill?.statement || parsed.item.primaryLine,
        owedTo: `${parsed.formData.get("owedTo") ?? ""}`.trim() || parsed.item.sender,
        dueLabel: `${parsed.formData.get("timing") ?? ""}`.trim() || parsed.item.commitmentPrefill?.dueLabel || null,
        contextNote: `${parsed.formData.get("contextNote") ?? ""}`.trim() || parsed.item.summary
      },
      message: "Added to commitments."
    });
  }

  function handleInitiativeSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = parseRequiredItem(event);
    if (!parsed) {
      return;
    }

    const name = `${parsed.formData.get("name") ?? ""}`.trim();

    transitionItem(parsed.item, {
      nextState: "handled",
      disposition: "initiative_created",
      dispositionLabel: "Initiative created",
      createdObject: {
        type: "initiative",
        title: name || parsed.item.initiativePrefill?.name || parsed.item.threadTitle,
        href: "/initiatives"
      },
      message: "Initiative created."
    });
  }

  function handleDeferSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = parseRequiredItem(event);
    if (!parsed) {
      return;
    }

    const preset = `${parsed.formData.get("preset") ?? ""}`;
    const presetDate = `${parsed.formData.get("presetDate") ?? ""}`;
    const customDate = `${parsed.formData.get("customDate") ?? ""}`;
    const reason = `${parsed.formData.get("reason") ?? "not_now"}` as PriorityInboxDeferredReason;
    const deferredUntil = customDate || presetDate;
    const dateValue = deferredUntil ? new Date(deferredUntil) : null;
    const deferredLabel =
      preset === "later_today" ? "later today" : preset === "tomorrow" ? "tomorrow" : preset === "next_week" ? "next week" : dateValue ? formatPriorityInboxTimestamp(dateValue.toISOString()) : "later";

    transitionItem(parsed.item, {
      nextState: "deferred",
      disposition: "deferred",
      dispositionLabel: "Deferred",
      deferredUntil: deferredUntil || null,
      deferredLabel,
      deferredReason: reason,
      message: `Deferred until ${deferredLabel}.`
    });
  }

  const filteredItems = items.filter((item) => matchesPriorityInboxSourceFilter(item, sourceFilter));

  const highPriorityItems = filteredItems.filter((item) => getResolvedVisibleState(item, now) === "high_priority");
  const needsReviewItems = filteredItems.filter((item) => getResolvedVisibleState(item, now) === "needs_review");
  const deferredItems = filteredItems.filter((item) => item.visibleState === "deferred" && !isDeferredDue(item, now));
  const handledItems = filteredItems.filter((item) => item.visibleState === "handled");
  const dismissedItems = filteredItems.filter((item) => item.visibleState === "dismissed");
  const deferredDueCount = filteredItems.filter((item) => isDeferredDue(item, now)).length;
  const activeItemCount = highPriorityItems.length + needsReviewItems.length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-[1.85rem] border border-line/75 bg-white/74 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Priority Inbox</p>
            <h1 className="page-title mt-2">Inbound items requiring action, follow-up, or routing.</h1>
            <p className="mt-3 text-sm font-medium text-text-muted">
              {highPriorityItems.length} High Priority · {needsReviewItems.length} Needs Review · {deferredDueCount} Deferred due
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {SOURCE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSourceFilter(filter.id)}
                className={topButtonClass(sourceFilter === filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-line/60 pt-4">
          <PriorityInboxDigestBar items={items} sourceFilter={sourceFilter} now={now} />
        </div>
      </section>

      {flash ? (
        <section className="rounded-[1.35rem] border border-line/75 bg-white/70 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-text-muted">{flash.message}</p>
            {flash.snapshot && flash.itemId ? (
              <button type="button" onClick={handleUndoFlash} className={primaryButtonClass()}>
                Undo
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeItemCount > 0 ? (
        <div className="space-y-4 lg:space-y-5">
          <PriorityInboxSection
            title="High Priority"
            summary="Items likely requiring action, decision, escalation, or meaningful accountability now."
            count={highPriorityItems.length}
            items={highPriorityItems}
            categories={categories}
            commonCategories={commonCategories}
            initiatives={initiatives}
            emptyMessage="Nothing is currently elevated into the high-priority layer."
            now={now}
            expandedItemId={expandedItemId}
            composerState={composerState}
            pendingTransitions={pendingTransitions}
            onToggleExpand={handleToggleExpand}
            onOpen={handleOpen}
            onRecommendedAction={handleRecommendedAction}
            onOpenComposer={handleOpenComposer}
            onCancelComposer={() => setComposerState(null)}
            onTaskSubmit={handleTaskSubmit}
            onCommitmentSubmit={handleCommitmentSubmit}
            onInitiativeSubmit={handleInitiativeSubmit}
            onDeferSubmit={handleDeferSubmit}
            onSaveReference={handleSaveReference}
            onMarkHandled={handleMarkHandled}
            onDismiss={handleDismiss}
            onPromote={handlePromote}
            onDemote={handleDemote}
            onUndoPending={handleUndoPending}
            onRestore={handleRestore}
            onDelete={handleDelete}
          />

          <PriorityInboxSection
            title="Needs Review"
            summary="Items that may matter but still need your judgment before they earn stronger routing or closure."
            count={needsReviewItems.length}
            items={needsReviewItems}
            categories={categories}
            commonCategories={commonCategories}
            initiatives={initiatives}
            emptyMessage="Nothing is currently waiting in the review layer."
            now={now}
            expandedItemId={expandedItemId}
            composerState={composerState}
            pendingTransitions={pendingTransitions}
            onToggleExpand={handleToggleExpand}
            onOpen={handleOpen}
            onRecommendedAction={handleRecommendedAction}
            onOpenComposer={handleOpenComposer}
            onCancelComposer={() => setComposerState(null)}
            onTaskSubmit={handleTaskSubmit}
            onCommitmentSubmit={handleCommitmentSubmit}
            onInitiativeSubmit={handleInitiativeSubmit}
            onDeferSubmit={handleDeferSubmit}
            onSaveReference={handleSaveReference}
            onMarkHandled={handleMarkHandled}
            onDismiss={handleDismiss}
            onPromote={handlePromote}
            onDemote={handleDemote}
            onUndoPending={handleUndoPending}
            onRestore={handleRestore}
            onDelete={handleDelete}
          />
        </div>
      ) : deferredItems.length > 0 ? (
        <section className="rounded-[1.75rem] border border-line/75 bg-white/68 px-5 py-10 text-center">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Priority Inbox</p>
          <p className="mt-3 text-[1.02rem] font-medium text-text">Nothing active needs review.</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">Deferred items will return when they&apos;re due.</p>
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-line/75 bg-white/68 px-5 py-10 text-center">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Priority Inbox</p>
          <p className="mt-3 text-[1.02rem] font-medium text-text">No priority items right now.</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Priority Inbox will surface inbound items when they likely need action, follow-up, or routing.
          </p>
        </section>
      )}

      <PriorityInboxSection
        title="Deferred"
        summary="Items that still matter, but should stay out of the active layer until their return time is met."
        count={deferredItems.length}
        open={deferredOpen}
        onToggle={() => setDeferredOpen((current) => !current)}
        items={deferredItems}
        categories={categories}
        commonCategories={commonCategories}
        initiatives={initiatives}
        emptyMessage="No items are currently waiting in deferred."
        now={now}
        expandedItemId={expandedItemId}
        composerState={composerState}
        pendingTransitions={pendingTransitions}
        onToggleExpand={handleToggleExpand}
        onOpen={handleOpen}
        onRecommendedAction={handleRecommendedAction}
        onOpenComposer={handleOpenComposer}
        onCancelComposer={() => setComposerState(null)}
        onTaskSubmit={handleTaskSubmit}
        onCommitmentSubmit={handleCommitmentSubmit}
        onInitiativeSubmit={handleInitiativeSubmit}
        onDeferSubmit={handleDeferSubmit}
        onSaveReference={handleSaveReference}
        onMarkHandled={handleMarkHandled}
        onDismiss={handleDismiss}
        onPromote={handlePromote}
        onDemote={handleDemote}
        onUndoPending={handleUndoPending}
        onRestore={handleRestore}
            onDelete={handleDelete}
      />

      <PriorityInboxSection
        title="Handled"
        summary="Validly surfaced items that were routed, saved, or otherwise resolved without needing to stay active."
        count={handledItems.length}
        open={handledOpen}
        onToggle={() => setHandledOpen((current) => !current)}
        items={handledItems}
        categories={categories}
        commonCategories={commonCategories}
        initiatives={initiatives}
        emptyMessage="No handled items are currently retained."
        now={now}
        expandedItemId={expandedItemId}
        composerState={composerState}
        pendingTransitions={pendingTransitions}
        onToggleExpand={handleToggleExpand}
        onOpen={handleOpen}
        onRecommendedAction={handleRecommendedAction}
        onOpenComposer={handleOpenComposer}
        onCancelComposer={() => setComposerState(null)}
        onTaskSubmit={handleTaskSubmit}
        onCommitmentSubmit={handleCommitmentSubmit}
        onInitiativeSubmit={handleInitiativeSubmit}
        onDeferSubmit={handleDeferSubmit}
        onSaveReference={handleSaveReference}
        onMarkHandled={handleMarkHandled}
        onDismiss={handleDismiss}
        onPromote={handlePromote}
        onDemote={handleDemote}
        onUndoPending={handleUndoPending}
        onRestore={handleRestore}
            onDelete={handleDelete}
      />

      <PriorityInboxSection
        title="Dismissed"
        summary="Items that should not have been surfaced or are not worth continued attention."
        count={dismissedItems.length}
        open={dismissedOpen}
        onToggle={() => setDismissedOpen((current) => !current)}
        items={dismissedItems}
        categories={categories}
        commonCategories={commonCategories}
        initiatives={initiatives}
        emptyMessage="No dismissed items are currently retained."
        now={now}
        expandedItemId={expandedItemId}
        composerState={composerState}
        pendingTransitions={pendingTransitions}
        onToggleExpand={handleToggleExpand}
        onOpen={handleOpen}
        onRecommendedAction={handleRecommendedAction}
        onOpenComposer={handleOpenComposer}
        onCancelComposer={() => setComposerState(null)}
        onTaskSubmit={handleTaskSubmit}
        onCommitmentSubmit={handleCommitmentSubmit}
        onInitiativeSubmit={handleInitiativeSubmit}
        onDeferSubmit={handleDeferSubmit}
        onSaveReference={handleSaveReference}
        onMarkHandled={handleMarkHandled}
        onDismiss={handleDismiss}
        onPromote={handlePromote}
        onDemote={handleDemote}
        onUndoPending={handleUndoPending}
        onRestore={handleRestore}
            onDelete={handleDelete}
      />

    </div>
  );
}
