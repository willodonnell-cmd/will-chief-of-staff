import assert from "node:assert/strict";
import test from "node:test";

import {
  briefItemDomId,
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

test("explicit sourceLane metadata overrides text heuristics without changing lane order", () => {
  const lanes = buildStructuredBriefSourceLanes({
    structuredBrief: buildStructuredBrief({
      topMoves: [
        buildItem({
          id: "calendar-explicit",
          title: "Board calendar hold",
          source: "Outlook",
          sourceLane: "calendar_meetings"
        })
      ],
      decisionsNeeded: [
        buildItem({
          id: "teams-explicit",
          title: "Reply to email thread",
          source: "Email",
          sourceLane: "teams"
        })
      ],
      meetingPrep: [],
      taskCandidates: []
    })
  });

  assert.deepEqual(
    lanes.map((lane) => lane.id),
    ["calendar_meetings", "teams"]
  );
  assert.equal(lanes[0]?.entries[0]?.item.id, "calendar-explicit");
  assert.equal(lanes[1]?.entries[0]?.item.id, "teams-explicit");
});

test("brief item DOM ids are stable anchors for specific source-lane entries", () => {
  assert.equal(briefItemDomId("topMoves-outlook reply"), "brief-item-topMoves-outlook-reply");
  assert.equal(briefItemDomId(""), "brief-item-item");
});
