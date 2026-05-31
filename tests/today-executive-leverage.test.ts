import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTodayExecutiveLeverageViewModel,
  getMeetingSectionCountLabel,
  getMeetingSectionStatusNote,
  makeExecutiveSummary,
  makeExecutiveTitle,
  makeWhyShown,
  type TodayExecutiveLeverageViewModel
} from "../lib/today-executive-leverage";
import {
  listTransientOutlookCalendarExecutiveSignals,
  loadTodayCalendarSignalsWithStatus,
  resolveTodayMicrosoftSourceMode,
  shouldShowAppNativeCalendarReconnectPrompt
} from "../lib/today-calendar-signals";
import type { ExecutiveSignal } from "../lib/executive-work";
import type { OutlookCalendarViewEvent } from "../lib/outlook";

const GENERATED_AT = "2026-05-29T12:00:00.000Z";

function buildSignal(overrides: Partial<ExecutiveSignal> = {}): ExecutiveSignal {
  return {
    id: "signal-1",
    title: "Default signal",
    summary: "Default summary",
    source_type: "priority_inbox",
    source_origin: "priority_inbox",
    source_id: "source-1",
    source_label: "Priority Inbox",
    work_type: "logistics",
    priority: "medium",
    recommended_action: "review",
    due_at: null,
    confidence: 0.6,
    related_persons: [],
    related_companies: [],
    related_initiatives: [],
    evidence_snippets: [],
    href: "/inbox",
    created_at: "2026-05-29T09:00:00.000Z",
    updated_at: "2026-05-29T10:00:00.000Z",
    ...overrides
  };
}

function buildViewModel(signals: ExecutiveSignal[]): TodayExecutiveLeverageViewModel {
  return buildTodayExecutiveLeverageViewModel({
    executiveSignals: signals,
    generatedAt: GENERATED_AT
  });
}

function sumCounts(counts: Partial<Record<string, number>>) {
  return Object.values(counts).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function buildCalendarEvent(
  overrides: Partial<OutlookCalendarViewEvent> = {}
): OutlookCalendarViewEvent {
  return {
    id: "event-1",
    subject: "Board prep review",
    bodyPreview: "Review the board packet and confirm the approval path.",
    startAt: "2026-05-29T18:00:00.000Z",
    endAt: "2026-05-29T19:00:00.000Z",
    isCancelled: false,
    isAllDay: false,
    isOnlineMeeting: true,
    locationDisplayName: "Microsoft Teams",
    organizerName: "Amelia Hart",
    organizerEmail: "amelia@example.com",
    attendees: [{ name: "Will O'Donnell", email: "will@example.com", type: "required" }],
    importance: "high",
    sensitivity: "normal",
    showAs: "busy",
    webLink: "https://outlook.example/calendar/event",
    ...overrides
  };
}

test("builds an empty view model from an empty signal list", () => {
  const model = buildViewModel([]);

  assert.equal(model.topNextBestActions.length, 0);
  assert.equal(model.consequentialMeetings.length, 0);
  assert.equal(model.decisionsNeeded.length, 0);
  assert.equal(model.protectedValueCreation.length, 0);
  assert.equal(model.opportunityQueue.length, 0);
  assert.equal(model.delegateWaitingOn.length, 0);
  assert.equal(model.quietlyHandled.length, 0);
  assert.deepEqual(model.sourceCounts, {
    work_type: {},
    priority: {},
    source_type: {}
  });
  assert.deepEqual(model.sectionOverflowCounts, {
    consequentialMeetings: 0,
    decisionsNeeded: 0,
    protectedValueCreation: 0,
    opportunityQueue: 0,
    delegateWaitingOn: 0,
    quietlyHandled: 0
  });
  assert.deepEqual(model.meetingSourceAttribution, {
    eligibleBySourceType: {},
    visibleBySourceType: {},
    surfacedAboveBySourceType: {},
    liveCalendarVisibleCount: 0,
    liveCalendarSurfacedAboveCount: 0
  });
  assert.equal(model.emptyState?.title, "No executive leverage signals yet.");
});

test("calendar fetch failure path returns no transient signals", async () => {
  const signals = await listTransientOutlookCalendarExecutiveSignals({
    getAccessToken: async () => ({
      ok: true,
      accessToken: "token",
      accountLabel: "Will",
      scopes: ["Calendars.Read"]
    }),
    listCalendarViewEvents: async () => {
      throw new Error("calendar unavailable");
    }
  });

  assert.deepEqual(signals, []);
});

test("today calendar status requires reconnect when outlook lacks calendar scope", async () => {
  const result = await loadTodayCalendarSignalsWithStatus({
    getConnectionStatus: async () => ({
      connected: true,
      hasCalendarScope: false,
      delegatedScopes: ["Mail.Read"],
      connectHref: "/api/integrations/outlook/connect",
      accountLabel: "will@example.com",
      state: "connected",
      statusLabel: "Outlook synced just now."
    }),
    getAccessToken: async () => {
      throw new Error("should not request token without Calendars.Read");
    }
  });

  assert.deepEqual(result.signals, []);
  assert.equal(result.status.connected, true);
  assert.equal(result.status.hasCalendarScope, false);
  assert.equal(result.status.needsReconnect, true);
  assert.equal(result.status.fetchAttempted, false);
  assert.equal(result.status.fetchSucceeded, false);
  assert.equal(result.status.reviewedEventCount, 0);
  assert.equal(result.status.mappedSignalCount, 0);
  assert.match(result.status.message ?? "", /Reconnect Outlook/i);
});

test("transient live calendar fetch maps real meetings into executive signals", async () => {
  const signals = await listTransientOutlookCalendarExecutiveSignals({
    now: new Date(GENERATED_AT),
    getAccessToken: async () => ({
      ok: true,
      accessToken: "token",
      accountLabel: "Will",
      scopes: ["Calendars.Read"]
    }),
    listCalendarViewEvents: async () => [buildCalendarEvent()]
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.source_type, "outlook_calendar");
  assert.equal(signals[0]?.work_type, "meeting");
});

test("today calendar status reflects successful live fetches", async () => {
  const result = await loadTodayCalendarSignalsWithStatus({
    now: new Date(GENERATED_AT),
    getConnectionStatus: async () => ({
      connected: true,
      hasCalendarScope: true,
      delegatedScopes: ["Mail.Read", "Calendars.Read"],
      connectHref: "/api/integrations/outlook/connect",
      accountLabel: "will@example.com",
      state: "connected",
      statusLabel: "Outlook synced just now."
    }),
    getAccessToken: async () => ({
      ok: true,
      accessToken: "token",
      accountLabel: "Will",
      scopes: ["Calendars.Read"]
    }),
    listCalendarViewEvents: async () => [buildCalendarEvent()]
  });

  assert.equal(result.status.fetchAttempted, true);
  assert.equal(result.status.fetchSucceeded, true);
  assert.equal(result.status.reviewedEventCount, 1);
  assert.equal(result.status.mappedSignalCount, 1);
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0]?.source_type, "outlook_calendar");
});

