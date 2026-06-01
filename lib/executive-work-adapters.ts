import type { ChiefOfStaffSignal } from "@/lib/chief-of-staff-signal";
import type { LibraryItemDetail, LibraryItemSummary } from "@/lib/capture-library";
import { sanitizeDisplayText } from "@/lib/agent-signal-brief";
import type { OutlookCalendarViewEvent } from "@/lib/outlook";
import type { PriorityInboxItem, PriorityInboxRecommendedAction } from "@/lib/priority-inbox";

import {
  type ExecutivePriority,
  type ExecutiveRecommendedAction,
  type ExecutiveSignal,
  type ExecutiveSignalSourceType,
  type ExecutiveWorkType,
  normalizeExecutivePriority
} from "@/lib/executive-work";

export type ExecutiveWorkClassificationInput = {
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  sourceType?: ExecutiveSignalSourceType | null;
  category?: string | null;
  existingType?: string | null;
  signalType?: string | null;
  recommendedAction?: ExecutiveRecommendedAction | null;
};

export type ExecutiveWorkClassification = {
  workType: ExecutiveWorkType;
  confidence: number;
  evidenceSnippets: string[];
  recommendedAction: ExecutiveRecommendedAction;
};

export type DiagnosticSystemSignalInput = {
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  sourceType?: ExecutiveSignalSourceType | null;
  signalType?: string | null;
};

export type OutlookCalendarEventSignalOptions = {
  now?: string | Date;
};

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string | null | undefined) {
  return compactText(value).toLowerCase();
}

