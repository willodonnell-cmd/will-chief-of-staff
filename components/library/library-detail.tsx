import type { Route } from "next";
import Link from "next/link";

import {
  appendUpdateAction,
  archiveLibraryItemAction,
  completeTaskAction,
  deleteLibraryItemAction,
  reopenTaskAction,
  unarchiveLibraryItemAction,
  updateTaskDetailsAction,
  updateWorkingContentAction
} from "@/app/library/actions";
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
};

function sanitizeFlashMessage(message: string | undefined) {
  if (!message) {
    return null;
  }

  const lookup: Record<string, string> = {
    "working-saved": "Working content saved.",
    "task-details-saved": "Task details saved.",
    "update-added": "Update appended.",
    "item-archived": "Item archived.",
    "item-unarchived": "Item restored to the active library.",
    "task-completed": "Task marked complete.",
    "task-reopened": "Task reopened.",
    "item-deleted": "Item deleted from the library."
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

  if (item.type === "task" && item.task?.dueAt) {
    rows.push({ label: "Due", value: formatTimestamp(item.task.dueAt) });
  }

  if (item.type === "task" && item.task?.priority) {
    rows.push({
      label: "Priority",
      value: `${item.task.priority.slice(0, 1).toUpperCase()}${item.task.priority.slice(1)}`
    });
  }

  if (item.archivedAt) {
    rows.push({ label: "Archived", value: formatTimestamp(item.archivedAt) });
  }

  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
}

export function LibraryDetail({ item, backHref, backLabel, redirectTo, returnTo, notice, error }: LibraryDetailProps) {
  const successMessage = sanitizeFlashMessage(notice);
  const errorMessage = sanitizeFlashMessage(error);

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

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <div className="brief-layout">
          <div className="brief-main">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Library detail</p>
            <h2 className="brief-title">{item.title}</h2>
            <p className="brief-body">{item.preview}</p>
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
          {item.type === "task" ? (
            <form action={updateTaskDetailsAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
              <input type="hidden" name="captureId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Task details</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  These fields define the operational task object while the captured and working content remain intact.
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="taskTitle" className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">
                    Title
                  </label>
                  <input
                    id="taskTitle"
                    name="title"
                    required
                    defaultValue={item.title}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="taskStatus" className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">
                    Status
                  </label>
                  <select
                    id="taskStatus"
                    name="status"
                    defaultValue={item.task?.status ?? "active"}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="taskPriority" className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">
                    Priority
                  </label>
                  <select
                    id="taskPriority"
                    name="priority"
                    defaultValue={item.task?.priority ?? ""}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  >
                    <option value="">None</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="taskDueAt" className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">
                    Due
                  </label>
                  <input
                    id="taskDueAt"
                    name="dueAt"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocal(item.task?.dueAt ?? null)}
                    className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white"
                >
                  Save task details
                </button>
              </div>
            </form>
          ) : null}

          <form action={updateWorkingContentAction} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <input type="hidden" name="captureId" value={item.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />

            {item.type !== "task" ? (
              <div className="space-y-2">
                <label htmlFor="title" className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  defaultValue={item.title}
                  className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                />
              </div>
            ) : (
              <input type="hidden" name="title" value={item.title} />
            )}

            <div className={item.type !== "task" ? "mt-4 space-y-2" : "space-y-2"}>
              <label htmlFor="workingContent" className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">
                Working content
              </label>
              <textarea
                id="workingContent"
                name="workingContent"
                rows={12}
                defaultValue={item.workingContent}
                className="min-h-[18rem] w-full rounded-[1.15rem] border border-line/75 bg-white/82 px-4 py-4 text-sm leading-6 text-text outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white"
              >
                Save working content
              </button>
            </div>
          </form>

          <section className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Original capture</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  This stays immutable so the first captured version remains visible by default.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[1.2rem] border border-line/70 bg-[rgba(255,255,255,0.56)] px-4 py-4">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-text-muted">{item.originalContent}</pre>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Detail actions</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {item.type === "task" ? (
                item.status === "completed" ? (
                  <form action={reopenTaskAction}>
                    <input type="hidden" name="captureId" value={item.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <button
                      type="submit"
                      className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white"
                    >
                      Reopen
                    </button>
                  </form>
                ) : (
                  <form action={completeTaskAction}>
                    <input type="hidden" name="captureId" value={item.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <button
                      type="submit"
                      className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white"
                    >
                      Complete
                    </button>
                  </form>
                )
              ) : null}

              {item.status === "archived" ? (
                <form action={unarchiveLibraryItemAction}>
                  <input type="hidden" name="captureId" value={item.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <button
                    type="submit"
                    className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white"
                  >
                    Unarchive
                  </button>
                </form>
              ) : (
                <form action={archiveLibraryItemAction}>
                  <input type="hidden" name="captureId" value={item.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <button
                    type="submit"
                    className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white"
                  >
                    Archive
                  </button>
                </form>
              )}

              <form action={deleteLibraryItemAction}>
                <input type="hidden" name="captureId" value={item.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  type="submit"
                  className="rounded-full border border-accent-red/25 bg-[rgba(125,35,31,0.07)] px-4 py-2 text-sm font-medium text-[rgb(125,35,31)] transition hover:bg-[rgba(125,35,31,0.11)]"
                >
                  Delete
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Append update or comment</p>

            <form action={appendUpdateAction} className="mt-4 space-y-4">
              <input type="hidden" name="captureId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div className="space-y-2">
                <label htmlFor="kind" className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">
                  Entry type
                </label>
                <select
                  id="kind"
                  name="kind"
                  defaultValue="update"
                  className="w-full rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
                >
                  <option value="update">Update</option>
                  <option value="comment">Comment</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="body" className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">
                  Text
                </label>
                <textarea
                  id="body"
                  name="body"
                  rows={5}
                  className="w-full rounded-[1.1rem] border border-line/75 bg-white/82 px-4 py-4 text-sm leading-6 text-text outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white"
                >
                  Append
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-[1.55rem] border border-line/75 bg-white/68 p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Updates and comments</p>

            <div className="mt-4 space-y-3">
              {item.updates.length > 0 ? (
                item.updates.map((update) => (
                  <article
                    key={update.id}
                    className="rounded-[1.2rem] border border-line/70 bg-[rgba(255,255,255,0.56)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-subtle">
                      <span>{update.kind}</span>
                      <span>{formatTimestamp(update.createdAt)}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-muted">{update.body}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm leading-6 text-text-muted">No updates or comments have been appended yet.</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
