import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMeetingCandidateRegistryEntries,
  buildMeetingExecutiveItemCandidates
} from "../lib/meeting-executive-item-candidates";
import type { MeetingRecord } from "../lib/meetings/meeting-records";
import {
  registerExecutiveItemCandidates
} from "../lib/executive-item-candidate-registry";
import {
  createExecutiveItemCandidate,
  type ExecutiveItemCandidate
} from "../lib/executive-item-nomination";
import { selectTodayExecutiveItemCandidates } from "../lib/today-executive-item-candidates";

const NOW = new Date("2026-07-02T16:00:00.000Z");

function buildMeetingRecord(overrides: Partial<MeetingRecord> = {}): MeetingRecord {
  return {
    id: "meeting-1",
    userId: "user-1",
    calendarEventId: "event-1",
    calendarSourceSystemId: "outlook",
    title: "Routine internal sync",
    startAt: "2026-07-02T20:00:00.000Z",
    endAt: "2026-07-02T21:00:00.000Z",
    timezone: "America/Los_Angeles",
    organizerName: "Alex Partner",
    organizerEmail: "alex@example.com",
    attendees: [],
    internalExternalClassification: "internal",
    relatedCompanyNames: [],
    relatedPeopleNames: [],
    priority: "normal",
    priorityReasons: [],
    researchStatus: "not_researched",
    researchRequestedAt: null,
    researchCompletedAt: null,
    researchSummary: null,
    sourceRefs: [],
    transcriptStatus: "none",
    transcriptRefs: [],
    postMeetingStatus: "not_started",
    postMeetingSummary: null,
    taskCandidates: [],
    linkedTaskIds: [],
    obsidianExportStatus: "not_exported",
    obsidianExportedAt: null,
    obsidianEmailTo: "wodonnell@taskrobin.io",
    createdAt: "2026-07-02T15:00:00.000Z",
    updatedAt: "2026-07-02T15:00:00.000Z",
    ...overrides
  };
}

function buildIcCandidate(overrides: Partial<ExecutiveItemCandidate> = {}): ExecutiveItemCandidate {
  return createExecutiveItemCandidate({
    id: "ic-candidate",
    title: "Investment Committee questions due",
    summary: "Will questions are due.",
    recommendedAction: "Open Investment Committee and send Will's questions.",
    sourceWorkflow: "investment_committee",
    sourceEntityType: "cycle",
    sourceEntityId: "2026-07-01",
    href: "/investment-committee",
    dueAt: "2026-07-02T18:00:00.000Z",
    priority: "medium",
    attentionReasons: ["deadline_approaching", "will_questions_not_sent"],
    evidence: [{ label: "Week of", value: "2026-07-01" }],
    generatedAt: "2026-07-02T16:00:00.000Z",
    ...overrides
  });
}

test("normal meeting produces zero eligible candidates", () => {
  assert.deepEqual(buildMeetingCandidateRegistryEntries([buildMeetingRecord()], NOW), []);
});

test("canceled logistics and focus meetings produce zero candidates", () => {
  const records = [
    buildMeetingRecord({ id: "focus", title: "Focus hold", priorityReasons: ["prep block"] }),
    buildMeetingRecord({ id: "travel", title: "Travel to SFO", priority: "high", priorityReasons: ["logistics"] }),
    buildMeetingRecord({ id: "canceled", title: "Canceled: Board prep", priority: "high", priorityReasons: ["board prep"] })
  ];

  assert.deepEqual(buildMeetingExecutiveItemCandidates(records, NOW), []);
});

test("high-value prep-sensitive meeting produces eligible candidate with recommended action", () => {
  const entries = buildMeetingCandidateRegistryEntries([
    buildMeetingRecord({
      id: "board-prep",
      title: "Board approval prep",
      priority: "high",
      priorityReasons: ["board approval", "prepare decision path"],
      relatedPeopleNames: ["Board"],
      sourceRefs: [{ title: "Board packet", url: "https://example.com/packet" }]
    })
  ], NOW);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.sourceType, "meeting");
  assert.equal(entries[0]?.eligibleForToday, true);
  assert.match(entries[0]?.candidate.recommendedAction ?? "", /Review the meeting research|Review the relationship context/);
  assert.deepEqual(
    entries[0]?.candidate.attentionReasons.includes("meeting_prep_required"),
    true
  );
  assert.equal(entries[0]?.candidate.evidence.some((evidence) => evidence.href === "https://example.com/packet"), true);
});

test("meeting with saved research summary or prep material produces eligible candidate", () => {
  const entries = buildMeetingCandidateRegistryEntries([
    buildMeetingRecord({
      id: "customer-research",
      title: "Customer expansion review",
      priorityReasons: ["key customer"],
      relatedCompanyNames: ["CustomerCo"],
      researchStatus: "researched",
      researchSummary: {
        meetingRecordId: "customer-research",
        generatedAt: "2026-07-02T15:30:00.000Z",
        highLevelContext: "Expansion decision needs Will's position before the customer call.",
        keyPriorities: [{ title: "Confirm expansion stance", reason: "Customer expects direction.", sourceRefs: [] }],
        suggestedQuestions: [],
        recentRelevantActivity: [],
        relevantLinks: [],
        taskCandidates: []
      }
    })
  ], NOW);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.candidate.summary, "Expansion decision needs Will's position before the customer call.");
  assert.equal(entries[0]?.candidate.attentionReasons.includes("material_new_information"), true);
  assert.match(entries[0]?.candidate.recommendedAction ?? "", /Review the meeting research/);
});

test("meeting candidate flows into Today selector with IC candidates", () => {
  const icEntries = registerExecutiveItemCandidates({
    candidates: [buildIcCandidate()],
    sourceType: "investment_committee",
    sourceId: "2026-07-01",
    sourceLabel: "Investment Committee",
    now: NOW
  });
  const meetingEntries = buildMeetingCandidateRegistryEntries([
    buildMeetingRecord({
      id: "elt-prep",
      title: "ELT strategy prep",
      priority: "critical",
      priorityReasons: ["ELT decision prep", "capacity risk"]
    })
  ], NOW);

  const selected = selectTodayExecutiveItemCandidates([...icEntries, ...meetingEntries]);

  assert.equal(selected.some((entry) => entry.sourceType === "investment_committee"), true);
  assert.equal(selected.some((entry) => entry.sourceType === "meeting"), true);
});

test("Today selector sorts and caps mixed IC and meeting candidates deterministically", () => {
  const icEntries = registerExecutiveItemCandidates({
    candidates: Array.from({ length: 8 }, (_, index) =>
      buildIcCandidate({
        id: `ic-${index}`,
        priority: "medium",
        dueAt: `2026-07-02T${String(18 + index).padStart(2, "0")}:00:00.000Z`
      })
    ),
    sourceType: "investment_committee",
    sourceId: "2026-07-01",
    sourceLabel: "Investment Committee",
    now: NOW
  });
  const meetingEntries = buildMeetingCandidateRegistryEntries([
    buildMeetingRecord({
      id: "critical-meeting",
      title: "Board decision prep",
      priority: "critical",
      priorityReasons: ["board decision prep", "capacity risk"],
      startAt: "2026-07-02T17:00:00.000Z"
    }),
    buildMeetingRecord({
      id: "normal-meeting",
      title: "Routine sync"
    })
  ], NOW);

  const selected = selectTodayExecutiveItemCandidates([...icEntries, ...meetingEntries]);

  assert.equal(selected.length, 7);
  assert.equal(selected[0]?.candidate.id, "meeting:critical-meeting");
  assert.equal(selected.some((entry) => entry.candidate.id === "meeting:normal-meeting"), false);
});
