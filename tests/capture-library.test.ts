import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutiveCaptureMetadata } from "../lib/blackhawk-capture-model";
import {
  type LibraryItemSummary,
  type LibraryQuery
} from "../lib/capture-library";
import {
  countLibraryItemsByWorkType,
  filterLibraryItems,
  groupLibraryItemsByWorkType,
  parseLibraryQueryParams
} from "../lib/library-filters";
import {
  mergeExecutiveCaptureMetadata,
  resolveLibraryItemEditorMode
} from "../lib/library-executive-edit";

function buildLibraryItem(overrides: Partial<LibraryItemSummary> = {}): LibraryItemSummary {
  return {
    id: "capture-1",
    type: "note",
    captureType: "note",
    captureTypeLabel: "Note",
    executiveWorkType: null,
    captureMetadata: null,
    priority: null,
    categoryId: null,
    categoryName: null,
    categoryIsFallback: undefined,
    linkedInitiativeId: null,
    linkedInitiativeTitle: null,
    title: "Library item",
    preview: "Preview",
    sourcePath: "/capture",
    privacy: "open",
    status: "active",
    capturedAt: "2026-05-31T08:00:00.000Z",
    lastActiveAt: "2026-05-31T09:00:00.000Z",
    archivedAt: null,
    completedAt: null,
    dueAt: null,
    saveState: "saved",
    saveStateDetail: "",
    localOnly: false,
    note: {
      title: "Library item",
      body: "Preview",
      linkedInitiativeId: null,
      linkedInitiativeTitle: null
    },
    task: null,
    originCapture: null,
    sourceLinkage: null,
    ...overrides
  };
}

function buildLibraryQuery(overrides: Partial<LibraryQuery> = {}): LibraryQuery {
  return {
    scope: "library",
    mode: "all",
    search: "",
    type: "all",
    status: "all",
    priority: "all",
    due: "all",
    category: "all",
    ...overrides
  };
}

test("resolves executive editor modes from explicit capture types", () => {
  assert.equal(
    resolveLibraryItemEditorMode({
      type: "note",
      captureType: "decision",
      executiveWorkType: "decision"
    }),
    "decision"
  );

  assert.equal(
    resolveLibraryItemEditorMode({
      type: "task",
      captureType: "waiting_on",
      executiveWorkType: "delegation"
    }),
    "waiting_on"
  );
});

test("falls back to executive work type when capture type metadata is missing", () => {
  assert.equal(
    resolveLibraryItemEditorMode({
      type: "note",
      captureType: null,
      executiveWorkType: "meeting"
    }),
    "meeting_note"
  );

  assert.equal(
    resolveLibraryItemEditorMode({
      type: "task",
      captureType: null,
      executiveWorkType: "delegation"
    }),
    "waiting_on"
  );
});

test("decision metadata updates preserve unknown keys and capture type", () => {
  const existing = {
    captureType: "decision",
    decisionQuestion: "Should we approve the board-prep direction?",
    status: "needs_review",
    sourceThreadId: "thread-7"
  } as ExecutiveCaptureMetadata & { sourceThreadId: string };

  const merged = mergeExecutiveCaptureMetadata(existing, {
    captureType: "decision",
    recommendation: "Approve the narrowed direction.",
    status: null
  }) as ExecutiveCaptureMetadata & { sourceThreadId?: string };

  assert.equal(merged.captureType, "decision");
  assert.equal(merged.decisionQuestion, "Should we approve the board-prep direction?");
  assert.equal(merged.recommendation, "Approve the narrowed direction.");
  assert.equal(merged.status, null);
  assert.equal(merged.sourceThreadId, "thread-7");
});

test("waiting-on metadata updates preserve task-compatible context", () => {
  const existing = {
    captureType: "waiting_on",
    waitingOn: "Finance",
    delegatedTo: "Will",
    relatedOpportunity: "Harbinger diligence",
    untouchedKey: "preserve-me"
  } as ExecutiveCaptureMetadata & { untouchedKey: string };

  const merged = mergeExecutiveCaptureMetadata(existing, {
    captureType: "waiting_on",
    expectedOutcome: "Receive the updated numbers.",
    followUpAt: "2026-06-02T16:00:00.000Z",
    delegatedTo: "Chief of Staff"
  }) as ExecutiveCaptureMetadata & { untouchedKey?: string };

  assert.equal(merged.captureType, "waiting_on");
  assert.equal(merged.waitingOn, "Finance");
  assert.equal(merged.expectedOutcome, "Receive the updated numbers.");
  assert.equal(merged.delegatedTo, "Chief of Staff");
  assert.equal(merged.relatedOpportunity, "Harbinger diligence");
  assert.equal(merged.untouchedKey, "preserve-me");
});

