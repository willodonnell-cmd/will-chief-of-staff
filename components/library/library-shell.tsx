import type { Route } from "next";
import Link from "next/link";

import type { TaskCategoryOption } from "@/lib/blackhawk-capture-model";
import type { LibraryItemSummary, LibraryQuery, LibraryScope } from "@/lib/capture-library";
import { formatTaskPriorityLabel } from "@/lib/blackhawk-capture-model";
import { cn } from "@/lib/utils";

import { PageIntro } from "../shell/page-intro";
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
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(0,0.52fr))_auto]">
        <label className="space-y-2 text-sm text-text-muted">
          <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Search</span>
          <input
            type="search"
            name="search"
            defaultValue={query.search}
            placeholder={query.scope === "tasks" ? "Search task description, next step, outcome" : "Search notes, tasks, working updates"}
            className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none transition focus:border-line"
          />
        </label>

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
            <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Due cue</span>
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
          <button type="submit" className="rounded-full border border-line/80 bg-white/85 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
            Apply
          </button>
          <Link href={basePath} className="rounded-full border border-line/70 bg-[rgba(255,255,255,0.45)] px-4 py-2.5 text-sm text-text-muted transition hover:bg-white/75">
            Clear
          </Link>
        </div>
      </div>

      {query.scope === "tasks" ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href={basePath}
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
                href={`${basePath}?category=${encodeURIComponent(category.id)}`}
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

          <label className="block space-y-2 text-sm text-text-muted">
            <span className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">More categories</span>
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
        </div>
      ) : null}
    </form>
  );
}

function noteHref(item: LibraryItemSummary, currentPath: string) {
  return {
    pathname: `/library/${item.id}` as Route,
    query: { from: currentPath }
  };
}

function NoteRow({ item, currentPath }: { item: LibraryItemSummary; currentPath: string }) {
  return (
    <Link href={noteHref(item, currentPath)} className="block rounded-[1.55rem] border border-line/70 bg-[rgba(255,255,255,0.66)] p-4 transition hover:-translate-y-px hover:bg-white/78">
      <article className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-subtle">
          <span>Note</span>
          <span>{item.status === "archived" ? "Archived" : "Active"}</span>
          {item.localOnly ? <span>Local only</span> : null}
          {item.note?.linkedInitiativeTitle ? <span>{item.note.linkedInitiativeTitle}</span> : null}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-[1.04rem] font-medium leading-6 text-text md:text-[1.08rem]">{item.title}</h3>
            <p className="mt-2 max-w-[58rem] text-sm leading-6 text-text-muted">{item.preview}</p>
            <p className="mt-3 text-sm text-text-muted">{formatDateLabel(item.lastActiveAt, { year: undefined })}</p>
          </div>

          <SaveStateIndicator state={item.saveState} detail={item.saveStateDetail} />
        </div>
      </article>
    </Link>
  );
}

