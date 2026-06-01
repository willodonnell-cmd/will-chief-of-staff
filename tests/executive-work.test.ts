import assert from "node:assert/strict";
import test from "node:test";

import type { ChiefOfStaffSignal } from "../lib/chief-of-staff-signal";
import type { LibraryItemSummary } from "../lib/capture-library";
import {
  classifyExecutiveWork,
  isDiagnosticSystemSignal,
  mapChiefOfStaffSignalToExecutiveSignal,
  mapLibraryItemToExecutiveSignal,
  mapOutlookCalendarEventToExecutiveSignal,
  mapPriorityInboxItemToExecutiveSignal
} from "../lib/executive-work-adapters";
import {
  getExecutiveRecommendedActionLabel,
  getExecutiveWorkTypeLabel,
  isExecutiveWorkType,
  normalizeExecutivePriority
} from "../lib/executive-work";
import { isExecutiveCaptureType } from "../lib/blackhawk-capture-model";
import {
  getOutlookScopes,
  hasOutlookCalendarScope,
  type OutlookCalendarViewEvent
} from "../lib/outlook";
import type { PriorityInboxItem } from "../lib/priority-inbox";

function buildLibraryTask(overrides: Partial<LibraryItemSummary> = {}): LibraryItemSummary {
  return {
    id: "capture-1",
    type: "task",
    captureType: "task",
    captureTypeLabel: "Task",
    executiveWorkType: null,
    captureMetadata: null,
    title: "Follow up with Amelia on board prep",
    preview: "Next Step: confirm the narrowed board-prep framing.",
    sourcePath: "/capture",
    privacy: "open",
    status: "active",
    capturedAt: "2026-05-29T08:00:00.000Z",
    lastActiveAt: "2026-05-29T09:00:00.000Z",
    archivedAt: null,
    completedAt: null,
    dueAt: "2026-05-30T16:00:00.000Z",
    saveState: "saved",
    saveStateDetail: "",
    localOnly: false,
    note: null,
    task: {
      title: "Follow up with Amelia on board prep",
      description: "Follow up with Amelia on board prep",
      nextStep: "Get her sign-off on the narrowed board-prep framing.",
      desiredOutcome: "Walk into the board-prep meeting with one coherent narrative.",
      status: "active",
      dueAt: "2026-05-30T16:00:00.000Z",
      priority: "high",
      categoryId: "waiting-for",
      categoryName: "Waiting For",
      categoryIsFallback: false,
      linkedInitiativeId: "initiative-1",
      linkedInitiativeTitle: "Executive operating rhythm"
    },
    originCapture: null,
    sourceLinkage: null,
    ...overrides
  };
}

function buildLibraryNote(overrides: Partial<LibraryItemSummary> = {}): LibraryItemSummary {
  return {
    id: "capture-note-1",
    type: "note",
    captureType: "note",
    captureTypeLabel: "Note",
    executiveWorkType: null,
    captureMetadata: null,
    title: "Harbinger conversation notes",
    preview: "Conversation notes and rough ideas for later retrieval.",
    sourcePath: "/capture",
    privacy: "open",
    status: "active",
    capturedAt: "2026-05-29T08:00:00.000Z",
    lastActiveAt: "2026-05-29T09:00:00.000Z",
    archivedAt: null,
    completedAt: null,
    dueAt: null,
    saveState: "saved",
    saveStateDetail: "",
    localOnly: false,
    note: {
      title: "Harbinger conversation notes",
      body: "Conversation notes and rough ideas for later retrieval.",
      linkedInitiativeId: null,
      linkedInitiativeTitle: null
    },
    task: null,
    originCapture: null,
    sourceLinkage: null,
    ...overrides
  };
}

function buildPriorityInboxItem(overrides: Partial<PriorityInboxItem> = {}): PriorityInboxItem {
  return {
    id: "inbox-1",
    source: "outlook",
    sourceLabel: "Outlook",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://outlook.example/item",
    externalMessageId: "external-1",
    conversationId: "thread-1",
    receivedAt: "2026-05-29T09:15:00.000Z",
    sender: "Amelia Hart",
    senderRole: "Board partner",
    threadTitle: "Board prep decision memo",
    primaryLine: "Review the board prep decision memo before the afternoon session.",
    summary: "A board approval decision is needed before the memo goes out.",
    timeLabel: "Today",
    visibleState: "high_priority",
    priorVisibleState: "high_priority",
    deferredUntil: null,
    deferredLabel: null,
    deferredReason: null,
    disposition: null,
    dispositionReason: null,
    dispositionLabel: null,
    updatedCue: "High importance",
    relationshipCue: null,
    sensitiveContext: null,
    attachmentCue: null,
    groupedCue: null,
    whySurfaced: "Board approval is pending today.",
    supportingSignals: ["High importance", "Decision needed"],
    recommendedAction: "create_task",
    taskPrefill: {
      description: "Review the board prep decision memo",
      nextStep: "Make the board-prep approval decision.",
      desiredOutcome: "One approved memo and no parallel drafts.",
      priority: "high",
      categoryName: "Priority Action",
      linkedInitiativeTitle: "Executive operating rhythm",
      associatedWith: "Board prep"
    },
    commitmentPrefill: undefined,
    initiativePrefill: undefined,
    referencePrefill: undefined,
    createdObject: null,
    lastChangedAt: "2026-05-29T09:20:00.000Z",
    sourceMetadata: null,
    ...overrides
  };
}