test("today calendar fetch failure does not throw and does not create meeting cards", async () => {
  const result = await loadTodayCalendarSignalsWithStatus({
    getConnectionStatus: async () => ({
      connected: true,
      hasCalendarScope: true,
      delegatedScopes: ["Mail.Read", "Calendars.Read"],
      connectHref: "/api/integrations/outlook/connect",
      accountLabel: "will@example.com",
      state: "connected",
      statusLabel: "Outlook synced just now."
    }),
    getAccessToken: async () => ({
      ok: true,
      accessToken: "token",
      accountLabel: "Will",
      scopes: ["Calendars.Read"]
    }),
    listCalendarViewEvents: async () => {
      throw new Error("calendar unavailable");
    }
  });

  const model = buildViewModel(result.signals);

  assert.deepEqual(result.signals, []);
  assert.equal(result.status.fetchAttempted, true);
  assert.equal(result.status.fetchSucceeded, false);
  assert.equal(result.status.reviewedEventCount, 0);
  assert.equal(result.status.mappedSignalCount, 0);
  assert.match(result.status.message ?? "", /temporarily unavailable/i);
  assert.equal(model.topNextBestActions.length, 0);
  assert.equal(model.consequentialMeetings.length, 0);
});

test("calendar fetch success with zero consequential events is represented without meeting cards", async () => {
  const result = await loadTodayCalendarSignalsWithStatus({
    getConnectionStatus: async () => ({
      connected: true,
      hasCalendarScope: true,
      delegatedScopes: ["Mail.Read", "Calendars.Read"],
      connectHref: "/api/integrations/outlook/connect",
      accountLabel: "will@example.com",
      state: "connected",
      statusLabel: "Outlook synced just now."
    }),
    getAccessToken: async () => ({
      ok: true,
      accessToken: "token",
      accountLabel: "Will",
      scopes: ["Calendars.Read"]
    }),
    listCalendarViewEvents: async () => [
      buildCalendarEvent({
        id: "focus-1",
        subject: "Focus time",
        bodyPreview: "",
        importance: "normal",
        showAs: "busy"
      })
    ]
  });

  const model = buildViewModel(result.signals);

  assert.equal(result.status.fetchSucceeded, true);
  assert.equal(result.status.reviewedEventCount, 1);
  assert.equal(result.status.mappedSignalCount, 1);
  assert.equal(model.consequentialMeetings.length, 0);
});

test("title compression removes re and fwd prefixes", () => {
  const title = makeExecutiveTitle(
    buildSignal({
      title: "Re: Fwd: 600 Grumman - Project Island - IICM",
      work_type: "decision"
    })
  );

  assert.equal(title.startsWith("Re:"), false);
  assert.equal(title.startsWith("Fwd:"), false);
  assert.equal(title, "600 Grumman / Project Island decision memo");
});

test("title compression removes unhelpful automation bracket prefixes", () => {
  const title = makeExecutiveTitle(
    buildSignal({
      title: "[Plaud-AutoFlow] 05-10 Source Validation Over Content: Handling an Unverified Iran Internet Shutdown Narrative",
      work_type: "reference"
    })
  );

  assert.equal(title.includes("[Plaud-AutoFlow]"), false);
  assert.match(title, /Source Validation Over Content/i);
});

test("title compression preserves company and project names", () => {
  const title = makeExecutiveTitle(
    buildSignal({
      title: "Re: 600 Grumman - Project Island - IICM",
      work_type: "decision"
    })
  );

  assert.match(title, /600 Grumman/);
  assert.match(title, /Project Island/);
});

test("summary compression caps long text and removes metadata jargon", () => {
  const summary = makeExecutiveSummary(
    buildSignal({
      summary:
        "High priority · signal type: decision · source: Re: 600 Grumman memo · recommended action: decide · Needs a judgment call on lease timing, scenario-table accuracy, and thesis changes before Monday afternoon with more context than should stay on a Today card."
    })
  );

  assert.equal(summary.includes("signal type:"), false);
  assert.equal(summary.includes("recommended action:"), false);
  assert.equal(summary.length <= 132, true);
  assert.match(summary, /judgment call/i);
});