function TaskRow({ item, currentPath }: { item: LibraryItemSummary; currentPath: string }) {
  if (!item.task) {
    return null;
  }

  return (
    <Link href={noteHref(item, currentPath)} className="block rounded-[1.55rem] border border-line/70 bg-[rgba(255,255,255,0.66)] p-4 transition hover:-translate-y-px hover:bg-white/78">
      <article className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-subtle">
          <span>{formatTaskPriorityLabel(item.task.priority ?? "medium")}</span>
          <span>{item.task.categoryIsFallback ? "Needs Categorization" : item.task.categoryName}</span>
          {item.status === "completed" ? <span>Completed</span> : null}
          {item.localOnly ? <span>Local only</span> : null}
          {dueCue(item) ? <span>{dueCue(item)}</span> : null}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-[1.04rem] font-medium leading-6 text-text md:text-[1.08rem]">{item.task.description}</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {formatTaskPriorityLabel(item.task.priority ?? "medium")} priority · {item.task.categoryName}
            </p>
            {item.task.nextStep ? <p className="mt-2 text-sm leading-6 text-text-muted">Next Step: {item.task.nextStep}</p> : null}
            {item.task.desiredOutcome ? <p className="mt-2 text-sm leading-6 text-text-muted">Desired Outcome: {item.task.desiredOutcome}</p> : null}
          </div>

          <div className="flex items-center gap-3">
            <SaveStateIndicator state={item.saveState} detail={item.saveStateDetail} />
            <span className="text-sm text-text-muted">{formatDateLabel(item.lastActiveAt, { year: undefined })}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function groupTasks(items: LibraryItemSummary[]) {
  const groups = new Map<string, Map<string, LibraryItemSummary[]>>();

  for (const item of items.filter((entry) => entry.type === "task" && entry.task)) {
    const priorityKey = item.task?.priority ?? "medium";
    const categoryKey = item.task?.categoryIsFallback ? "__needs_categorization__" : item.task?.categoryName ?? "TBD";

    if (!groups.has(priorityKey)) {
      groups.set(priorityKey, new Map());
    }

    const categoryGroups = groups.get(priorityKey)!;
    const existing = categoryGroups.get(categoryKey) ?? [];
    existing.push(item);
    categoryGroups.set(categoryKey, existing);
  }

  return groups;
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
  const groups = groupTasks(items);
  const priorities: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{title}</p>
      </div>

      {priorities.map((priority) => {
        const categoryGroups = groups.get(priority);
        if (!categoryGroups || categoryGroups.size === 0) {
          return null;
        }

        return (
          <div key={priority} className="rounded-[1.55rem] border border-line/75 bg-white/64 p-4">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-subtle">{formatTaskPriorityLabel(priority)} Priority</h3>
            <div className="mt-4 space-y-4">
              {[...categoryGroups.entries()].map(([categoryName, taskItems]) => (
                <div key={categoryName} className="space-y-3">
                  <p className="text-sm font-medium text-text">
                    {categoryName === "__needs_categorization__" ? "Needs Categorization" : categoryName}
                  </p>
                  {taskItems.map((item) => (
                    <TaskRow key={item.id} item={item} currentPath={currentPath} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function LibraryShell({ copy, scope, items, query, currentPath, categories, commonCategories }: LibraryShellProps) {
  const noteItems = items.filter((item) => item.type === "note");
  const taskItems = items.filter((item) => item.type === "task");

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <LibraryTabs scope={scope} />
      <Filters query={query} categories={categories} commonCategories={commonCategories} />

      {scope === "archived" ? (
        items.length > 0 ? (
          <section className="space-y-3">
            {items.map((item) => (item.type === "task" ? <TaskRow key={item.id} item={item} currentPath={currentPath} /> : <NoteRow key={item.id} item={item} currentPath={currentPath} />))}
          </section>
        ) : (
          <section className="rounded-[1.75rem] border border-line/75 bg-white/66 px-5 py-10 text-center">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Archived library</p>
            <p className="mt-3 text-[1.02rem] font-medium text-text">No archived items match the current view.</p>
          </section>
        )
      ) : scope === "tasks" ? (
        taskItems.length > 0 ? (
          <TaskGroups items={taskItems} currentPath={currentPath} title="Tasks grouped for execution" />
        ) : (
          <section className="rounded-[1.75rem] border border-line/75 bg-white/66 px-5 py-10 text-center">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Task library</p>
            <p className="mt-3 text-[1.02rem] font-medium text-text">No tasks match the current view.</p>
          </section>
        )
      ) : (
        <div className="space-y-6">
          {taskItems.length > 0 ? <TaskGroups items={taskItems} currentPath={currentPath} title="Tasks" /> : null}

          <section className="space-y-4">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Notes</p>
            </div>
            {noteItems.length > 0 ? (
              noteItems.map((item) => <NoteRow key={item.id} item={item} currentPath={currentPath} />)
            ) : (
              <div className="rounded-[1.55rem] border border-line/75 bg-white/66 px-5 py-8 text-center">
                <p className="text-sm text-text-muted">No notes match the current view.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
