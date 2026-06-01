import type { Route } from "next";
import Link from "next/link";

import {
  archiveLibraryItemAction,
  completeTaskAction,
  deleteLibraryItemAction,
  reopenTaskAction,
  unarchiveLibraryItemAction
} from "@/app/library/actions";
import type { TaskCategoryOption } from "@/lib/blackhawk-capture-model";
import { formatTaskPriorityLabel } from "@/lib/blackhawk-capture-model";
import {
  countLibraryItemsByWorkType,
  getLibraryCaptureType,
  getLibraryItemPriority,
  groupLibraryItemsByWorkType,
  type LibraryBrowseMode,
  type LibraryItemSummary,
  type LibraryPriorityFilter,
  type LibraryQuery,
  type LibraryScope,
  type LibraryTypeFilter
} from "@/lib/capture-library";
import { cn } from "@/lib/utils";

import { PageIntro } from "../shell/page-intro";
import { ConfirmSubmitButton } from "./confirm-submit-button";
import { SaveStateIndicator } from "./save-state-indicator";

type LibraryShellProps = {
  copy: {
    eyebrow: string;
    title: string;
    description: string;
  };
  scope: LibraryScope;
  items: LibraryItemSummary[];
  query: LibraryQuery;
  currentPath: string;
  categories: TaskCategoryOption[];
  commonCategories: TaskCategoryOption[];
};

function formatDateLabel(value: string | null, options?: Intl.DateTimeFormatOptions) {
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
    hour: "numeric",
    minute: "2-digit",
    ...options
  }).format(date);
}

function basePathForScope(scope: LibraryScope): Route {
  if (scope === "tasks") {
    return "/library/tasks";
  }

  if (scope === "archived") {
    return "/library/archived";
  }

  return "/library";
}

function buildQueryHref(
  scope: LibraryScope,
  query: LibraryQuery,
  overrides: Partial<{
    mode: LibraryBrowseMode;
    search: string;
    type: LibraryTypeFilter;
    status: LibraryQuery["status"];
    priority: LibraryPriorityFilter;
    due: LibraryQuery["due"];
    category: LibraryQuery["category"];
  }>
) {
  const next = {
    mode: query.mode,
    search: query.search,
    type: query.type,
    status: query.status,
    priority: query.priority,
    due: query.due,
    category: query.category,
    ...overrides
  };
  const params = new URLSearchParams();
  const defaultStatus = scope === "archived" ? "archived" : "all";
  const defaultMode = scope === "tasks" ? "tasks" : "all";

  if (scope !== "tasks" && next.mode !== defaultMode) {
    params.set("mode", next.mode);
  }

  if (next.search) {
    params.set("q", next.search);
  }

  if (next.type !== "all") {
    params.set("type", next.type);
  }

  if (next.status !== defaultStatus) {
    params.set("status", next.status);
  }

  if (next.priority !== "all") {
    params.set("priority", next.priority);
  }

  if (scope === "tasks" && next.due !== "all") {
    params.set("due", next.due);
  }

  if (scope === "tasks" && next.category !== "all") {
    params.set("category", next.category);
  }

  const queryString = params.toString();
  const basePath = basePathForScope(scope);
  return (queryString ? `${basePath}?${queryString}` : basePath) as Route;
}

function shouldShowDueCue(item: LibraryItemSummary) {
  if (item.type !== "task" || !item.task?.dueAt || item.status === "completed") {
    return false;
  }

  const dueAt = Date.parse(item.task.dueAt);
  if (Number.isNaN(dueAt)) {
    return false;
  }

  const now = Date.now();
  return dueAt < now || dueAt <= now + 1000 * 60 * 60 * 24 * 3;
}

function dueCue(item: LibraryItemSummary) {
  if (!shouldShowDueCue(item) || !item.task?.dueAt) {
    return null;
  }

  const dueAt = Date.parse(item.task.dueAt);
  if (dueAt < Date.now()) {
    return `Overdue since ${formatDateLabel(item.task.dueAt)}`;
  }

  return `Due ${formatDateLabel(item.task.dueAt)}`;
}