test("summary compression strips malformed markdown-style action text", () => {
  const summary = makeExecutiveSummary(
    buildSignal({
      summary:
        "Prepare](https://outlook.office365.com/owa/?ItemID=abc123) the Monday readout on Amazon interest and acquisition context."
    })
  );

  assert.equal(summary.includes("]("), false);
  assert.equal(summary.includes("https://"), false);
  assert.match(summary, /^Prepare the Monday readout/i);
});

test("why shown avoids repeating priority and work-type labels", () => {
  const whyShown = makeWhyShown(
    buildSignal({
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    Date.parse(GENERATED_AT)
  );

  assert.equal(whyShown, "Needs Will's decision.");
});

test("ranks a high-priority decision above medium logistics", () => {
  const model = buildViewModel([
    buildSignal({
      id: "logistics-1",
      title: "Reschedule travel logistics",
      work_type: "logistics",
      priority: "medium",
      recommended_action: "schedule"
    }),
    buildSignal({
      id: "decision-1",
      title: "Approve the board recommendation",
      summary: "A board recommendation is ready for decision.",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    })
  ]);

  assert.equal(model.topNextBestActions[0]?.id, "decision-1");
});

test("returns at most three top next best actions", () => {
  const model = buildViewModel([
    buildSignal({ id: "1", title: "Decision", work_type: "decision", priority: "high" }),
    buildSignal({ id: "2", title: "Meeting", work_type: "meeting", priority: "high" }),
    buildSignal({ id: "3", title: "Initiative", work_type: "strategic_initiative", priority: "medium" }),
    buildSignal({ id: "4", title: "Delegation", work_type: "delegation", priority: "medium" })
  ]);

  assert.equal(model.topNextBestActions.length, 3);
});

test("does not include noise in top next best actions", () => {
  const model = buildViewModel([
    buildSignal({
      id: "noise-1",
      title: "Newsletter",
      work_type: "noise",
      priority: "high",
      recommended_action: "ignore"
    }),
    buildSignal({
      id: "decision-1",
      title: "Capital allocation decision",
      work_type: "decision",
      priority: "medium",
      recommended_action: "decide"
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "noise-1"), false);
});

test("calendar review unavailable does not appear in top next best actions", () => {
  const model = buildViewModel([
    buildSignal({
      id: "calendar-diagnostic-1",
      title: "Calendar review unavailable",
      summary: "Outlook calendar auth unavailable for the current review.",
      source_type: "calendar",
      work_type: "noise",
      recommended_action: "ignore",
      status: "status"
    }),
    buildSignal({
      id: "decision-1",
      title: "Capital allocation decision",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "calendar-diagnostic-1"), false);
});

test("a signal selected for top next best actions does not appear in decisions needed", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Board approval needed",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide",
      due_at: "2026-05-29T15:00:00.000Z"
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "decision-1"), true);
  assert.equal(model.decisionsNeeded.some((item) => item.id === "decision-1"), false);
});

test("a signal selected for top next best actions does not appear in delegate waiting on", () => {
  const model = buildViewModel([
    buildSignal({
      id: "delegation-1",
      title: "Follow up with finance",
      work_type: "delegation",
      priority: "high",
      recommended_action: "follow_up",
      waiting_on: "Finance numbers"
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "delegation-1"), true);
  assert.equal(model.delegateWaitingOn.some((item) => item.id === "delegation-1"), false);
});

test("a signal selected for top next best actions does not appear in opportunity queue", () => {
  const model = buildViewModel([
    buildSignal({
      id: "opportunity-1",
      title: "Harbinger partnership opportunity",
      work_type: "opportunity",
      priority: "high",
      recommended_action: "advance",
      related_companies: ["Harbinger"]
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "opportunity-1"), true);
  assert.equal(model.opportunityQueue.some((item) => item.id === "opportunity-1"), false);
});

test("a decision signal not selected for top next best actions can still appear in decisions needed", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Board decision",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide",
      due_at: "2026-05-29T13:00:00.000Z"
    }),
    buildSignal({
      id: "decision-2",
      title: "PAC decision",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide",
      due_at: "2026-05-29T14:00:00.000Z"
    }),
    buildSignal({
      id: "meeting-1",
      title: "Board prep meeting",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare",
      due_at: "2026-05-29T15:00:00.000Z"
    }),
    buildSignal({
      id: "decision-3",
      title: "Secondary governance call",
      summary: "A lower-priority governance decision still needs review.",
      work_type: "decision",
      priority: "medium",
      recommended_action: "decide",
      desired_outcome: "Choose the secondary governance path."
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "decision-3"), false);
  assert.equal(model.decisionsNeeded.some((item) => item.id === "decision-3"), true);
});

test("groups meeting signals into consequential meetings when not already surfaced above", () => {
  const model = buildViewModel([
    buildSignal({ id: "decision-1", title: "Decision A", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "decision-2", title: "Decision B", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "delegation-1", title: "Delegation A", work_type: "delegation", priority: "high", recommended_action: "follow_up" }),
    buildSignal({
      id: "meeting-1",
      title: "Weekly operating sync",
      work_type: "meeting",
      priority: "medium",
      recommended_action: "prepare",
      due_at: "2026-05-30T15:00:00.000Z"
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "meeting-1"), false);
  assert.equal(model.consequentialMeetings.some((item) => item.id === "meeting-1"), true);
});

test("live calendar meeting is counted separately from agent and inbox meeting signals", () => {
  const model = buildViewModel([
    buildSignal({
      id: "calendar-meeting-1",
      title: "Board prep review",
      source_type: "outlook_calendar",
      source_origin: "live_calendar",
      source_label: "Outlook Calendar",
      work_type: "meeting",
      priority: "medium",
      recommended_action: "prepare",
      due_at: "2026-05-30T15:00:00.000Z"
    }),
    buildSignal({
      id: "agent-meeting-1",
      title: "Customer prep note",
      source_type: "calendar",
      source_origin: "agent_brief",
      source_label: "Outlook Calendar connector",
      work_type: "meeting",
      priority: "medium",
      recommended_action: "prepare",
      due_at: "2026-05-30T18:00:00.000Z"
    }),
    buildSignal({
      id: "inbox-meeting-1",
      title: "Deal call prep",
      source_type: "priority_inbox",
      source_origin: "priority_inbox",
      source_label: "Outlook",
      work_type: "meeting",
      priority: "medium",
      recommended_action: "prepare",
      due_at: "2026-05-30T20:00:00.000Z"
    })
  ]);

  assert.equal(model.meetingSourceAttribution.eligibleBySourceType.outlook_calendar, 1);
  assert.equal(model.meetingSourceAttribution.eligibleBySourceType.agent_brief, 1);
  assert.equal(model.meetingSourceAttribution.eligibleBySourceType.priority_inbox, 1);
});

test("meeting overlap attribution distinguishes live calendar surfaced above from non-calendar overlap", () => {
  const liveCalendarModel = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision 1",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "Decision 2",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "calendar-meeting-1",
      title: "Board prep review",
      source_type: "outlook_calendar",
      source_origin: "live_calendar",
      source_label: "Outlook Calendar",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "calendar-meeting-2",
      title: "Customer strategy call",
      source_type: "outlook_calendar",
      source_origin: "live_calendar",
      source_label: "Outlook Calendar",
      work_type: "meeting",
      priority: "medium",
      recommended_action: "prepare"
    })
  ]);

  const mixedModel = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision 1",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "calendar-meeting-1",
      title: "Board prep review",
      source_type: "outlook_calendar",
      source_origin: "live_calendar",
      source_label: "Outlook Calendar",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "agent-meeting-1",
      title: "Customer prep note",
      source_type: "calendar",
      source_origin: "agent_brief",
      source_label: "Outlook Calendar connector",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "logistics-1",
      title: "Logistics 1",
      work_type: "logistics",
      priority: "low",
      recommended_action: "schedule"
    })
  ]);

  const nonCalendarModel = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision 1",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "agent-meeting-1",
      title: "Customer prep note",
      source_type: "calendar",
      source_origin: "agent_brief",
      source_label: "Outlook Calendar connector",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "inbox-meeting-1",
      title: "Deal call prep",
      source_type: "priority_inbox",
      source_origin: "priority_inbox",
      source_label: "Outlook",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "logistics-1",
      title: "Logistics 1",
      work_type: "logistics",
      priority: "low",
      recommended_action: "schedule"
    })
  ]);

  assert.equal(liveCalendarModel.meetingSourceAttribution.liveCalendarSurfacedAboveCount, 1);
  assert.equal(mixedModel.meetingSourceAttribution.liveCalendarSurfacedAboveCount, 1);
  assert.equal(
    sumCounts(mixedModel.meetingSourceAttribution.surfacedAboveBySourceType),
    2
  );
  assert.equal(nonCalendarModel.meetingSourceAttribution.liveCalendarSurfacedAboveCount, 0);
});