function buildChiefOfStaffSignal(overrides: Partial<ChiefOfStaffSignal> = {}): ChiefOfStaffSignal {
  return {
    id: "signal-1",
    source: "outlook",
    signalType: "decision",
    attention: "high",
    title: "Approve the board-prep direction",
    summary: "A recommendation is ready and the board-prep direction needs a decision.",
    owner: "Will O'Donnell",
    sourceLabel: "Outlook",
    occurredAt: "2026-05-29T10:00:00.000Z",
    dueAt: "2026-05-29T18:00:00.000Z",
    sourceUrl: "https://outlook.example/message",
    actionRequest: "Decide whether to approve the board-prep direction.",
    participants: ["Amelia Hart", "Will O'Donnell"],
    protectedContext: false,
    ...overrides
  };
}

function buildOutlookCalendarEvent(
  overrides: Partial<OutlookCalendarViewEvent> = {}
): OutlookCalendarViewEvent {
  return {
    id: "event-1",
    subject: "Board prep review",
    bodyPreview: "Review the board packet and confirm the approval path before materials lock.",
    startAt: "2026-05-29T18:00:00.000Z",
    endAt: "2026-05-29T19:00:00.000Z",
    isCancelled: false,
    isAllDay: false,
    isOnlineMeeting: true,
    locationDisplayName: "Microsoft Teams",
    organizerName: "Amelia Hart",
    organizerEmail: "amelia@example.com",
    attendees: [
      { name: "Will O'Donnell", email: "will@example.com", type: "required" },
      { name: "Finance partner", email: "finance@example.com", type: "required" }
    ],
    importance: "high",
    sensitivity: "normal",
    showAs: "busy",
    webLink: "https://outlook.example/calendar/event",
    ...overrides
  };
}

test("maps executive work type labels", () => {
  assert.equal(getExecutiveWorkTypeLabel("decision"), "Decision / Governance");
  assert.equal(isExecutiveWorkType("meeting"), true);
  assert.equal(isExecutiveWorkType("unknown"), false);
  assert.equal(isExecutiveCaptureType("meeting_note"), true);
  assert.equal(isExecutiveCaptureType("unknown"), false);
});

test("normalizes priorities and exposes action labels", () => {
  assert.equal(normalizeExecutivePriority("high"), "high");
  assert.equal(normalizeExecutivePriority("urgent"), null);
  assert.equal(getExecutiveRecommendedActionLabel("schedule"), "Schedule");
  assert.equal(getOutlookScopes().includes("Calendars.Read"), true);
});

test("detects Calendars.Read in delegated Outlook scopes", () => {
  assert.equal(hasOutlookCalendarScope(["Mail.Read", "Calendars.Read"]), true);
  assert.equal(hasOutlookCalendarScope("mail.read calendars.read offline_access"), true);
  assert.equal(hasOutlookCalendarScope("Calendars.Read,Mail.Read"), true);
  assert.equal(hasOutlookCalendarScope(null), false);
  assert.equal(hasOutlookCalendarScope(["Mail.Read"]), false);
});

test("classifies ambiguous notes conservatively", () => {
  const result = classifyExecutiveWork({
    title: "Scratch notes",
    summary: "Loose thoughts from a conversation.",
    existingType: "note",
    sourceType: "library"
  });

  assert.equal(result.workType, "reference");
  assert.equal(result.recommendedAction, "review");
});

test("does not overclassify ambiguous tasks as decision or opportunity", () => {
  const result = classifyExecutiveWork({
    title: "Handle follow-up",
    summary: "Tidy up the loose ends from this thread.",
    existingType: "task",
    sourceType: "library"
  });

  assert.equal(result.workType, "logistics");
  assert.notEqual(result.workType, "decision");
  assert.notEqual(result.workType, "opportunity");
});

test("classifies calendar diagnostics as system noise", () => {
  const result = classifyExecutiveWork({
    title: "Calendar review unavailable",
    summary: "Outlook calendar auth unavailable for the current review.",
    sourceType: "calendar",
    signalType: "status"
  });

  assert.equal(result.workType, "noise");
  assert.equal(result.recommendedAction, "ignore");
  assert.equal(
    isDiagnosticSystemSignal({
      title: "Calendar review unavailable",
      summary: "Outlook calendar auth unavailable for the current review.",
      sourceType: "calendar",
      signalType: "status"
    }),
    true
  );
});

