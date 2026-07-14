import assert from "node:assert/strict";
import test from "node:test";

import {
  BLACKHAWK_LIVE_BRIEF_CONTRACT_VERSION,
  type BlackhawkLiveBrief,
  type LiveBriefItem,
  validateBlackhawkLiveBrief
} from "../lib/blackhawk/live-brief-contract";

const generatedAt = "2026-07-13T16:00:00.000Z";

function buildItem(overrides: Partial<LiveBriefItem> = {}): LiveBriefItem {
  return {
    id: "item-1",
    canonicalIssueKey: "board-prep",
    kind: "top_action",
    headline: "Approve the board-prep direction",
    explanation: "A decision from Will will unblock the team before tomorrow's meeting.",
    priority: "high",
    confidence: "high",
    change: "new",
    rank: 1,
    context: "The team has converged on one recommended direction.",
    whyNow: "Materials lock tomorrow.",
    recommendedNextMove: "Review the recommendation and approve or revise it.",
    relatedPeople: ["Amelia Hart"],
    relatedCompanies: [],
    relatedTopic: "Board preparation",
    dueAt: "2026-07-14T18:00:00.000Z",
    meetingStartAt: null,
    waitingOn: null,
    expectedTrigger: null,
    evidence: [{
      source: "outlook",
      id: "message-1",
      label: "Board prep decision memo",
      url: "https://outlook.office.com/mail/message-1",
      occurredAt: generatedAt
    }],
    sourceConflict: null,
    allowedActions: ["accept_as_task", "dismiss", "draft_response", "run_deeper_research", "adjust"],
    ...overrides
  };
}

function buildBrief(overrides: Partial<BlackhawkLiveBrief> = {}): BlackhawkLiveBrief {
  return {
    contractVersion: BLACKHAWK_LIVE_BRIEF_CONTRACT_VERSION,
    briefId: "brief-1",
    generatedAt,
    previousBriefId: null,
    refresh: {
      trigger: "open",
      status: "succeeded",
      startedAt: "2026-07-13T15:59:00.000Z",
      completedAt: generatedAt,
      materialChangeCount: 1
    },
    sourceCoverage: {
      outlook: { status: "available", checkedAt: generatedAt, warning: null },
      calendar: { status: "available", checkedAt: generatedAt, warning: null },
      teams: { status: "available", checkedAt: generatedAt, warning: null }
    },
    sections: {
      topActions: { items: [buildItem()], additionalItemCount: 0 },
      decisionsNeeded: { items: [], additionalItemCount: 0 },
      meetingPrep: { items: [], additionalItemCount: 0 },
      waitingOn: { items: [], additionalItemCount: 0 },
      personal: { items: [], additionalItemCount: 0 }
    },
    navigation: {
      investmentCommittee: true,
      tasksAndWaitingOn: true,
      adminAndSettings: true
    },
    ...overrides
  };
}

test("accepts a concise source-backed live brief", () => {
  const result = validateBlackhawkLiveBrief(buildBrief(), {
    now: "2026-07-13T16:05:00.000Z",
    maximumAgeMinutes: 15
  });
  assert.deepEqual(result, { ok: true, errors: [] });
});

test("blocks unsupported context and duplicate cross-source items", () => {
  const duplicate = buildItem({
    id: "item-2",
    evidence: [{ source: "teams", id: "message-2", label: "Board prep chat", url: null, occurredAt: generatedAt }]
  });
  const brief = buildBrief();
  brief.sections.decisionsNeeded.items = [duplicate, buildItem({ id: "item-3", canonicalIssueKey: "unsupported", evidence: [] })];
  const result = validateBlackhawkLiveBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Combine related sources into one item/);
  assert.match(result.errors.join(" "), /has no supporting source/);
});

test("blocks clutter from excess top actions and low-confidence items", () => {
  const brief = buildBrief();
  brief.sections.topActions.items = Array.from({ length: 6 }, (_, index) => buildItem({
    id: `item-${index}`,
    canonicalIssueKey: `issue-${index}`,
    confidence: index < 2 ? "low" : "high"
  }));
  const result = validateBlackhawkLiveBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /at most five top actions/);
  assert.match(result.errors.join(" "), /at most one low-confidence item/);
});

test("blocks stale state and missing coverage warnings", () => {
  const brief = buildBrief();
  brief.sourceCoverage.teams = { status: "unavailable", checkedAt: generatedAt, warning: null };
  const result = validateBlackhawkLiveBrief(brief, {
    now: "2026-07-13T17:00:00.000Z",
    maximumAgeMinutes: 15
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /requires a warning/);
  assert.match(result.errors.join(" "), /Brief is stale/);
});

test("keeps Investment Committee work out of the main brief", () => {
  const brief = buildBrief();
  brief.sections.topActions.items = [buildItem({
    headline: "Prepare Investment Committee materials",
    explanation: "The IC package is due tomorrow."
  })];
  const result = validateBlackhawkLiveBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /must stay outside the main brief/);
});

test("blocks items placed in the wrong section", () => {
  const brief = buildBrief();
  brief.sections.waitingOn.items = [buildItem({ id: "waiting-1", canonicalIssueKey: "vendor-response" })];
  brief.sections.topActions.items = [];
  const result = validateBlackhawkLiveBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /appears in Waiting On/);
});