test("meeting overlap status wording distinguishes live calendar, mixed, and non-calendar sources", () => {
  const liveCalendarOnly = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: { outlook_calendar: 2 },
      visibleBySourceType: {},
      surfacedAboveBySourceType: { outlook_calendar: 2 },
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 2
    },
    calendarSourceStatus: {
      fetchSucceeded: true,
      reviewedEventCount: 3,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 2
    }
  });
  const mixed = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: { outlook_calendar: 1, agent_brief: 1 },
      visibleBySourceType: {},
      surfacedAboveBySourceType: { outlook_calendar: 1, agent_brief: 1 },
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 1
    },
    calendarSourceStatus: {
      fetchSucceeded: true,
      reviewedEventCount: 3,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 1
    }
  });
  const nonCalendarOnly = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: { agent_brief: 2 },
      visibleBySourceType: {},
      surfacedAboveBySourceType: { agent_brief: 2 },
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    },
    calendarSourceStatus: {
      fetchSucceeded: true,
      reviewedEventCount: 3,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    }
  });

  assert.match(liveCalendarOnly ?? "", /live calendar items already surfaced above/i);
  assert.match(mixed ?? "", /meeting-related items already surfaced above/i);
  assert.match(nonCalendarOnly ?? "", /meeting-prep signals already surfaced above/i);
});

test("agent handoff source mode suppresses app-native reconnect semantics", () => {
  const sourceMode = resolveTodayMicrosoftSourceMode({
    hasAgentHandoff: true,
    calendarSourceStatus: {
      connected: false,
      hasCalendarScope: false,
      needsReconnect: false,
      fetchAttempted: false,
      fetchSucceeded: false,
      reviewedEventCount: 0,
      mappedSignalCount: 0,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    }
  });

  assert.equal(sourceMode, "agent_handoff");
  assert.equal(
    shouldShowAppNativeCalendarReconnectPrompt({
      sourceMode,
      calendarSourceStatus: {
        connected: true,
        hasCalendarScope: false,
        needsReconnect: true,
        fetchAttempted: false,
        fetchSucceeded: false,
        reviewedEventCount: 0,
        mappedSignalCount: 0,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 0
      }
    }),
    false
  );
});

