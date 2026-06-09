import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStructuredBriefSourceLanes,
  resolveBriefSourceLaneId
} from "../lib/brief/source-lanes";
import type { StructuredExecutiveBrief, StructuredExecutiveBriefItem } from "../lib/brief/executive-brief-snapshots";

function buildItem(overrides: Partial<StructuredExecutiveBriefItem> = {}): StructuredExecutiveBriefItem {
  return {
    id: "item-1",
    title: "Review the customer reply",
    summary: "A customer email needs a response.",
    source: "Outlook",
    priority: "high",
    recommendedAction: "Reply",
    dueAt: null,
    ...overrides
  };
}

function buildStructuredBrief(overrides: Partial<StructuredExecutiveBrief> = {}): StructuredExecutiveBrief {
  return {
    commandSummary: [],
    topMoves: [buildItem({ id: "email-move", source: "Outlook" })],
    decisionsNeeded: [buildItem({ id: "teams-decision", title: "Answer JT", source: "Teams DM" })],
    meetingPrep: [buildItem({ id: "calendar-meeting", title: "Board prep", source: "Calendar" })],
    carryForward: [],
    taskCandidates: [buildItem({ id: "email-task", source: "Executive Brief" })],
    ...overrides
  };
}

test("structured brief source lanes are Email, Calendar / Meetings, Teams", () => {
  const lanes = buildStructuredBriefSourceLanes({
    structuredBrief: buildStructuredBrief()
  });

  assert.deepEqual(
    lanes.map((lane) => lane.id),
    ["email", "calendar_meetings", "teams"]
  );
  assert.deepEqual(
    lanes.map((lane) => lane.label),
    ["Email", "Calendar / Meetings", "Teams"]
  );
});

test("structured brief source lanes omit empty source sections", () => {
  const lanes = buildStructuredBriefSourceLanes({
    structuredBrief: buildStructuredBrief({
      decisionsNeeded: [],
      meetingPrep: []
    })
  });

  assert.deepEqual(
    lanes.map((lane) => lane.id),
    ["email"]
  );
});

test("meeting prep is categorized as Calendar / Meetings even without explicit source text", () => {
  assert.equal(
    resolveBriefSourceLaneId({
      section: "meetingPrep",
      item: buildItem({
        source: null,
        title: "Portfolio review",
        summary: null
      })
    }),
    "calendar_meetings"
  );
});