function primaryDateLabel(item: LibraryItemSummary) {
  if (item.task?.dueAt || item.dueAt) {
    return `Due ${formatDateLabel(item.task?.dueAt ?? item.dueAt ?? null)}`;
  }

  if (item.captureMetadata?.meetingAt) {
    return `Meeting ${formatDateLabel(item.captureMetadata.meetingAt)}`;
  }

  if (item.captureMetadata?.followUpAt) {
    return `Follow up ${formatDateLabel(item.captureMetadata.followUpAt)}`;
  }

  return formatDateLabel(item.lastActiveAt, { year: undefined });
}

function statusLabel(item: LibraryItemSummary) {
  if (item.status === "archived") {
    return "Archived";
  }

  if (item.status === "completed") {
    return "Completed";
  }

  return "Active";
}

function sourceLabel(item: LibraryItemSummary) {
  if (item.sourceLinkage?.sourceLabel) {
    return item.sourceLinkage.sourceLabel;
  }

  switch (item.sourcePath) {
    case "/capture":
      return "Capture";
    case "/inbox":
      return "Inbox";
    case "/commitments":
      return "Commitments";
    default:
      return null;
  }
}

function relatedContextLabel(item: LibraryItemSummary) {
  return (
    item.captureMetadata?.companyOrCounterparty ??
    item.captureMetadata?.relatedCompany ??
    item.captureMetadata?.relatedPerson ??
    item.captureMetadata?.owner ??
    null
  );
}

function typeOptions(scope: LibraryScope) {
  if (scope === "tasks") {
    return [
      { value: "all", label: "All task work" },
      { value: "task", label: "Tasks" },
      { value: "waiting_on", label: "Waiting On" }
    ] satisfies Array<{ value: LibraryTypeFilter; label: string }>;
  }

  if (scope === "archived") {
    return [
      { value: "all", label: "All" },
      { value: "note", label: "Notes" },
      { value: "task", label: "Tasks" },
      { value: "decision", label: "Decisions" },
      { value: "opportunity", label: "Opportunities" },
      { value: "waiting_on", label: "Waiting On" },
      { value: "meeting_note", label: "Meeting Notes" }
    ] satisfies Array<{ value: LibraryTypeFilter; label: string }>;
  }

  return [
    { value: "all", label: "All" },
    { value: "note", label: "Notes" },
    { value: "decision", label: "Decisions" },
    { value: "opportunity", label: "Opportunities" },
    { value: "meeting_note", label: "Meeting Notes" }
  ] satisfies Array<{ value: LibraryTypeFilter; label: string }>;
}

function primaryModeLabel(mode: LibraryBrowseMode) {
  if (mode === "notes") {
    return "Notes";
  }

  if (mode === "tasks") {
    return "Tasks";
  }

  return "All";
}

function effectiveMode(scope: LibraryScope, query: LibraryQuery): LibraryBrowseMode {
  if (scope === "tasks") {
    return "tasks";
  }

  return query.mode;
}

function normalizedTypeForMode(mode: LibraryBrowseMode, type: LibraryTypeFilter): LibraryTypeFilter {
  if (mode === "notes" && (type === "task" || type === "waiting_on")) {
    return "all";
  }

  if (mode === "tasks" && type !== "all" && type !== "task" && type !== "waiting_on") {
    return "all";
  }

  return type;
}

function typeOptionsForQuery(scope: LibraryScope, query: LibraryQuery) {
  if (scope === "tasks") {
    return typeOptions(scope);
  }

  if (query.mode === "notes") {
    return typeOptions("library");
  }

  if (query.mode === "tasks") {
    return [
      { value: "all", label: "All task work" },
      { value: "task", label: "Tasks" },
      { value: "waiting_on", label: "Waiting On" }
    ] satisfies Array<{ value: LibraryTypeFilter; label: string }>;
  }

  return [
    { value: "all", label: "All" },
    { value: "note", label: "Notes" },
    { value: "task", label: "Tasks" },
    { value: "decision", label: "Decisions" },
    { value: "opportunity", label: "Opportunities" },
    { value: "waiting_on", label: "Waiting On" },
    { value: "meeting_note", label: "Meeting Notes" }
  ] satisfies Array<{ value: LibraryTypeFilter; label: string }>;
}

function actionButtonClassName(intent: "default" | "danger" = "default") {
  return cn(
    "rounded-full border px-3 py-2 text-xs font-medium transition",
    intent === "danger"
      ? "border-line/75 bg-white/72 text-text-muted hover:bg-white hover:text-text"
      : "border-line/75 bg-white/78 text-text hover:bg-white"
  );
}

