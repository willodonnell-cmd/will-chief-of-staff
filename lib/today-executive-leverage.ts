import type { InitiativeOption } from "@/lib/blackhawk-capture-model";
import { sanitizeDisplayText } from "@/lib/agent-signal-brief";
import { isDiagnosticSystemSignal } from "@/lib/executive-work-adapters";
import type { TodayMicrosoftSourceMode } from "@/lib/today-calendar-signals";
import {
  getExecutiveRecommendedActionLabel,
  getExecutiveWorkTypeLabel,
  type ExecutivePriority,
  type ExecutiveRecommendedAction,
  type ExecutiveSignal,
  type ExecutiveSignalSourceType,
  type ExecutiveWorkType
} from "@/lib/executive-work";

export type TopNextBestAction = {
  id: string;
  title: string;
  summary: string;
  work_type: ExecutiveWorkType;
  work_type_label: string;
  priority?: ExecutivePriority | null;
  recommended_action?: ExecutiveRecommendedAction | null;
  recommended_action_label: string;
  why_shown: string;
  due_at?: string | null;
  source_label: string;
  related_people: string[];
  related_companies: string[];
  related_initiatives: string[];
  href?: string | null;
  confidence?: number | null;
};

export type ConsequentialMeetingItem = {
  id: string;
  title: string;
  summary: string;
  meeting_time?: string | null;
  why_consequential: string;
  source_label_compact?: string | null;
  recommended_action?: ExecutiveRecommendedAction | null;
  href?: string | null;
  confidence?: number | null;
};

export type DecisionNeededItem = {
  id: string;
  title: string;
  decision_question: string;
  recommended_action?: ExecutiveRecommendedAction | null;
  priority?: ExecutivePriority | null;
  deadline?: string | null;
  risks_or_tradeoffs?: string | null;
  href?: string | null;
  confidence?: number | null;
};

export type ProtectedValueCreationItem = {
  id: string;
  title: string;
  current_focus?: string | null;
  latest_movement?: string | null;
  blocker?: string | null;
  recommended_action?: ExecutiveRecommendedAction | null;
  related_signal_count: number;
  href?: string | null;
};

export type OpportunityQueueItem = {
  id: string;
  company_or_counterparty: string;
  title: string;
  strategic_relevance?: string | null;
  recommended_action?: ExecutiveRecommendedAction | null;
  recommended_action_label: string;
  last_touch_at?: string | null;
  owner?: string | null;
  href?: string | null;
  confidence?: number | null;
};

export type DelegateWaitingOnItem = {
  id: string;
  title: string;
  delegated_to?: string | null;
  waiting_on?: string | null;
  expected_outcome?: string | null;
  last_touch_at?: string | null;
  recommended_action?: ExecutiveRecommendedAction | null;
  href?: string | null;
  confidence?: number | null;
};

export type QuietlyHandledItem = {
  id: string;
  title: string;
  summary: string;
  reason_suppressed: string;
  source_label: string;
  href?: string | null;
  confidence?: number | null;
};

export type TodayExecutiveLeverageSourceCounts = {
  work_type: Partial<Record<ExecutiveWorkType, number>>;
  priority: Partial<Record<ExecutivePriority, number>>;
  source_type: Partial<Record<ExecutiveSignalSourceType, number>>;
};

export type TodayExecutiveLeverageEmptyState = {
  title: string;
  detail: string;
};

export type TodayExecutiveLeverageSectionOverlapCounts = {
  consequentialMeetings: number;
  decisionsNeeded: number;
  protectedValueCreation: number;
  opportunityQueue: number;
  delegateWaitingOn: number;
  quietlyHandled: number;
};

export type TodayExecutiveLeverageSectionOverflowCounts = {
  consequentialMeetings: number;
  decisionsNeeded: number;
  protectedValueCreation: number;
  opportunityQueue: number;
  delegateWaitingOn: number;
  quietlyHandled: number;
};

export const TODAY_MEETING_SOURCE_TYPES = [
  "outlook_calendar",
  "agent_brief",
  "priority_inbox",
  "forwarded_email",
  "library",
  "other"
] as const;

export type TodayMeetingSourceType = (typeof TODAY_MEETING_SOURCE_TYPES)[number];

export type TodayMeetingSourceCounts = Partial<Record<TodayMeetingSourceType, number>>;

export type TodayExecutiveLeverageMeetingSourceAttribution = {
  eligibleBySourceType: TodayMeetingSourceCounts;
  visibleBySourceType: TodayMeetingSourceCounts;
  surfacedAboveBySourceType: TodayMeetingSourceCounts;
  liveCalendarVisibleCount: number;
  liveCalendarSurfacedAboveCount: number;
};

export type TodayExecutiveLeverageViewModel = {
  generated_at: string;
  topNextBestActions: TopNextBestAction[];
  consequentialMeetings: ConsequentialMeetingItem[];
  decisionsNeeded: DecisionNeededItem[];
  protectedValueCreation: ProtectedValueCreationItem[];
  opportunityQueue: OpportunityQueueItem[];
  delegateWaitingOn: DelegateWaitingOnItem[];
  quietlyHandled: QuietlyHandledItem[];
  sourceCounts: TodayExecutiveLeverageSourceCounts;
  sectionOverlapCounts: TodayExecutiveLeverageSectionOverlapCounts;
  sectionOverflowCounts: TodayExecutiveLeverageSectionOverflowCounts;
  meetingSourceAttribution: TodayExecutiveLeverageMeetingSourceAttribution;
  emptyState?: TodayExecutiveLeverageEmptyState | null;
};

export type BuildTodayExecutiveLeverageInput = {
  executiveSignals: ExecutiveSignal[];
  initiatives?: InitiativeOption[];
  generatedAt?: string | Date;
};