test("graph and mixed source modes preserve app-native calendar status", () => {
  const graphMode = resolveTodayMicrosoftSourceMode({
    hasAgentHandoff: false,
    calendarSourceStatus: {
      connected: true,
      hasCalendarScope: false,
      needsReconnect: true,
      fetchAttempted: false,
      fetchSucceeded: false,
      reviewedEventCount: 0,
      mappedSignalCount: 0,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    }
  });
  const mixedMode = resolveTodayMicrosoftSourceMode({
    hasAgentHandoff: true,
    calendarSourceStatus: {
      connected: true,
      hasCalendarScope: true,
      needsReconnect: false,
      fetchAttempted: true,
      fetchSucceeded: true,
      reviewedEventCount: 2,
      mappedSignalCount: 1,
      liveCalendarVisibleCount: 1,
      liveCalendarSurfacedAboveCount: 0
    },
    liveCalendarSignalCount: 1
  });

  assert.equal(graphMode, "graph_oauth");
  assert.equal(mixedMode, "mixed");
  assert.equal(
    shouldShowAppNativeCalendarReconnectPrompt({
      sourceMode: graphMode,
      calendarSourceStatus: {
        connected: true,
        hasCalendarScope: false,
        needsReconnect: true,
        fetchAttempted: false,
        fetchSucceeded: false,
        reviewedEventCount: 0,
        mappedSignalCount: 0,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 0
      }
    }),
    true
  );
});

test("meetings and prep status says reconnect when calendar scope is missing", () => {
  const note = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: {},
      visibleBySourceType: {},
      surfacedAboveBySourceType: {},
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    },
    calendarSourceStatus: {
      connected: true,
      hasCalendarScope: false,
      needsReconnect: true,
      fetchAttempted: false,
      fetchSucceeded: false,
      reviewedEventCount: 0,
      mappedSignalCount: 0,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    },
    microsoftSourceMode: "graph_oauth"
  });

  assert.equal(note, "Reconnect Outlook to include live calendar context.");
});

test("meetings and prep status can say live calendar reviewed events", () => {
  const note = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: { outlook_calendar: 2 },
      visibleBySourceType: { outlook_calendar: 1 },
      surfacedAboveBySourceType: {},
      liveCalendarVisibleCount: 1,
      liveCalendarSurfacedAboveCount: 0
    },
    calendarSourceStatus: {
      connected: true,
      hasCalendarScope: true,
      needsReconnect: false,
      fetchAttempted: true,
      fetchSucceeded: true,
      reviewedEventCount: 2,
      mappedSignalCount: 1,
      liveCalendarVisibleCount: 1,
      liveCalendarSurfacedAboveCount: 0
    },
    microsoftSourceMode: "graph_oauth"
  });

  assert.equal(note, "Live calendar connected · 2 events reviewed · 1 surfaced item here.");
});

test("meetings and prep status can say no foreground attention after reviewed events", () => {
  const note = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: { outlook_calendar: 2 },
      visibleBySourceType: {},
      surfacedAboveBySourceType: { agent_brief: 2 },
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    },
    calendarSourceStatus: {
      connected: true,
      hasCalendarScope: true,
      needsReconnect: false,
      fetchAttempted: true,
      fetchSucceeded: true,
      reviewedEventCount: 2,
      mappedSignalCount: 0,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    },
    microsoftSourceMode: "graph_oauth"
  });

  assert.match(note ?? "", /Live calendar connected · 2 events reviewed · none needed foreground attention\./i);
  assert.match(note ?? "", /2 meeting-prep signals already surfaced above\./i);
});

test("meetings and prep count label reflects calendar status instead of zero visible", () => {
  assert.equal(
    getMeetingSectionCountLabel({
      visibleCount: 0,
      calendarSourceStatus: {
        connected: true,
        hasCalendarScope: true,
        needsReconnect: false,
        fetchAttempted: true,
        fetchSucceeded: true,
        reviewedEventCount: 2,
        mappedSignalCount: 1,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 1
      },
      microsoftSourceMode: "graph_oauth"
    }),
    "calendar checked"
  );
  assert.equal(
    getMeetingSectionCountLabel({
      visibleCount: 0,
      calendarSourceStatus: {
        connected: true,
        hasCalendarScope: false,
        needsReconnect: true,
        fetchAttempted: false,
        fetchSucceeded: false,
        reviewedEventCount: 0,
        mappedSignalCount: 0,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 0
      },
      microsoftSourceMode: "graph_oauth"
    }),
    "needs reconnect"
  );
});

test("agent handoff meeting status identifies the agent brief instead of app-native calendar", () => {
  const note = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: { agent_brief: 2 },
      visibleBySourceType: {},
      surfacedAboveBySourceType: { agent_brief: 2 },
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    },
    microsoftSourceMode: "agent_handoff",
    calendarSourceStatus: {
      connected: false,
      hasCalendarScope: false,
      needsReconnect: false,
      fetchAttempted: false,
      fetchSucceeded: false,
      reviewedEventCount: 0,
      mappedSignalCount: 0,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    }
  });

  assert.match(note ?? "", /Agent brief is active for meeting context/i);
  assert.doesNotMatch(note ?? "", /No live calendar connected/i);
});