test("maps library task items into executive signals", () => {
  const signal = mapLibraryItemToExecutiveSignal(buildLibraryTask());

  assert.equal(signal.source_type, "library");
  assert.equal(signal.work_type, "delegation");
  assert.equal(signal.priority, "high");
  assert.equal(signal.category, "Waiting For");
  assert.equal(signal.next_step, "Get her sign-off on the narrowed board-prep framing.");
  assert.equal(signal.due_at, "2026-05-30T16:00:00.000Z");
  assert.equal(signal.href, "/library/capture-1");
  assert.deepEqual(signal.related_initiatives, ["Executive operating rhythm"]);
});

test("maps library notes conservatively", () => {
  const signal = mapLibraryItemToExecutiveSignal(buildLibraryNote());

  assert.equal(signal.work_type, "reference");
  assert.equal(signal.recommended_action, "review");
  assert.equal(signal.priority, null);
});

test("maps explicit decision captures into executive decision signals", () => {
  const signal = mapLibraryItemToExecutiveSignal(
    buildLibraryNote({
      captureType: "decision",
      captureTypeLabel: "Decision",
      executiveWorkType: "decision",
      captureMetadata: {
        captureType: "decision",
        decisionQuestion: "Should we approve the board-prep direction?",
        recommendation: "Approve the narrowed path.",
        peopleInvolved: "Amelia Hart, Will O'Donnell"
      },
      title: "Should we approve the board-prep direction?"
    })
  );

  assert.equal(signal.work_type, "decision");
  assert.equal(signal.recommended_action, "decide");
  assert.deepEqual(signal.related_persons, ["Amelia Hart", "Will O'Donnell"]);
});

test("maps explicit opportunity captures into opportunity signals", () => {
  const signal = mapLibraryItemToExecutiveSignal(
    buildLibraryNote({
      captureType: "opportunity",
      captureTypeLabel: "Opportunity",
      executiveWorkType: "opportunity",
      captureMetadata: {
        captureType: "opportunity",
        companyOrCounterparty: "Harbinger",
        strategicRelevance: "High-leverage strategic fit.",
        nextAction: "Set a diligence call."
      },
      title: "Harbinger follow-up"
    })
  );

  assert.equal(signal.work_type, "opportunity");
  assert.equal(signal.next_step, "Set a diligence call.");
  assert.deepEqual(signal.related_companies, ["Harbinger"]);
});

test("maps explicit waiting-on captures into delegation signals", () => {
  const signal = mapLibraryItemToExecutiveSignal(
    buildLibraryTask({
      captureType: "waiting_on",
      captureTypeLabel: "Waiting On",
      executiveWorkType: "delegation",
      task: {
        ...buildLibraryTask().task!,
        desiredOutcome: "Final budget numbers"
      },
      captureMetadata: {
        captureType: "waiting_on",
        waitingOn: "Finance",
        expectedOutcome: "Final budget numbers",
        delegatedTo: "CFO chief of staff"
      }
    })
  );

  assert.equal(signal.work_type, "delegation");
  assert.equal(signal.waiting_on, "Finance");
  assert.equal(signal.delegated_to, "CFO chief of staff");
  assert.equal(signal.desired_outcome, "Final budget numbers");
});

test("maps explicit meeting-note captures into meeting signals", () => {
  const signal = mapLibraryItemToExecutiveSignal(
    buildLibraryNote({
      captureType: "meeting_note",
      captureTypeLabel: "Meeting Note",
      executiveWorkType: "meeting",
      captureMetadata: {
        captureType: "meeting_note",
        attendees: "Will O'Donnell, Amelia Hart",
        decisions: "Narrow the board-prep packet."
      },
      title: "Board prep sync"
    })
  );

  assert.equal(signal.work_type, "meeting");
  assert.equal(signal.recommended_action, "prepare");
});

test("maps priority inbox items into executive signals", () => {
  const signal = mapPriorityInboxItemToExecutiveSignal(buildPriorityInboxItem());

  assert.equal(signal.source_type, "outlook");
  assert.equal(signal.work_type, "decision");
  assert.equal(signal.priority, "high");
  assert.equal(signal.status, "high_priority");
  assert.equal(signal.recommended_action, "route");
  assert.equal(signal.href, "/inbox");
  assert.match(signal.evidence_snippets?.join(" ") ?? "", /Board approval/i);
});

