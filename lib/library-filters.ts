import {
  getExecutiveCaptureTypeLabel,
  isExecutiveCaptureType,
  type ExecutiveCaptureType
} from "@/lib/blackhawk-capture-model";

import type {
  LibraryBrowseMode,
  LibraryDueFilter,
  LibraryItemSummary,
  LibraryQuickView,
  LibraryPriorityFilter,
  LibraryQuery,
  LibraryScope,
  LibraryStatusFilter,
  LibraryTaskPriority,
  LibraryTypeFilter,
  LibraryWorkTypeGroup,
  LibraryWorkTypeSummary
} from "./capture-library";

export const LIBRARY_WORK_TYPE_ORDER = [
  "decision",
  "opportunity",
  "waiting_on",
  "meeting_note",
  "task",
  "note"
] as const satisfies readonly ExecutiveCaptureType[];

const NOTE_COMPATIBLE_CAPTURE_TYPES: ExecutiveCaptureType[] = [
  "note",
  "decision",
  "opportunity",
  "meeting_note"
];

const TASK_COMPATIBLE_CAPTURE_TYPES: ExecutiveCaptureType[] = ["task", "waiting_on"];
const CLEANUP_CATEGORY_NAMES = ["tbd", "needs categorization", "needs category", "uncategorized"];
const CLEANUP_STALE_DAYS = 45;

export const LIBRARY_QUICK_VIEWS = [
  {
    value: "high-priority",
    label: "High Priority",
    description: "Active high-priority items across the library.",
    scope: "library"
  },
  {
    value: "waiting-on",
    label: "Waiting On",
    description: "Delegation and waiting-for follow-through work.",
    scope: "library"
  },
  {
    value: "decisions",
    label: "Decisions",
    description: "Decision and governance work that needs review.",
    scope: "library"
  },
  {
    value: "opportunities",
    label: "Opportunities",
    description: "Active opportunity and relationship streams.",
    scope: "library"
  },
  {
    value: "meeting-notes",
    label: "Meeting Notes",
    description: "Meeting notes and prep records.",
    scope: "library"
  },
  {
    value: "needs-cleanup",
    label: "Needs Cleanup",
    description: "Low-signal or stale items worth reviewing.",
    scope: "library"
  },
  {
    value: "recently-archived",
    label: "Recently Archived",
    description: "Archived items sorted for cleanup review.",
    scope: "archived"
  }
] as const satisfies ReadonlyArray<{
  value: LibraryQuickView;
  label: string;
  description: string;
  scope: LibraryScope;
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isLibraryStatus(value: string | undefined): value is LibraryStatusFilter {
  return value === "all" || value === "active" || value === "completed" || value === "archived";
}

function isLibraryType(value: string | undefined): value is LibraryTypeFilter {
  return value === "all" || isExecutiveCaptureType(value);
}

function isLibraryDue(value: string | undefined): value is LibraryDueFilter {
  return value === "all" || value === "overdue" || value === "upcoming" || value === "none";
}

function isLibraryTaskPriority(value: string | null | undefined): value is LibraryTaskPriority {
  return value === "low" || value === "medium" || value === "high";
}

function isLibraryPriorityFilter(value: string | undefined): value is LibraryPriorityFilter {
  return value === "all" || isLibraryTaskPriority(value);
}

function isLibraryBrowseMode(value: string | undefined): value is LibraryBrowseMode {
  return value === "all" || value === "notes" || value === "tasks";
}

function isLibraryQuickView(value: string | undefined): value is LibraryQuickView {
  return LIBRARY_QUICK_VIEWS.some((view) => view.value === value);
}

function compareByLastActive(left: LibraryItemSummary, right: LibraryItemSummary) {
  return Date.parse(right.lastActiveAt) - Date.parse(left.lastActiveAt);
}

function prioritySortRank(priority: LibraryTaskPriority | null) {
  if (priority === "high") {
    return 0;
  }

  if (priority === "medium") {
    return 1;
  }

  return 2;
}

function compareByPlannedDate(left: string | null, right: string | null) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return Date.parse(left) - Date.parse(right);
}

