import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvestmentCommitteeBoard,
  buildInvestmentCommitteeCandidateRegistryEntries
} from "../lib/investment-committee";
import type { InvestmentCommitteeAgentEnvelope } from "../lib/investment-committee-agent";
import {
  registerExecutiveItemCandidates
} from "../lib/executive-item-candidate-registry";
import {
  createExecutiveItemCandidate,
  suppressExecutiveItemCandidate,
  type ExecutiveItemCandidate
} from "../lib/executive-item-nomination";
import {
  selectTodayExecutiveItemCandidates,
  TODAY_EXECUTIVE_ITEM_CANDIDATE_MAX_LIMIT
} from "../lib/today-executive-item-candidates";

function buildAgentEnvelope(overrides: Partial<InvestmentCommitteeAgentEnvelope> = {}): InvestmentCommitteeAgentEnvelope {
  return {
    producer: "chatgpt_agent",
    workflow: "investment_committee_weekly_cycle",
    producedAt: "2026-06-01T15:00:00Z",
    tenantLabel: "Prologis",
    cycle: {
      weekOf: "2026-06-01",
      meetingDate: "2026-06-08T08:30:00-07:00",
      packageEmailSubject: "IC Memos for Monday, June 8",
      packageEmailUrl: "https://outlook.example/package",
      boxFolderUrl: "https://box.example/folder",
      questionsDueAt: "2026-06-05T17:00:00-07:00",
      resetAt: null
    },
    deals: [
      {
        id: "routine-deal",
        title: "Routine Deal",
        memoUrl: "https://box.example/routine",
        peerQuestionSummary: null,
        answerSummary: null,
        threads: [
          {
            id: "thread-package",
            subject: "IC Memos for Monday, June 8",
            sender: "Pi, Susan",
            kind: "package",
            occurredAt: "2026-06-02T23:30:15Z",
            sourceUrl: "https://outlook.example/package",
            summary: "Susan package.",
            mentionsWill: false
          }
        ]
      }
    ],
    ...overrides
  };
}

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

test("Today candidate data returns zero items when IC has no eligible candidates", () => {
  const board = buildInvestmentCommitteeBoard(
    buildAgentEnvelope({
      cycle: {
        ...buildAgentEnvelope().cycle,
        questionsDueAt: "2099-06-05T17:00:00-07:00"
      }
    }),
    [],
    "local"
  );

  assert.deepEqual(selectTodayExecutiveItemCandidates(buildInvestmentCommitteeCandidateRegistryEntries(board)), []);
});

test("Today candidate data returns IC deadline candidate when questions are due and Will questions are unsent", () => {
  const board = buildInvestmentCommitteeBoard(
    buildAgentEnvelope({
      cycle: {
        ...buildAgentEnvelope().cycle,
        weekOf: "2020-06-01",
        questionsDueAt: "2020-06-05T17:00:00-07:00"
      }
    }),
    [],
    "local"
  );

  const candidates = selectTodayExecutiveItemCandidates(buildInvestmentCommitteeCandidateRegistryEntries(board));

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.candidate.sourceWorkflow, "investment_committee");
  assert.equal(candidates[0]?.candidate.sourceEntityType, "cycle");
  assert.deepEqual(candidates[0]?.candidate.attentionReasons, ["deadline_approaching", "will_questions_not_sent"]);
});

test("Today candidate data excludes suppressed approval candidates", () => {
  const entries = registerExecutiveItemCandidates({
    candidates: [
      buildCandidate({ id: "eligible" }),
      suppressExecutiveItemCandidate(buildCandidate({ id: "suppressed-approval" }), "routine_ic_approval")
    ],
    sourceType: "investment_committee",
    sourceId: "2026-07-01",
    sourceLabel: "Investment Committee",
    now: new Date("2026-07-01T12:00:00.000Z")
  });

  assert.deepEqual(
    selectTodayExecutiveItemCandidates(entries).map((entry) => entry.candidate.id),
    ["eligible"]
  );
});

test("Today candidate sorting is deterministic", () => {
  const entries = registerExecutiveItemCandidates({
    candidates: [
      buildCandidate({ id: "z-low", priority: "low" }),
      buildCandidate({ id: "a-high", priority: "high" }),
      buildCandidate({ id: "m-medium", priority: "medium", dueAt: "2026-06-30T12:00:00.000Z" })
    ],
    sourceType: "manual",
    sourceId: "manual",
    sourceLabel: "Manual",
    now: new Date("2026-07-01T12:00:00.000Z")
  });

  assert.deepEqual(
    selectTodayExecutiveItemCandidates(entries).map((entry) => entry.candidate.id),
    ["a-high", "m-medium", "z-low"]
  );
});

test("Today candidate limit is enforced", () => {
  const entries = registerExecutiveItemCandidates({
    candidates: Array.from({ length: 12 }, (_, index) =>
      createExecutiveItemCandidate(buildCandidate({ id: `candidate-${String(index).padStart(2, "0")}` }))
    ),
    sourceType: "manual",
    sourceId: "manual",
    sourceLabel: "Manual",
    now: new Date("2026-07-01T12:00:00.000Z")
  });

  assert.equal(selectTodayExecutiveItemCandidates(entries).length, 7);
  assert.equal(selectTodayExecutiveItemCandidates(entries, 99).length, TODAY_EXECUTIVE_ITEM_CANDIDATE_MAX_LIMIT);
});
