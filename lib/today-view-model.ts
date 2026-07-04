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
import type { ExecutiveItemRegistryEntry } from "@/lib/executive-item-candidate-registry";

export type TodayBriefItem = {
  id: string;
  title: string;
  summary: string | null;
  href: string;
  sourceHref: string | null;
  briefHref: string;
  sourceLane: BriefSourceLaneId | null;
  sourceRefs: JsonValue[];
  senderLabel: string | null;
  sourceLabel: string | null;
  receivedAt: string | null;
  timeLabel: string | null;
  attendeeLabel: string | null;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
  attendees: JsonValue[];
  organizerName: string | null;
  organizerEmail: string | null;
  locationOrLink: string | null;
  calendarEventId: string | null;
  calendarSourceSystemId: string | null;
  descriptionSummary: string | null;
  relatedCompanyNames: string[];
  relatedPeopleNames: string[];
  internalExternalClassification: "internal" | "external" | "mixed" | "unknown" | null;
  priorityReasons: string[];
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
  executiveItemCandidates: ExecutiveItemRegistryEntry[];
  recommendedFocus: TodayBriefItem[];
  openLoops: TodayBriefItem[];
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
    item.receivedAt ? `Received ${formatTimestamp(item.receivedAt) ?? item.receivedAt}` : null,
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
    sourceLane: laneId ?? item.sourceLane ?? null,
    sourceRefs: item.sourceRefs ?? [],
    senderLabel: senderLabel(item),
    sourceLabel: compactText(item.sourceLabel) || compactText(item.source) || null,
    receivedAt: item.receivedAt ?? null,
    timeLabel: formatTimeWindow(item),
    attendeeLabel: attendeeLabel(item),
    startAt: item.startAt ?? null,
    endAt: item.endAt ?? null,
    timezone: compactText(item.timezone) || null,
    attendees: item.attendees ?? [],
    organizerName: compactText(item.organizerName) || null,
    organizerEmail: compactText(item.organizerEmail) || null,
    locationOrLink: compactText(item.locationOrLink) || null,
    calendarEventId: compactText(item.calendarEventId) || null,
    calendarSourceSystemId: compactText(item.calendarSourceSystemId) || null,
    descriptionSummary: compactText(item.descriptionSummary) || null,
    relatedCompanyNames: item.relatedCompanyNames ?? [],
    relatedPeopleNames: item.relatedPeopleNames ?? [],
    internalExternalClassification: item.internalExternalClassification ?? null,
    priorityReasons: item.priorityReasons ?? [],
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

function sourceRefDedupeKey(value: JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, JsonValue>;
  const url = compactText(typeof record.url === "string" ? record.url : null);
  const sourceSystemId = compactText(typeof record.sourceSystemId === "string" ? record.sourceSystemId : null);
  const sourceItemId = compactText(typeof record.sourceItemId === "string" ? record.sourceItemId : null);
  const sourceType = compactText(typeof record.sourceType === "string" ? record.sourceType : null);

  if (url) {
    return `url:${url.toLowerCase()}`;
  }

  if (sourceType && sourceSystemId) {
    return `system:${sourceType.toLowerCase()}:${sourceSystemId.toLowerCase()}`;
  }

  if (sourceType && sourceItemId) {
    return `item:${sourceType.toLowerCase()}:${sourceItemId.toLowerCase()}`;
  }

  return null;
}

function todayItemDedupeKey(item: TodayBriefItem) {
  if (item.sourceHref) {
    return `source:${item.sourceHref.toLowerCase()}`;
  }

  const refKey = item.sourceRefs.map(sourceRefDedupeKey).find((value): value is string => Boolean(value));
  if (refKey) {
    return `ref:${refKey}`;
  }

  return `title:${item.title.toLowerCase()}`;
}

function dedupeTodayLaneItems(items: TodayBriefItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = todayItemDedupeKey(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeTodayItems(items: TodayBriefItem[]) {
  return dedupeTodayLaneItems(items);
}

function resolveNow(value: number | Date | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }

  return value ?? Date.now();
}

function hasDueSoonDate(item: TodayBriefItem, now: number) {
  if (!item.taskDueAt) {
    return false;
  }

  const parsed = Date.parse(item.taskDueAt);
  if (Number.isNaN(parsed)) {
    return false;
  }

  const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000;
  return parsed <= threeDaysFromNow;
}

function focusScore(item: TodayBriefItem, now: number) {
  let score = 0;
  const text = [item.title, item.summary, item.actionLabel, item.sourceLabel, ...item.meta].join(" ").toLowerCase();

  if (item.taskPriority === "high") {
    score += 50;
  } else if (item.taskPriority === "medium") {
    score += 20;
  }

  if (item.meta.some((value) => value.toLowerCase().includes("decision"))) {
    score += 40;
  }

  if (item.sourceLane === "calendar_meetings") {
    score += 30;
  }

  if (item.actionLabel) {
    score += 25;
  }

  if (hasDueSoonDate(item, now)) {
    score += 25;
  }

  if (/\b(escalat|risk|blocked|urgent|deadline|waiting|approval|approve|decide|decision|prep|prepare)\b/.test(text)) {
    score += 20;
  }

  return score;
}

function buildRecommendedFocus(input: {
  currentFocus: TodayBriefItem[];
  decisionsNeeded: TodayBriefItem[];
  meetingPrep: TodayBriefItem[];
  taskCandidates: TodayBriefItem[];
  now: number;
}) {
  return dedupeTodayItems([
    ...input.decisionsNeeded,
    ...input.meetingPrep,
    ...input.currentFocus,
    ...input.taskCandidates
  ])
    .map((item, index) => ({ item, index, score: focusScore(item, input.now) }))
    .filter(({ item, score }) => score > 0 || item.taskPriority === "high")
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
    .slice(0, 3);
}

function buildOpenLoops(input: {
  carryForward: TodayBriefItem[];
  taskCandidates: TodayBriefItem[];
  recommendedFocus: TodayBriefItem[];
}) {
  const focusKeys = new Set(input.recommendedFocus.map(todayItemDedupeKey));

  return dedupeTodayItems([...input.carryForward, ...input.taskCandidates])
    .filter((item) => !focusKeys.has(todayItemDedupeKey(item)))
    .slice(0, 6);
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
  executiveItemCandidates?: ExecutiveItemRegistryEntry[];
  now?: number | Date;
}): TodayViewModel {
  const structuredBrief: StructuredExecutiveBrief | null = input.snapshot?.structuredBrief ?? null;
  const now = resolveNow(input.now);
  const mappedTasks = input.openTasks.map(mapLibraryTaskToTodayTask);
  const briefOriginTasks = mappedTasks.filter((task) => task.sourcePath === "/brief").slice(0, 3);
  const executiveItemCandidates = input.executiveItemCandidates ?? [];

  if (!structuredBrief) {
    return {
      hasBriefSnapshot: Boolean(input.snapshot),
      commandSummary: [],
      executiveItemCandidates,
      recommendedFocus: [],
      openLoops: [],
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

  const currentFocus = mapBriefItems(structuredBrief.topMoves, "focus");
  const decisionsNeeded = mapBriefItems(structuredBrief.decisionsNeeded, "decision");
  const meetingPrep = mapBriefItems(structuredBrief.meetingPrep, "meeting");
  const carryForward = mapBriefItems(structuredBrief.carryForward, "carry-forward");
  const taskCandidates = mapBriefItems(structuredBrief.taskCandidates, "task-candidate");
  const recommendedFocus = buildRecommendedFocus({
    currentFocus,
    decisionsNeeded,
    meetingPrep,
    taskCandidates,
    now
  });
  const openLoops = buildOpenLoops({
    carryForward,
    taskCandidates,
    recommendedFocus
  });

  return {
    hasBriefSnapshot: true,
    commandSummary: compactStringList(structuredBrief.commandSummary),
    executiveItemCandidates,
    recommendedFocus,
    openLoops,
    currentFocus,
    decisionsNeeded,
    meetingPrep,
    carryForward,
    taskCandidates,
    openTasks: mappedTasks,
    sourceLanes: buildStructuredBriefSourceLanes({ structuredBrief })
      .map((lane) => ({
        id: lane.id,
        label: lane.label,
        items: dedupeTodayLaneItems(
          lane.entries.map((entry) => mapLaneEntry(entry, lane.id)).filter((item): item is TodayBriefItem => Boolean(item))
        ),
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