test("maps chief of staff signals into executive signals", () => {
  const signal = mapChiefOfStaffSignalToExecutiveSignal(buildChiefOfStaffSignal());

  assert.equal(signal.source_type, "outlook");
  assert.equal(signal.work_type, "decision");
  assert.equal(signal.priority, "high");
  assert.equal(signal.recommended_action, "decide");
  assert.equal(signal.owner, "Will O'Donnell");
  assert.equal(signal.source_label, "Agent brief · Outlook");
  assert.deepEqual(signal.related_persons, ["Amelia Hart", "Will O'Donnell"]);
});

test("maps meeting signals to meeting work type", () => {
  const signal = mapChiefOfStaffSignalToExecutiveSignal(
    buildChiefOfStaffSignal({
      signalType: "meeting",
      title: "Board prep meeting",
      summary: "Prepare for the board prep meeting and tighten the agenda."
    })
  );

  assert.equal(signal.work_type, "meeting");
  assert.equal(signal.recommended_action, "prepare");
});

test("maps agent calendar signals with agent-brief origin", () => {
  const signal = mapChiefOfStaffSignalToExecutiveSignal(
    buildChiefOfStaffSignal({
      source: "calendar",
      signalType: "meeting",
      title: "Board prep meeting",
      summary: "Prepare for the board prep meeting and tighten the agenda.",
      sourceLabel: "Outlook Calendar connector"
    })
  );

  assert.equal(signal.source_type, "calendar");
  assert.equal(signal.source_origin, "agent_brief");
  assert.equal(signal.source_label, "Agent brief · Calendar");
  assert.equal(signal.work_type, "meeting");
});

test("maps agent teams signals with agent-brief origin", () => {
  const signal = mapChiefOfStaffSignalToExecutiveSignal(
    buildChiefOfStaffSignal({
      source: "teams",
      signalType: "decision",
      title: "Ops escalation needs judgment",
      summary: "A Teams thread asks for a call on vendor sequencing.",
      sourceLabel: "Teams"
    })
  );

  assert.equal(signal.source_type, "teams");
  assert.equal(signal.source_origin, "agent_brief");
  assert.equal(signal.source_label, "Agent brief · Teams");
  assert.equal(signal.work_type, "decision");
});

test("maps calendar diagnostic chief of staff signals to quiet system noise", () => {
  const signal = mapChiefOfStaffSignalToExecutiveSignal(
    buildChiefOfStaffSignal({
      signalType: "status",
      source: "calendar",
      title: "Calendar review unavailable",
      summary: "Calendar auth unavailable for the current review.",
      actionRequest: "Reauthorize the connector before relying on this signal."
    })
  );

  assert.equal(signal.work_type, "noise");
  assert.equal(signal.recommended_action, "ignore");
});

test("maps outlook calendar events into meeting executive signals", () => {
  const signal = mapOutlookCalendarEventToExecutiveSignal(buildOutlookCalendarEvent(), {
    now: "2026-05-29T12:00:00.000Z"
  });

  assert.ok(signal);
  assert.equal(signal?.source_type, "outlook_calendar");
  assert.equal(signal?.work_type, "meeting");
  assert.equal(signal?.recommended_action, "prepare");
  assert.equal(signal?.due_at, "2026-05-29T18:00:00.000Z");
  assert.deepEqual(signal?.related_persons, ["Amelia Hart", "Will O'Donnell", "Finance partner"]);
});

test("excludes cancelled outlook calendar events from executive signals", () => {
  const signal = mapOutlookCalendarEventToExecutiveSignal(
    buildOutlookCalendarEvent({
      isCancelled: true,
      subject: "Cancelled board prep"
    }),
    {
      now: "2026-05-29T12:00:00.000Z"
    }
  );

  assert.equal(signal, null);
});

test("maps generic focus holds as quiet calendar noise", () => {
  const signal = mapOutlookCalendarEventToExecutiveSignal(
    buildOutlookCalendarEvent({
      subject: "Focus time",
      bodyPreview: "Hold this block for focus.",
      showAs: "free",
      importance: "normal"
    }),
    {
      now: "2026-05-29T12:00:00.000Z"
    }
  );

  assert.ok(signal);
  assert.equal(signal?.work_type, "noise");
  assert.equal(signal?.priority, "low");
  assert.equal(signal?.recommended_action, "ignore");
});

test("maps board and strategy meetings as consequential prep-worthy signals", () => {
  const signal = mapOutlookCalendarEventToExecutiveSignal(
    buildOutlookCalendarEvent({
      subject: "IC strategy review with CEO",
      bodyPreview: "Investment committee review of strategy options with CEO context before approval."
    }),
    {
      now: "2026-05-29T12:00:00.000Z"
    }
  );

  assert.ok(signal);
  assert.equal(signal?.work_type, "meeting");
  assert.equal(signal?.priority, "high");
  assert.equal(signal?.recommended_action, "prepare");
});