function itemHref(item: LibraryItemSummary, currentPath: string) {
  return {
    pathname: `/library/${item.id}` as Route,
    query: { from: currentPath }
  };
}

function LibraryTabs({ scope, query }: { scope: LibraryScope; query: LibraryQuery }) {
  const mode = effectiveMode(scope, query);

  return (
    <div className="flex flex-col gap-3 rounded-[1.55rem] border border-line/75 bg-white/62 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <p className="section-label">Browse Library</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildQueryHref("library", query, {
              mode: "all",
              status: scope === "archived" ? "all" : query.status,
              type: normalizedTypeForMode("all", query.type)
            })}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              scope === "library" && mode === "all"
                ? "bg-[rgb(var(--color-shell))] text-white"
                : "bg-white/78 text-text-muted hover:bg-white"
            )}
          >
            All
          </Link>
          <Link
            href={buildQueryHref("library", query, {
              mode: "notes",
              status: scope === "archived" ? "all" : query.status,
              type: normalizedTypeForMode("notes", query.type)
            })}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              scope === "library" && mode === "notes"
                ? "bg-[rgb(var(--color-shell))] text-white"
                : "bg-white/78 text-text-muted hover:bg-white"
            )}
          >
            Notes
          </Link>
          <Link
            href={buildQueryHref("tasks", query, {
              mode: "tasks",
              status: scope === "archived" ? "all" : query.status,
              type: normalizedTypeForMode("tasks", query.type)
            })}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              scope === "tasks" ? "bg-[rgb(var(--color-shell))] text-white" : "bg-white/78 text-text-muted hover:bg-white"
            )}
          >
            Tasks
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
        <p className="text-sm text-text-muted">
          Primary view: <span className="font-medium text-text">{primaryModeLabel(mode)}</span>
        </p>
        <Link
          href="/library/archived"
          className={cn(
            "text-sm transition",
            scope === "archived" ? "font-medium text-text" : "text-text-muted hover:text-text"
          )}
        >
          Archived library
        </Link>
      </div>
    </div>
  );
}

function Filters({
  query,
  categories,
  commonCategories
}: {
  query: LibraryQuery;
  categories: TaskCategoryOption[];
  commonCategories: TaskCategoryOption[];
}) {
  const basePath = basePathForScope(query.scope);

  return (
    <form action={basePath} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-4 md:p-5">
      {query.scope !== "tasks" && query.mode !== "all" ? <input type="hidden" name="mode" value={query.mode} /> : null}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <span className="section-label">Filters</span>
        <span>Primary mode controls the browsing surface; work type refines within it.</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,0.5fr))_auto]">
        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={query.search}
            placeholder="Search work, people, companies, sources"
            className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none transition focus:border-line"
          />
        </label>

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Work Type</span>
          <select
            name="type"
            defaultValue={normalizedTypeForMode(query.mode, query.type)}
            className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
          >
            {typeOptionsForQuery(query.scope, query).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {query.scope !== "archived" ? (
          <label className="space-y-2 text-sm text-text-muted">
            <span className="section-label">Status</span>
            <select
              name="status"
              defaultValue={query.status}
              className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        ) : (
          <div className="space-y-2 text-sm text-text-muted">
            <span className="section-label">Status</span>
            <div className="rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text">Archived</div>
          </div>
        )}

        <label className="space-y-2 text-sm text-text-muted">
          <span className="section-label">Priority</span>
          <select
            name="priority"
            defaultValue={query.priority}
            className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button type="submit" className="btn-secondary">
            Apply
          </button>
          <Link href={basePath} className="btn-secondary">
            Clear
          </Link>
        </div>
      </div>

      {query.scope === "tasks" ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[repeat(2,minmax(0,0.52fr))_minmax(0,1fr)]">
          <label className="space-y-2 text-sm text-text-muted">
            <span className="section-label">Due cue</span>
            <select
              name="due"
              defaultValue={query.due}
              className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
            >
              <option value="all">Any</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Due soon</option>
              <option value="none">No due date</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-text-muted">
            <span className="section-label">Category</span>
            <select
              name="category"
              defaultValue={query.category}
              className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className="section-label text-sm text-text-muted">Quick categories</span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildQueryHref(query.scope, query, { category: "all" })}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm transition",
                  query.category === "all"
                    ? "border-line/85 bg-[rgb(var(--color-shell))] text-white"
                    : "border-line/75 bg-white/78 text-text-muted hover:bg-white hover:text-text"
                )}
              >
                All categories
              </Link>
              {commonCategories.map((category) => (
                <Link
                  key={category.id}
                  href={buildQueryHref(query.scope, query, { category: category.id })}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm transition",
                    query.category === category.id
                      ? "border-line/85 bg-[rgb(var(--color-shell))] text-white"
                      : "border-line/75 bg-white/78 text-text-muted hover:bg-white hover:text-text"
                  )}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function RowActions({
  item,
  currentPath
}: {
  item: LibraryItemSummary;
  currentPath: string;
}) {
  if (item.localOnly) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.type === "task" && item.status !== "archived" && item.status !== "completed" ? (
        <form action={completeTaskAction}>
          <input type="hidden" name="captureId" value={item.id} />
          <input type="hidden" name="redirectTo" value={currentPath} />
          <button type="submit" className={actionButtonClassName()}>
            Complete
          </button>
        </form>
      ) : null}

      {item.type === "task" && item.status === "completed" ? (
        <form action={reopenTaskAction}>
          <input type="hidden" name="captureId" value={item.id} />
          <input type="hidden" name="redirectTo" value={currentPath} />
          <button type="submit" className={actionButtonClassName()}>
            Reopen
          </button>
        </form>
      ) : null}

      {item.status === "archived" ? (
        <form action={unarchiveLibraryItemAction}>
          <input type="hidden" name="captureId" value={item.id} />
          <input type="hidden" name="redirectTo" value={currentPath} />
          <button type="submit" className={actionButtonClassName()}>
            Restore
          </button>
        </form>
      ) : (
        <form action={archiveLibraryItemAction}>
          <input type="hidden" name="captureId" value={item.id} />
          <input type="hidden" name="redirectTo" value={currentPath} />
          <button type="submit" className={actionButtonClassName()}>
            Archive
          </button>
        </form>
      )}

      <form action={deleteLibraryItemAction}>
        <input type="hidden" name="captureId" value={item.id} />
        <input type="hidden" name="returnTo" value={currentPath} />
        <ConfirmSubmitButton
          confirmMessage="Delete this item? This removes it from Library."
          className={actionButtonClassName("danger")}
        >
          Delete
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}

