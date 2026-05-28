import "server-only";

import type { LibraryItemSummary } from "@/lib/capture-library";
import { listLibraryItems } from "@/lib/capture-library";
import type {
  PriorityInboxDispositionReason,
  PriorityInboxItem,
  PriorityInboxRecommendedAction,
  PriorityInboxSource,
  PriorityInboxVisibleState
} from "@/lib/priority-inbox";
import { getResolvedVisibleState } from "@/lib/priority-inbox";
import { listPriorityInboxItems } from "@/lib/priority-inbox-store";
import type { OutlookMessage } from "@/lib/microsoft/outlook-mail";
import { normalizeOutlookMessageToWorkSignal } from "@/lib/work-signals/normalize-outlook";
import { scoreExecutiveRelevance } from "@/lib/work-signals/ranking";
import type { WorkSignalRelevance } from "@/lib/work-signals/types";

type DailyBriefSectionEmptyStates = {
  decisionsNeeded: string;
  peopleWaitingOnWill: string;
  priorityInboxItems: string;
  meetingPrep: string;
  strategicFyis: string;
  followUpsOpenLoops: string;
  recentlyCaptured: string;
};

export type DailyBriefCardPriority = "p1" | "p2" | "p3";
export type DailyBriefCardConfidence = "high" | "medium" | "needs_review";
export type DailyBriefCardSource =
  | "manual_capture"
  | "email"
  | "teams"
  | "calendar"
  | "transcript"
  | "document"
  | "taskrobin"
  | "brain"
  | "needs_review";

export type DailyBriefItem = {
  id: string;
  recordType: "priority_inbox" | "capture";
  title: string;
  bodyOrSummary: string;
  reason: string;
  recommendedAction: string;
  source: DailyBriefCardSource;
  sourceLabel: string;
  sourceAnchor: string;
  sourceSummary: string;
  sourceHref: string | null;
  timestamp: string | null;
  updatedAt: string | null;
  dueDate: string | null;
  priority: DailyBriefCardPriority;
  confidence: DailyBriefCardConfidence;
  counterparty: string | null;
  expectedOutcome: string | null;
  tags: string[];
  rawMetadata: Record<string, unknown>;
};

export type DailyBriefPreparedBrief = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  startsAt: string;
  level: "light" | "standard";
  confidence: DailyBriefCardConfidence;
  source: DailyBriefCardSource;
  sourceLabel: string;
  sourceAnchor: string;
  whyShown: string;
  sourceSummary: string;
  sourceHref: string | null;
  sections: Array<{
    label: string;
    body: string;
  }>;
  recommendedAction: string;
};

export type DailyBriefData = {
  generatedAt: string;
  decisionsNeeded: DailyBriefItem[];
  peopleWaitingOnWill: DailyBriefItem[];
  priorityInboxItems: DailyBriefItem[];
  meetingPrep: DailyBriefPreparedBrief[];
  strategicFyis: DailyBriefItem[];
  followUpsOpenLoops: DailyBriefItem[];
  recentlyCaptured: DailyBriefItem[];
  lowValueNoiseFiltered: {
    count: number;
    label: string;
  };
  emptyStates: DailyBriefSectionEmptyStates;
};

type BuildDailyBriefInput = {
  priorityInboxItems: PriorityInboxItem[];
  libraryItems: LibraryItemSummary[];
  now?: Date;
};

const LOW_VALUE_NOISE_REASONS = new Set<PriorityInboxDispositionReason>([
  "low_value",
  "irrelevant",
  "duplicate",
  "generic_update"
]);

const DECISION_LANGUAGE_PATTERN =
  /\b(decision|decide|deciding|approval|approve|approved|confirm|confirmed|choose|choice|sign off)\b/i;
const DIRECT_ASK_LANGUAGE_PATTERN =
  /\b(please|can you|could you|need you to|let me know|reply|follow up|action required|get back to)\b/i;
const WAITING_ON_OTHERS_PATTERN =
  /\b(waiting for|awaiting|pending from|once they|when they|after they|until they)\b/i;
const ACTIVE_INBOX_PRIORITIES: Record<Extract<PriorityInboxVisibleState, "high_priority" | "needs_review">, number> = {
  high_priority: 0,
  needs_review: 1
};
const FOLLOW_UP_TASK_CATEGORIES = new Set(["person", "agenda", "priority action", "waiting for"]);
const MEETING_PREP_CATEGORIES = new Set(["calendar", "agenda"]);