test("meeting-note metadata updates preserve existing related context", () => {
  const existing = {
    captureType: "meeting_note",
    meetingTitle: "Board prep review",
    relatedCompany: "Harbinger",
    attendees: "Will, Amelia"
  } satisfies ExecutiveCaptureMetadata;

  const merged = mergeExecutiveCaptureMetadata(existing, {
    captureType: "meeting_note",
    decisions: "Narrow the board packet.",
    followUps: "Send the revised memo.",
    waitingOnItems: "Finance numbers"
  });

  assert.equal(merged.captureType, "meeting_note");
  assert.equal(merged.meetingTitle, "Board prep review");
  assert.equal(merged.relatedCompany, "Harbinger");
  assert.equal(merged.decisions, "Narrow the board packet.");
  assert.equal(merged.followUps, "Send the revised memo.");
  assert.equal(merged.waitingOnItems, "Finance numbers");
});

test("parses library query params for q, type, status, and priority", () => {
  const query = parseLibraryQueryParams(
    {
      q: "board prep",
      type: "decision",
      status: "archived",
      priority: "high"
    },
    "library"
  );

  assert.equal(query.search, "board prep");
  assert.equal(query.mode, "all");
  assert.equal(query.type, "decision");
  assert.equal(query.status, "archived");
  assert.equal(query.priority, "high");
});

test("notes mode keeps note-compatible executive objects in view", () => {
  const items = [
    buildLibraryItem({
      id: "note-1"
    }),
    buildLibraryItem({
      id: "decision-1",
      captureType: "decision",
      captureTypeLabel: "Decision",
      executiveWorkType: "decision",
      captureMetadata: { captureType: "decision", decisionQuestion: "Approve?" }
    }),
    buildLibraryItem({
      id: "waiting-on-1",
      type: "task",
      captureType: "waiting_on",
      captureTypeLabel: "Waiting On",
      executiveWorkType: "delegation",
      note: null,
      priority: "medium",
      task: {
        title: "Waiting on finance",
        description: "Waiting on finance",
        nextStep: "",
        desiredOutcome: "",
        status: "active",
        dueAt: null,
        priority: "medium",
        categoryId: "waiting-for",
        categoryName: "Waiting For",
        categoryIsFallback: false,
        linkedInitiativeId: null,
        linkedInitiativeTitle: null
      }
    })
  ];

  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ mode: "notes" })).map((item) => item.id),
    ["note-1", "decision-1"]
  );
});

test("filters ordinary notes and tasks by work type", () => {
  const items = [
    buildLibraryItem(),
    buildLibraryItem({
      id: "capture-task-1",
      type: "task",
      captureType: "task",
      captureTypeLabel: "Task",
      note: null,
      priority: "medium",
      task: {
        title: "Follow up",
        description: "Follow up",
        nextStep: "Send the note",
        desiredOutcome: "Get a reply",
        status: "active",
        dueAt: null,
        priority: "medium",
        categoryId: "priority-action",
        categoryName: "Priority Action",
        categoryIsFallback: false,
        linkedInitiativeId: null,
        linkedInitiativeTitle: null
      }
    })
  ];

  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ type: "note" })).map((item) => item.id),
    ["capture-1"]
  );
  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ type: "task" })).map((item) => item.id),
    ["capture-task-1"]
  );
});

