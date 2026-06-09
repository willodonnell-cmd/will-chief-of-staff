import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutiveBriefSnapshot } from "../lib/brief/executive-brief-snapshots";
import type { LibraryItemSummary } from "../lib/capture-library";
import { buildTodayViewModel } from "../lib/today-view-model";

const GENERATED_AT = "2026-06-08T14:00:00.000Z";

function buildSnapshot(overrides: Partial<ExecutiveBriefSnapshot> = {}): ExecutiveBriefSnapshot {
  return {
    id: "snapshot-1",
    subject: "BLACKHAWK_BRIEF_BUNDLE 7 AM",
    slot: "7 AM",
    generatedAt: GENERATED_AT,
    displayDate: "June 8, 2026",
    rawEmailBody: "raw brief",
    humanBrief: "human brief",
    jsonBundle: null,
    structuredBrief: {
      commandSummary: ["Land the board approval path before the afternoon readout."],
      topMoves: [
        {
          id: "move-1",
          title: "Board approval path",
          summary: "Confirm the recommendation and owner before the readout.",
          source: "Executive Brief",
          sourceLabel: null,
          sourceUrl: null,
          senderName: null,
          senderEmail: null,
          receivedAt: null,
          priority: "high",
          recommendedAction: "Decide",
          dueAt: "2026-06-08T18:00:00.000Z",
          attendees: []
        }
      ],
      decisionsNeeded: [
        {
          id: "decision-1",
          title: "Approve memo release",
          summary: "Choose whether the memo can go out today.",
          source: "Legal",
          priority: "high",
          recommendedAction: "Approve",
          dueAt: null,
          attendees: []
        }
      ],
      meetingPrep: [
        {
          id: "meeting-1",
          title: "LP call prep",
          summary: "Review talking points before the LP call.",
          source: "Calendar",
          sourceUrl: null,
          priority: "medium",
          recommendedAction: "Prepare",
          dueAt: null,
          startAt: null,
          endAt: null,
          attendees: []
        }
      ],
      carryForward: [
        {
          id: "memory-1",
          title: "Carry financing context",
          summary: "Keep the financing caveat visible until the lender reply lands.",
          source: "Prior brief",
          priority: "medium",
          recommendedAction: "Monitor",
          dueAt: null,
          attendees: []
        }
      ],
      taskCandidates: [
        {
          id: "task-candidate-1",
          title: "Ask finance for lender update",
          summary: "Convert this into a task if finance has not replied.",
          source: "Executive Brief",
          priority: "medium",
          recommendedAction: "Create task",
          dueAt: null,
          attendees: []
        }
      ]
    },
    contractVersion: "executive_brief.v1",
    validationWarnings: [],
    sourceMessageId: "message-1",
    createdAt: "2026-06-08T14:01:00.000Z",
    ...overrides
  };
}

function buildTask(overrides: Partial<LibraryItemSummary> = {}): LibraryItemSummary {
  return {
    id: "task-1",
    type: "task",
    captureType: "task",
    captureTypeLabel: "Task",
    executiveWorkType: "delegation",
    captureMetadata: null,
    priority: "high",
    categoryId: null,
    categoryName: null,
    categoryIsFallback: false,
    linkedInitiativeId: null,
    linkedInitiativeTitle: null,
    title: "Ask finance for lender update",
    preview: "Follow up with finance.",
    sourcePath: "/brief",
    privacy: "open",
    status: "active",
    capturedAt: "2026-06-08T14:05:00.000Z",
    lastActiveAt: "2026-06-08T14:05:00.000Z",
    archivedAt: null,
    completedAt: null,
    dueAt: "2026-06-08T22:00:00.000Z",
    saveState: "saved",
    saveStateDetail: "",
    localOnly: false,
    note: null,
    task: {
      title: "Ask finance for lender update",
      description: "Ask finance for lender update",
      nextStep: "Send reminder",
      desiredOutcome: "Lender reply received",
      status: "active",
      dueAt: "2026-06-08T22:00:00.000Z",
      priority: "high",
      categoryId: null,
      categoryName: "TBD",
      categoryIsFallback: true,
      linkedInitiativeId: null,
      linkedInitiativeTitle: null
    },
    originCapture: null,
    sourceLinkage: null,
    ...overrides
  };
}