function librarySortDate(item: LibraryItemSummary) {
  return (
    item.task?.dueAt ??
    item.dueAt ??
    item.captureMetadata?.followUpAt ??
    item.captureMetadata?.meetingAt ??
    item.captureMetadata?.lastTouch ??
    null
  );
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function hasPlannedDate(item: LibraryItemSummary) {
  return Boolean(item.task?.dueAt ?? item.dueAt ?? item.captureMetadata?.followUpAt ?? item.captureMetadata?.meetingAt);
}

function isWaitingForCategory(item: LibraryItemSummary) {
  return normalizeText(item.categoryName ?? item.task?.categoryName) === "waiting for";
}

function isWaitingOnLike(item: LibraryItemSummary) {
  return getLibraryCaptureType(item) === "waiting_on" || (item.type === "task" && isWaitingForCategory(item));
}

function isCleanupCategoryCandidate(item: LibraryItemSummary) {
  if (item.type !== "task") {
    return false;
  }

  if (!item.categoryId || !item.categoryName) {
    return true;
  }

  return item.categoryIsFallback === true || CLEANUP_CATEGORY_NAMES.includes(normalizeText(item.categoryName));
}

function isLowPriorityWithoutPlanning(item: LibraryItemSummary) {
  return getLibraryItemPriority(item) === "low" && !hasPlannedDate(item);
}

function isStaleCleanupCandidate(item: LibraryItemSummary) {
  if (hasPlannedDate(item)) {
    return false;
  }

  const lastActive = Date.parse(item.lastActiveAt);
  if (Number.isNaN(lastActive)) {
    return false;
  }

  return lastActive <= Date.now() - CLEANUP_STALE_DAYS * 24 * 60 * 60 * 1000;
}

function isObviousTestItem(item: LibraryItemSummary) {
  return /\btest\b/i.test(item.title) || /\btest\b/i.test(item.preview);
}

function matchesQuickView(item: LibraryItemSummary, view: LibraryQuickView | null) {
  if (!view) {
    return true;
  }

  switch (view) {
    case "high-priority":
      return item.status === "active" && getLibraryItemPriority(item) === "high";
    case "waiting-on":
      return item.status === "active" && isWaitingOnLike(item);
    case "decisions":
      return item.status === "active" && getLibraryCaptureType(item) === "decision";
    case "opportunities":
      return item.status === "active" && getLibraryCaptureType(item) === "opportunity";
    case "meeting-notes":
      return item.status === "active" && getLibraryCaptureType(item) === "meeting_note";
    case "needs-cleanup":
      return (
        item.status === "active" &&
        (isCleanupCategoryCandidate(item) ||
          isLowPriorityWithoutPlanning(item) ||
          isStaleCleanupCandidate(item) ||
          isObviousTestItem(item))
      );
    case "recently-archived":
      return item.status === "archived";
  }
}

function matchesType(item: LibraryItemSummary, filter: LibraryTypeFilter) {
  return filter === "all" ? true : getLibraryCaptureType(item) === filter;
}

function matchesMode(item: LibraryItemSummary, mode: LibraryBrowseMode) {
  if (mode === "all") {
    return true;
  }

  const captureType = getLibraryCaptureType(item);
  return mode === "notes"
    ? NOTE_COMPATIBLE_CAPTURE_TYPES.includes(captureType)
    : TASK_COMPATIBLE_CAPTURE_TYPES.includes(captureType);
}

function matchesStatus(item: LibraryItemSummary, filter: LibraryStatusFilter) {
  if (filter === "all") {
    return true;
  }

  return item.status === filter;
}

function matchesPriority(item: LibraryItemSummary, filter: LibraryPriorityFilter) {
  if (filter === "all") {
    return true;
  }

  return getLibraryItemPriority(item) === filter;
}

function matchesDue(item: LibraryItemSummary, filter: LibraryDueFilter) {
  if (item.type !== "task" || filter === "all") {
    return true;
  }

  const dueAt = item.dueAt ? Date.parse(item.dueAt) : null;

  if (filter === "none") {
    return dueAt === null;
  }

  if (item.status === "completed" || dueAt === null) {
    return false;
  }

  if (filter === "overdue") {
    return dueAt < Date.now();
  }

  return dueAt >= Date.now();
}

function matchesCategory(item: LibraryItemSummary, filter: LibraryQuery["category"]) {
  if (item.type !== "task" || filter === "all") {
    return true;
  }

  return item.task?.categoryId === filter;
}

export function getLibraryQuickViewDefinition(view: LibraryQuickView) {
  return LIBRARY_QUICK_VIEWS.find((entry) => entry.value === view) ?? null;
}

export function countLibraryItemsForQuickView(items: LibraryItemSummary[], view: LibraryQuickView) {
  return items.filter((item) => matchesQuickView(item, view)).length;
}

function applyQuickViewDefaults(query: LibraryQuery): LibraryQuery {
  if (!query.view) {
    return query;
  }

  // Quick views are fixed shortcuts. They own the dominant slice and clear conflicting filters.
  switch (query.view) {
    case "high-priority":
      return {
        ...query,
        mode: "all",
        type: "all",
        status: "active",
        priority: "high",
        due: "all",
        category: "all"
      };
    case "waiting-on":
      return {
        ...query,
        mode: "all",
        type: "all",
        status: "active",
        priority: "all",
        due: "all",
        category: "all"
      };
    case "decisions":
      return {
        ...query,
        mode: "all",
        type: "decision",
        status: "active",
        priority: "all",
        due: "all",
        category: "all"
      };
    case "opportunities":
      return {
        ...query,
        mode: "all",
        type: "opportunity",
        status: "active",
        priority: "all",
        due: "all",
        category: "all"
      };
    case "meeting-notes":
      return {
        ...query,
        mode: "all",
        type: "meeting_note",
        status: "active",
        priority: "all",
        due: "all",
        category: "all"
      };
    case "needs-cleanup":
      return {
        ...query,
        mode: "all",
        type: "all",
        status: "active",
        priority: "all",
        due: "all",
        category: "all"
      };
    case "recently-archived":
      return {
        ...query,
        mode: "all",
        type: "all",
        status: "archived",
        priority: "all",
        due: "all",
        category: "all"
      };
  }
}

export function getLibraryCaptureType(
  item: Pick<LibraryItemSummary, "captureType" | "type">
): ExecutiveCaptureType {
  return item.captureType ?? item.type;
}

export function getLibraryItemPriority(
  item: Pick<LibraryItemSummary, "priority" | "task">
): LibraryTaskPriority | null {
  return item.priority ?? item.task?.priority ?? null;
}

export function compareLibraryItemsForExecutiveView(left: LibraryItemSummary, right: LibraryItemSummary) {
  const leftPriority = prioritySortRank(getLibraryItemPriority(left));
  const rightPriority = prioritySortRank(getLibraryItemPriority(right));

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const dateComparison = compareByPlannedDate(librarySortDate(left), librarySortDate(right));
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return compareByLastActive(left, right);
}

export function filterLibraryItems(items: LibraryItemSummary[], query: LibraryQuery) {
  return items
    .filter((item) => matchesQuickView(item, query.view))
    .filter((item) => matchesMode(item, query.mode))
    .filter((item) => matchesType(item, query.type))
    .filter((item) => matchesStatus(item, query.status))
    .filter((item) => matchesPriority(item, query.priority))
    .filter((item) => matchesDue(item, query.due))
    .filter((item) => matchesCategory(item, query.category));
}

export function countLibraryItemsByWorkType(items: LibraryItemSummary[]): LibraryWorkTypeSummary[] {
  return LIBRARY_WORK_TYPE_ORDER.map((type) => ({
    type,
    label: getExecutiveCaptureTypeLabel(type),
    count: items.filter((item) => getLibraryCaptureType(item) === type).length
  }));
}

export function groupLibraryItemsByWorkType(items: LibraryItemSummary[]): LibraryWorkTypeGroup[] {
  return LIBRARY_WORK_TYPE_ORDER.map((type) => ({
    type,
    label: getExecutiveCaptureTypeLabel(type),
    items: items
      .filter((item) => getLibraryCaptureType(item) === type)
      .sort(compareLibraryItemsForExecutiveView)
  })).filter((group) => group.items.length > 0);
}

export function parseLibraryQueryParams(
  raw: Record<string, string | string[] | undefined>,
  scope: LibraryScope
): LibraryQuery {
  const search = firstValue(raw.q)?.trim() ?? firstValue(raw.search)?.trim() ?? "";
  const mode = firstValue(raw.mode);
  const view = firstValue(raw.view);
  const type = firstValue(raw.type);
  const status = firstValue(raw.status);
  const priority = firstValue(raw.priority);
  const due = firstValue(raw.due);
  const category = firstValue(raw.category)?.trim() ?? "all";

  return applyQuickViewDefaults({
    scope,
    mode: scope === "tasks" ? "tasks" : isLibraryBrowseMode(mode) ? mode : "all",
    view: isLibraryQuickView(view) ? view : null,
    search,
    type: isLibraryType(type) ? type : "all",
    status: scope === "archived" ? "archived" : isLibraryStatus(status) ? status : "all",
    priority: isLibraryPriorityFilter(priority) ? priority : "all",
    due: scope === "tasks" && isLibraryDue(due) ? due : "all",
    category: scope === "tasks" && category ? category : "all"
  });
}
