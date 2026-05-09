import type { Route } from "next";
import Link from "next/link";

import {
  appendUpdateAction,
  archiveLibraryItemAction,
  completeTaskAction,
  createTaskFromNoteAction,
  deleteLibraryItemAction,
  reopenTaskAction,
  unarchiveLibraryItemAction,
  updateTaskDetailsAction,
  updateWorkingContentAction
} from "@/app/library/actions";
import { formatTaskPriorityLabel, type InitiativeOption, type TaskCategoryOption } from "@/lib/blackhawk-capture-model";
import type { LibraryItemDetail } from "@/lib/capture-library";
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
    { label: "Status", value: item.type === "task" && item.status === "completed" ? "Completed" : item.status === "archived" ? "Archived" : "Active" },
    { label: "Captured", value: formatTimestamp(item.capturedAt) },
    { label: "Last active", value: formatTimestamp(item.lastActiveAt) }
  ];

  if (item.type === "task" && item.task?.priority) {
    rows.push({ label: "Priority", value: formatTaskPriorityLabel(item.task.priority) });
  }

  if (item.type === "task" && item.task?.categoryName) {
    rows.push({
      label: "Category",
      value: item.task.categoryIsFallback ? `Needs Categorization · ${item.task.categoryName}` : item.task.categoryName
    });
  }

  if (item.type === "task" && item.task?.linkedInitiativeTitle) {
    rows.push({ label: "Linked initiative", value: item.task.linkedInitiativeTitle });
  }

  if (item.type === "note" && item.note?.linkedInitiativeTitle) {
    rows.push({ label: "Linked initiative", value: item.note.linkedInitiativeTitle });
  }

  if (item.type === "task" && item.task?.dueAt) {
    rows.push({ label: "Due", value: formatTimestamp(item.task.dueAt) });
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
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Library detail</p>
            <h2 className="brief-title">{item.title}</h2>
            <p className="brief-body">
              {item.type === "note" ? item.note?.body ?? item.preview : item.task?.description ?? item.preview}
            </p>
          </div>

          <div className="brief-side space-y-3">
            {metadataRows(item).map((row) => (
              <div key={row.label} className="rounded-[1.3rem] border border-line/75 bg-white/68 px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{row.label}</p>
                <p className="mt-2 text-sm font-medium leading-6 text-text">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          {item.type === "note" && !isLocalOnly ? (
            <form action={updateWorkingContentAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
              <input type="hidden" name="captureId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Working note</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  The editable note stays foregrounded. Original captured content remains preserved below when you need it.
                </p>
              </div>

              <div className="mt-4 space-y-4">
                <label className="space-y-2 text-sm text-text-muted">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Title (Optional)</span>
                  <input
                    name="title"
                    defaultValue={item.note?.title ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Body</span>
                  <textarea
                    name="workingContent"
                    rows={10}
                    required
                    defaultValue={item.note?.body ?? ""}
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Linked Initiative</span>
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

          {item.type === "task" && !isLocalOnly ? (
            <form action={updateTaskDetailsAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
              <input type="hidden" name="captureId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Working task</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Tasks stay operational here: description, execution detail, categorization, initiative linkage, and normal task metadata.
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Task Description</span>
                  <textarea
                    name="description"
                    rows={5}
                    required
                    defaultValue={item.task?.description ?? ""}
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Priority</span>
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
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Category</span>
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
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Next Step</span>
                  <input
                    name="nextStep"
                    defaultValue={item.task?.nextStep ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Desired Outcome</span>
                  <textarea
                    name="desiredOutcome"
                    rows={3}
                    defaultValue={item.task?.desiredOutcome ?? ""}
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Linked Initiative</span>
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
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Status</span>
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
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Due (Optional)</span>
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

          {item.type === "note" && !isLocalOnly ? (
            <form action={createTaskFromNoteAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
              <input type="hidden" name="captureId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Create task from note</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  The original note stays intact. This creates a new task with a preserved backlink to the note as source lineage.
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Task Description</span>
                  <textarea
                    name="description"
                    rows={4}
                    required
                    defaultValue={item.note?.body ?? ""}
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Next Step</span>
                  <input
                    name="nextStep"
                    defaultValue={item.note?.title ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted md:col-span-2">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Desired Outcome</span>
                  <textarea
                    name="desiredOutcome"
                    rows={3}
                    defaultValue=""
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/82 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-text-muted">
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Priority</span>
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
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Category</span>
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
                  <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Linked Initiative</span>
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
                    <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{row.label}</p>
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
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Actions</p>
            <div className="mt-4">
              <DetailActions item={item} redirectTo={redirectTo} returnTo={returnTo} isLocalOnly={isLocalOnly} />
            </div>
          </section>

          <section className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Updates</p>
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
                          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{update.kind}</p>
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