test("Today view model uses latest Executive Brief structured sections", () => {
  const model = buildTodayViewModel({
    snapshot: buildSnapshot(),
    openTasks: [buildTask()]
  });

  assert.equal(model.hasBriefSnapshot, true);
  assert.equal(model.briefFreshness.status, "processed");
  assert.equal(model.briefFreshness.slot, "7 AM");
  assert.equal(model.briefFreshness.generatedAt, GENERATED_AT);
  assert.deepEqual(model.commandSummary, ["Land the board approval path before the afternoon readout."]);
  assert.equal(model.currentFocus[0]?.title, "Board approval path");
  assert.equal(model.decisionsNeeded[0]?.title, "Approve memo release");
  assert.equal(model.meetingPrep[0]?.title, "LP call prep");
  assert.equal(model.carryForward[0]?.title, "Carry financing context");
  assert.equal(model.taskCandidates[0]?.title, "Ask finance for lender update");
});

test("Today brief-derived cards link to source URLs or specific Executive Brief anchors", () => {
  const model = buildTodayViewModel({
    snapshot: buildSnapshot({
      structuredBrief: {
        ...buildSnapshot().structuredBrief!,
        topMoves: [
          {
            id: "move-source",
            title: "Reply to board observer",
            summary: "Board observer needs an answer.",
            source: "Outlook",
            sourceUrl: "https://outlook.example/message-1",
            senderName: "Board Observer",
            senderEmail: "observer@example.com",
            priority: "high",
            recommendedAction: "Reply",
            dueAt: null,
            attendees: []
          }
        ]
      }
    }),
    openTasks: []
  });

  const emailLane = model.sourceLanes.find((lane) => lane.id === "email");
  assert.equal(emailLane?.items[0]?.href, "https://outlook.example/message-1");
  assert.equal(emailLane?.items[0]?.sourceHref, "https://outlook.example/message-1");
  assert.equal(emailLane?.items[0]?.briefHref, "/brief#brief-item-topMoves-move-source");
  assert.equal(model.decisionsNeeded[0]?.href, "/brief#brief-item-decision-decision-1");
  assert.equal(model.meetingPrep[0]?.briefHref, "/brief#brief-item-meeting-meeting-1");
});

test("Today email cards include sender source labels and task creation metadata", () => {
  const model = buildTodayViewModel({
    snapshot: buildSnapshot({
      structuredBrief: {
        ...buildSnapshot().structuredBrief!,
        topMoves: [
          {
            id: "move-email",
            title: "Reply on approval path",
            summary: "The sender is waiting on Will before the packet moves.",
            source: "Outlook",
            sourceLabel: "Approval thread",
            sourceUrl: "https://outlook.example/message-2",
            senderName: "Maya Finance",
            senderEmail: "maya@example.com",
            priority: "high",
            recommendedAction: "Reply today",
            dueAt: "2026-06-08T18:00:00.000Z",
            attendees: []
          }
        ]
      }
    }),
    openTasks: []
  });
  const emailItem = model.sourceLanes.find((lane) => lane.id === "email")?.items[0];

  assert.equal(emailItem?.senderLabel, "Maya Finance <maya@example.com>");
  assert.equal(emailItem?.sourceLabel, "Approval thread");
  assert.equal(emailItem?.sourceQualityLabel, "Source link available");
  assert.equal(emailItem?.canCreateTask, true);
  assert.equal(emailItem?.taskDescription, "Reply on approval path");
  assert.equal(emailItem?.taskNextStep, "Reply today");
});

test("Today meeting cards include time attendee and missing-metadata labels", () => {
  const baseSnapshot = buildSnapshot();
  const model = buildTodayViewModel({
    snapshot: buildSnapshot({
      structuredBrief: {
        ...baseSnapshot.structuredBrief!,
        meetingPrep: [
          {
            id: "meeting-rich",
            title: "Customer prep",
            summary: "Prepare for the expansion decision.",
            source: "Calendar",
            priority: "high",
            recommendedAction: "Review scope options",
            dueAt: null,
            startAt: "2026-06-08T17:00:00.000Z",
            endAt: "2026-06-08T18:00:00.000Z",
            attendees: ["Will O'Donnell", "Alex Partner", "Jordan Lee", "Customer COO"],
            organizerName: "Alex Partner",
            organizerEmail: "alex@example.com",
            locationOrLink: "https://outlook.example/calendar"
          }
        ]
      }
    }),
    openTasks: []
  });
  const meetingItem = model.sourceLanes.find((lane) => lane.id === "calendar_meetings")?.items[0];

  assert.match(meetingItem?.timeLabel ?? "", /Jun 8/);
  assert.equal(meetingItem?.attendeeLabel, "Group meeting · 4 attendees");
  assert.equal(meetingItem?.sourceQualityLabel, "Brief-only context");
  assert.equal(meetingItem?.organizerName, "Alex Partner");
  assert.equal(meetingItem?.locationOrLink, "https://outlook.example/calendar");

  const missingModel = buildTodayViewModel({
    snapshot: buildSnapshot(),
    openTasks: []
  });
  assert.equal(
    missingModel.sourceLanes.find((lane) => lane.id === "calendar_meetings")?.items[0]?.sourceQualityLabel,
    "Calendar metadata unavailable"
  );
});

