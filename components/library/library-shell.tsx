import type { Route } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/shell/page-intro";
import type { LibraryItemSummary, LibraryQuery, LibraryScope } from "@/lib/capture-library";
import { cn } from "@/lib/utils";

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

function labelForType(type: LibraryItemSummary["type"]) {
  return type === "task" ? "Task" : "Note";
}

function labelForStatus(item: LibraryItemSummary) {
  if (item.status === "archived") {
    return "Archived";
  }

  if (item.type === "task" && item.status === "completed") {
    return "Completed";
  }

  return "Active";
}

function labelForPriority(item: LibraryItemSummary) {
  if (item.type !== "task" || !item.task?.priority) {
    return null;
  }

  return `${item.task.priority.slice(0, 1).toUpperCase()}${item.task.priority.slice(1)} priority`;
}

function labelForTaskTiming(item: LibraryItemSummary) {
  if (item.type !== "task" || !item.dueAt || item.status === "completed") {
    return null;
  }

  const dueAt = Date.parse(item.dueAt);
  if (Number.isNaN(dueAt)) {
    return null;
  }

  if (dueAt < Date.now()) {
    return `Overdue since ${formatDateLabel(item.dueAt, { hour: "numeric", minute: "2-digit" })}`;
  }

  return `Due ${formatDateLabel(item.dueAt, { hour: "numeric", minute: "2-digit" })}`;
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

function Filters({ query }: { query: LibraryQuery }) {
  const basePath = basePathForScope(query.scope);

  return (
    <form action={basePath} className="rounded-[1.55rem] border border-line/75 bg-white/68 p-4 md:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,0.52fr))_auto]">
        <label className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Search</span>
          <input
            type="search"
            name="search"
            defaultValue={query.search}
            placeholder="Search title, captured text, working content, updates"
            className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none transition focus:border-line"
          />
        </label>

        {query.scope !== "tasks" ? (
          <label className="space-y-2 text-sm text-text-muted">
            <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Type</span>
            <select
              name="type"
              defaultValue={query.type}
              className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
            >
              <option value="all">All</option>
              <option value="note">Notes</option>
              <option value="task">Tasks</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="type" value="task" />
        )}

        {query.scope !== "archived" ? (
          <label className="space-y-2 text-sm text-text-muted">
            <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Status</span>
            <select
              name="status"
              defaultValue={query.status}
              className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        ) : null}

        {query.scope === "tasks" ? (
          <label className="space-y-2 text-sm text-text-muted">
            <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Due</span>
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
        ) : null}

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-full border border-line/80 bg-white/85 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white"
          >
            Apply
          </button>
          <Link
            href={basePath}
            className="rounded-full border border-line/70 bg-[rgba(255,255,255,0.45)] px-4 py-2.5 text-sm text-text-muted transition hover:bg-white/75"
          >
            Clear
          </Link>
        </div>
      </div>
    </form>
  );
}

function LibraryTabs({ scope }: { scope: LibraryScope }) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.55rem] border border-line/75 bg-white/62 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Link
          href="/library"
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition",
            scope === "library" ? "bg-[rgb(var(--color-shell))] text-white" : "bg-white/78 text-text-muted hover:bg-white"
          )}
        >
          All
        </Link>
        <Link
          href="/library/tasks"
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition",
            scope === "tasks" ? "bg-[rgb(var(--color-shell))] text-white" : "bg-white/78 text-text-muted hover:bg-white"
          )}
        >
          Tasks
        </Link>
      </div>

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
  );
}

export function LibraryShell({ copy, scope, items, query, currentPath }: LibraryShellProps) {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <LibraryTabs scope={scope} />
      <Filters query={query} />

      {items.length > 0 ? (
        <section className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={{
                pathname: `/library/${item.id}` as Route,
                query: { from: currentPath }
              }}
              className="block rounded-[1.55rem] border border-line/70 bg-[rgba(255,255,255,0.66)] p-4 transition hover:-translate-y-px hover:bg-white/78"
            >
              <article className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-subtle">
                  <span>{labelForType(item.type)}</span>
                  <span>{labelForStatus(item)}</span>
                  {labelForTaskTiming(item) ? <span>{labelForTaskTiming(item)}</span> : null}
                  {labelForPriority(item) ? <span>{labelForPriority(item)}</span> : null}
                  {item.sourcePath ? <span>{item.sourcePath.replace(/^\//, "") || "capture"}</span> : null}
                  {(item.privacy === "protected" || item.privacy === "hybrid") ? <span>{item.privacy}</span> : null}
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1.04rem] font-medium leading-6 text-text md:text-[1.08rem]">{item.title}</h3>
                    <p className="mt-2 max-w-[58rem] text-sm leading-6 text-text-muted">{item.preview}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <SaveStateIndicator state={item.saveState} detail={item.saveStateDetail} />
                    <span className="text-sm text-text-muted">{formatDateLabel(item.lastActiveAt)}</span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-line/75 bg-white/66 px-5 py-10 text-center">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Library</p>
          <p className="mt-3 text-[1.02rem] font-medium text-text">No items match the current view.</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Captured notes and tasks will appear here once they are saved, searchable, and active in the library.
          </p>
        </section>
      )}
    </div>
  );
}