type ExecutiveSummaryOptions = {
  preferredText?: string | null;
  fallback?: string;
  maxLength?: number;
};

const TOP_NEXT_BEST_ACTION_LIMIT = 3;
const CONSEQUENTIAL_MEETING_LIMIT = 3;
const DECISIONS_NEEDED_LIMIT = 4;
const PROTECTED_VALUE_CREATION_LIMIT = 4;
const OPPORTUNITY_QUEUE_LIMIT = 4;
const DELEGATE_WAITING_ON_LIMIT = 4;
const QUIETLY_HANDLED_LIMIT = 5;
const EXECUTIVE_TITLE_LIMIT = 78;
const EXECUTIVE_SUMMARY_LIMIT = 132;
const EXECUTIVE_SUMMARY_SHORT_LIMIT = 112;

const DECISION_EVIDENCE_TERMS = ["decision", "approve", "approval", "board", "committee", "governance", "ic", "pac"];
const OPPORTUNITY_EVIDENCE_TERMS = [
  "opportunity",
  "deal",
  "partnership",
  "investment",
  "customer",
  "prospect",
  "venture",
  "pipeline",
  "counterparty",
  "diligence"
];
const AUTOMATION_PREFIX_PATTERN =
  /^\s*(?:\[(?:plaud(?:[- ]autoflow)?|autoflow|transcript|summary|digest|recording|auto(?:-generated)?|automation|alert|notification)[^\]]*\]\s*)+/i;
const EMAIL_PREFIX_PATTERN = /^\s*(?:(?:re|fw|fwd)\s*:\s*)+/i;

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string | null | undefined) {
  return compactText(value).toLowerCase();
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[\s\-–—:;,.]+$/g, "").trim();
}

function smartTruncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  const slice = value.slice(0, limit - 1);
  const boundary = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("; "),
    slice.lastIndexOf(", "),
    slice.lastIndexOf(" "),
    slice.lastIndexOf("/")
  );
  const trimmed = trimTrailingPunctuation(boundary > Math.floor(limit * 0.55) ? slice.slice(0, boundary) : slice);
  return `${trimmed}…`;
}