test("meetings and prep status reports no live calendar connection", () => {
  const note = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: {},
      visibleBySourceType: {},
      surfacedAboveBySourceType: {},
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    },
    calendarSourceStatus: {
      connected: false,
      hasCalendarScope: false,
      needsReconnect: false,
      fetchAttempted: false,
      fetchSucceeded: false,
      reviewedEventCount: 0,
      mappedSignalCount: 0,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    }
  });

  assert.equal(note, "No live calendar connected.");
});

test("meetings and prep status reports live calendar unavailability without cards", () => {
  const note = getMeetingSectionStatusNote({
    meetingSourceAttribution: {
      eligibleBySourceType: {},
      visibleBySourceType: {},
      surfacedAboveBySourceType: {},
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    },
    calendarSourceStatus: {
      connected: true,
      hasCalendarScope: true,
      needsReconnect: false,
      fetchAttempted: true,
      fetchSucceeded: false,
      reviewedEventCount: 0,
      mappedSignalCount: 0,
      liveCalendarVisibleCount: 0,
      liveCalendarSurfacedAboveCount: 0
    }
  });

  assert.equal(note, "Live calendar unavailable right now.");
});

test("live calendar reviewed count can differ from visible meeting card count", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Board approval",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "PAC approval",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "calendar-meeting-1",
      title: "Board prep review",
      source_type: "outlook_calendar",
      source_origin: "live_calendar",
      source_label: "Outlook Calendar",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    })
  ]);

  const note = getMeetingSectionStatusNote({
    meetingSourceAttribution: model.meetingSourceAttribution,
    calendarSourceStatus: {
      fetchSucceeded: true,
      reviewedEventCount: 4,
      liveCalendarVisibleCount: model.meetingSourceAttribution.liveCalendarVisibleCount,
      liveCalendarSurfacedAboveCount: model.meetingSourceAttribution.liveCalendarSurfacedAboveCount
    }
  });

  assert.equal(model.consequentialMeetings.length, 0);
  assert.equal(model.meetingSourceAttribution.liveCalendarSurfacedAboveCount, 1);
  assert.match(note ?? "", /4 events reviewed/i);
});

test("non-calendar meeting-prep signal appears in meeting section with accurate source attribution", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision A",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "Decision B",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "delegation-1",
      title: "Delegation A",
      work_type: "delegation",
      priority: "high",
      recommended_action: "follow_up"
    }),
    buildSignal({
      id: "agent-meeting-1",
      title: "Customer prep note",
      source_type: "calendar",
      source_origin: "agent_brief",
      source_label: "Outlook Calendar connector",
      work_type: "meeting",
      priority: "medium",
      recommended_action: "prepare"
    })
  ]);

  assert.equal(model.consequentialMeetings[0]?.source_label_compact, "Agent brief · Calendar");
});

test("agent teams decision signal can enter decisions needed", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision A",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "Decision B",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "meeting-1",
      title: "Meeting A",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "teams-decision-1",
      title: "Ops escalation needs judgment",
      source_type: "teams",
      source_origin: "agent_brief",
      source_label: "Agent brief · Teams",
      work_type: "decision",
      priority: "medium",
      recommended_action: "decide"
    })
  ]);

  assert.equal(model.decisionsNeeded.some((item) => item.id === "teams-decision-1"), true);
});

test("agent teams follow-up signal can enter delegate waiting on", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision A",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "Decision B",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "meeting-1",
      title: "Meeting A",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "teams-follow-up-1",
      title: "Need finance response in Teams",
      source_type: "teams",
      source_origin: "agent_brief",
      source_label: "Agent brief · Teams",
      work_type: "delegation",
      priority: "medium",
      recommended_action: "follow_up",
      waiting_on: "Finance response"
    })
  ]);

  assert.equal(model.delegateWaitingOn.some((item) => item.id === "teams-follow-up-1"), true);
});

test("calendar review unavailable does not appear in consequential meetings", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision A",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "Decision B",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "delegation-1",
      title: "Delegation A",
      work_type: "delegation",
      priority: "high",
      recommended_action: "follow_up"
    }),
    buildSignal({
      id: "calendar-diagnostic-1",
      title: "Calendar review unavailable",
      summary: "Calendar sync failed because auth is unavailable.",
      source_type: "calendar",
      work_type: "noise",
      recommended_action: "ignore",
      status: "status"
    })
  ]);

  assert.equal(model.consequentialMeetings.some((item) => item.id === "calendar-diagnostic-1"), false);
});

test("calendar diagnostics are kept quiet instead of surfacing as executive work", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision A",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "Decision B",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "meeting-1",
      title: "Meeting A",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "calendar-diagnostic-1",
      title: "Calendar review unavailable",
      summary: "Calendar auth unavailable for the current review.",
      source_type: "calendar",
      work_type: "noise",
      recommended_action: "ignore",
      status: "status"
    })
  ]);

  assert.equal(model.quietlyHandled.some((item) => item.id === "calendar-diagnostic-1"), true);
  assert.equal(
    model.quietlyHandled.find((item) => item.id === "calendar-diagnostic-1")?.reason_suppressed,
    "System diagnostic kept out of foreground."
  );
});