function RowMeta({ item }: { item: LibraryItemSummary }) {
  const priority = getLibraryItemPriority(item);
  const source = sourceLabel(item);
  const relatedContext = relatedContextLabel(item);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-subtle">
      <span>{item.captureTypeLabel}</span>
      <span>{statusLabel(item)}</span>
      {priority ? <span>{formatTaskPriorityLabel(priority)}</span> : null}
      {item.task?.categoryName ? <span>{item.task.categoryIsFallback ? "Needs Categorization" : item.task.categoryName}</span> : null}
      {item.linkedInitiativeTitle ? <span>{item.linkedInitiativeTitle}</span> : null}
      {relatedContext ? <span>{relatedContext}</span> : null}
      {source ? <span>{source}</span> : null}
      {item.localOnly ? <span>Local only</span> : null}
      {dueCue(item) ? <span>{dueCue(item)}</span> : null}
    </div>
  );
}

function NoteRow({ item, currentPath }: { item: LibraryItemSummary; currentPath: string }) {
  return (
    <article className="rounded-[1.55rem] border border-line/70 bg-[rgba(255,255,255,0.66)] p-4 transition hover:-translate-y-px hover:bg-white/78">
      <div className="space-y-3">
        <RowMeta item={item} />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <Link href={itemHref(item, currentPath)} className="block">
              <h3 className="text-[1.04rem] font-medium leading-6 text-text transition hover:text-text-muted md:text-[1.08rem]">
                {item.title}
              </h3>
              <p className="mt-2 max-w-[58rem] text-sm leading-6 text-text-muted">{item.preview}</p>
            </Link>
            <p className="mt-3 text-sm text-text-muted">{primaryDateLabel(item)}</p>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <SaveStateIndicator state={item.saveState} detail={item.saveStateDetail} />
            <RowActions item={item} currentPath={currentPath} />
          </div>
        </div>
      </div>
    </article>
  );
}