function titleCaseFromSnake(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function dedupeStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = compactText(value);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

function evidence(source: string, value: string) {
  return `${source}: ${value}`;
}

function firstMatchingKeyword(text: string, keywords: readonly string[]) {
  return keywords.find((keyword) => text.includes(keyword)) ?? null;
}

function hasAnyKeyword(text: string, keywords: readonly string[]) {
  return firstMatchingKeyword(text, keywords) !== null;
}

const NOISE_KEYWORDS = [
  "newsletter",
  "cold outreach",
  "unsubscribe",
  "promo",
  "promotion",
  "generic update",
  "fyi only",
  "no action"
] as const;

const OPPORTUNITY_KEYWORDS = [
  "opportunity",
  "deal",
  "partnership",
  "investment",
  "customer",
  "prospect",
  "venture",
  "fund",
  "pipeline",
  "diligence",
  "counterparty"
] as const;

const DECISION_KEYWORDS = [
  "decision",
  "approve",
  "approval",
  "board",
  "investment committee",
  "ic ",
  "governance",
  "authorize",
  "sign off",
  "capital allocation"
] as const;

const MEETING_KEYWORDS = [
  "meeting",
  "prep",
  "debrief",
  "agenda",
  "sync",
  "1:1",
  "offsite",
  "call",
  "review session"
] as const;

const RELATIONSHIP_KEYWORDS = [
  "relationship",
  "stakeholder",
  "reach out",
  "check in",
  "intro",
  "follow up with",
  "keep warm"
] as const;

const DELEGATION_KEYWORDS = [
  "waiting for",
  "waiting on",
  "delegate",
  "delegated",
  "follow up",
  "awaiting response",
  "owner",
  "hand off"
] as const;

const STRATEGIC_INITIATIVE_KEYWORDS = [
  "initiative",
  "strategic",
  "strategy",
  "roadmap",
  "launch",
  "rollout",
  "operating rhythm",
  "program"
] as const;

const LOGISTICS_KEYWORDS = [
  "travel",
  "schedule",
  "calendar",
  "admin",
  "invoice",
  "expense",
  "booking",
  "reschedule",
  "logistics"
] as const;

const DIAGNOSTIC_DIRECT_PHRASES = [
  "calendar review unavailable",
  "calendar unavailable",
  "calendar sync failed",
  "calendar auth unavailable",
  "outlook calendar unavailable",
  "auth unavailable",
  "token unavailable",
  "integration unavailable",
  "source unavailable"
] as const;

const DIAGNOSTIC_ISSUE_TERMS = [
  "unavailable",
  "failed",
  "failure",
  "blocked",
  "expired",
  "missing",
  "invalid",
  "error"
] as const;

const DIAGNOSTIC_CONTEXT_TERMS = [
  "calendar",
  "outlook calendar",
  "auth",
  "token",
  "integration",
  "connector",
  "source",
  "sync",
  "permission",
  "access"
] as const;

const CONSEQUENTIAL_CALENDAR_KEYWORDS = [
  "board",
  "investment committee",
  "ic",
  "pac",
  "governance",
  "customer",
  "ceo",
  "partner",
  "venture",
  "deal",
  "diligence",
  "strategy",
  "review",
  "approval"
] as const;

const LOW_SIGNAL_CALENDAR_KEYWORDS = [
  "focus time",
  "focus block",
  "hold",
  "placeholder",
  "lunch",
  "break",
  "commute",
  "travel",
  "personal",
  "ooo",
  "out of office",
  "reminder"
] as const;

function defaultActionForWorkType(workType: ExecutiveWorkType): ExecutiveRecommendedAction {
  switch (workType) {
    case "decision":
      return "decide";
    case "meeting":
      return "prepare";
    case "relationship":
      return "follow_up";
    case "delegation":
      return "follow_up";
    case "opportunity":
      return "advance";
    case "strategic_initiative":
      return "advance";
    case "logistics":
      return "schedule";
    case "noise":
      return "ignore";
    case "reference":
    default:
      return "review";
  }
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function isDiagnosticSystemSignal(
  input: DiagnosticSystemSignalInput
) {
  const signalType = normalizeText(input.signalType);
  const combined = normalizeText([input.title, input.summary, input.body].filter(Boolean).join(" "));
  const sourceType = normalizeText(input.sourceType);

  if (hasAnyKeyword(combined, DIAGNOSTIC_DIRECT_PHRASES)) {
    return true;
  }

  const isCalendarLikeSource = sourceType === "calendar" || sourceType === "outlook_calendar";

  if (signalType !== "status" && !isCalendarLikeSource) {
    return false;
  }

  const hasIssueTerm = hasAnyKeyword(combined, DIAGNOSTIC_ISSUE_TERMS);
  const hasContextTerm =
    hasAnyKeyword(combined, DIAGNOSTIC_CONTEXT_TERMS) ||
    isCalendarLikeSource;

  return hasIssueTerm && hasContextTerm;
}

function safeIsoTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function eventPeople(event: OutlookCalendarViewEvent) {
  return dedupeStrings([
    event.organizerName,
    ...event.attendees.map((attendee) => attendee.name ?? attendee.email)
  ]);
}

function normalizeCalendarTitle(subject: string | null | undefined) {
  const cleaned = sanitizeDisplayText(subject ?? "").replace(/\s+/g, " ").trim();
  return cleaned || "Untitled meeting";
}

function calendarBodySummary(event: OutlookCalendarViewEvent) {
  const cleaned = sanitizeDisplayText(event.bodyPreview ?? "").replace(/\s+/g, " ").trim();
  if (cleaned) {
    return cleaned;
  }

  if (event.locationDisplayName) {
    return `Location: ${event.locationDisplayName}`;
  }

  if (event.isOnlineMeeting) {
    return "Online meeting.";
  }

  return "Meeting context is available from Outlook Calendar.";
}

function isLowSignalOutlookCalendarEvent(event: OutlookCalendarViewEvent) {
  const combined = normalizeText(
    [event.subject, event.bodyPreview, event.locationDisplayName, event.showAs].filter(Boolean).join(" ")
  );
  const subject = normalizeText(event.subject);
  const attendeeCount = event.attendees.filter((attendee) => attendee.type !== "resource").length;

  if (!compactText(event.subject)) {
    return true;
  }

  if (event.showAs === "free" || event.showAs === "oof") {
    return true;
  }

  if (event.isAllDay && attendeeCount <= 1) {
    return true;
  }

  if (hasAnyKeyword(combined, LOW_SIGNAL_CALENDAR_KEYWORDS)) {
    return true;
  }

  return subject === "hold" || subject === "busy";
}

function isConsequentialOutlookCalendarEvent(event: OutlookCalendarViewEvent) {
  const combined = normalizeText(
    [event.subject, event.bodyPreview, event.organizerName, ...event.attendees.map((attendee) => attendee.name ?? attendee.email)]
      .filter(Boolean)
      .join(" ")
  );

  return hasAnyKeyword(combined, CONSEQUENTIAL_CALENDAR_KEYWORDS);
}

export function mapOutlookCalendarEventToExecutiveSignal(
  event: OutlookCalendarViewEvent,
  options: OutlookCalendarEventSignalOptions = {}
): ExecutiveSignal | null {
  if (event.isCancelled) {
    return null;
  }

  const now = safeIsoTimestamp(options.now ?? new Date()) ?? new Date().toISOString();
  const title = normalizeCalendarTitle(event.subject);
  const summary = calendarBodySummary(event);
  const people = eventPeople(event);
  const consequential = isConsequentialOutlookCalendarEvent(event);
  const lowSignal = isLowSignalOutlookCalendarEvent(event);
  const startAt = safeIsoTimestamp(event.startAt);
  const dueSoon =
    startAt !== null &&
    Date.parse(startAt) - Date.parse(now) <= 24 * 60 * 60 * 1000 &&
    Date.parse(startAt) >= Date.parse(now);

  if (lowSignal) {
    return {
      id: `outlook-calendar:${event.id}`,
      title,
      summary,
      source_type: "outlook_calendar",
      source_origin: "live_calendar",
      source_id: event.id,
      source_label: "Outlook Calendar",
      source_received_at: startAt,
      work_type: "noise",
      priority: "low",
      status: "calendar_event",
      related_persons: people,
      related_companies: [],
      related_initiatives: [],
      recommended_action: "ignore",
      due_at: startAt,
      confidence: 0.72,
      evidence_snippets: dedupeStrings([title, event.organizerName, event.showAs ?? null]),
      href: event.webLink,
      created_at: startAt,
      updated_at: safeIsoTimestamp(event.endAt)
    };
  }

  const priority: ExecutivePriority =
    event.importance === "high" || consequential || dueSoon ? "high" : "medium";
  const confidence = clampConfidence(
    0.74 +
      (event.bodyPreview ? 0.08 : 0) +
      (people.length > 1 ? 0.06 : 0) +
      (consequential ? 0.08 : 0)
  );

  return {
    id: `outlook-calendar:${event.id}`,
    title,
    summary,
    source_type: "outlook_calendar",
    source_origin: "live_calendar",
    source_id: event.id,
    source_label: "Outlook Calendar",
    source_received_at: startAt,
    work_type: "meeting",
    priority,
    status: "calendar_event",
    related_persons: people,
    related_companies: [],
    related_initiatives: [],
    recommended_action: "prepare",
    next_step: consequential ? "Prepare for the consequential meeting." : "Prepare for the meeting.",
    desired_outcome: event.bodyPreview ? null : "Walk into the meeting with the necessary context.",
    owner: event.organizerName ?? null,
    due_at: startAt,
    confidence,
    evidence_snippets: dedupeStrings([
      title,
      event.organizerName ? evidence("organizer", event.organizerName) : null,
      event.bodyPreview ? smartTruncateForEvidence(event.bodyPreview) : null
    ]),
    href: event.webLink,
    created_at: startAt,
    updated_at: safeIsoTimestamp(event.endAt)
  };
}

function smartTruncateForEvidence(value: string) {
  const cleaned = sanitizeDisplayText(value).replace(/\s+/g, " ").trim();
  return cleaned.length <= 100 ? cleaned : `${cleaned.slice(0, 97).trimEnd()}...`;
}

export function mapPriorityInboxActionToExecutiveAction(
  action: PriorityInboxRecommendedAction
): ExecutiveRecommendedAction {
  switch (action) {
    case "defer":
      return "wait";
    case "mark_handled":
      return "archive";
    case "create_task":
    case "add_commitment":
    case "save_reference":
      return "route";
    default:
      return "review";
  }
}

export function mapChiefOfStaffSignalAttentionToExecutivePriority(
  attention: ChiefOfStaffSignal["attention"]
): ExecutivePriority {
  return attention;
}

export function mapLibraryPriorityToExecutivePriority(
  priority: "high" | "medium" | "low" | null | undefined
) {
  return normalizeExecutivePriority(priority ?? null);
}

export function classifyExecutiveWork(
  input: ExecutiveWorkClassificationInput
): ExecutiveWorkClassification {
  const title = compactText(input.title);
  const summary = compactText(input.summary);
  const body = compactText(input.body);
  const category = compactText(input.category);
  const signalType = normalizeText(input.signalType);
  const existingType = normalizeText(input.existingType);
  const combined = normalizeText([title, summary, body, category].filter(Boolean).join(" "));
  const recommendedAction = input.recommendedAction ?? null;

  if (
    isDiagnosticSystemSignal({
      title,
      summary,
      body,
      sourceType: input.sourceType,
      signalType: input.signalType
    })
  ) {
    return {
      workType: "noise",
      confidence: 0.98,
      evidenceSnippets: [evidence("diagnostic", "system status")],
      recommendedAction: "ignore"
    };
  }

  if (signalType === "decision") {
    return {
      workType: "decision",
      confidence: 0.98,
      evidenceSnippets: [evidence("signal type", "decision")],
      recommendedAction: recommendedAction ?? "decide"
    };
  }

  if (signalType === "meeting") {
    return {
      workType: "meeting",
      confidence: 0.98,
      evidenceSnippets: [evidence("signal type", "meeting")],
      recommendedAction: recommendedAction ?? "prepare"
    };
  }

  if (signalType === "follow_up") {
    const relationshipKeyword = firstMatchingKeyword(combined, RELATIONSHIP_KEYWORDS);
    if (relationshipKeyword) {
      return {
        workType: "relationship",
        confidence: 0.78,
        evidenceSnippets: [
          evidence("signal type", "follow_up"),
          evidence("keyword", relationshipKeyword)
        ],
        recommendedAction: recommendedAction ?? "follow_up"
      };
    }

    return {
      workType: "delegation",
      confidence: 0.72,
      evidenceSnippets: [evidence("signal type", "follow_up")],
      recommendedAction: recommendedAction ?? "follow_up"
    };
  }

  const noiseKeyword = firstMatchingKeyword(combined, NOISE_KEYWORDS);
  if (noiseKeyword) {
    return {
      workType: "noise",
      confidence: 0.94,
      evidenceSnippets: [evidence("keyword", noiseKeyword)],
      recommendedAction: recommendedAction ?? "ignore"
    };
  }

  const categoryLower = normalizeText(category);
  if (categoryLower === "waiting for") {
    return {
      workType: "delegation",
      confidence: 0.9,
      evidenceSnippets: [evidence("category", "Waiting For")],
      recommendedAction: recommendedAction ?? "follow_up"
    };
  }

  if (categoryLower === "person") {
    return {
      workType: "relationship",
      confidence: 0.84,
      evidenceSnippets: [evidence("category", "Person")],
      recommendedAction: recommendedAction ?? "follow_up"
    };
  }

  if (categoryLower === "agenda") {
    return {
      workType: "meeting",
      confidence: 0.82,
      evidenceSnippets: [evidence("category", "Agenda")],
      recommendedAction: recommendedAction ?? "prepare"
    };
  }

  if (categoryLower === "calendar") {
    return {
      workType: "logistics",
      confidence: 0.76,
      evidenceSnippets: [evidence("category", "Calendar")],
      recommendedAction: recommendedAction ?? "schedule"
    };
  }

  const opportunityKeyword = firstMatchingKeyword(combined, OPPORTUNITY_KEYWORDS);
  if (opportunityKeyword) {
    return {
      workType: "opportunity",
      confidence: 0.88,
      evidenceSnippets: [evidence("keyword", opportunityKeyword)],
      recommendedAction: recommendedAction ?? "advance"
    };
  }

  const decisionKeyword = firstMatchingKeyword(combined, DECISION_KEYWORDS);
  if (decisionKeyword) {
    return {
      workType: "decision",
      confidence: 0.87,
      evidenceSnippets: [evidence("keyword", decisionKeyword)],
      recommendedAction: recommendedAction ?? "decide"
    };
  }

  const meetingKeyword = firstMatchingKeyword(combined, MEETING_KEYWORDS);
  if (meetingKeyword) {
    return {
      workType: "meeting",
      confidence: 0.84,
      evidenceSnippets: [evidence("keyword", meetingKeyword)],
      recommendedAction: recommendedAction ?? "prepare"
    };
  }

  const initiativeKeyword = firstMatchingKeyword(combined, STRATEGIC_INITIATIVE_KEYWORDS);
  if (initiativeKeyword) {
    return {
      workType: "strategic_initiative",
      confidence: 0.82,
      evidenceSnippets: [evidence("keyword", initiativeKeyword)],
      recommendedAction: recommendedAction ?? "advance"
    };
  }

  const relationshipKeyword = firstMatchingKeyword(combined, RELATIONSHIP_KEYWORDS);
  if (relationshipKeyword) {
    return {
      workType: "relationship",
      confidence: 0.78,
      evidenceSnippets: [evidence("keyword", relationshipKeyword)],
      recommendedAction: recommendedAction ?? "follow_up"
    };
  }

  const delegationKeyword = firstMatchingKeyword(combined, DELEGATION_KEYWORDS);
  if (delegationKeyword) {
    return {
      workType: "delegation",
      confidence: 0.76,
      evidenceSnippets: [evidence("keyword", delegationKeyword)],
      recommendedAction: recommendedAction ?? "follow_up"
    };
  }

  const logisticsKeyword = firstMatchingKeyword(combined, LOGISTICS_KEYWORDS);
  if (logisticsKeyword) {
    return {
      workType: "logistics",
      confidence: 0.74,
      evidenceSnippets: [evidence("keyword", logisticsKeyword)],
      recommendedAction: recommendedAction ?? "schedule"
    };
  }

  if (input.sourceType === "calendar" || input.sourceType === "outlook_calendar") {
    return {
      workType: "meeting",
      confidence: 0.58,
      evidenceSnippets: [evidence("source", "Calendar")],
      recommendedAction: recommendedAction ?? "prepare"
    };
  }

  if (signalType === "status" && hasAnyKeyword(combined, STRATEGIC_INITIATIVE_KEYWORDS)) {
    return {
      workType: "strategic_initiative",
      confidence: 0.6,
      evidenceSnippets: [
        evidence("signal type", "status"),
        evidence("source", titleCaseFromSnake(input.sourceType ?? "signal"))
      ],
      recommendedAction: recommendedAction ?? "review"
    };
  }

  if (existingType === "task") {
    return {
      workType: "logistics",
      confidence: 0.34,
      evidenceSnippets: [evidence("fallback", "task defaults to logistics")],
      recommendedAction: recommendedAction ?? "follow_up"
    };
  }

  return {
    workType: "reference",
    confidence: 0.28,
    evidenceSnippets: [evidence("fallback", "insufficient structured evidence")],
    recommendedAction: recommendedAction ?? "review"
  };
}

function mapLibraryRecommendedAction(
  item: LibraryItemSummary | LibraryItemDetail,
  workType: ExecutiveWorkType
) {
  if (item.status === "archived") {
    return "archive" as const;
  }

  if (item.type === "task" && item.status === "completed") {
    return "archive" as const;
  }

  return defaultActionForWorkType(workType);
}

function mapPriorityInboxSourceType(item: PriorityInboxItem): ExecutiveSignalSourceType {
  switch (item.source) {
    case "outlook":
      return "outlook";
    case "gmail":
      return "gmail";
    case "teams":
      return "teams";
    case "manual":
      return "manual";
    case "forwarded_email":
      return "forwarded_email";
    default:
      return "priority_inbox";
  }
}

function mapAgentSignalSourceType(signal: ChiefOfStaffSignal): ExecutiveSignalSourceType {
  switch (signal.source) {
    case "calendar":
      return "calendar";
    case "teams":
      return "teams";
    case "outlook":
    default:
      return "outlook";
  }
}

function formatAgentBriefSourceLabel(source: ChiefOfStaffSignal["source"]) {
  switch (source) {
    case "calendar":
      return "Agent brief · Calendar";
    case "teams":
      return "Agent brief · Teams";
    case "outlook":
    default:
      return "Agent brief · Outlook";
  }
}

function librarySummaryText(item: LibraryItemSummary | LibraryItemDetail) {
  if (item.type === "task") {
    return compactText(
      [item.task?.description, item.task?.nextStep, item.task?.desiredOutcome, item.preview].join(" ")
    );
  }

  return compactText([item.note?.body, item.preview].join(" "));
}

function splitStructuredValues(value: string | null | undefined) {
  return dedupeStrings(
    (value ?? "")
      .split(/\r?\n|,|;/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export function mapLibraryItemToExecutiveSignal(
  item: LibraryItemSummary | LibraryItemDetail
): ExecutiveSignal {
  const category = item.task?.categoryName ?? null;
  const priority = mapLibraryPriorityToExecutivePriority(item.task?.priority ?? null);
  const metadata = item.captureMetadata;
  const classification = item.executiveWorkType
    ? {
        workType: item.executiveWorkType,
        confidence: 0.99,
        evidenceSnippets: [evidence("capture type", item.captureTypeLabel)],
        recommendedAction: defaultActionForWorkType(item.executiveWorkType)
      }
    : classifyExecutiveWork({
        title: item.title,
        summary: item.preview,
        body: librarySummaryText(item),
        sourceType: "library",
        category,
        existingType: item.type
      });
  const relatedInitiatives = dedupeStrings([
    item.note?.linkedInitiativeTitle ?? null,
    item.task?.linkedInitiativeTitle ?? null
  ]);
  const relatedPersons = dedupeStrings([
    ...(metadata?.relatedPerson ? [metadata.relatedPerson] : []),
    ...splitStructuredValues(metadata?.peopleInvolved)
  ]);
  const relatedCompanies = dedupeStrings([
    metadata?.companyOrCounterparty ?? null,
    metadata?.relatedCompany ?? null
  ]);
  const nextStep =
    item.task?.nextStep ??
    metadata?.nextAction ??
    metadata?.followUps ??
    null;
  const desiredOutcome =
    item.task?.desiredOutcome ??
    metadata?.expectedOutcome ??
    metadata?.strategicRelevance ??
    null;
  const waitingOn =
    metadata?.waitingOn ??
    (classification.workType === "delegation" && item.task?.nextStep ? item.task.nextStep : null);

  return {
    id: item.id,
    title: item.title,
    summary: item.preview,
    source_type: "library",
    source_origin: "library",
    source_id: item.id,
    source_label: `Library ${item.captureTypeLabel.toLowerCase()}`,
    source_received_at: item.capturedAt,
    work_type: classification.workType,
    priority,
    category,
    status: metadata?.status ?? item.status,
    related_persons: relatedPersons,
    related_companies: relatedCompanies,
    related_initiatives: relatedInitiatives,
    recommended_action: mapLibraryRecommendedAction(item, classification.workType),
    next_step: nextStep,
    desired_outcome: desiredOutcome,
    owner: metadata?.owner ?? null,
    delegated_to: metadata?.delegatedTo ?? null,
    waiting_on: waitingOn,
    due_at: item.task?.dueAt ?? item.dueAt ?? null,
    confidence: classification.confidence,
    evidence_snippets: classification.evidenceSnippets,
    href: `/library/${item.id}`,
    created_at: item.capturedAt,
    updated_at: item.lastActiveAt
  };
}

export function mapPriorityInboxItemToExecutiveSignal(item: PriorityInboxItem): ExecutiveSignal {
  const sourceType = mapPriorityInboxSourceType(item);
  const priority = normalizeExecutivePriority(
    item.visibleState === "high_priority" ? "high" : item.visibleState === "needs_review" ? "medium" : "low"
  );
  const category = item.taskPrefill?.categoryName ?? null;
  const mappedAction = mapPriorityInboxActionToExecutiveAction(item.recommendedAction);
  const classification = classifyExecutiveWork({
    title: item.threadTitle,
    summary: item.summary,
    body: [item.primaryLine, item.whySurfaced, ...item.supportingSignals].join(" "),
    sourceType,
    category,
    existingType: item.recommendedAction === "create_task" ? "task" : "note",
    recommendedAction: mappedAction
  });
  const relatedInitiatives = dedupeStrings([
    item.taskPrefill?.linkedInitiativeTitle ?? null,
    item.initiativePrefill?.name ?? null
  ]);

  return {
    id: item.id,
    title: item.threadTitle,
    summary: item.summary,
    source_type: sourceType,
    source_origin: "priority_inbox",
    source_id: item.externalMessageId ?? item.id,
    source_label:
      sourceType === "outlook"
        ? "Outlook Mail"
        : sourceType === "teams"
          ? "Teams, app-native"
          : item.sourceLabel,
    source_received_at: item.receivedAt ?? null,
    work_type: classification.workType,
    priority,
    category,
    status: item.visibleState,
    related_persons: dedupeStrings([item.sender]),
    related_companies: [],
    related_initiatives: relatedInitiatives,
    recommended_action: mappedAction,
    next_step:
      item.taskPrefill?.nextStep ??
      item.commitmentPrefill?.statement ??
      item.referencePrefill?.summary ??
      null,
    desired_outcome: item.taskPrefill?.desiredOutcome ?? null,
    owner: item.sender,
    delegated_to: null,
    waiting_on:
      item.visibleState === "deferred" ? item.deferredLabel ?? item.deferredUntil ?? null : null,
    due_at: null,
    confidence: clampConfidence(Math.max(classification.confidence, 0.42)),
    evidence_snippets: dedupeStrings([
      ...classification.evidenceSnippets,
      item.whySurfaced,
      ...item.supportingSignals.slice(0, 2)
    ]),
    href: "/inbox",
    created_at: item.receivedAt ?? item.lastChangedAt ?? null,
    updated_at: item.lastChangedAt ?? item.receivedAt ?? null
  };
}

export function mapChiefOfStaffSignalToExecutiveSignal(signal: ChiefOfStaffSignal): ExecutiveSignal {
  const sourceType = mapAgentSignalSourceType(signal);
  const classification = classifyExecutiveWork({
    title: signal.title,
    summary: signal.summary,
    body: signal.actionRequest,
    sourceType,
    signalType: signal.signalType
  });

  return {
    id: signal.id,
    title: signal.title,
    summary: signal.summary,
    source_type: sourceType,
    source_origin: "agent_brief",
    source_id: signal.id,
    source_label: formatAgentBriefSourceLabel(signal.source),
    source_received_at: signal.occurredAt,
    work_type: classification.workType,
    priority: mapChiefOfStaffSignalAttentionToExecutivePriority(signal.attention),
    category: null,
    status: "active",
    related_persons: dedupeStrings(signal.participants),
    related_companies: [],
    related_initiatives: [],
    recommended_action: classification.recommendedAction,
    next_step: signal.actionRequest ?? null,
    desired_outcome: null,
    owner: signal.owner,
    delegated_to: null,
    waiting_on: null,
    due_at: signal.dueAt,
    confidence: classification.confidence,
    evidence_snippets: dedupeStrings([
      ...classification.evidenceSnippets,
      evidence("source", signal.sourceLabel)
    ]),
    href: "/inbox",
    created_at: signal.occurredAt,
    updated_at: signal.occurredAt
  };
}
