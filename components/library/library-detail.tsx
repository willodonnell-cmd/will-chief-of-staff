import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  appendUpdateAction,
  archiveLibraryItemAction,
  completeTaskAction,
  createTaskFromNoteAction,
  deleteLibraryItemAction,
  reopenTaskAction,
  unarchiveLibraryItemAction,
  updateExecutiveDetailsAction,
  updateTaskDetailsAction,
  updateWorkingContentAction
} from "@/app/library/actions";
import { formatTaskPriorityLabel, type InitiativeOption, type TaskCategoryOption } from "@/lib/blackhawk-capture-model";
import type { LibraryItemDetail } from "@/lib/capture-library";
import { resolveLibraryItemEditorMode } from "@/lib/library-executive-edit";
import { cn } from "@/lib/utils";

import { SaveStateIndicator } from "./save-state-indicator";

type LibraryDetailProps = {
  item: LibraryItemDetail;
  backHref: string;
  backLabel: string;
  redirectTo: string;
  returnTo: string;
  notice?: string;
  error?: string;
  categories: TaskCategoryOption[];
  initiatives: InitiativeOption[];
};

function sanitizeFlashMessage(message: string | undefined) {
  if (!message) {
    return null;
  }

  const lookup: Record<string, string> = {
    "working-saved": "Note saved.",
    "task-details-saved": "Task saved.",
    "executive-details-saved": "Executive detail saved.",
    "update-added": "Update appended.",
    "item-archived": "Item archived.",
    "item-unarchived": "Item restored to the active library.",
    "task-completed": "Task marked complete.",
    "task-reopened": "Task reopened.",
    "item-deleted": "Item deleted from the library.",
    "task-created-from-note": "Task created from note."
  };

  return lookup[message] ?? message;
}

function formatTimestamp(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options
  }).format(date);
}

function formatDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function metadataRows(item: LibraryItemDetail) {
  const rows = [
    { label: "Type", value: item.type === "task" ? "Task" : "Note" },
    { label: "Capture", value: item.captureTypeLabel },
    { label: "Status", value: item.type === "task" && item.status === "completed" ? "Completed" : item.status === "archived" ? "Archived" : "Active" },
    { label: "Captured", value: formatTimestamp(item.capturedAt) },
    { label: "Last active", value: formatTimestamp(item.lastActiveAt) }
  ];

  const priority = item.priority ?? item.task?.priority ?? null;
  if (priority) {
    rows.push({ label: "Priority", value: formatTaskPriorityLabel(priority) });
  }

  const categoryName = item.categoryName ?? item.task?.categoryName ?? null;
  const categoryIsFallback = item.categoryIsFallback ?? item.task?.categoryIsFallback ?? false;
  if (categoryName) {
    rows.push({
      label: "Category",
      value: categoryIsFallback ? `Needs Categorization · ${categoryName}` : categoryName
    });
  }

  const linkedInitiativeTitle = item.linkedInitiativeTitle ?? item.task?.linkedInitiativeTitle ?? item.note?.linkedInitiativeTitle ?? null;
  if (linkedInitiativeTitle) {
    rows.push({ label: "Linked initiative", value: linkedInitiativeTitle });
  }

  const dueAt = item.task?.dueAt ?? item.dueAt ?? null;
  if (dueAt) {
    rows.push({ label: "Due", value: formatTimestamp(dueAt) });
  }

  if (item.archivedAt) {
    rows.push({ label: "Archived", value: formatTimestamp(item.archivedAt) });
  }

  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
}

function provenanceRows(item: LibraryItemDetail) {
  const rows = [];

  if (item.originCapture) {
    rows.push({
      label: "Created from",
      value: item.originCapture.title,
      href: `/library/${item.originCapture.id}?from=%2Flibrary`
    });
  }

  if (item.sourceLinkage) {
    rows.push({
      label: "Source",
      value: item.sourceLinkage.sourceLabel ?? item.sourceLinkage.source,
      href:
        item.sourceLinkage.nativeSourceLink ??
        item.sourceLinkage.forwardedEmailSource?.nativeSourceLink ??
        item.sourceLinkage.fallbackDetailHref ??
        null
    });
  }

  if (item.sourceLinkage?.threadTitle) {
    rows.push({
      label: "Thread",
      value: item.sourceLinkage.threadTitle,
      href: null
    });
  }

  if (item.sourceLinkage?.sender) {
    rows.push({
      label: "Sender",
      value: item.sourceLinkage.senderRole ? `${item.sourceLinkage.sender} · ${item.sourceLinkage.senderRole}` : item.sourceLinkage.sender,
      href: null
    });
  }

  return rows;
}