function formatDisplayMoment(value: string | null | undefined) {
  if (!value) {
    return "Time unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(value);
}

function compactText(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function trimToSentence(value: string, fallback: string) {
  const normalized = compactText(value, fallback);
  if (normalized.length <= 220) {
    return normalized;
  }

  return `${normalized.slice(0, 217).trimEnd()}...`;
}

function resolvePriorityInboxHref(item: PriorityInboxItem) {
  if (item.sourceLink) {
    return item.sourceLink;
  }

  if (item.source === "forwarded_email") {
    return `/inbox/${item.id}`;
  }

  return null;
}

function resolveCaptureHref(item: LibraryItemSummary) {
  if (item.sourceLinkage?.nativeSourceLink) {
    return item.sourceLinkage.nativeSourceLink;
  }

  if (item.sourceLinkage?.fallbackDetailHref) {
    return item.sourceLinkage.fallbackDetailHref;
  }

  if (item.type === "task") {
    return `/library/${item.id}?from=%2Flibrary%2Ftasks`;
  }

  return `/library/${item.id}?from=%2Flibrary`;
}

function priorityInboxSortRank(item: PriorityInboxItem) {
  const visibleState = getResolvedVisibleState(item);
  if (visibleState === "high_priority" || visibleState === "needs_review") {
    return ACTIVE_INBOX_PRIORITIES[visibleState];
  }

  return 99;
}

function comparePriorityInboxItems(left: PriorityInboxItem, right: PriorityInboxItem) {
  const priorityDelta = priorityInboxSortRank(left) - priorityInboxSortRank(right);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftTimestamp = parseDate(left.receivedAt ?? left.lastChangedAt);
  const rightTimestamp = parseDate(right.receivedAt ?? right.lastChangedAt);
  const normalizedLeft = Number.isFinite(leftTimestamp) ? leftTimestamp : 0;
  const normalizedRight = Number.isFinite(rightTimestamp) ? rightTimestamp : 0;

  return normalizedRight - normalizedLeft;
}

function compareLibraryRecency(left: LibraryItemSummary, right: LibraryItemSummary) {
  return parseDate(right.lastActiveAt) - parseDate(left.lastActiveAt);
}

function compareLibraryCapturedAt(left: LibraryItemSummary, right: LibraryItemSummary) {
  return parseDate(right.capturedAt) - parseDate(left.capturedAt);
}

function compareLibraryDueSoon(left: LibraryItemSummary, right: LibraryItemSummary) {
  const leftDue = parseDate(left.task?.dueAt ?? left.dueAt);
  const rightDue = parseDate(right.task?.dueAt ?? right.dueAt);
  const normalizedLeft = Number.isFinite(leftDue) ? leftDue : Number.POSITIVE_INFINITY;
  const normalizedRight = Number.isFinite(rightDue) ? rightDue : Number.POSITIVE_INFINITY;

  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft - normalizedRight;
  }

  return compareLibraryRecency(left, right);
}

function mapInboxSource(source: PriorityInboxSource): DailyBriefCardSource {
  if (source === "teams") {
    return "teams";
  }

  return "email";
}

function mapCaptureSource(item: LibraryItemSummary): DailyBriefCardSource {
  const linkedSource = item.sourceLinkage?.source;
  if (linkedSource === "outlook" || linkedSource === "gmail" || linkedSource === "forwarded_email") {
    return "email";
  }

  if (linkedSource === "teams") {
    return "teams";
  }

  if (item.task?.categoryName === "Calendar") {
    return "calendar";
  }

  if (item.sourcePath === "/capture") {
    return "manual_capture";
  }

  if (item.note?.linkedInitiativeId || item.task?.linkedInitiativeId) {
    return "brain";
  }

  return "document";
}

function mapInboxConfidence(item: PriorityInboxItem, relevance: WorkSignalRelevance | null): DailyBriefCardConfidence {
  if (item.dispositionReason === "decision_needed" || relevance?.level === "high") {
    return "high";
  }

  if (item.supportingSignals.length > 0 || relevance?.level === "medium") {
    return "medium";
  }

  return "needs_review";
}

function mapCaptureConfidence(item: LibraryItemSummary): DailyBriefCardConfidence {
  if (item.task?.priority === "high" || item.task?.dueAt || item.sourceLinkage?.priorityInboxItemId) {
    return "high";
  }

  if (item.note?.linkedInitiativeId || item.task?.linkedInitiativeId) {
    return "medium";
  }

  return "needs_review";
}

function mapInboxPriority(item: PriorityInboxItem, relevance: WorkSignalRelevance | null): DailyBriefCardPriority {
  if (
    item.dispositionReason === "decision_needed" ||
    getResolvedVisibleState(item) === "high_priority" ||
    (relevance?.score ?? 0) >= 7
  ) {
    return "p1";
  }

  if (
    item.dispositionReason === "reply_needed" ||
    item.dispositionReason === "follow_up_needed" ||
    (relevance?.score ?? 0) >= 4
  ) {
    return "p2";
  }

  return "p3";
}

function mapCapturePriority(item: LibraryItemSummary): DailyBriefCardPriority {
  if (item.task?.priority === "high" || item.task?.categoryName === "Priority Action") {
    return "p1";
  }

  if (item.task?.dueAt || item.note?.linkedInitiativeId || item.task?.linkedInitiativeId) {
    return "p2";
  }

  return "p3";
}

function mapInboxRecommendedAction(action: PriorityInboxRecommendedAction) {
  switch (action) {
    case "create_task":
      return "Convert the thread into a canonical next step.";
    case "add_commitment":
      return "Close the loop and preserve the commitment in the Library.";
    case "save_reference":
      return "Keep the source nearby without promoting it into action.";
    case "mark_handled":
      return "Confirm the thread is truly closed and remove it from active attention.";
    case "defer":
    default:
      return "Review the thread and decide the clean next move.";
  }
}

function getInboxSourceAnchor(item: PriorityInboxItem) {
  return [item.sourceLabel, item.sender, formatDisplayMoment(item.receivedAt ?? item.lastChangedAt)]
    .filter(Boolean)
    .join(" · ");
}

function getCaptureSourceAnchor(item: LibraryItemSummary) {
  const sourceLinkage = item.sourceLinkage;
  if (sourceLinkage?.sourceLabel || sourceLinkage?.sender || sourceLinkage?.receivedAt) {
    return [
      sourceLinkage.sourceLabel ?? "Priority Inbox",
      sourceLinkage.sender ?? sourceLinkage.threadTitle ?? "Source-linked capture",
      formatDisplayMoment(sourceLinkage.receivedAt ?? item.capturedAt)
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (item.note?.linkedInitiativeTitle || item.task?.linkedInitiativeTitle) {
    return ["Initiative-linked capture", item.note?.linkedInitiativeTitle ?? item.task?.linkedInitiativeTitle ?? null]
      .filter(Boolean)
      .join(" · ");
  }

  return ["Library capture", formatDisplayMoment(item.capturedAt)].filter(Boolean).join(" · ");
}

function getCaptureSourceSummary(item: LibraryItemSummary) {
  if (item.sourceLinkage?.summary) {
    return trimToSentence(item.sourceLinkage.summary, item.preview);
  }

  if (item.type === "task") {
    const detail = [item.task?.nextStep, item.task?.desiredOutcome].filter(Boolean).join(" ");
    return trimToSentence(detail, item.preview);
  }

  return trimToSentence(item.preview, "Review the capture in the Library.");
}

function summarizeWorkSignalRelevance(relevance: WorkSignalRelevance | null) {
  if (!relevance || relevance.reasons.length === 0) {
    return null;
  }

  return relevance.reasons
    .slice(0, 2)
    .map((reason) => reason.label)
    .join(" · ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeInboxToOutlookMessage(item: PriorityInboxItem): OutlookMessage | null {
  if (item.source !== "outlook") {
    return null;
  }

  const metadata = isRecord(item.sourceMetadata) ? item.sourceMetadata : {};
  const importance =
    metadata.importance === "low" || metadata.importance === "normal" || metadata.importance === "high"
      ? metadata.importance
      : "normal";
  const inferenceClassification =
    metadata.inferenceClassification === "focused" || metadata.inferenceClassification === "other"
      ? metadata.inferenceClassification
      : undefined;
  const isRead = typeof metadata.isRead === "boolean" ? metadata.isRead : undefined;
  const hasAttachments = typeof metadata.hasAttachments === "boolean" ? metadata.hasAttachments : undefined;
  const flagStatus =
    metadata.flagStatus === "notFlagged" || metadata.flagStatus === "complete" || metadata.flagStatus === "flagged"
      ? metadata.flagStatus
      : item.updatedCue === "Flagged"
        ? "flagged"
        : undefined;

  return {
    id: item.externalMessageId ?? item.id,
    conversationId: item.conversationId ?? null,
    subject: item.threadTitle,
    receivedDateTime: item.receivedAt ?? item.lastChangedAt ?? null,
    bodyPreview: item.summary || item.primaryLine,
    webLink: item.sourceLink ?? null,
    internetMessageId: typeof metadata.internetMessageId === "string" ? metadata.internetMessageId : null,
    importance,
    inferenceClassification,
    isRead,
    hasAttachments,
    lastModifiedDateTime: typeof metadata.lastModifiedDateTime === "string" ? metadata.lastModifiedDateTime : null,
    flag: flagStatus ? { flagStatus } : undefined,
    from: {
      emailAddress: {
        name: item.sender,
        address: item.senderRole ?? null
      }
    },
    toRecipients: [],
    ccRecipients: []
  };
}

function getOutlookSignal(item: PriorityInboxItem) {
  const message = normalizeInboxToOutlookMessage(item);
  if (!message) {
    return null;
  }

  const signal = normalizeOutlookMessageToWorkSignal(message);
  return {
    signal,
    relevance: scoreExecutiveRelevance(signal)
  };
}

function getInboxLanguageHaystack(item: PriorityInboxItem, relevance: WorkSignalRelevance | null) {
  return [
    item.threadTitle,
    item.summary,
    item.primaryLine,
    item.whySurfaced,
    item.dispositionLabel,
    relevance?.reasons.map((reason) => reason.label).join(" ")
  ]
    .filter(Boolean)
    .join(" ");
}

function isDecisionItem(item: PriorityInboxItem, relevance: WorkSignalRelevance | null) {
  if (item.dispositionReason === "decision_needed") {
    return true;
  }

  return DECISION_LANGUAGE_PATTERN.test(getInboxLanguageHaystack(item, relevance));
}

function isPeopleWaitingOnWillItem(item: PriorityInboxItem, relevance: WorkSignalRelevance | null, followUpRequired: boolean) {
  if (WAITING_ON_OTHERS_PATTERN.test(getInboxLanguageHaystack(item, relevance))) {
    return false;
  }

  if (item.dispositionReason === "reply_needed" || item.dispositionReason === "follow_up_needed") {
    return true;
  }

  return followUpRequired || DIRECT_ASK_LANGUAGE_PATTERN.test(getInboxLanguageHaystack(item, relevance));
}

function isLowValueNoiseItem(item: PriorityInboxItem) {
  const resolvedState = getResolvedVisibleState(item);
  return (resolvedState === "handled" || resolvedState === "dismissed") && Boolean(item.dispositionReason && LOW_VALUE_NOISE_REASONS.has(item.dispositionReason));
}

function isMeetingPrepTask(item: LibraryItemSummary, nowIso: string) {
  if (item.type !== "task" || item.status !== "active") {
    return false;
  }

  const categoryName = item.task?.categoryName.trim().toLowerCase();
  if (!categoryName || !MEETING_PREP_CATEGORIES.has(categoryName)) {
    return false;
  }

  const dueAt = parseDate(item.task?.dueAt ?? item.dueAt);
  if (!Number.isFinite(dueAt)) {
    return false;
  }

  const now = parseDate(nowIso);
  return dueAt >= now && dueAt <= now + 1000 * 60 * 60 * 24 * 3;
}

function isFollowUpTask(item: LibraryItemSummary) {
  if (item.type !== "task" || item.status !== "active") {
    return false;
  }

  const categoryName = item.task?.categoryName.trim().toLowerCase() ?? "";
  if (FOLLOW_UP_TASK_CATEGORIES.has(categoryName)) {
    return true;
  }

  return Boolean(item.task?.priority === "high" || item.task?.dueAt || item.sourceLinkage?.priorityInboxItemId);
}

function isStrategicFyi(item: LibraryItemSummary) {
  if (item.type !== "note" || item.status !== "active") {
    return false;
  }

  return Boolean(item.note?.linkedInitiativeId || item.sourceLinkage?.priorityInboxItemId);
}

function isRecentCapture(item: LibraryItemSummary) {
  return item.status === "active";
}

function toInboxDailyBriefItem(params: {
  item: PriorityInboxItem;
  reason: string;
  recommendedAction?: string;
  relevance: WorkSignalRelevance | null;
  followUpRequired: boolean;
}): DailyBriefItem {
  const { item, reason, recommendedAction, relevance, followUpRequired } = params;
  const relevanceSummary = summarizeWorkSignalRelevance(relevance);

  return {
    id: item.id,
    recordType: "priority_inbox",
    title: compactText(item.threadTitle, "Untitled inbox item"),
    bodyOrSummary: trimToSentence(item.summary, item.primaryLine),
    reason,
    recommendedAction: recommendedAction ?? mapInboxRecommendedAction(item.recommendedAction),
    source: mapInboxSource(item.source),
    sourceLabel: item.sourceLabel,
    sourceAnchor: getInboxSourceAnchor(item),
    sourceSummary: trimToSentence(
      [item.whySurfaced, relevanceSummary, item.supportingSignals.slice(0, 2).join(" · ")].filter(Boolean).join(" · "),
      item.whySurfaced
    ),
    sourceHref: resolvePriorityInboxHref(item),
    timestamp: item.receivedAt ?? item.lastChangedAt ?? null,
    updatedAt: item.lastChangedAt ?? item.receivedAt ?? null,
    dueDate: null,
    priority: mapInboxPriority(item, relevance),
    confidence: mapInboxConfidence(item, relevance),
    counterparty: item.sender,
    expectedOutcome:
      item.taskPrefill?.desiredOutcome ??
      (followUpRequired ? "Close the loop from the source thread." : item.relationshipCue ?? null),
    tags: item.supportingSignals.slice(0, 3),
    rawMetadata: {
      visibleState: getResolvedVisibleState(item),
      disposition: item.disposition ?? null,
      dispositionReason: item.dispositionReason ?? null,
      supportingSignals: item.supportingSignals,
      recommendedAction: item.recommendedAction,
      workSignalRelevance: relevance
    }
  };
}

function toCaptureDailyBriefItem(params: {
  item: LibraryItemSummary;
  reason: string;
  recommendedAction?: string;
  expectedOutcome?: string | null;
}): DailyBriefItem {
  const { item, reason, recommendedAction, expectedOutcome } = params;

  return {
    id: item.id,
    recordType: "capture",
    title: item.title,
    bodyOrSummary: trimToSentence(item.preview, "Open the capture in the Library."),
    reason,
    recommendedAction:
      recommendedAction ??
      (item.type === "task"
        ? item.task?.nextStep || "Review the capture and confirm the next move."
        : "Keep this nearby as durable context."),
    source: mapCaptureSource(item),
    sourceLabel: item.sourceLinkage?.sourceLabel ?? (item.sourcePath === "/capture" ? "Manual capture" : "Library"),
    sourceAnchor: getCaptureSourceAnchor(item),
    sourceSummary: getCaptureSourceSummary(item),
    sourceHref: resolveCaptureHref(item),
    timestamp: item.capturedAt,
    updatedAt: item.lastActiveAt,
    dueDate: item.task?.dueAt ?? item.dueAt,
    priority: mapCapturePriority(item),
    confidence: mapCaptureConfidence(item),
    counterparty: item.sourceLinkage?.sender ?? null,
    expectedOutcome: expectedOutcome ?? item.task?.desiredOutcome ?? null,
    tags: [item.task?.categoryName, item.note?.linkedInitiativeTitle].filter((value): value is string => Boolean(value)),
    rawMetadata: {
      type: item.type,
      status: item.status,
      saveState: item.saveState,
      linkedInitiativeId: item.note?.linkedInitiativeId ?? item.task?.linkedInitiativeId ?? null,
      priorityInboxItemId: item.sourceLinkage?.priorityInboxItemId ?? null
    }
  };
}

function toMeetingPrepBrief(item: LibraryItemSummary): DailyBriefPreparedBrief {
  const dueAt = item.task?.dueAt ?? item.dueAt ?? item.capturedAt;
  const categoryName = item.task?.categoryName ?? "Meeting prep";
  const linkedInitiative = item.task?.linkedInitiativeTitle ?? item.note?.linkedInitiativeTitle ?? null;
  const sections = [
    {
      label: "Objective",
      body: item.task?.description || item.title
    },
    {
      label: "Next step",
      body: item.task?.nextStep || "Review the task and confirm what preparation is actually needed."
    },
    {
      label: "Desired outcome",
      body:
        item.task?.desiredOutcome ||
        "Enter the meeting with the current context, the likely ask, and a clean next move."
    },
    {
      label: "Source context",
      body: getCaptureSourceSummary(item)
    }
  ];

  if (linkedInitiative) {
    sections.push({
      label: "Strategic context",
      body: `Keep the meeting tied to ${linkedInitiative}.`
    });
  }

  return {
    id: `${item.id}::meeting-prep`,
    meetingId: item.id,
    meetingTitle: item.title,
    startsAt: dueAt,
    level: item.task?.priority === "high" ? "standard" : "light",
    confidence: mapCaptureConfidence(item),
    source: mapCaptureSource(item),
    sourceLabel: item.sourceLinkage?.sourceLabel ?? categoryName,
    sourceAnchor: getCaptureSourceAnchor(item),
    whyShown: `${categoryName} task due soon.`,
    sourceSummary: getCaptureSourceSummary(item),
    sourceHref: resolveCaptureHref(item),
    sections,
    recommendedAction: item.task?.nextStep || "Review the prep task before the meeting."
  };
}

function buildEmptyStates(): DailyBriefSectionEmptyStates {
  return {
    decisionsNeeded: "No source-grounded decisions are waiting right now.",
    peopleWaitingOnWill: "No active source-grounded asks currently look like Will owes the next move.",
    priorityInboxItems: "No remaining active inbox items deserve the top layer right now.",
    meetingPrep:
      "No calendar source is connected yet. Meeting prep is only surfacing due-soon Calendar and Agenda tasks for now.",
    strategicFyis: "No recent strategic context needs to stay in the active layer right now.",
    followUpsOpenLoops: "No canonical follow-ups are currently active.",
    recentlyCaptured: "Nothing recently captured needs another pass right now."
  };
}

export function buildChiefOfStaffDailyBriefData(input: BuildDailyBriefInput): DailyBriefData {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const activeInboxItems = input.priorityInboxItems
    .filter((item) => {
      const visibleState = getResolvedVisibleState(item);
      return visibleState === "high_priority" || visibleState === "needs_review";
    })
    .sort(comparePriorityInboxItems);
  const activeLibraryItems = input.libraryItems.filter((item) => item.status === "active");
  const activeTaskItems = activeLibraryItems.filter((item) => item.type === "task").sort(compareLibraryDueSoon);
  const activeNoteItems = activeLibraryItems.filter((item) => item.type === "note").sort(compareLibraryRecency);

  const outlookContextByItemId = new Map(
    activeInboxItems.map((item) => {
      const outlook = getOutlookSignal(item);
      return [
        item.id,
        {
          relevance: outlook?.relevance ?? null,
          followUpRequired: outlook?.signal.followUpRequired ?? false
        }
      ] as const;
    })
  );

  const usedInboxIds = new Set<string>();
  const usedCaptureIds = new Set<string>();

  const decisionsNeeded = activeInboxItems
    .filter((item) => isDecisionItem(item, outlookContextByItemId.get(item.id)?.relevance ?? null))
    .slice(0, 3)
    .map((item) => {
      usedInboxIds.add(item.id);
      return toInboxDailyBriefItem({
        item,
        reason: "Decision-needed source signal.",
        recommendedAction: "Open the thread and make the call or define the decision owner.",
        relevance: outlookContextByItemId.get(item.id)?.relevance ?? null,
        followUpRequired: outlookContextByItemId.get(item.id)?.followUpRequired ?? false
      });
    });

  const peopleWaitingOnWill = activeInboxItems
    .filter((item) => !usedInboxIds.has(item.id))
    .filter((item) =>
      isPeopleWaitingOnWillItem(
        item,
        outlookContextByItemId.get(item.id)?.relevance ?? null,
        outlookContextByItemId.get(item.id)?.followUpRequired ?? false
      )
    )
    .slice(0, 3)
    .map((item) => {
      usedInboxIds.add(item.id);
      return toInboxDailyBriefItem({
        item,
        reason: "Looks like Will owes the next move.",
        recommendedAction: "Reply or close the loop from the native thread.",
        relevance: outlookContextByItemId.get(item.id)?.relevance ?? null,
        followUpRequired: true
      });
    });

  const priorityInboxItems = activeInboxItems
    .filter((item) => !usedInboxIds.has(item.id))
    .slice(0, 5)
    .map((item) => {
      usedInboxIds.add(item.id);
      return toInboxDailyBriefItem({
        item,
        reason: "Remaining active inbox signal after decisions and direct asks are carved out.",
        relevance: outlookContextByItemId.get(item.id)?.relevance ?? null,
        followUpRequired: outlookContextByItemId.get(item.id)?.followUpRequired ?? false
      });
    });

  const meetingPrep = activeTaskItems
    .filter((item) => !usedCaptureIds.has(item.id))
    .filter((item) => isMeetingPrepTask(item, nowIso))
    .slice(0, 3)
    .map((item) => {
      usedCaptureIds.add(item.id);
      return toMeetingPrepBrief(item);
    });

  const strategicFyis = activeNoteItems
    .filter((item) => !usedCaptureIds.has(item.id))
    .filter((item) => isStrategicFyi(item))
    .slice(0, 3)
    .map((item) => {
      usedCaptureIds.add(item.id);
      return toCaptureDailyBriefItem({
        item,
        reason: "Durable context worth keeping nearby without turning it into action."
      });
    });

  const followUpsOpenLoops = activeTaskItems
    .filter((item) => !usedCaptureIds.has(item.id))
    .filter((item) => isFollowUpTask(item))
    .slice(0, 4)
    .map((item) => {
      usedCaptureIds.add(item.id);
      return toCaptureDailyBriefItem({
        item,
        reason: "Canonical open loop that still looks operationally live.",
        expectedOutcome:
          item.task?.desiredOutcome ??
          (item.task?.categoryName === "Waiting For" ? "Wait for the trigger, then pull it back into active attention." : null)
      });
    });

  const recentlyCaptured = activeLibraryItems
    .filter((item) => !usedCaptureIds.has(item.id))
    .filter((item) => isRecentCapture(item))
    .sort(compareLibraryCapturedAt)
    .slice(0, 4)
    .map((item) => {
      usedCaptureIds.add(item.id);
      return toCaptureDailyBriefItem({
        item,
        reason: "Recent capture worth one more pass before it drops into the background.",
        recommendedAction:
          item.type === "task"
            ? item.task?.nextStep || "Decide whether this task belongs in the active layer."
            : "Review, keep, or let this context recede into the Library."
      });
    });

  const lowValueNoiseFilteredCount = input.priorityInboxItems.filter((item) => isLowValueNoiseItem(item)).length;

  return {
    generatedAt: nowIso,
    decisionsNeeded,
    peopleWaitingOnWill,
    priorityInboxItems,
    meetingPrep,
    strategicFyis,
    followUpsOpenLoops,
    recentlyCaptured,
    lowValueNoiseFiltered: {
      count: lowValueNoiseFilteredCount,
      label:
        lowValueNoiseFilteredCount === 0
          ? "No low-value noise is currently being filtered out."
          : `${lowValueNoiseFilteredCount} low-value or duplicative inbox items were filtered out of the active layer.`
    },
    emptyStates: buildEmptyStates()
  };
}

export const buildDailyBriefData = buildChiefOfStaffDailyBriefData;

export async function getChiefOfStaffDailyBriefData() {
  const [priorityInboxItems, libraryItems] = await Promise.all([
    listPriorityInboxItems(),
    listLibraryItems({
      scope: "library",
      search: "",
      type: "all",
      status: "active",
      due: "all",
      category: "all"
    })
  ]);

  return buildChiefOfStaffDailyBriefData({
    priorityInboxItems,
    libraryItems
  });
}