test("Today source lanes are ordered as Email, Calendar / Meetings, Teams", () => {
  const baseSnapshot = buildSnapshot();
  const model = buildTodayViewModel({
    snapshot: buildSnapshot({
      structuredBrief: {
        ...baseSnapshot.structuredBrief!,
        decisionsNeeded: [
          {
            id: "teams-ask",
            title: "Answer JT escalation",
            summary: "JT asked for a decision in Teams.",
            source: "Teams DM",
            priority: "high",
            recommendedAction: "Reply",
            dueAt: null
          }
        ]
      }
    }),
    openTasks: [buildTask()]
  });

  assert.deepEqual(
    model.sourceLanes.map((lane) => lane.label),
    ["Email", "Calendar / Meetings", "Teams"]
  );
  assert.equal(model.sourceLanes[0]?.tasks[0]?.sourcePath, "/brief");
});

test("Today source lanes omit empty source sections", () => {
  const model = buildTodayViewModel({
    snapshot: buildSnapshot({
      structuredBrief: {
        commandSummary: [],
        topMoves: [],
        decisionsNeeded: [],
        meetingPrep: [],
        carryForward: [],
        taskCandidates: []
      }
    }),
    openTasks: []
  });

  assert.deepEqual(model.sourceLanes, []);
});

test("Today task links still point at library detail pages", () => {
  const model = buildTodayViewModel({
    snapshot: buildSnapshot(),
    openTasks: [buildTask({ id: "capture-task-123" })]
  });

  assert.equal(model.openTasks[0]?.href, "/library/capture-task-123?from=%2F");
  assert.equal(model.openTasks[0]?.sourcePath, "/brief");
  assert.match(model.openTasks[0]?.detail ?? "", /From Executive Brief/);
});

test("Today shows an empty stale-state when no current brief exists", () => {
  const model = buildTodayViewModel({
    snapshot: null,
    openTasks: []
  });

  assert.equal(model.hasBriefSnapshot, false);
  assert.equal(model.briefFreshness.status, "waiting");
  assert.equal(model.briefFreshness.generatedAt, null);
  assert.equal(model.currentFocus.length, 0);
  assert.equal(model.emptyState?.title, "No processed Executive Brief yet.");
  assert.match(model.emptyState?.detail ?? "", /BLACKHAWK_BRIEF_BUNDLE/);
});

test("Today does not introduce old executive-leverage demo content when a snapshot exists", () => {
  const model = buildTodayViewModel({
    snapshot: buildSnapshot(),
    openTasks: []
  });
  const renderedText = JSON.stringify(model);

  assert.doesNotMatch(renderedText, /No executive leverage signals yet/i);
  assert.doesNotMatch(renderedText, /Priority Inbox/i);
  assert.doesNotMatch(renderedText, /Top 3 next best actions/i);
});

test("Today omits unsupported brief-card filler instead of inventing summaries or titles", () => {
  const baseSnapshot = buildSnapshot();
  const model = buildTodayViewModel({
    snapshot: buildSnapshot({
      structuredBrief: {
        ...baseSnapshot.structuredBrief!,
        commandSummary: ["  Keep the approval path warm.  ", ""],
        topMoves: [
          {
            id: "blank-title",
            title: "   ",
            summary: "Should not render without a real title.",
            source: "Executive Brief",
            priority: "high",
            recommendedAction: null,
            dueAt: null
          },
          {
            id: "no-summary",
            title: "Confirm approval owner",
            summary: null,
            source: null,
            priority: null,
            recommendedAction: null,
            dueAt: null
          }
        ]
      }
    }),
    openTasks: []
  });
  const renderedText = JSON.stringify(model);

  assert.deepEqual(model.commandSummary, ["Keep the approval path warm."]);
  assert.equal(model.currentFocus.length, 1);
  assert.equal(model.currentFocus[0]?.title, "Confirm approval owner");
  assert.equal(model.currentFocus[0]?.summary, null);
  assert.doesNotMatch(renderedText, /Untitled brief item/i);
  assert.doesNotMatch(renderedText, /Open the full brief for more context/i);
});
