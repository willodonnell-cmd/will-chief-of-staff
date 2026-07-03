import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExecutiveItemCandidateAuditViewModel
} from "../lib/executive-item-candidate-audit";
import {
  buildCandidateInteractionKey,
  type ExecutiveItemCandidateInteraction
} from "../lib/executive-item-candidate-interactions";
import {
  registerExecutiveItemCandidates,
  type ExecutiveItemRegistryEntry,
  type ExecutiveItemSourceType
} from "../lib/executive-item-candidate-registry";
import {
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

function buildEntry(
  candidate: ExecutiveItemCandidate,
  sourceType: ExecutiveItemSourceType = "investment_committee",
  sourceId = "source-1"
) {
  return registerExecutiveItemCandidates({
    candidates: [candidate],
    sourceType,
    sourceId,
    sourceLabel: sourceType === "meeting" ? "Meeting" : "Investment Committee",
    generatedAt: "2026-07-01T12:00:00.000Z",
    now: new Date("2026-07-01T12:00:00.000Z")
  })[0] as ExecutiveItemRegistryEntry;
}

function buildInteraction(
  entry: ExecutiveItemRegistryEntry,
  overrides: Partial<ExecutiveItemCandidateInteraction> = {}
): ExecutiveItemCandidateInteraction {
  return {
    id: "interaction-1",
    userId: "user-1",
    candidateId: entry.candidate.id,
    interactionKey: buildCandidateInteractionKey(entry),
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    action: "dismissed",
    snoozedUntil: null,
    reason: null,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    ...overrides
  };
}

test("audit summarizes zero candidates", () => {
  const audit = buildExecutiveItemCandidateAuditViewModel([], []);

  assert.equal(audit.summary.total, 0);
  assert.equal(audit.summary.eligible, 0);
  assert.equal(audit.summary.suppressedByInteraction, 0);
  assert.equal(audit.summary.bySourceType.investment_committee, 0);
  assert.equal(audit.summary.byAction.dismissed, 0);
});

test("audit counts candidates by source", () => {
  const icEntry = buildEntry(buildCandidate({ id: "ic-candidate" }), "investment_committee", "ic-1");
  const meetingEntry = buildEntry(buildCandidate({ id: "meeting-candidate" }), "meeting", "meeting-1");
  const audit = buildExecutiveItemCandidateAuditViewModel([icEntry, meetingEntry], []);

  assert.equal(audit.summary.bySourceType.investment_committee, 1);
  assert.equal(audit.summary.bySourceType.meeting, 1);
});

test("audit counts eligible vs ineligible candidates", () => {
  const eligible = buildEntry(buildCandidate({ id: "eligible" }));
  const ineligible = buildEntry(
    suppressExecutiveItemCandidate(buildCandidate({ id: "ineligible" }), "normal_ic_process")
  );
  const audit = buildExecutiveItemCandidateAuditViewModel([eligible, ineligible], []);

  assert.equal(audit.summary.eligible, 1);
  assert.equal(audit.summary.ineligible, 1);
});

test("audit marks dismissed candidate as suppressed by interaction", () => {
  const entry = buildEntry(buildCandidate());
  const audit = buildExecutiveItemCandidateAuditViewModel([entry], [buildInteraction(entry)]);

  assert.equal(audit.entries[0]?.suppressedByInteraction, true);
  assert.equal(audit.entries[0]?.interactionAction, "dismissed");
  assert.equal(audit.summary.suppressedByInteraction, 1);
  assert.equal(audit.summary.byAction.dismissed, 1);
});

test("audit marks active snooze as suppressed", () => {
  const entry = buildEntry(buildCandidate());
  const audit = buildExecutiveItemCandidateAuditViewModel(
    [entry],
    [buildInteraction(entry, { action: "snoozed", snoozedUntil: "2026-07-02T12:00:00.000Z" })],
    new Date("2026-07-01T12:00:00.000Z")
  );

  assert.equal(audit.entries[0]?.suppressedByInteraction, true);
  assert.equal(audit.entries[0]?.interactionAction, "snoozed");
  assert.equal(audit.summary.byAction.snoozed, 1);
});

test("audit does not suppress expired snooze", () => {
  const entry = buildEntry(buildCandidate());
  const audit = buildExecutiveItemCandidateAuditViewModel(
    [entry],
    [buildInteraction(entry, { action: "snoozed", snoozedUntil: "2026-07-01T08:00:00.000Z" })],
    new Date("2026-07-01T12:00:00.000Z")
  );

  assert.equal(audit.entries[0]?.suppressedByInteraction, false);
  assert.equal(audit.entries[0]?.interactionAction, "snoozed");
  assert.equal(audit.summary.suppressedByInteraction, 0);
});

test("audit marks reviewed candidate as suppressed", () => {
  const entry = buildEntry(buildCandidate());
  const audit = buildExecutiveItemCandidateAuditViewModel([entry], [buildInteraction(entry, { action: "reviewed" })]);

  assert.equal(audit.entries[0]?.suppressedByInteraction, true);
  assert.equal(audit.summary.byAction.reviewed, 1);
});

test("audit preserves interaction key and source metadata", () => {
  const entry = buildEntry(buildCandidate({ id: "source-check" }), "meeting", "meeting-123");
  const audit = buildExecutiveItemCandidateAuditViewModel([entry], []);

  assert.equal(audit.entries[0]?.interactionKey, buildCandidateInteractionKey(entry));
  assert.equal(audit.entries[0]?.sourceType, "meeting");
  assert.equal(audit.entries[0]?.sourceId, "meeting-123");
  assert.equal(audit.entries[0]?.sourceLabel, "Meeting");
});
