import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCandidateInteractions,
  buildCandidateInteractionKey,
  isCandidateSnoozed,
  validateCandidateInteractionActionInput,
  type ExecutiveItemCandidateInteraction
} from "../lib/executive-item-candidate-interactions";
import { registerExecutiveItemCandidates, type ExecutiveItemRegistryEntry } from "../lib/executive-item-candidate-registry";
import type { ExecutiveItemCandidate } from "../lib/executive-item-nomination";

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

function buildEntry(overrides: Partial<ExecutiveItemCandidate> = {}, sourceType: "investment_committee" | "meeting" = "investment_committee") {
  return registerExecutiveItemCandidates({
    candidates: [buildCandidate(overrides)],
    sourceType,
    sourceId: sourceType === "meeting" ? "meeting-1" : "ic-1",
    sourceLabel: sourceType === "meeting" ? "Meeting" : "Investment Committee",
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

test("interaction key is stable across equivalent candidate objects", () => {
  const first = buildEntry({ attentionReasons: ["deadline_approaching", "will_action_required"] });
  const second = buildEntry({ attentionReasons: ["will_action_required", "deadline_approaching"] });

  assert.equal(buildCandidateInteractionKey(first), buildCandidateInteractionKey(second));
});

test("dismissed candidate is suppressed", () => {
  const entry = buildEntry();

  assert.deepEqual(applyCandidateInteractions([entry], [buildInteraction(entry)]), []);
});

test("snoozed candidate is suppressed before snoozedUntil", () => {
  const entry = buildEntry();
  const interaction = buildInteraction(entry, {
    action: "snoozed",
    snoozedUntil: "2026-07-02T12:00:00.000Z"
  });

  assert.equal(isCandidateSnoozed(interaction, new Date("2026-07-01T12:00:00.000Z")), true);
  assert.deepEqual(applyCandidateInteractions([entry], [interaction], new Date("2026-07-01T12:00:00.000Z")), []);
});

test("expired snooze no longer suppresses", () => {
  const entry = buildEntry();
  const interaction = buildInteraction(entry, {
    action: "snoozed",
    snoozedUntil: "2026-07-01T08:00:00.000Z"
  });

  assert.deepEqual(applyCandidateInteractions([entry], [interaction], new Date("2026-07-01T12:00:00.000Z")), [entry]);
});

test("reviewed candidate is suppressed for the same interaction key", () => {
  const entry = buildEntry();

  assert.deepEqual(applyCandidateInteractions([entry], [buildInteraction(entry, { action: "reviewed" })]), []);
});

test("unrelated candidate is not suppressed", () => {
  const entry = buildEntry({ id: "candidate-1" });
  const unrelated = buildEntry({ id: "candidate-2" });

  assert.deepEqual(applyCandidateInteractions([unrelated], [buildInteraction(entry)]), [unrelated]);
});

test("Today candidate interaction filtering works across mixed IC and meeting candidates without source mutation", () => {
  const icEntry = buildEntry({ id: "ic-candidate" }, "investment_committee");
  const meetingEntry = buildEntry({ id: "meeting-candidate" }, "meeting");
  const originalMeetingCandidate = { ...meetingEntry.candidate };

  assert.deepEqual(applyCandidateInteractions([icEntry, meetingEntry], [buildInteraction(icEntry)]), [meetingEntry]);
  assert.deepEqual(meetingEntry.candidate, originalMeetingCandidate);
});

test("action validation rejects invalid action", () => {
  const result = validateCandidateInteractionActionInput({
    userId: "user-1",
    candidateId: "candidate-1",
    interactionKey: "key-1",
    sourceType: "meeting",
    sourceId: "meeting-1",
    action: "bogus" as "dismissed",
    snoozedUntil: null
  });

  assert.deepEqual(result, { ok: false, error: "invalid-action" });
});

test("snooze validation requires future snoozedUntil", () => {
  const result = validateCandidateInteractionActionInput(
    {
      userId: "user-1",
      candidateId: "candidate-1",
      interactionKey: "key-1",
      sourceType: "meeting",
      sourceId: "meeting-1",
      action: "snoozed",
      snoozedUntil: "2026-07-01T08:00:00.000Z"
    },
    new Date("2026-07-01T12:00:00.000Z")
  );

  assert.deepEqual(result, { ok: false, error: "invalid-snooze" });
});
