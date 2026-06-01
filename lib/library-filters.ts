import {
  getExecutiveCaptureTypeLabel,
  isExecutiveCaptureType,
  type ExecutiveCaptureType
} from "@/lib/blackhawk-capture-model";

import type {
  LibraryBrowseMode,
  LibraryDueFilter,
  LibraryItemSummary,
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
  const type = firstValue(raw.type);
  const status = firstValue(raw.status);
  const priority = firstValue(raw.priority);
  const due = firstValue(raw.due);
  const category = firstValue(raw.category)?.trim() ?? "all";

  return {
    scope,
    mode: scope === "tasks" ? "tasks" : isLibraryBrowseMode(mode) ? mode : "all",
    search,
    type: isLibraryType(type) ? type : "all",
    status: scope === "archived" ? "archived" : isLibraryStatus(status) ? status : "all",
    priority: isLibraryPriorityFilter(priority) ? priority : "all",
    due: scope === "tasks" && isLibraryDue(due) ? due : "all",
    category: scope === "tasks" && category ? category : "all"
  };
}