test("groups delegation and waiting-on signals into delegate waiting on when not already surfaced above", () => {
  const model = buildViewModel([
    buildSignal({ id: "decision-1", title: "Decision A", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "decision-2", title: "Decision B", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "meeting-1", title: "Meeting A", work_type: "meeting", priority: "high", recommended_action: "prepare" }),
    buildSignal({
      id: "delegation-1",
      title: "Waiting on finance update",
      work_type: "delegation",
      recommended_action: "wait",
      waiting_on: "Finance numbers",
      desired_outcome: "Final budget numbers"
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "delegation-1"), false);
  assert.equal(model.delegateWaitingOn.some((item) => item.id === "delegation-1"), true);
});

test("groups opportunity signals into opportunity queue when not already surfaced above", () => {
  const model = buildViewModel([
    buildSignal({ id: "decision-1", title: "Decision A", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "decision-2", title: "Decision B", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "meeting-1", title: "Meeting A", work_type: "meeting", priority: "high", recommended_action: "prepare" }),
    buildSignal({
      id: "opportunity-1",
      title: "Harbinger partnership opportunity",
      summary: "Advance diligence on the Harbinger partnership opportunity.",
      work_type: "opportunity",
      recommended_action: "advance",
      related_companies: ["Harbinger"]
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "opportunity-1"), false);
  assert.equal(model.opportunityQueue.length, 1);
  assert.equal(model.opportunityQueue[0]?.company_or_counterparty, "Harbinger");
});

test("section caps limit visible items and expose deterministic overflow counts", () => {
  const model = buildViewModel([
    buildSignal({ id: "top-opportunity", title: "Top opportunity", work_type: "opportunity", priority: "high", recommended_action: "advance" }),
    buildSignal({ id: "top-meeting", title: "Top meeting", work_type: "meeting", priority: "high", recommended_action: "prepare" }),
    buildSignal({ id: "top-initiative", title: "Top initiative", work_type: "strategic_initiative", priority: "high", recommended_action: "advance" }),
    buildSignal({ id: "decision-1", title: "Decision 1", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-2", title: "Decision 2", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-3", title: "Decision 3", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-4", title: "Decision 4", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-5", title: "Decision 5", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-6", title: "Decision 6", work_type: "decision", priority: "medium", recommended_action: "decide" })
  ]);

  assert.equal(model.decisionsNeeded.length, 4);
  assert.equal(model.sectionOverflowCounts.decisionsNeeded, 2);
  assert.deepEqual(
    model.decisionsNeeded.map((item) => item.id),
    ["decision-1", "decision-2", "decision-3", "decision-4"]
  );
});

test("groups strategic initiative signals into protected value creation when not already surfaced above", () => {
  const model = buildTodayExecutiveLeverageViewModel({
    executiveSignals: [
      buildSignal({ id: "decision-1", title: "Decision A", work_type: "decision", priority: "high", recommended_action: "decide" }),
      buildSignal({ id: "decision-2", title: "Decision B", work_type: "decision", priority: "high", recommended_action: "decide" }),
      buildSignal({ id: "meeting-1", title: "Meeting A", work_type: "meeting", priority: "high", recommended_action: "prepare" }),
      buildSignal({
        id: "initiative-signal-1",
        title: "Executive operating rhythm weekly review",
        summary: "The weekly review advanced and one blocker remains.",
        work_type: "strategic_initiative",
        recommended_action: "advance",
        related_initiatives: ["Executive operating rhythm"]
      })
    ],
    initiatives: [
      {
        id: "initiative-1",
        title: "Executive operating rhythm",
        status: "active"
      }
    ],
    generatedAt: GENERATED_AT
  });

  assert.equal(model.protectedValueCreation.length >= 1, true);
  assert.equal(model.protectedValueCreation[0]?.title, "Executive operating rhythm");
  assert.equal(model.protectedValueCreation[0]?.related_signal_count, 1);
});

test("groups low-priority reference and noise into quietly handled", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Decision A",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "Decision B",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "meeting-1",
      title: "Meeting A",
      work_type: "meeting",
      priority: "high",
      recommended_action: "prepare"
    }),
    buildSignal({
      id: "reference-1",
      title: "Reference note",
      work_type: "reference",
      priority: "low",
      recommended_action: "review"
    }),
    buildSignal({
      id: "noise-1",
      title: "Promo blast",
      work_type: "noise",
      priority: "low",
      recommended_action: "ignore"
    })
  ]);

  assert.equal(model.quietlyHandled.length, 2);
  assert.match(
    model.quietlyHandled[0]?.reason_suppressed ?? "",
    /quiet|noise|archive|ignore|foreground/i
  );
});

test("quietly handled caps visible items and keeps overflow deterministic", () => {
  const model = buildViewModel([
    buildSignal({ id: "top-decision", title: "Top decision", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "top-meeting", title: "Top meeting", work_type: "meeting", priority: "high", recommended_action: "prepare" }),
    buildSignal({ id: "top-opportunity", title: "Top opportunity", work_type: "opportunity", priority: "high", recommended_action: "advance" }),
    buildSignal({ id: "quiet-1", title: "Quiet 1", work_type: "reference", priority: "low", recommended_action: "review" }),
    buildSignal({ id: "quiet-2", title: "Quiet 2", work_type: "reference", priority: "low", recommended_action: "review" }),
    buildSignal({ id: "quiet-3", title: "Quiet 3", work_type: "reference", priority: "low", recommended_action: "review" }),
    buildSignal({ id: "quiet-4", title: "Quiet 4", work_type: "reference", priority: "low", recommended_action: "review" }),
    buildSignal({ id: "quiet-5", title: "Quiet 5", work_type: "reference", priority: "low", recommended_action: "review" }),
    buildSignal({ id: "quiet-6", title: "Quiet 6", work_type: "reference", priority: "low", recommended_action: "review" })
  ]);

  assert.equal(model.quietlyHandled.length, 5);
  assert.equal(model.sectionOverflowCounts.quietlyHandled, 1);
});

test("counts source totals by work type, priority, and source type", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      work_type: "decision",
      priority: "high",
      source_type: "outlook",
      source_label: "Outlook"
    }),
    buildSignal({
      id: "meeting-1",
      work_type: "meeting",
      priority: "medium",
      source_type: "calendar",
      source_label: "Calendar"
    }),
    buildSignal({
      id: "meeting-2",
      work_type: "meeting",
      priority: "medium",
      source_type: "calendar",
      source_label: "Calendar"
    })
  ]);

  assert.equal(model.sourceCounts.work_type.decision, 1);
  assert.equal(model.sourceCounts.work_type.meeting, 2);
  assert.equal(model.sourceCounts.priority.high, 1);
  assert.equal(model.sourceCounts.priority.medium, 2);
  assert.equal(model.sourceCounts.source_type.outlook, 1);
  assert.equal(model.sourceCounts.source_type.calendar, 2);
});