function DetailActions({ item, redirectTo, returnTo, isLocalOnly }: { item: LibraryItemDetail; redirectTo: string; returnTo: string; isLocalOnly: boolean }) {
  if (isLocalOnly) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {item.type === "task" && item.status !== "completed" ? (
        <form action={completeTaskAction}>
          <input type="hidden" name="captureId" value={item.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" className="rounded-full border border-line/75 bg-white/82 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
            Mark complete
          </button>
        </form>
      ) : null}

      {item.type === "task" && item.status === "completed" ? (
        <form action={reopenTaskAction}>
          <input type="hidden" name="captureId" value={item.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" className="rounded-full border border-line/75 bg-white/82 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
            Reopen
          </button>
        </form>
      ) : null}

      {item.status === "archived" ? (
        <form action={unarchiveLibraryItemAction}>
          <input type="hidden" name="captureId" value={item.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" className="rounded-full border border-line/75 bg-white/82 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
            Restore
          </button>
        </form>
      ) : (
        <form action={archiveLibraryItemAction}>
          <input type="hidden" name="captureId" value={item.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" className="rounded-full border border-line/75 bg-white/82 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
            Archive
          </button>
        </form>
      )}

      <form action={deleteLibraryItemAction}>
        <input type="hidden" name="captureId" value={item.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className="rounded-full border border-line/75 bg-white/82 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
          Delete
        </button>
      </form>
    </div>
  );
}

function fieldValue(value: string | null | undefined) {
  return value ?? "";
}

function linkedInitiativeValue(item: LibraryItemDetail) {
  return item.linkedInitiativeId ?? item.note?.linkedInitiativeId ?? item.task?.linkedInitiativeId ?? "";
}

function priorityValue(item: LibraryItemDetail) {
  return item.priority ?? item.task?.priority ?? "";
}

function categoryValue(item: LibraryItemDetail) {
  return item.categoryId ?? item.task?.categoryId ?? "";
}

function dueAtValue(item: LibraryItemDetail) {
  return formatDateTimeLocal(item.task?.dueAt ?? item.dueAt ?? null);
}

function ExecutivePrioritySelect({ item }: { item: LibraryItemDetail }) {
  return (
    <label className="space-y-2 text-sm text-text-muted">
      <span className="section-label">Priority</span>
      <select
        name="priority"
        defaultValue={priorityValue(item)}
        className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
      >
        <option value="">No priority</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
  );
}

function InitiativeSelect({ item, initiatives }: { item: LibraryItemDetail; initiatives: InitiativeOption[] }) {
  return (
    <label className="space-y-2 text-sm text-text-muted">
      <span className="section-label">Linked Initiative</span>
      <select
        name="linkedInitiativeId"
        defaultValue={linkedInitiativeValue(item)}
        className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
      >
        <option value="">No linked initiative</option>
        {initiatives.map((initiative) => (
          <option key={initiative.id} value={initiative.id}>
            {initiative.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExecutiveEditorFrame({
  item,
  redirectTo,
  mode,
  title,
  description,
  children
}: {
  item: LibraryItemDetail;
  redirectTo: string;
  mode: "decision" | "opportunity" | "waiting_on" | "meeting_note";
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <form action={updateExecutiveDetailsAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
      <input type="hidden" name="captureId" value={item.id} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="mode" value={mode} />

      <div>
        <p className="section-label">{title}</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
      </div>

      <div className="mt-4">{children}</div>
    </form>
  );
}

function DecisionEditor({
  item,
  redirectTo,
  initiatives
}: {
  item: LibraryItemDetail;
  redirectTo: string;
  initiatives: InitiativeOption[];
}) {
  const metadata = item.captureMetadata;

  return (
    <ExecutiveEditorFrame
      item={item}
      redirectTo={redirectTo}
      mode="decision"
      title="Decision detail"
      description="Keep the decision question, recommendation, tradeoffs, and risk context structured without turning it into a generic task."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Decision Question</span>
          <input
            name="decisionQuestion"
            required
            defaultValue={fieldValue(metadata?.decisionQuestion ?? item.note?.title)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <ExecutivePrioritySelect item={item} />

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Deadline</span>
          <input
            name="dueAt"
            type="datetime-local"
            defaultValue={formatDateTimeLocal(item.dueAt ?? metadata?.deadline ?? null)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Recommendation</span>
          <textarea
            name="recommendation"
            rows={3}
            defaultValue={fieldValue(metadata?.recommendation)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Options / Tradeoffs</span>
          <textarea
            name="optionsTradeoffs"
            rows={4}
            defaultValue={fieldValue(metadata?.optionsTradeoffs)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Risks</span>
          <textarea
            name="risks"
            rows={3}
            defaultValue={fieldValue(metadata?.risks)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Status</span>
          <input
            name="metadataStatus"
            defaultValue={fieldValue(metadata?.status)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">People Involved</span>
          <input
            name="peopleInvolved"
            defaultValue={fieldValue(metadata?.peopleInvolved)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <InitiativeSelect item={item} initiatives={initiatives} />

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Working Notes</span>
          <textarea
            name="body"
            rows={6}
            defaultValue={fieldValue(item.note?.body)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
          Save decision
        </button>
      </div>
    </ExecutiveEditorFrame>
  );
}

function OpportunityEditor({
  item,
  redirectTo,
  initiatives
}: {
  item: LibraryItemDetail;
  redirectTo: string;
  initiatives: InitiativeOption[];
}) {
  const metadata = item.captureMetadata;

  return (
    <ExecutiveEditorFrame
      item={item}
      redirectTo={redirectTo}
      mode="opportunity"
      title="Opportunity detail"
      description="Track why the opportunity matters, who owns it, and what needs to happen next without collapsing it into a generic note."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Company / Counterparty</span>
          <input
            name="companyOrCounterparty"
            defaultValue={fieldValue(metadata?.companyOrCounterparty)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <ExecutivePrioritySelect item={item} />

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Title</span>
          <input
            name="title"
            required
            defaultValue={fieldValue(item.note?.title)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Why It Matters</span>
          <textarea
            name="strategicRelevance"
            rows={3}
            defaultValue={fieldValue(metadata?.strategicRelevance)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Next Action</span>
          <input
            name="nextAction"
            defaultValue={fieldValue(metadata?.nextAction)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Owner</span>
          <input
            name="owner"
            defaultValue={fieldValue(metadata?.owner)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Status</span>
          <input
            name="metadataStatus"
            defaultValue={fieldValue(metadata?.status)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Related Person</span>
          <input
            name="relatedPerson"
            defaultValue={fieldValue(metadata?.relatedPerson)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Related Company</span>
          <input
            name="relatedCompany"
            defaultValue={fieldValue(metadata?.relatedCompany)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <InitiativeSelect item={item} initiatives={initiatives} />

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Working Notes</span>
          <textarea
            name="body"
            rows={6}
            defaultValue={fieldValue(item.note?.body)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
          Save opportunity
        </button>
      </div>
    </ExecutiveEditorFrame>
  );
}

function WaitingOnEditor({
  item,
  redirectTo,
  categories,
  initiatives
}: {
  item: LibraryItemDetail;
  redirectTo: string;
  categories: TaskCategoryOption[];
  initiatives: InitiativeOption[];
}) {
  const metadata = item.captureMetadata;

  return (
    <ExecutiveEditorFrame
      item={item}
      redirectTo={redirectTo}
      mode="waiting_on"
      title="Waiting-on detail"
      description="Keep the follow-up mechanics operational while preserving who is on the hook, what outcome is expected, and when to re-engage."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Waiting-on Summary</span>
          <textarea
            name="description"
            rows={4}
            required
            defaultValue={fieldValue(item.task?.description)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Waiting On</span>
          <input
            name="waitingOn"
            defaultValue={fieldValue(metadata?.waitingOn)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Delegated To</span>
          <input
            name="delegatedTo"
            defaultValue={fieldValue(metadata?.delegatedTo)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Expected Outcome</span>
          <textarea
            name="expectedOutcome"
            rows={3}
            defaultValue={fieldValue(metadata?.expectedOutcome ?? item.task?.desiredOutcome)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Follow-up Plan</span>
          <input
            name="nextStep"
            defaultValue={fieldValue(item.task?.nextStep)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Status</span>
          <select
            name="taskStatus"
            defaultValue={fieldValue(item.task?.status ?? "active")}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Follow-up Date</span>
          <input
            name="dueAt"
            type="datetime-local"
            defaultValue={dueAtValue(item)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Priority</span>
          <select
            name="priority"
            defaultValue={fieldValue(item.task?.priority ?? "medium")}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Category</span>
          <select
            name="categoryId"
            defaultValue={categoryValue(item)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.status === "inactive" ? " (Inactive)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Last Touch</span>
          <input
            name="lastTouch"
            type="datetime-local"
            defaultValue={formatDateTimeLocal(metadata?.lastTouch ?? null)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Related Opportunity</span>
          <input
            name="relatedOpportunity"
            defaultValue={fieldValue(metadata?.relatedOpportunity)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <InitiativeSelect item={item} initiatives={initiatives} />
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
          Save waiting-on item
        </button>
      </div>
    </ExecutiveEditorFrame>
  );
}

function MeetingNoteEditor({
  item,
  redirectTo,
  initiatives
}: {
  item: LibraryItemDetail;
  redirectTo: string;
  initiatives: InitiativeOption[];
}) {
  const metadata = item.captureMetadata;

  return (
    <ExecutiveEditorFrame
      item={item}
      redirectTo={redirectTo}
      mode="meeting_note"
      title="Meeting note detail"
      description="Keep the meeting record structured so decisions, follow-ups, and waiting-on items remain available for later review and projection."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Meeting Title</span>
          <input
            name="meetingTitle"
            required
            defaultValue={fieldValue(metadata?.meetingTitle ?? item.note?.title)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Meeting Date / Time</span>
          <input
            name="meetingAt"
            type="datetime-local"
            defaultValue={formatDateTimeLocal(metadata?.meetingAt ?? null)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Attendees</span>
          <input
            name="attendees"
            defaultValue={fieldValue(metadata?.attendees)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted md:col-span-2">
          <span className="section-label">Notes</span>
          <textarea
            name="body"
            rows={6}
            defaultValue={fieldValue(item.note?.body)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Decisions</span>
          <textarea
            name="decisions"
            rows={3}
            defaultValue={fieldValue(metadata?.decisions)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Follow-ups</span>
          <textarea
            name="followUps"
            rows={3}
            defaultValue={fieldValue(metadata?.followUps)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Waiting-on Items</span>
          <textarea
            name="waitingOnItems"
            rows={3}
            defaultValue={fieldValue(metadata?.waitingOnItems)}
            className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Related Person</span>
          <input
            name="relatedPerson"
            defaultValue={fieldValue(metadata?.relatedPerson)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Related Company</span>
          <input
            name="relatedCompany"
            defaultValue={fieldValue(metadata?.relatedCompany)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
          />
        </label>

        <InitiativeSelect item={item} initiatives={initiatives} />
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
          Save meeting note
        </button>
      </div>
    </ExecutiveEditorFrame>
  );
}

export function LibraryDetail({
  item,
  backHref,
  backLabel,
  redirectTo,
  returnTo,
  notice,
  error,
  categories,
  initiatives
}: LibraryDetailProps) {
  const successMessage = sanitizeFlashMessage(notice);
  const errorMessage = sanitizeFlashMessage(error);
  const isLocalOnly = item.localOnly;
  const provenance = provenanceRows(item);
  const editorMode = resolveLibraryItemEditorMode(item);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref as Route} className="text-sm text-text-muted transition hover:text-text">
          {backLabel}
        </Link>
        <SaveStateIndicator state={item.saveState} detail={item.saveStateDetail} />
      </div>

      {(successMessage || errorMessage || (item.saveState !== "saved" && item.saveStateDetail)) ? (
        <div
          className={cn(
            "rounded-[1.35rem] border px-4 py-3 text-sm",
            errorMessage || item.saveState === "error"
              ? "border-accent-red/20 bg-[rgba(125,35,31,0.07)] text-[rgb(92,41,37)]"
              : "border-line/75 bg-white/74 text-text-muted"
          )}
        >
          {errorMessage ?? successMessage ?? item.saveStateDetail}
        </div>
      ) : null}

      {isLocalOnly ? (
        <div className="rounded-[1.35rem] border border-line/75 bg-white/74 px-4 py-3 text-sm text-text-muted">
          This is a local-only Library placeholder created while Supabase is unavailable. Source links remain browsable, but editing actions stay disabled here.
        </div>
      ) : null}

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <div className="brief-layout">
          <div className="brief-main">
            <p className="section-label">Library detail</p>
            <h2 className="brief-title">{item.title}</h2>
            <p className="brief-body">
              {item.type === "note" ? item.note?.body ?? item.preview : item.task?.description ?? item.preview}
            </p>
          </div>

          <div className="brief-side space-y-3">
            {metadataRows(item).map((row) => (
              <div key={row.label} className="rounded-[1.3rem] border border-line/75 bg-white/68 px-4 py-4">
                <p className="section-label">{row.label}</p>
                <p className="mt-2 text-sm font-medium leading-6 text-text">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          {editorMode === "note" && item.type === "note" && !isLocalOnly ? (
            <form action={updateWorkingContentAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
              <input type="hidden" name="captureId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div>
                <p className="section-label">Working note</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  The editable note stays foregrounded. Original captured content remains preserved below when you need it.
                </p>
              </div>

              <div className="mt-4 space-y-4">
                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Title (Optional)</span>
                  <input
                    name="title"
                    defaultValue={item.note?.title ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Body</span>
                  <textarea
                    name="workingContent"
                    rows={10}
                    required
                    defaultValue={item.note?.body ?? ""}
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Linked Initiative</span>
                  <select
                    name="linkedInitiativeId"
                    defaultValue={item.note?.linkedInitiativeId ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="">No linked initiative</option>
                    {initiatives.map((initiative) => (
                      <option key={initiative.id} value={initiative.id}>
                        {initiative.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
                  Save note
                </button>
              </div>
            </form>
          ) : null}

          {editorMode === "task" && item.type === "task" && !isLocalOnly ? (
            <form action={updateTaskDetailsAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
              <input type="hidden" name="captureId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div>
                <p className="section-label">Working task</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Tasks stay operational here: description, execution detail, categorization, initiative linkage, and normal task metadata.
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="section-label">Task Description</span>
                  <textarea
                    name="description"
                    rows={5}
                    required
                    defaultValue={item.task?.description ?? ""}
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Priority</span>
                  <select
                    name="priority"
                    defaultValue={item.task?.priority ?? "medium"}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Category</span>
                  <select
                    name="categoryId"
                    defaultValue={item.task?.categoryId ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {category.status === "inactive" ? " (Inactive)" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="section-label">Next Step</span>
                  <input
                    name="nextStep"
                    defaultValue={item.task?.nextStep ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="section-label">Desired Outcome</span>
                  <textarea
                    name="desiredOutcome"
                    rows={3}
                    defaultValue={item.task?.desiredOutcome ?? ""}
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Linked Initiative</span>
                  <select
                    name="linkedInitiativeId"
                    defaultValue={item.task?.linkedInitiativeId ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="">No linked initiative</option>
                    {initiatives.map((initiative) => (
                      <option key={initiative.id} value={initiative.id}>
                        {initiative.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Status</span>
                  <select
                    name="status"
                    defaultValue={item.task?.status ?? "active"}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="section-label">Due (Optional)</span>
                  <input
                    name="dueAt"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocal(item.task?.dueAt ?? null)}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
                  Save task
                </button>
              </div>
            </form>
          ) : null}

          {editorMode === "decision" && !isLocalOnly ? (
            <DecisionEditor item={item} redirectTo={redirectTo} initiatives={initiatives} />
          ) : null}

          {editorMode === "opportunity" && !isLocalOnly ? (
            <OpportunityEditor item={item} redirectTo={redirectTo} initiatives={initiatives} />
          ) : null}

          {editorMode === "waiting_on" && !isLocalOnly ? (
            <WaitingOnEditor item={item} redirectTo={redirectTo} categories={categories} initiatives={initiatives} />
          ) : null}

          {editorMode === "meeting_note" && !isLocalOnly ? (
            <MeetingNoteEditor item={item} redirectTo={redirectTo} initiatives={initiatives} />
          ) : null}

          {editorMode === "note" && item.type === "note" && !isLocalOnly ? (
            <form action={createTaskFromNoteAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
              <input type="hidden" name="captureId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div>
                <p className="section-label">Create task from note</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  The original note stays intact. This creates a new task with a preserved backlink to the note as source lineage.
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="section-label">Task Description</span>
                  <textarea
                    name="description"
                    rows={4}
                    required
                    defaultValue={item.note?.body ?? ""}
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="section-label">Next Step</span>
                  <input
                    name="nextStep"
                    defaultValue={item.note?.title ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="section-label">Desired Outcome</span>
                  <textarea
                    name="desiredOutcome"
                    rows={3}
                    defaultValue=""
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Priority</span>
                  <select
                    name="priority"
                    defaultValue="medium"
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="section-label">Category</span>
                  <select
                    name="categoryId"
                    defaultValue=""
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="">Leave uncategorized for now</option>
                    {categories.filter((category) => category.status === "active").map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="section-label">Linked Initiative</span>
                  <select
                    name="linkedInitiativeId"
                    defaultValue={item.note?.linkedInitiativeId ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="">No linked initiative</option>
                    {initiatives.map((initiative) => (
                      <option key={initiative.id} value={initiative.id}>
                        {initiative.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
                  Review and create task
                </button>
              </div>
            </form>
          ) : null}

          <details className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <summary className="cursor-pointer text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Original captured content</summary>
            <div className="mt-4 rounded-[1.15rem] border border-line/70 bg-[rgba(255,255,255,0.56)] p-4">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-text-muted">{item.originalContent}</pre>
            </div>
          </details>

          {(provenance.length > 0 || item.sourceLinkage) ? (
            <details className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
              <summary className="cursor-pointer text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Source and provenance</summary>
              <div className="mt-4 space-y-3">
                {provenance.map((row) => (
                  <div key={`${row.label}-${row.value}`} className="rounded-[1.15rem] border border-line/70 bg-[rgba(255,255,255,0.56)] px-4 py-4">
                    <p className="section-label">{row.label}</p>
                    {row.href ? (
                      <Link href={row.href as Route} className="mt-2 inline-flex text-sm font-medium leading-6 text-text transition hover:text-text-muted">
                        {row.value}
                      </Link>
                    ) : (
                      <p className="mt-2 text-sm font-medium leading-6 text-text">{row.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <p className="section-label">Actions</p>
            <div className="mt-4">
              <DetailActions item={item} redirectTo={redirectTo} returnTo={returnTo} isLocalOnly={isLocalOnly} />
            </div>
          </section>

          <section className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <p className="section-label">Updates</p>
            {isLocalOnly ? (
              <p className="mt-4 text-sm leading-6 text-text-muted">Updates stay disabled while this item is still local-only.</p>
            ) : (
              <>
                <form action={appendUpdateAction} className="mt-4 space-y-4">
                  <input type="hidden" name="captureId" value={item.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <textarea
                    name="body"
                    rows={4}
                    placeholder="Append a working update or comment."
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <select name="kind" defaultValue="update" className="rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none">
                      <option value="update">Update</option>
                      <option value="comment">Comment</option>
                    </select>
                    <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
                      Add
                    </button>
                  </div>
                </form>

                <div className="mt-4 space-y-3">
                  {item.updates.length > 0 ? (
                    item.updates.map((update) => (
                      <div key={update.id} className="rounded-[1.15rem] border border-line/70 bg-[rgba(255,255,255,0.56)] px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="section-label">{update.kind}</p>
                          <p className="text-sm text-text-muted">{formatTimestamp(update.createdAt)}</p>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-muted">{update.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-text-muted">No working updates yet.</p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
