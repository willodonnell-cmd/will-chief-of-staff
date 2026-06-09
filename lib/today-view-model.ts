import type {
  ExecutiveBriefSnapshot,
  JsonValue,
  StructuredExecutiveBrief,
  StructuredExecutiveBriefItem
} from "@/lib/brief/executive-brief-snapshots";
import {
  briefItemDomId,
  buildStructuredBriefSourceLanes,
  type BriefSourceLaneId,
  type StructuredBriefLaneEntry
} from "@/lib/brief/source-lanes";
import type { LibraryItemSummary } from "@/lib/capture-library";
import type { MeetingRecordStatusSummary } from "@/lib/meetings/meeting-records";

export type TodayBriefItem = {
  id: string;
  title: string;
  summary: string | null;
  href: string;
  sourceHref: string | null;
  briefHref: string;
  senderLabel: string | null;
  sourceLabel: string | null;
  timeLabel: string | null;
  attendeeLabel: string | null;
  startAt: string | null;
  endAt: string | null;
  attendees: JsonValue[];
  organizerName: string | null;
  organizerEmail: string | null;
  locationOrLink: string | null;
  sourceQualityLabel: string;
  canCreateTask: boolean;
  taskDescription: string;
  taskNextStep: string | null;
  taskDesiredOutcome: string | null;
  taskPriority: "high" | "medium" | "low" | null;
  taskDueAt: string | null;
  taskSource: string | null;
  actionLabel: string | null;
  meta: string[];
};

export type TodayTaskItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourcePath: string | null;
};

export type TodaySourceLane = {
  id: BriefSourceLaneId;
  label: string;
  items: TodayBriefItem[];
  tasks: TodayTaskItem[];
};

export type TodayBriefFreshness = {
  status: "processed" | "waiting";
  generatedAt: string | null;
  slot: string | null;
  label: string;
  detail: string;
};

export type TodayViewModel = {
  hasBriefSnapshot: boolean;
  commandSummary: string[];
  currentFocus: TodayBriefItem[];
  decisionsNeeded: TodayBriefItem[];
  meetingPrep: TodayBriefItem[];
  carryForward: TodayBriefItem[];
  taskCandidates: TodayBriefItem[];
  openTasks: TodayTaskItem[];
  sourceLanes: TodaySourceLane[];
  meetingRecordStatuses: Record<string, MeetingRecordStatusSummary>;
  briefFreshness: TodayBriefFreshness;
  emptyState: {
    title: string;
    detail: string;
  } | null;
};

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function formatTimestamp(value: string | null | undefined) {
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
    minute: "2-digit"
  }).format(date);
}

function itemSummary(item: StructuredExecutiveBriefItem) {
  return compactText(item.summary) || compactText(item.recommendedAction) || compactText(item.source) || null;
}

function itemMeta(item: StructuredExecutiveBriefItem) {
  return [
    item.priority ? `${item.priority} priority` : null,
    item.sourceLabel ?? item.source,
    item.dueAt ? `Due ${formatTimestamp(item.dueAt) ?? item.dueAt}` : null
  ].filter((value): value is string => Boolean(compactText(value)));
}

function senderLabel(item: StructuredExecutiveBriefItem) {
  const sender = compactText(item.senderName);
  const email = compactText(item.senderEmail);
  if (sender && email && sender.toLowerCase() !== email.toLowerCase()) {
    return `${sender} <${email}>`;
  }

  return sender || email || null;
}

function formatTimeWindow(item: StructuredExecutiveBriefItem) {
  const start = formatTimestamp(item.startAt);
  const end = formatTimestamp(item.endAt);
  if (start && end) {
    return `${start} - ${end}`;
  }

  return start ?? end ?? null;
}