test("source counts still include signals surfaced in top next best actions", () => {
  const model = buildViewModel([
    buildSignal({
      id: "decision-1",
      title: "Board approval",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide",
      source_type: "outlook",
      source_label: "Outlook"
    }),
    buildSignal({
      id: "delegation-1",
      title: "Follow up with finance",
      work_type: "delegation",
      priority: "high",
      recommended_action: "follow_up",
      source_type: "library",
      source_label: "Library"
    })
  ]);

  assert.equal(model.sourceCounts.work_type.decision, 1);
  assert.equal(model.sourceCounts.work_type.delegation, 1);
  assert.equal(model.sourceCounts.priority.high, 2);
});

test("quietly handled does not include signals already placed in higher-priority sections", () => {
  const model = buildViewModel([
    buildSignal({
      id: "reference-1",
      title: "Reference note",
      work_type: "reference",
      priority: "low",
      recommended_action: "review"
    }),
    buildSignal({
      id: "decision-1",
      title: "Board approval",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    }),
    buildSignal({
      id: "decision-2",
      title: "PAC approval",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide"
    })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "reference-1"), true);
  assert.equal(model.quietlyHandled.some((item) => item.id === "reference-1"), false);
});

test("capped-out items do not reappear as duplicates elsewhere", () => {
  const model = buildViewModel([
    buildSignal({ id: "top-opportunity", title: "Top opportunity", work_type: "opportunity", priority: "high", recommended_action: "advance" }),
    buildSignal({ id: "top-meeting", title: "Top meeting", work_type: "meeting", priority: "high", recommended_action: "prepare" }),
    buildSignal({ id: "top-initiative", title: "Top initiative", work_type: "strategic_initiative", priority: "high", recommended_action: "advance" }),
    buildSignal({ id: "decision-1", title: "Decision 1", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-2", title: "Decision 2", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-3", title: "Decision 3", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-4", title: "Decision 4", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-5", title: "Decision 5", work_type: "decision", priority: "medium", recommended_action: "decide" }),
    buildSignal({ id: "decision-6", title: "Decision 6", work_type: "decision", priority: "medium", recommended_action: "decide" })
  ]);

  const visibleIds = new Set([
    ...model.topNextBestActions.map((item) => item.id),
    ...model.decisionsNeeded.map((item) => item.id),
    ...model.consequentialMeetings.map((item) => item.id),
    ...model.delegateWaitingOn.map((item) => item.id),
    ...model.opportunityQueue.map((item) => item.id),
    ...model.quietlyHandled.map((item) => item.id)
  ]);

  assert.equal(visibleIds.has("decision-5"), false);
  assert.equal(visibleIds.has("decision-6"), false);
});

test("primary placement priority is deterministic", () => {
  const model = buildViewModel([
    buildSignal({
      id: "hybrid-1",
      title: "Board prep follow-up",
      work_type: "decision",
      priority: "medium",
      recommended_action: "follow_up",
      waiting_on: "Finance numbers",
      due_at: "2026-05-31T12:00:00.000Z"
    }),
    buildSignal({ id: "decision-1", title: "Decision A", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "decision-2", title: "Decision B", work_type: "decision", priority: "high", recommended_action: "decide" }),
    buildSignal({ id: "meeting-1", title: "Meeting A", work_type: "meeting", priority: "high", recommended_action: "prepare" })
  ]);

  assert.equal(model.topNextBestActions.some((item) => item.id === "hybrid-1"), false);
  assert.equal(model.decisionsNeeded.some((item) => item.id === "hybrid-1"), true);
  assert.equal(model.consequentialMeetings.some((item) => item.id === "hybrid-1"), false);
  assert.equal(model.delegateWaitingOn.some((item) => item.id === "hybrid-1"), false);
});

test("due-soon item outranks an undated comparable item", () => {
  const model = buildViewModel([
    buildSignal({
      id: "undated-1",
      title: "Review the memo",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide",
      due_at: null
    }),
    buildSignal({
      id: "due-soon-1",
      title: "Review the memo today",
      work_type: "decision",
      priority: "high",
      recommended_action: "decide",
      due_at: "2026-05-29T18:00:00.000Z"
    })
  ]);

  assert.equal(model.topNextBestActions[0]?.id, "due-soon-1");
});