test("filters executive capture types correctly", () => {
  const items = [
    buildLibraryItem({
      id: "decision-1",
      captureType: "decision",
      captureTypeLabel: "Decision",
      executiveWorkType: "decision",
      captureMetadata: { captureType: "decision", decisionQuestion: "Approve?" }
    }),
    buildLibraryItem({
      id: "opportunity-1",
      captureType: "opportunity",
      captureTypeLabel: "Opportunity",
      executiveWorkType: "opportunity",
      captureMetadata: { captureType: "opportunity", companyOrCounterparty: "Harbinger" }
    }),
    buildLibraryItem({
      id: "waiting-on-1",
      type: "task",
      captureType: "waiting_on",
      captureTypeLabel: "Waiting On",
      executiveWorkType: "delegation",
      note: null,
      priority: "high",
      task: {
        title: "Waiting on finance",
        description: "Waiting on finance",
        nextStep: "Check in Friday",
        desiredOutcome: "Budget numbers",
        status: "active",
        dueAt: "2026-06-01T15:00:00.000Z",
        priority: "high",
        categoryId: "waiting-for",
        categoryName: "Waiting For",
        categoryIsFallback: false,
        linkedInitiativeId: null,
        linkedInitiativeTitle: null
      }
    }),
    buildLibraryItem({
      id: "meeting-1",
      captureType: "meeting_note",
      captureTypeLabel: "Meeting Note",
      executiveWorkType: "meeting",
      captureMetadata: { captureType: "meeting_note", meetingTitle: "Board prep sync" }
    })
  ];

  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ type: "decision" })).map((item) => item.id),
    ["decision-1"]
  );
  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ type: "opportunity" })).map((item) => item.id),
    ["opportunity-1"]
  );
  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ type: "waiting_on" })).map((item) => item.id),
    ["waiting-on-1"]
  );
  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ type: "meeting_note" })).map((item) => item.id),
    ["meeting-1"]
  );
});

test("filters by priority and status", () => {
  const items = [
    buildLibraryItem({
      id: "high-decision",
      captureType: "decision",
      captureTypeLabel: "Decision",
      executiveWorkType: "decision",
      priority: "high",
      captureMetadata: { captureType: "decision", decisionQuestion: "Approve?" }
    }),
    buildLibraryItem({
      id: "archived-note",
      archivedAt: "2026-05-31T10:00:00.000Z",
      status: "archived"
    }),
    buildLibraryItem({
      id: "completed-task",
      type: "task",
      captureType: "task",
      captureTypeLabel: "Task",
      note: null,
      priority: "medium",
      status: "completed",
      completedAt: "2026-05-31T10:15:00.000Z",
      task: {
        title: "Send update",
        description: "Send update",
        nextStep: "",
        desiredOutcome: "",
        status: "completed",
        dueAt: null,
        priority: "medium",
        categoryId: "priority-action",
        categoryName: "Priority Action",
        categoryIsFallback: false,
        linkedInitiativeId: null,
        linkedInitiativeTitle: null
      }
    })
  ];

  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ priority: "high" })).map((item) => item.id),
    ["high-decision"]
  );
  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ status: "active" })).map((item) => item.id),
    ["high-decision"]
  );
  assert.deepEqual(
    filterLibraryItems(items, buildLibraryQuery({ status: "archived" })).map((item) => item.id),
    ["archived-note"]
  );
});

test("counts and groups items by work type in executive order", () => {
  const items = [
    buildLibraryItem({
      id: "decision-1",
      captureType: "decision",
      captureTypeLabel: "Decision",
      executiveWorkType: "decision",
      captureMetadata: { captureType: "decision", decisionQuestion: "Approve?" },
      priority: "high"
    }),
    buildLibraryItem({
      id: "opportunity-1",
      captureType: "opportunity",
      captureTypeLabel: "Opportunity",
      executiveWorkType: "opportunity",
      captureMetadata: { captureType: "opportunity", companyOrCounterparty: "Harbinger" }
    }),
    buildLibraryItem({
      id: "note-1"
    }),
    buildLibraryItem({
      id: "task-1",
      type: "task",
      captureType: "task",
      captureTypeLabel: "Task",
      note: null,
      priority: "medium",
      task: {
        title: "Follow up",
        description: "Follow up",
        nextStep: "",
        desiredOutcome: "",
        status: "active",
        dueAt: null,
        priority: "medium",
        categoryId: "priority-action",
        categoryName: "Priority Action",
        categoryIsFallback: false,
        linkedInitiativeId: null,
        linkedInitiativeTitle: null
      }
    })
  ];

  assert.deepEqual(
    countLibraryItemsByWorkType(items).map((entry) => [entry.type, entry.count]),
    [
      ["decision", 1],
      ["opportunity", 1],
      ["waiting_on", 0],
      ["meeting_note", 0],
      ["task", 1],
      ["note", 1]
    ]
  );

  assert.deepEqual(
    groupLibraryItemsByWorkType(items).map((group) => group.type),
    ["decision", "opportunity", "task", "note"]
  );
});