function attendeeText(value: JsonValue) {
  if (typeof value === "string") {
    return compactText(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, JsonValue>;
    return compactText(typeof record.name === "string" ? record.name : null) || compactText(typeof record.email === "string" ? record.email : null);
  }

  return "";
}

function attendeeLabel(item: StructuredExecutiveBriefItem) {
  const attendees = (item.attendees ?? []).map(attendeeText).filter(Boolean);
  if (attendees.length === 0) {
    return null;
  }

  if (attendees.length > 3) {
    return `Group meeting · ${attendees.length} attendees`;
  }

  return attendees.join(", ");
}

function sourceQualityLabel(item: StructuredExecutiveBriefItem, laneId?: BriefSourceLaneId) {
  if (item.sourceUrl) {
    return "Source link available";
  }

  if (laneId === "calendar_meetings" && !item.startAt && !item.attendees?.length) {
    return "Calendar metadata unavailable";
  }

  if (laneId === "email" && !senderLabel(item)) {
    return "Sender unavailable";
  }

  return "Brief-only context";
}

function mapBriefItem(
  item: StructuredExecutiveBriefItem,
  section: string,
  sectionLabel?: string,
  entryId = `${section}-${item.id}`,
  laneId?: BriefSourceLaneId
): TodayBriefItem | null {
  const title = compactText(item.title);
  if (!title) {
    return null;
  }

  const briefHref = `/brief#${briefItemDomId(entryId)}`;
  const sourceHref = compactText(item.sourceUrl) || null;

  return {
    id: entryId,
    title,
    summary: itemSummary(item),
    href: sourceHref ?? briefHref,
    sourceHref,
    briefHref,
    senderLabel: senderLabel(item),
    sourceLabel: compactText(item.sourceLabel) || compactText(item.source) || null,
    timeLabel: formatTimeWindow(item),
    attendeeLabel: attendeeLabel(item),
    startAt: item.startAt ?? null,
    endAt: item.endAt ?? null,
    attendees: item.attendees ?? [],
    organizerName: compactText(item.organizerName) || null,
    organizerEmail: compactText(item.organizerEmail) || null,
    locationOrLink: compactText(item.locationOrLink) || null,
    sourceQualityLabel: sourceQualityLabel(item, laneId),
    canCreateTask: laneId === "email",
    taskDescription: title,
    taskNextStep: compactText(item.recommendedAction) || null,
    taskDesiredOutcome: itemSummary(item),
    taskPriority: item.priority,
    taskDueAt: item.dueAt,
    taskSource: [senderLabel(item), compactText(item.sourceLabel) || compactText(item.source)].filter(Boolean).join(" · ") || null,
    actionLabel: compactText(item.recommendedAction) || null,
    meta: [sectionLabel, ...itemMeta(item)].filter((value): value is string => Boolean(compactText(value)))
  };
}

function mapBriefItems(items: StructuredExecutiveBriefItem[] | undefined, section: string) {
  return (items ?? [])
    .map((item) => mapBriefItem(item, section))
    .filter((item): item is TodayBriefItem => Boolean(item));
}

function buildFreshness(snapshot: ExecutiveBriefSnapshot | null): TodayBriefFreshness {
  if (!snapshot) {
    return {
      status: "waiting",
      generatedAt: null,
      slot: null,
      label: "Waiting",
      detail: "No processed Executive Brief snapshot is available yet."
    };
  }

  const generatedAt = snapshot.generatedAt ?? snapshot.createdAt;
  const formatted = formatTimestamp(generatedAt);
  return {
    status: "processed",
    generatedAt,
    slot: snapshot.slot,
    label: formatted ?? "Processed",
    detail: `${snapshot.slot} brief${formatted ? ` generated ${formatted}` : " processed"}.`
  };
}

function compactStringList(items: string[] | undefined) {
  return (items ?? []).map(compactText).filter((item) => item.length > 0);
}

function mapLaneEntry(entry: StructuredBriefLaneEntry, laneId: BriefSourceLaneId) {
  return mapBriefItem(entry.item, entry.section, entry.sectionLabel, entry.id, laneId);
}

function taskPriorityLabel(item: LibraryItemSummary) {
  const priority = item.task?.priority ?? item.priority;
  if (!priority) {
    return null;
  }

  return `${priority.slice(0, 1).toUpperCase()}${priority.slice(1)} priority`;
}

function taskDueLabel(item: LibraryItemSummary) {
  const dueAt = item.task?.dueAt ?? item.dueAt;
  if (!dueAt) {
    return "No due date";
  }

  const parsed = Date.parse(dueAt);
  if (Number.isNaN(parsed)) {
    return "Due date unavailable";
  }

  const prefix = parsed < Date.now() ? "Overdue since" : "Due";
  return `${prefix} ${formatTimestamp(dueAt) ?? dueAt}`;
}

export function mapLibraryTaskToTodayTask(item: LibraryItemSummary): TodayTaskItem {
  return {
    id: item.id,
    title: item.title,
    detail: [taskDueLabel(item), taskPriorityLabel(item), item.sourcePath === "/brief" ? "From Executive Brief" : null]
      .filter(Boolean)
      .join(" · "),
    href: `/library/${item.id}?from=%2F`,
    sourcePath: item.sourcePath
  };
}

export function buildTodayViewModel(input: {
  snapshot: ExecutiveBriefSnapshot | null;
  openTasks: LibraryItemSummary[];
}): TodayViewModel {
  const structuredBrief: StructuredExecutiveBrief | null = input.snapshot?.structuredBrief ?? null;
  const mappedTasks = input.openTasks.map(mapLibraryTaskToTodayTask);
  const briefOriginTasks = mappedTasks.filter((task) => task.sourcePath === "/brief").slice(0, 3);

  if (!structuredBrief) {
    return {
      hasBriefSnapshot: Boolean(input.snapshot),
      commandSummary: [],
      currentFocus: [],
      decisionsNeeded: [],
      meetingPrep: [],
      carryForward: [],
      taskCandidates: [],
      openTasks: mappedTasks,
      sourceLanes: [],
      meetingRecordStatuses: {},
      briefFreshness: buildFreshness(input.snapshot),
      emptyState: {
        title: input.snapshot ? "Latest brief has no structured sections." : "No processed Executive Brief yet.",
        detail: input.snapshot
          ? "Open the full brief to inspect the raw snapshot while structured Today sections wait for parsed items."
          : "Today will populate once a BLACKHAWK_BRIEF_BUNDLE email is processed into an Executive Brief snapshot."
      }
    };
  }

  return {
    hasBriefSnapshot: true,
    commandSummary: compactStringList(structuredBrief.commandSummary),
    currentFocus: mapBriefItems(structuredBrief.topMoves, "focus"),
    decisionsNeeded: mapBriefItems(structuredBrief.decisionsNeeded, "decision"),
      meetingPrep: mapBriefItems(structuredBrief.meetingPrep, "meeting"),
      carryForward: mapBriefItems(structuredBrief.carryForward, "carry-forward"),
      taskCandidates: mapBriefItems(structuredBrief.taskCandidates, "task-candidate"),
      openTasks: mappedTasks,
      sourceLanes: buildStructuredBriefSourceLanes({ structuredBrief })
        .map((lane) => ({
          id: lane.id,
          label: lane.label,
          items: lane.entries.map((entry) => mapLaneEntry(entry, lane.id)).filter((item): item is TodayBriefItem => Boolean(item)),
          tasks: lane.id === "email" ? briefOriginTasks : []
        }))
        .filter((lane) => lane.items.length > 0 || lane.tasks.length > 0),
      meetingRecordStatuses: {},
      briefFreshness: buildFreshness(input.snapshot),
      emptyState: null
  };
}

export function attachMeetingRecordStatusesToTodayViewModel(
  model: TodayViewModel,
  statuses: MeetingRecordStatusSummary[]
): TodayViewModel {
  return {
    ...model,
    meetingRecordStatuses: Object.fromEntries(statuses.map((status) => [status.calendarEventId, status]))
  };
}
