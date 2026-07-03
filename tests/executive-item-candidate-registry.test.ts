import assert from "node:assert/strict";
import test from "node:test";

import {
  filterEligibleTodayCandidates,
  registerExecutiveItemCandidates,
  sortExecutiveItemCandidates,
  summarizeExecutiveItemCandidates
} from "../lib/executive-item-candidate-registry";
import {
  createExecutiveItemCandidate,
  suppressExecutiveItemCandidate,
  type ExecutiveItemCandidate
} from "../lib/executive-item-nomination";

function buildCandidate(overrides: Partial<ExecutiveItemCandidate> = {}): ExecutiveItemCandidate {
  return {
    id: "candidate-1",
    title: "Candidate one",
    summary: "A candidate that requires Will attention.",
    recommendedAction: "Review the source item and decide the next move.",
    sourceWorkflow: "test_workflow",
    sourceEntityType: "test_entity",
    sourceEntityId: "entity-1",
    href: "/test",
    dueAt: null,
    priority: "medium",
    attentionReasons: ["will_action_required"],
    suppressionReasons: [],
    evidence: [{ label: "Source", value: "Fixture" }],
    generatedAt: "2026-07-01T12:00:00.000Z",
    ...overrides
  };
}

test("registers zero candidates cleanly", () => {
  const entries = registerExecutiveItemCandidates({
    candidates: [],
    sourceType: "manual",
    sourceId: "manual",
    sourceLabel: "Manual"
  });

  assert.deepEqual(entries, []);
  assert.deepEqual(summarizeExecutiveItemCandidates(entries), {
    total: 0,
    eligible: 0,
    ineligible: 0,
    bySourceType: {
      investment_committee: 0,
      executive_brief: 0,
      meeting: 0,
      topic: 0,
      manual: 0,
      task: 0,
      unknown: 0
    },
    byEligibility: {
      eligible: 0,
      ineligible: 0
    }
  });
});

test("filters eligible Today candidates and excludes suppressed candidates", () => {
  const suppressed = suppressExecutiveItemCandidate(buildCandidate({ id: "suppressed" }), "normal_ic_process");
  const entries = registerExecutiveItemCandidates({
    candidates: [buildCandidate({ id: "eligible" }), suppressed],
    sourceType: "investment_committee",
    sourceId: "2026-07-01",
    sourceLabel: "Investment Committee",
    now: new Date("2026-07-01T12:00:00.000Z")
  });

  assert.deepEqual(
    filterEligibleTodayCandidates(entries).map((entry) => entry.candidate.id),
    ["eligible"]
  );
  assert.equal(entries.find((entry) => entry.candidate.id === "suppressed")?.eligibleForToday, false);
});

test("sorts urgent and high-priority candidates ahead of lower priority candidates", () => {
  const entries = registerExecutiveItemCandidates({
    candidates: [
      buildCandidate({ id: "low", priority: "low", dueAt: null }),
      buildCandidate({ id: "high", priority: "high", dueAt: "2026-07-02T12:00:00.000Z" }),
      buildCandidate({ id: "medium-overdue", priority: "medium", dueAt: "2026-06-30T12:00:00.000Z" })
    ],
    sourceType: "manual",
    sourceId: "manual",
    sourceLabel: "Manual",
    now: new Date("2026-07-01T12:00:00.000Z")
  });

  assert.deepEqual(
    sortExecutiveItemCandidates(entries).map((entry) => entry.candidate.id),
    ["high", "medium-overdue", "low"]
  );
});

test("preserves source metadata on registry entries", () => {
  const entries = registerExecutiveItemCandidates({
    candidates: [createExecutiveItemCandidate(buildCandidate({ id: "source-check" }))],
    sourceType: "task",
    sourceId: "task-1",
    sourceLabel: "Task source",
    generatedAt: "2026-07-01T13:00:00.000Z",
    freshness: "carry_forward"
  });

  assert.equal(entries[0]?.sourceType, "task");
  assert.equal(entries[0]?.sourceId, "task-1");
  assert.equal(entries[0]?.sourceLabel, "Task source");
  assert.equal(entries[0]?.generatedAt, "2026-07-01T13:00:00.000Z");
  assert.equal(entries[0]?.freshness, "carry_forward");
});

test("summarizes candidate counts by source and eligibility", () => {
  const entries = registerExecutiveItemCandidates({
    candidates: [
      buildCandidate({ id: "eligible" }),
      suppressExecutiveItemCandidate(buildCandidate({ id: "suppressed" }), "already_resolved")
    ],
    sourceType: "meeting",
    sourceId: "meeting-1",
    sourceLabel: "Meeting"
  });
  const summary = summarizeExecutiveItemCandidates(entries);

  assert.equal(summary.total, 2);
  assert.equal(summary.eligible, 1);
  assert.equal(summary.ineligible, 1);
  assert.equal(summary.bySourceType.meeting, 2);
  assert.deepEqual(summary.byEligibility, { eligible: 1, ineligible: 1 });
});