function safeIsoTimestamp(value: string | Date | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const candidate = value instanceof Date ? value.toISOString() : value;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function dedupeSignals(signals: ExecutiveSignal[]) {
  const seen = new Set<string>();
  const next: ExecutiveSignal[] = [];

  for (const signal of signals) {
    if (seen.has(signal.id)) {
      continue;
    }

    seen.add(signal.id);
    next.push(signal);
  }

  return next;
}

function signalText(signal: ExecutiveSignal) {
  return normalizeText(
    [signal.title, signal.summary, signal.category, signal.next_step, signal.desired_outcome]
      .filter(Boolean)
      .join(" ")
  );
}

function isSystemDiagnosticSignal(signal: ExecutiveSignal) {
  return isDiagnosticSystemSignal({
    title: signal.title,
    summary: signal.summary,
    body: [signal.next_step, signal.desired_outcome, ...(signal.evidence_snippets ?? [])].join(" "),
    sourceType: signal.source_type,
    signalType: signal.status
  });
}

function includesAnyTerm(value: string, terms: readonly string[]) {
  return terms.some((term) => value.includes(term));
}

function priorityScore(priority: ExecutivePriority | null | undefined) {
  switch (priority) {
    case "high":
      return 100;
    case "medium":
      return 60;
    case "low":
    default:
      return 20;
  }
}

function workTypeScore(workType: ExecutiveWorkType) {
  switch (workType) {
    case "decision":
      return 48;
    case "opportunity":
      return 44;
    case "strategic_initiative":
      return 40;
    case "meeting":
      return 36;
    case "delegation":
      return 30;
    case "relationship":
      return 26;
    case "logistics":
      return 12;
    case "reference":
      return 4;
    case "noise":
    default:
      return -200;
  }
}

function actionScore(action: ExecutiveRecommendedAction | null | undefined) {
  switch (action) {
    case "decide":
      return 24;
    case "prepare":
      return 21;
    case "advance":
      return 20;
    case "delegate":
      return 18;
    case "follow_up":
      return 16;
    case "review":
      return 14;
    case "route":
      return 10;
    case "schedule":
      return 8;
    case "wait":
      return 6;
    case "archive":
    case "ignore":
      return -20;
    default:
      return 0;
  }
}

function dueSoonScore(dueAt: string | null | undefined, nowMs: number) {
  const dueTimestamp = parseTimestamp(dueAt);
  if (dueTimestamp === null) {
    return 0;
  }

  if (dueTimestamp < nowMs) {
    return 28;
  }

  const hoursAway = (dueTimestamp - nowMs) / (1000 * 60 * 60);
  if (hoursAway <= 24) {
    return 26;
  }

  if (hoursAway <= 72) {
    return 18;
  }

  if (hoursAway <= 168) {
    return 8;
  }

  return 0;
}

function confidenceScore(confidence: number | null | undefined) {
  return Math.round((confidence ?? 0) * 10);
}

function signalLeverageScore(signal: ExecutiveSignal, nowMs: number) {
  return (
    priorityScore(signal.priority) +
    workTypeScore(signal.work_type) +
    actionScore(signal.recommended_action) +
    dueSoonScore(signal.due_at, nowMs) +
    confidenceScore(signal.confidence)
  );
}

function sortSignalsByLeverage(signals: ExecutiveSignal[], nowMs: number) {
  return [...signals].sort((left, right) => {
    const scoreDelta = signalLeverageScore(right, nowMs) - signalLeverageScore(left, nowMs);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const dueDelta = (parseTimestamp(left.due_at) ?? Number.MAX_SAFE_INTEGER) -
      (parseTimestamp(right.due_at) ?? Number.MAX_SAFE_INTEGER);
    if (dueDelta !== 0) {
      return dueDelta;
    }

    const confidenceDelta = (right.confidence ?? 0) - (left.confidence ?? 0);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

function looksLikeMetadataOnly(part: string) {
  const normalized = normalizeText(part);
  return (
    normalized === "high priority" ||
    normalized === "medium priority" ||
    normalized === "low priority" ||
    normalized.startsWith("signal type:") ||
    normalized.startsWith("source:") ||
    normalized.startsWith("recommended action:") ||
    normalized.startsWith("confidence:")
  );
}

function fallbackSummary(signal: ExecutiveSignal) {
  switch (signal.work_type) {
    case "decision":
      return "Decision context needs review.";
    case "meeting":
      return "Meeting context needs preparation.";
    case "delegation":
      return "Follow-through is still open.";
    case "opportunity":
      return "Opportunity context needs direction.";
    case "strategic_initiative":
      return "Strategic initiative signal is active.";
    case "relationship":
      return "Relationship context may need follow-through.";
    case "reference":
      return "Reference context is available if needed.";
    case "noise":
      return "Low-value item kept out of the foreground.";
    case "logistics":
    default:
      return "Operational context needs review.";
  }
}

export function compressSourceLabel(sourceLabel: string | null | undefined) {
  let next = compactText(sanitizeDisplayText(sourceLabel ?? ""));
  if (!next) {
    return "";
  }

  next = next
    .replace(/^Priority Inbox$/i, "Inbox")
    .replace(/^Outlook Calendar$/i, "Calendar")
    .replace(/^Microsoft Outlook$/i, "Outlook")
    .replace(/^Microsoft Teams$/i, "Teams");

  return smartTruncate(next, 24);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sumMeetingSourceCounts(counts: TodayMeetingSourceCounts) {
  return Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
}

function incrementMeetingSourceCount(counts: TodayMeetingSourceCounts, sourceType: TodayMeetingSourceType) {
  counts[sourceType] = (counts[sourceType] ?? 0) + 1;
}

function mapSignalToMeetingSourceType(signal: ExecutiveSignal): TodayMeetingSourceType {
  if (signal.source_origin === "live_calendar" || signal.source_type === "outlook_calendar") {
    return "outlook_calendar";
  }

  if (signal.source_origin === "agent_brief") {
    return "agent_brief";
  }

  if (signal.source_origin === "library" || signal.source_type === "library" || signal.source_type === "capture") {
    return "library";
  }

  if (signal.source_type === "forwarded_email") {
    return "forwarded_email";
  }

  if (
    signal.source_origin === "priority_inbox" ||
    signal.source_type === "priority_inbox" ||
    signal.source_type === "outlook" ||
    signal.source_type === "gmail"
  ) {
    return "priority_inbox";
  }

  return "other";
}

function meetingSourceDisplayLabel(signal: ExecutiveSignal) {
  const sourceType = mapSignalToMeetingSourceType(signal);

  switch (sourceType) {
    case "outlook_calendar":
      return "Outlook Calendar";
    case "agent_brief":
      if (signal.source_type === "calendar") {
        return "Agent brief · Calendar";
      }
      if (signal.source_type === "teams") {
        return "Agent brief · Teams";
      }
      if (signal.source_type === "outlook") {
        return "Agent brief · Outlook";
      }
      return "Agent brief";
    case "forwarded_email":
      return "Forwarded email";
    case "priority_inbox":
      if (signal.source_type === "outlook") {
        return "Outlook Mail";
      }
      return "Priority Inbox";
    case "library":
      return "Library";
    case "other":
    default:
      return compressSourceLabel(signal.source_label) || "Meeting signal";
  }
}

export function makeExecutiveTitle(signal: Pick<ExecutiveSignal, "title" | "work_type">) {
  let next = compactText(sanitizeDisplayText(signal.title)) || "Untitled signal";

  next = next.replace(EMAIL_PREFIX_PATTERN, "");
  next = next.replace(AUTOMATION_PREFIX_PATTERN, "");
  next = next.replace(/\bOutlook Calendar\b/gi, "Calendar");
  next = next.replace(/\breview was unavailable\b/gi, "review unavailable");
  next = next.replace(/\bdiscussion with ([A-Za-z0-9&.'’\- ]+)\b/gi, "$1 discussion");
  next = next.replace(/\s+[|:]\s+/g, " / ");

  const dashSegments = next.split(/\s+-\s+/).map(compactText).filter(Boolean);
  if (dashSegments.length >= 3) {
    next = dashSegments.slice(0, 2).join(" / ");

    if (
      signal.work_type === "decision" &&
      !includesAnyTerm(normalizeText(next), [...DECISION_EVIDENCE_TERMS, "memo", "decision"])
    ) {
      next = `${next} decision memo`;
    }
  } else if (dashSegments.length === 2 && next.length > 46) {
    next = dashSegments.join(" / ");
  }

  next = next.replace(/\s{2,}/g, " ");
  next = trimTrailingPunctuation(next);
  return smartTruncate(next || "Untitled signal", EXECUTIVE_TITLE_LIMIT);
}

function stripSummaryNoise(value: string) {
  let next = compactText(sanitizeDisplayText(value));
  next = next.replace(AUTOMATION_PREFIX_PATTERN, "");
  next = next.replace(/https?:\/\/\S+/gi, "");
  next = next.replace(/\b(?:high|medium|low)\s+priority\b/gi, "");
  next = next.replace(/\b(?:signal type|source|recommended action|confidence)\s*:\s*[^·|]+/gi, "");
  next = next.replace(/\bclassifier\b/gi, "");
  next = next.replace(/\bprovenance\b/gi, "");
  next = next.replace(/\bappears to need\b/gi, "needs");
  next = next.replace(/\bwould become useful context\b/gi, "be useful context");

  const parts = next
    .split(/\s*[·|]\s*/g)
    .map(compactText)
    .filter(Boolean)
    .filter((part) => !looksLikeMetadataOnly(part));

  next = parts.join(" · ");
  next = next.replace(/\s{2,}/g, " ");
  next = trimTrailingPunctuation(next);
  return next;
}

export function makeExecutiveSummary(signal: ExecutiveSignal, options: ExecutiveSummaryOptions = {}) {
  const candidate =
    options.preferredText ??
    signal.desired_outcome ??
    signal.next_step ??
    signal.summary ??
    signal.evidence_snippets?.[0] ??
    "";

  let next = stripSummaryNoise(candidate);
  if (normalizeText(next) === normalizeText(signal.title)) {
    next = "";
  }

  if (!next) {
    next = options.fallback ?? fallbackSummary(signal);
  }

  return smartTruncate(next, options.maxLength ?? EXECUTIVE_SUMMARY_LIMIT);
}

function isDueSoon(dueAt: string | null | undefined, nowMs: number) {
  const dueTimestamp = parseTimestamp(dueAt);
  return dueTimestamp !== null && dueTimestamp <= nowMs + 1000 * 60 * 60 * 24 * 3;
}

export function makeWhyShown(signal: ExecutiveSignal, nowMs: number) {
  if (signal.work_type === "noise" || signal.recommended_action === "archive" || signal.recommended_action === "ignore") {
    return "Low-value item suppressed.";
  }

  if (signal.work_type === "decision" || signal.recommended_action === "decide") {
    return isDueSoon(signal.due_at, nowMs) ? "Needs Will's decision soon." : "Needs Will's decision.";
  }

  if (signal.work_type === "meeting") {
    return isDueSoon(signal.due_at, nowMs) ? "Prep required before meeting." : "Meeting context needs prep.";
  }

  if (signal.work_type === "delegation" || signal.recommended_action === "delegate") {
    return "Delegation needs follow-through.";
  }

  if (
    signal.recommended_action === "wait" ||
    signal.recommended_action === "follow_up" ||
    compactText(signal.waiting_on) ||
    compactText(signal.delegated_to)
  ) {
    return "Follow-through is waiting.";
  }

  if (signal.work_type === "opportunity" || signal.recommended_action === "advance") {
    return "Opportunity needs direction.";
  }

  if (signal.work_type === "strategic_initiative") {
    return "Strategic initiative signal.";
  }

  if (signal.work_type === "relationship") {
    return "Relationship follow-through may matter.";
  }

  if (isDueSoon(signal.due_at, nowMs)) {
    return "Due soon.";
  }

  switch (signal.recommended_action) {
    case "prepare":
      return "Prep required.";
    case "review":
      return "Needs review.";
    case "route":
      return "May need routing.";
    case "schedule":
      return "Scheduling choice needed.";
    default:
      return "Worth foreground attention.";
  }
}

function recommendedActionLabel(action: ExecutiveRecommendedAction | null | undefined) {
  return action ? getExecutiveRecommendedActionLabel(action) : "Review";
}

function sourceTimestamp(signal: ExecutiveSignal) {
  return signal.updated_at ?? signal.source_received_at ?? signal.created_at ?? signal.due_at ?? null;
}

function isTopActionCandidate(signal: ExecutiveSignal) {
  return signal.work_type !== "noise" && !isSystemDiagnosticSignal(signal);
}

function isConsequentialMeeting(signal: ExecutiveSignal) {
  if (isSystemDiagnosticSignal(signal)) {
    return false;
  }

  return (
    signal.work_type === "meeting" &&
    (signal.recommended_action === "prepare" ||
      signal.recommended_action === "follow_up" ||
      signal.recommended_action === "review" ||
      signal.recommended_action === "decide" ||
      signal.priority === "high" ||
      signal.priority === "medium")
  );
}

function isDecisionNeeded(signal: ExecutiveSignal) {
  if (isSystemDiagnosticSignal(signal)) {
    return false;
  }

  return (
    signal.work_type === "decision" ||
    signal.recommended_action === "decide" ||
    includesAnyTerm(signalText(signal), DECISION_EVIDENCE_TERMS)
  );
}

function isDelegateWaitingOn(signal: ExecutiveSignal) {
  if (isSystemDiagnosticSignal(signal)) {
    return false;
  }

  return (
    signal.work_type === "delegation" ||
    signal.recommended_action === "delegate" ||
    signal.recommended_action === "wait" ||
    signal.recommended_action === "follow_up" ||
    signal.recommended_action === "route" ||
    Boolean(compactText(signal.delegated_to) || compactText(signal.waiting_on))
  );
}

function isOpportunitySignal(signal: ExecutiveSignal) {
  if (isSystemDiagnosticSignal(signal)) {
    return false;
  }

  return (
    signal.work_type === "opportunity" ||
    ((signal.recommended_action === "advance" ||
      signal.recommended_action === "route" ||
      signal.recommended_action === "schedule" ||
      signal.recommended_action === "follow_up" ||
      signal.recommended_action === "review") &&
      includesAnyTerm(signalText(signal), OPPORTUNITY_EVIDENCE_TERMS))
  );
}

function isProtectedValueSignal(signal: ExecutiveSignal) {
  if (isSystemDiagnosticSignal(signal)) {
    return false;
  }

  return signal.work_type === "strategic_initiative" || (signal.related_initiatives?.length ?? 0) > 0;
}

function isQuietlyHandled(signal: ExecutiveSignal) {
  return (
    isSystemDiagnosticSignal(signal) ||
    signal.work_type === "noise" ||
    signal.recommended_action === "archive" ||
    signal.recommended_action === "ignore" ||
    (signal.priority === "low" &&
      (signal.work_type === "reference" || signal.work_type === "logistics"))
  );
}

function suppressionReason(signal: ExecutiveSignal) {
  if (isSystemDiagnosticSignal(signal)) {
    return "System diagnostic kept out of foreground.";
  }

  if (signal.work_type === "noise") {
    return "Low-value noise stayed out of the foreground.";
  }

  if (signal.recommended_action === "archive" || signal.recommended_action === "ignore") {
    return "Kept quiet because it does not need action.";
  }

  if (signal.priority === "low" && signal.work_type === "reference") {
    return "Low-priority reference held out of the foreground.";
  }

  if (signal.priority === "low" && signal.work_type === "logistics") {
    return "Low-priority logistics kept out of the foreground.";
  }

  return "Handled quietly to preserve focus.";
}

function buildSourceCounts(signals: ExecutiveSignal[]): TodayExecutiveLeverageSourceCounts {
  const counts: TodayExecutiveLeverageSourceCounts = {
    work_type: {},
    priority: {},
    source_type: {}
  };

  for (const signal of signals) {
    counts.work_type[signal.work_type] = (counts.work_type[signal.work_type] ?? 0) + 1;

    if (signal.priority) {
      counts.priority[signal.priority] = (counts.priority[signal.priority] ?? 0) + 1;
    }

    counts.source_type[signal.source_type] = (counts.source_type[signal.source_type] ?? 0) + 1;
  }

  return counts;
}

function compressRelatedValues(values: string[] | null | undefined, limit = 3) {
  return (values ?? [])
    .map((value) => smartTruncate(compactText(value), 40))
    .filter(Boolean)
    .slice(0, limit);
}

function buildTopNextBestActions(signals: ExecutiveSignal[], nowMs: number): TopNextBestAction[] {
  return sortSignalsByLeverage(signals.filter(isTopActionCandidate), nowMs)
    .slice(0, TOP_NEXT_BEST_ACTION_LIMIT)
    .map((signal) => ({
      id: signal.id,
      title: makeExecutiveTitle(signal),
      summary: makeExecutiveSummary(signal, { maxLength: EXECUTIVE_SUMMARY_LIMIT }),
      work_type: signal.work_type,
      work_type_label: getExecutiveWorkTypeLabel(signal.work_type),
      priority: signal.priority ?? null,
      recommended_action: signal.recommended_action ?? null,
      recommended_action_label: recommendedActionLabel(signal.recommended_action),
      why_shown: makeWhyShown(signal, nowMs),
      due_at: signal.due_at ?? null,
      source_label: compressSourceLabel(signal.source_label),
      related_people: compressRelatedValues(signal.related_persons),
      related_companies: compressRelatedValues(signal.related_companies),
      related_initiatives: compressRelatedValues(signal.related_initiatives),
      href: signal.href ?? null,
      confidence: signal.confidence ?? null
    }));
}

function selectSectionSignals(
  signals: ExecutiveSignal[],
  nowMs: number,
  predicate: (signal: ExecutiveSignal) => boolean,
  usedSignalIds: Set<string>
) {
  const candidates = sortSignalsByLeverage(signals.filter(predicate), nowMs);
  const selected: ExecutiveSignal[] = [];
  const omittedSignals: ExecutiveSignal[] = [];

  for (const signal of candidates) {
    if (usedSignalIds.has(signal.id)) {
      omittedSignals.push(signal);
      continue;
    }

    selected.push(signal);
    usedSignalIds.add(signal.id);
  }

  return {
    selected,
    omittedSignals,
    omittedBecauseSurfacedAbove: omittedSignals.length
  };
}

type CappedSection<T> = {
  visible: T[];
  hiddenCount: number;
};

function capSection<T>(items: T[], limit: number): CappedSection<T> {
  return {
    visible: items.slice(0, limit),
    hiddenCount: Math.max(0, items.length - limit)
  };
}

function buildMeetingSourceAttribution(
  eligibleSignals: ExecutiveSignal[],
  visibleSignals: ExecutiveSignal[],
  surfacedAboveSignals: ExecutiveSignal[]
): TodayExecutiveLeverageMeetingSourceAttribution {
  const eligibleBySourceType: TodayMeetingSourceCounts = {};
  const visibleBySourceType: TodayMeetingSourceCounts = {};
  const surfacedAboveBySourceType: TodayMeetingSourceCounts = {};

  for (const signal of eligibleSignals) {
    incrementMeetingSourceCount(eligibleBySourceType, mapSignalToMeetingSourceType(signal));
  }

  for (const signal of visibleSignals) {
    incrementMeetingSourceCount(visibleBySourceType, mapSignalToMeetingSourceType(signal));
  }

  for (const signal of surfacedAboveSignals) {
    incrementMeetingSourceCount(surfacedAboveBySourceType, mapSignalToMeetingSourceType(signal));
  }

  return {
    eligibleBySourceType,
    visibleBySourceType,
    surfacedAboveBySourceType,
    liveCalendarVisibleCount: visibleBySourceType.outlook_calendar ?? 0,
    liveCalendarSurfacedAboveCount: surfacedAboveBySourceType.outlook_calendar ?? 0
  };
}

function buildConsequentialMeetings(signals: ExecutiveSignal[], nowMs: number): ConsequentialMeetingItem[] {
  return signals.map((signal) => ({
    id: signal.id,
    title: makeExecutiveTitle(signal),
    summary: makeExecutiveSummary(signal, { maxLength: EXECUTIVE_SUMMARY_SHORT_LIMIT }),
    meeting_time: signal.due_at ?? signal.source_received_at ?? null,
    why_consequential: makeWhyShown(signal, nowMs),
    source_label_compact: meetingSourceDisplayLabel(signal),
    recommended_action: signal.recommended_action ?? null,
    href: signal.href ?? null,
    confidence: signal.confidence ?? null
  }));
}

function buildDecisionsNeeded(signals: ExecutiveSignal[]): DecisionNeededItem[] {
  return signals.map((signal) => ({
    id: signal.id,
    title: makeExecutiveTitle(signal),
    decision_question: makeExecutiveSummary(signal, {
      preferredText: signal.desired_outcome ?? signal.next_step ?? signal.summary,
      fallback: "Decision context needs review.",
      maxLength: EXECUTIVE_SUMMARY_SHORT_LIMIT
    }),
    recommended_action: signal.recommended_action ?? null,
    priority: signal.priority ?? null,
    deadline: signal.due_at ?? null,
    risks_or_tradeoffs: signal.evidence_snippets?.[0]
      ? smartTruncate(stripSummaryNoise(signal.evidence_snippets[0]), 100)
      : null,
    href: signal.href ?? null,
    confidence: signal.confidence ?? null
  }));
}

function buildProtectedValueCreation(
  visibleSignals: ExecutiveSignal[],
  relatedSignals: ExecutiveSignal[],
  initiatives: InitiativeOption[],
  knownInitiativeKeys: Set<string>
): ProtectedValueCreationItem[] {
  const byKey = new Map<string, ProtectedValueCreationItem>();
  const relatedSignalCounts = new Map<string, number>();

  for (const signal of relatedSignals) {
    const countKey = signal.related_initiatives?.[0] ?? signal.id;
    relatedSignalCounts.set(countKey, (relatedSignalCounts.get(countKey) ?? 0) + 1);
  }

  for (const signal of visibleSignals) {
    const initiativeName = signal.related_initiatives?.[0] ?? makeExecutiveTitle(signal);
    const key = signal.related_initiatives?.[0] ?? signal.id;
    const existing = byKey.get(key);

    if (existing) {
      existing.latest_movement =
        existing.latest_movement ??
        makeExecutiveSummary(signal, { preferredText: signal.summary, maxLength: EXECUTIVE_SUMMARY_SHORT_LIMIT });
      existing.blocker = (existing.blocker ?? compactText(signal.waiting_on)) || null;
      existing.recommended_action = existing.recommended_action ?? signal.recommended_action ?? null;
      existing.href = existing.href ?? signal.href ?? null;
      continue;
    }

    byKey.set(key, {
      id: key,
      title: smartTruncate(compactText(initiativeName), EXECUTIVE_TITLE_LIMIT),
      current_focus: makeExecutiveSummary(signal, {
        preferredText: signal.title,
        fallback: "Active initiative signal.",
        maxLength: 86
      }),
      latest_movement: makeExecutiveSummary(signal, {
        preferredText: signal.summary,
        fallback: "No recent movement surfaced.",
        maxLength: EXECUTIVE_SUMMARY_SHORT_LIMIT
      }),
      blocker: compactText(signal.waiting_on) || null,
      recommended_action: signal.recommended_action ?? null,
      related_signal_count: relatedSignalCounts.get(key) ?? 1,
      href: signal.href ?? null
    });
  }

  for (const initiative of initiatives) {
    if (byKey.has(initiative.title) || byKey.has(initiative.id)) {
      continue;
    }

    if (knownInitiativeKeys.has(initiative.title) || knownInitiativeKeys.has(initiative.id)) {
      continue;
    }

    byKey.set(initiative.id, {
      id: initiative.id,
      title: smartTruncate(compactText(initiative.title), EXECUTIVE_TITLE_LIMIT),
      current_focus: initiative.status === "quiet" ? "Quietly on track." : "Active initiative.",
      latest_movement: null,
      blocker: initiative.status === "at_risk" ? "At risk." : null,
      recommended_action: null,
      related_signal_count: 0,
      href: "/initiatives"
    });
  }

  return [...byKey.values()].sort((left, right) => {
    if (right.related_signal_count !== left.related_signal_count) {
      return right.related_signal_count - left.related_signal_count;
    }

    return left.title.localeCompare(right.title);
  });
}

function buildOpportunityQueue(signals: ExecutiveSignal[]): OpportunityQueueItem[] {
  return signals.map((signal) => ({
    id: signal.id,
    company_or_counterparty:
      smartTruncate(
        compactText(signal.related_companies?.[0] ?? signal.related_persons?.[0] ?? signal.title),
        52
      ),
    title: makeExecutiveTitle(signal),
    strategic_relevance: makeExecutiveSummary(signal, {
      preferredText: signal.desired_outcome ?? signal.summary,
      fallback: "Opportunity context needs direction.",
      maxLength: EXECUTIVE_SUMMARY_SHORT_LIMIT
    }),
    recommended_action: signal.recommended_action ?? null,
    recommended_action_label: recommendedActionLabel(signal.recommended_action),
    last_touch_at: sourceTimestamp(signal),
    owner: compactText(signal.owner) || null,
    href: signal.href ?? null,
    confidence: signal.confidence ?? null
  }));
}

function buildDelegateWaitingOn(signals: ExecutiveSignal[]): DelegateWaitingOnItem[] {
  return signals.map((signal) => ({
    id: signal.id,
    title: makeExecutiveTitle(signal),
    delegated_to: compactText(signal.delegated_to) || null,
    waiting_on: compactText(signal.waiting_on ?? signal.next_step) || null,
    expected_outcome: makeExecutiveSummary(signal, {
      preferredText: signal.desired_outcome ?? signal.next_step ?? signal.summary,
      fallback: "Follow-through is still open.",
      maxLength: EXECUTIVE_SUMMARY_SHORT_LIMIT
    }),
    last_touch_at: sourceTimestamp(signal),
    recommended_action: signal.recommended_action ?? null,
    href: signal.href ?? null,
    confidence: signal.confidence ?? null
  }));
}

function buildQuietlyHandled(signals: ExecutiveSignal[]): QuietlyHandledItem[] {
  return signals.map((signal) => ({
    id: signal.id,
    title: makeExecutiveTitle(signal),
    summary: makeExecutiveSummary(signal, {
      preferredText: signal.summary ?? signal.next_step ?? signal.desired_outcome,
      fallback: "Low-value item stayed out of the foreground.",
      maxLength: EXECUTIVE_SUMMARY_SHORT_LIMIT
    }),
    reason_suppressed: suppressionReason(signal),
    source_label: compressSourceLabel(signal.source_label),
    href: signal.href ?? null,
    confidence: signal.confidence ?? null
  }));
}

type MeetingSectionStatusNoteInput = {
  meetingSourceAttribution: TodayExecutiveLeverageMeetingSourceAttribution;
  microsoftSourceMode?: TodayMicrosoftSourceMode;
  calendarSourceStatus?: {
    connected?: boolean;
    hasCalendarScope?: boolean;
    needsReconnect?: boolean;
    fetchAttempted?: boolean;
    fetchSucceeded?: boolean;
    reviewedEventCount?: number;
    mappedSignalCount?: number;
    liveCalendarVisibleCount?: number;
    liveCalendarSurfacedAboveCount?: number;
    message?: string;
  } | null;
  overflowCount?: number;
};

export function getMeetingSectionCountLabel(input: {
  visibleCount: number;
  microsoftSourceMode?: TodayMicrosoftSourceMode;
  calendarSourceStatus?: MeetingSectionStatusNoteInput["calendarSourceStatus"];
}) {
  const visibleCount = input.visibleCount;
  const microsoftSourceMode = input.microsoftSourceMode;
  const calendarSourceStatus = input.calendarSourceStatus;

  if (microsoftSourceMode === "agent_handoff") {
    return visibleCount > 0 ? pluralize(visibleCount, "meeting card") : "agent brief";
  }

  if (calendarSourceStatus?.needsReconnect) {
    return "needs reconnect";
  }

  if (calendarSourceStatus?.connected === false) {
    return "no calendar";
  }

  if (calendarSourceStatus?.fetchAttempted && !calendarSourceStatus.fetchSucceeded) {
    return "calendar unavailable";
  }

  if (calendarSourceStatus?.fetchSucceeded) {
    if (visibleCount > 0) {
      return pluralize(visibleCount, "meeting card");
    }

    return "calendar checked";
  }

  if (visibleCount > 0) {
    return pluralize(visibleCount, "meeting card");
  }

  return "0 meeting cards";
}

export function getMeetingSectionStatusNote(input: MeetingSectionStatusNoteInput) {
  const parts: string[] = [];
  const microsoftSourceMode = input.microsoftSourceMode;
  const calendarSourceStatus = input.calendarSourceStatus;
  const surfacedAboveTotal = sumMeetingSourceCounts(input.meetingSourceAttribution.surfacedAboveBySourceType);
  const surfacedAboveLive =
    calendarSourceStatus?.liveCalendarSurfacedAboveCount ??
    input.meetingSourceAttribution.liveCalendarSurfacedAboveCount;
  const liveCalendarVisible =
    calendarSourceStatus?.liveCalendarVisibleCount ??
    input.meetingSourceAttribution.liveCalendarVisibleCount;
  const reviewedEventCount = calendarSourceStatus?.reviewedEventCount ?? 0;

  if (microsoftSourceMode === "agent_handoff") {
    parts.push("Microsoft 365 Agent brief is active for meeting context.");
  } else if (calendarSourceStatus?.needsReconnect) {
    parts.push("Reconnect Outlook to include live calendar context.");
  } else if (calendarSourceStatus?.connected === false) {
    parts.push("No live calendar connected.");
  } else if (calendarSourceStatus?.fetchAttempted && !calendarSourceStatus.fetchSucceeded) {
    parts.push("Live calendar unavailable right now.");
  } else if (calendarSourceStatus?.fetchSucceeded) {
    if (reviewedEventCount <= 0) {
      parts.push("No live calendar events reviewed yet.");
    } else {
      const calendarParts = [`Live calendar connected`, `${pluralize(reviewedEventCount, "event")} reviewed`];

      if (liveCalendarVisible > 0 && surfacedAboveLive > 0) {
        calendarParts.push(`${pluralize(liveCalendarVisible, "surfaced item")} here`);
        calendarParts.push(`${pluralize(surfacedAboveLive, "surfaced item")} above`);
      } else if (liveCalendarVisible > 0) {
        calendarParts.push(`${pluralize(liveCalendarVisible, "surfaced item")} here`);
      } else if (surfacedAboveLive > 0) {
        calendarParts.push(`${pluralize(surfacedAboveLive, "surfaced item")} above`);
      } else {
        calendarParts.push("none needed foreground attention");
      }

      parts.push(`${calendarParts.join(" · ")}.`);
    }
  } else {
    parts.push("No live calendar events reviewed yet.");
  }

  if (surfacedAboveTotal > 0) {
    if (surfacedAboveLive === surfacedAboveTotal) {
      parts.push(`${pluralize(surfacedAboveTotal, "live calendar item")} already surfaced above.`);
    } else if (surfacedAboveLive === 0) {
      parts.push(`${pluralize(surfacedAboveTotal, "meeting-prep signal")} already surfaced above.`);
    } else {
      parts.push(`${pluralize(surfacedAboveTotal, "meeting-related item")} already surfaced above.`);
    }
  }

  if ((input.overflowCount ?? 0) > 0) {
    parts.push(`${pluralize(input.overflowCount ?? 0, "more meeting item")} kept out of the foreground.`);
  }

  return parts.join(" ").trim() || undefined;
}

export function buildTodayExecutiveLeverageViewModel(
  input: BuildTodayExecutiveLeverageInput
): TodayExecutiveLeverageViewModel {
  const generatedAt = safeIsoTimestamp(input.generatedAt);
  const nowMs = Date.parse(generatedAt);
  const executiveSignals = dedupeSignals(input.executiveSignals);
  const initiatives = input.initiatives ?? [];

  const topNextBestActions = buildTopNextBestActions(executiveSignals, nowMs);
  const usedSignalIds = new Set(topNextBestActions.map((item) => item.id));
  const decisionsSelection = selectSectionSignals(executiveSignals, nowMs, isDecisionNeeded, usedSignalIds);
  const meetingsSelection = selectSectionSignals(executiveSignals, nowMs, isConsequentialMeeting, usedSignalIds);
  const delegationSelection = selectSectionSignals(executiveSignals, nowMs, isDelegateWaitingOn, usedSignalIds);
  const opportunitySelection = selectSectionSignals(executiveSignals, nowMs, isOpportunitySignal, usedSignalIds);
  const protectedSignals = executiveSignals.filter(isProtectedValueSignal);
  const protectedSignalKeys = new Set(
    protectedSignals.flatMap((signal) => [signal.related_initiatives?.[0] ?? null, signal.id]).filter(Boolean) as string[]
  );
  const protectedSelection = selectSectionSignals(executiveSignals, nowMs, isProtectedValueSignal, usedSignalIds);
  const quietlyHandledSelection = selectSectionSignals(executiveSignals, nowMs, isQuietlyHandled, usedSignalIds);

  const decisionsNeeded = capSection(buildDecisionsNeeded(decisionsSelection.selected), DECISIONS_NEEDED_LIMIT);
  const visibleMeetingSignals = meetingsSelection.selected.slice(0, CONSEQUENTIAL_MEETING_LIMIT);
  const consequentialMeetings = capSection(
    buildConsequentialMeetings(meetingsSelection.selected, nowMs),
    CONSEQUENTIAL_MEETING_LIMIT
  );
  const meetingSourceAttribution = buildMeetingSourceAttribution(
    [...meetingsSelection.selected, ...meetingsSelection.omittedSignals],
    visibleMeetingSignals,
    meetingsSelection.omittedSignals
  );
  const delegateWaitingOn = capSection(buildDelegateWaitingOn(delegationSelection.selected), DELEGATE_WAITING_ON_LIMIT);
  const opportunityQueue = capSection(buildOpportunityQueue(opportunitySelection.selected), OPPORTUNITY_QUEUE_LIMIT);
  const protectedValueCreation = capSection(
    buildProtectedValueCreation(protectedSelection.selected, protectedSignals, initiatives, protectedSignalKeys),
    PROTECTED_VALUE_CREATION_LIMIT
  );
  const quietlyHandled = capSection(buildQuietlyHandled(quietlyHandledSelection.selected), QUIETLY_HANDLED_LIMIT);
  const sourceCounts = buildSourceCounts(executiveSignals);
  const hasSignals =
    topNextBestActions.length > 0 ||
    consequentialMeetings.visible.length > 0 ||
    decisionsNeeded.visible.length > 0 ||
    protectedValueCreation.visible.length > 0 ||
    opportunityQueue.visible.length > 0 ||
    delegateWaitingOn.visible.length > 0;

  return {
    generated_at: generatedAt,
    topNextBestActions,
    consequentialMeetings: consequentialMeetings.visible,
    decisionsNeeded: decisionsNeeded.visible,
    protectedValueCreation: protectedValueCreation.visible,
    opportunityQueue: opportunityQueue.visible,
    delegateWaitingOn: delegateWaitingOn.visible,
    quietlyHandled: quietlyHandled.visible,
    sourceCounts,
    sectionOverlapCounts: {
      consequentialMeetings: meetingsSelection.omittedBecauseSurfacedAbove,
      decisionsNeeded: decisionsSelection.omittedBecauseSurfacedAbove,
      protectedValueCreation: protectedSelection.omittedBecauseSurfacedAbove,
      opportunityQueue: opportunitySelection.omittedBecauseSurfacedAbove,
      delegateWaitingOn: delegationSelection.omittedBecauseSurfacedAbove,
      quietlyHandled: quietlyHandledSelection.omittedBecauseSurfacedAbove
    },
    sectionOverflowCounts: {
      consequentialMeetings: consequentialMeetings.hiddenCount,
      decisionsNeeded: decisionsNeeded.hiddenCount,
      protectedValueCreation: protectedValueCreation.hiddenCount,
      opportunityQueue: opportunityQueue.hiddenCount,
      delegateWaitingOn: delegateWaitingOn.hiddenCount,
      quietlyHandled: quietlyHandled.hiddenCount
    },
    meetingSourceAttribution,
    emptyState: hasSignals
      ? null
      : {
          title: "No executive leverage signals yet.",
          detail: "Today can stay quiet until decisions, meetings, opportunities, or follow-through signals accumulate."
        }
  };
}