function TaskRow({ item, currentPath }: { item: LibraryItemSummary; currentPath: string }) {
  if (!item.task) {
    return null;
  }

  return (
    <article className="rounded-[1.55rem] border border-line/70 bg-[rgba(255,255,255,0.66)] p-4 transition hover:-translate-y-px hover:bg-white/78">
      <div className="space-y-3">
        <RowMeta item={item} />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <Link href={itemHref(item, currentPath)} className="block">
              <h3 className="text-[1.04rem] font-medium leading-6 text-text transition hover:text-text-muted md:text-[1.08rem]">
                {item.task.description}
              </h3>
              {item.task.nextStep ? <p className="mt-2 text-sm leading-6 text-text-muted">Next step: {item.task.nextStep}</p> : null}
              {item.task.desiredOutcome ? (
                <p className="mt-2 text-sm leading-6 text-text-muted">Desired outcome: {item.task.desiredOutcome}</p>
              ) : null}
            </Link>
            <p className="mt-3 text-sm text-text-muted">{primaryDateLabel(item)}</p>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <SaveStateIndicator state={item.saveState} detail={item.saveStateDetail} />
            <RowActions item={item} currentPath={currentPath} />
          </div>
        </div>
      </div>
    </article>
  );
}

function WorkTypeCountSummary({ items }: { items: LibraryItemSummary[] }) {
  const counts = countLibraryItemsByWorkType(items);

  return (
    <section className="rounded-[1.55rem] border border-line/75 bg-white/62 p-4 md:p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="section-label">Current view counts</p>
        <p className="text-sm text-text-muted">Counts reflect the items visible under the current filters.</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {counts.map((entry) => (
          <div key={entry.type} className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-white/76 px-3 py-2 text-sm text-text-muted">
            <span className="text-[0.64rem] uppercase tracking-[0.18em] text-text-subtle">{entry.label}</span>
            <span className="font-medium text-text">{entry.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkTypeSections({
  items,
  currentPath,
  emptyLabel
}: {
  items: LibraryItemSummary[];
  currentPath: string;
  emptyLabel: string;
}) {
  const groups = groupLibraryItemsByWorkType(items);

  if (groups.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-line/75 bg-white/66 px-5 py-10 text-center">
        <p className="mt-3 text-[1.02rem] font-medium text-text">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.type} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">{group.label}</p>
            <p className="text-sm text-text-muted">{group.items.length}</p>
          </div>

          <div className="space-y-3">
            {group.items.map((item) =>
              item.type === "task" ? (
                <TaskRow key={item.id} item={item} currentPath={currentPath} />
              ) : (
                <NoteRow key={item.id} item={item} currentPath={currentPath} />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskGroups({
  items,
  currentPath,
  title
}: {
  items: LibraryItemSummary[];
  currentPath: string;
  title: string;
}) {
  const sections = [
    { type: "waiting_on", label: "Waiting On" },
    { type: "task", label: "Tasks" }
  ] as const;

  return (
    <section className="space-y-5">
      <div>
        <p className="section-label">{title}</p>
      </div>

      {sections.map((section) => {
        const sectionItems = items.filter((item) => getLibraryCaptureType(item) === section.type);
        if (sectionItems.length === 0) {
          return null;
        }

        return (
          <div key={section.type} className="rounded-[1.55rem] border border-line/75 bg-white/64 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-subtle">{section.label}</h3>
              <p className="text-sm text-text-muted">{sectionItems.length}</p>
            </div>
            <div className="mt-4 space-y-3">
              {sectionItems.map((item) => (
                <TaskRow key={item.id} item={item} currentPath={currentPath} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function LibraryShell({ copy, scope, items, query, currentPath, categories, commonCategories }: LibraryShellProps) {
  const taskItems = items.filter((item) => item.type === "task");

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <LibraryTabs scope={scope} query={query} />
      <Filters query={query} categories={categories} commonCategories={commonCategories} />
      <WorkTypeCountSummary items={items} />

      {scope === "tasks" ? (
        taskItems.length > 0 ? (
          <TaskGroups items={taskItems} currentPath={currentPath} title="Task work grouped for execution" />
        ) : (
          <section className="rounded-[1.75rem] border border-line/75 bg-white/66 px-5 py-10 text-center">
            <p className="section-label">Task library</p>
            <p className="mt-3 text-[1.02rem] font-medium text-text">No task items match the current view.</p>
          </section>
        )
      ) : (
        <WorkTypeSections
          items={items}
          currentPath={currentPath}
          emptyLabel={scope === "archived" ? "No archived items match the current view." : "No library items match the current view."}
        />
      )}
    </div>
  );
}
