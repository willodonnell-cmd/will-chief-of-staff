import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  buildInvestmentCommitteeBoard,
  buildInvestmentCommitteeBoardFromSignals,
  calculateInvestmentCommitteeCounts,
  calculateInvestmentCommitteeSteps,
  deriveInvestmentCommitteeDetectedDeals,
  deriveInvestmentCommitteeDraftSeed,
  listVisibleInvestmentCommitteeDeals,
  selectCurrentInvestmentCommitteeCycle,
  shouldClearInvestmentCommitteeBoard,
  shouldHideInvestmentCommitteeBoard,
  type InvestmentCommitteeCycleRecord,
  type InvestmentCommitteeDealRecord
} from "../lib/investment-committee";
import type { ChiefOfStaffSignal } from "../lib/chief-of-staff-signal";
import {
  LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH,
  loadInvestmentCommitteeAgentEnvelopeWithSource,
  type InvestmentCommitteeAgentEnvelope
} from "../lib/investment-committee-agent";

function buildCycle(overrides: Partial<InvestmentCommitteeCycleRecord> = {}): InvestmentCommitteeCycleRecord {
  return {
    id: "cycle-1",
    user_id: "user-1",
    week_of: "2026-06-01",
    box_link: "https://box.example/package",
    memo_due_at: "2026-06-03T19:00:00.000Z",
    questions_due_at: "2026-06-05T22:00:00.000Z",
    status: "active",
    notes: null,
    created_at: "2026-06-01T08:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides
  };
}

function buildDeal(overrides: Partial<InvestmentCommitteeDealRecord> = {}): InvestmentCommitteeDealRecord {
  return {
    id: "deal-1",
    user_id: "user-1",
    cycle_id: "cycle-1",
    title: "Deal one",
    memo_link: "https://box.example/deal-one",
    sponsor: "Team One",
    status: "not_started",
    question_notes: null,
    peer_question_notes: null,
    sort_order: 0,
    created_at: "2026-06-01T08:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides
  };
}

function buildSignal(overrides: Partial<ChiefOfStaffSignal> = {}): ChiefOfStaffSignal {
  return {
    id: "signal-1",
    source: "outlook",
    signalType: "follow_up",
    attention: "medium",
    title: "Susan Pi sent weekly IC package",
    summary: "Weekly IC package is ready for review and the Box package is attached in the source email.",
    owner: "Susan Pi",
    sourceLabel: "Outlook",
    occurredAt: "2026-06-01T08:00:00.000Z",
    dueAt: "2026-06-05T22:00:00.000Z",
    sourceUrl: "https://outlook.example/ic-package",
    category: "IC",
    actionRequest: "Review the memos and prepare Will's Friday questions.",
    participants: ["Susan Pi", "ICMembersAll", "Will O'Donnell"],
    protectedContext: true,
    ...overrides
  };
}

function buildAgentEnvelope(overrides: Partial<InvestmentCommitteeAgentEnvelope> = {}): InvestmentCommitteeAgentEnvelope {
  return {
    producer: "chatgpt_agent",
    workflow: "investment_committee_weekly_cycle",
    producedAt: "2026-06-01T15:00:00Z",
    tenantLabel: "Prologis",
    cycle: {
      weekOf: "2026-06-01",
      meetingDate: "2026-06-01T08:30:00-07:00",
      packageEmailSubject: "IC Memos for Monday, June 1",
      packageEmailUrl: "https://outlook.example/package",
      boxFolderUrl: "https://box.example/folder",
      questionsDueAt: "2026-06-05T17:00:00-07:00",
      resetAt: "2026-06-02T23:59:59-07:00"
    },
    deals: [
      {
        id: "600-grumman-project-island",
        title: "600 Grumman Project Island - Procurement of Early Works Construction Package",
        memoUrl: null,
        peerQuestionSummary: "Peer questions for Grumman.",
        answerSummary: "Weekend answers for Grumman.",
        threads: [
          {
            id: "thread-package",
            subject: "IC Memos for Monday, June 1",
            sender: "Pi, Susan",
            kind: "package",
            occurredAt: "2026-05-27T23:30:15Z",
            sourceUrl: "https://outlook.example/package",
            summary: "Susan package.",
            mentionsWill: false
          },
          {
            id: "thread-question",
            subject: "Re: 600 Grumman - Project Island - IICM",
            sender: "Freedman, Bruce",
            kind: "question",
            occurredAt: "2026-05-29T18:40:41Z",
            sourceUrl: "https://outlook.example/question",
            summary: "Bruce question.",
            mentionsWill: false
          },
          {
            id: "thread-answer",
            subject: "Q&A Summary - 600 Grumman",
            sender: "Gavello, Garrett",
            kind: "answer",
            occurredAt: "2026-06-01T01:21:48Z",
            sourceUrl: "https://outlook.example/answer",
            summary: "Weekend Q&A packet.",
            mentionsWill: true
          }
        ]
      }
    ],
    ...overrides
  };
}

async function removeLocalInvestmentCommitteePayload() {
  await rm(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH, { force: true });
}

async function snapshotLocalInvestmentCommitteePayload() {
  try {
    return await readFile(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH, "utf8");
  } catch {
    return null;
  }
}

async function restoreLocalInvestmentCommitteePayload(contents: string | null) {
  if (contents === null) {
    await removeLocalInvestmentCommitteePayload();
    return;
  }

  await mkdir(dirname(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH), { recursive: true });
  await writeFile(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH, contents, "utf8");
}

test("selects the latest active cycle before more recent completed cycles", () => {
  const selected = selectCurrentInvestmentCommitteeCycle([
    buildCycle({
      id: "cycle-completed",
      week_of: "2026-06-08",
      status: "completed"
    }),
    buildCycle({
      id: "cycle-active",
      week_of: "2026-06-01",
      status: "active"
    })
  ]);

  assert.equal(selected?.id, "cycle-active");
});

test("falls back to the latest visible cycle when no active cycle exists", () => {
  const selected = selectCurrentInvestmentCommitteeCycle([
    buildCycle({
      id: "cycle-archived",
      week_of: "2026-06-08",
      status: "archived",
      archived_at: "2026-06-10T10:00:00.000Z"
    }),
    buildCycle({
      id: "cycle-completed",
      week_of: "2026-06-01",
      status: "completed"
    })
  ]);

  assert.equal(selected?.id, "cycle-completed");
});

test("excludes archived and deleted deals from visible counts", () => {
  const visibleDeals = listVisibleInvestmentCommitteeDeals([
    buildDeal({ id: "deal-visible", sort_order: 1 }),
    buildDeal({ id: "deal-archived", sort_order: 0, archived_at: "2026-06-02T10:00:00.000Z" }),
    buildDeal({ id: "deal-deleted", sort_order: 2, deleted_at: "2026-06-02T11:00:00.000Z" })
  ]);

  assert.deepEqual(
    visibleDeals.map((deal) => deal.id),
    ["deal-visible"]
  );
});

test("calculates review and question counts from deal statuses", () => {
  const counts = calculateInvestmentCommitteeCounts(buildCycle(), [
    buildDeal({ id: "deal-1", status: "reviewed" }),
    buildDeal({ id: "deal-2", status: "questions_drafted" }),
    buildDeal({ id: "deal-3", status: "questions_sent" }),
    buildDeal({ id: "deal-4", status: "reviewing" })
  ]);

  assert.deepEqual(counts, {
    totalDeals: 4,
    reviewedDeals: 3,
    draftedQuestionSets: 2,
    sentQuestionSets: 1,
    packageLinked: true
  });
});

test("marks the workflow done when the cycle is fully progressed", () => {
  const steps = calculateInvestmentCommitteeSteps(buildCycle(), [
    buildDeal({ id: "deal-1", status: "questions_sent" }),
    buildDeal({ id: "deal-2", status: "questions_sent" })
  ]);

  assert.deepEqual(
    steps.map((step) => step.state),
    ["done", "done"]
  );
});

test("flags questions as needs attention when the deadline has passed", () => {
  const overdueCycle = buildCycle({
    questions_due_at: "2020-06-05T22:00:00.000Z"
  });
  const steps = calculateInvestmentCommitteeSteps(overdueCycle, [
    buildDeal({ id: "deal-1", status: "reviewing" }),
    buildDeal({ id: "deal-2", status: "not_started" })
  ]);

  assert.equal(steps.find((step) => step.key === "package_and_deals")?.state, "done");
  assert.equal(steps.find((step) => step.key === "questions")?.state, "needs_attention");
});

test("uses detected package traffic and detected deals when no cycle has been saved yet", () => {
  const steps = calculateInvestmentCommitteeSteps(null, [], {
    detectedDealCount: 3,
    hasPackageSignal: true
  });

  assert.deepEqual(
    steps.map((step) => [step.key, step.state, step.detail]),
    [
      ["package_and_deals", "in_progress", "3 deals detected from this week's IC traffic."],
      ["questions", "waiting", "0 drafted, 0 sent, 3 total deals."]
    ]
  );
});

test("derives a draft current-week cycle seed from routed IC package traffic", () => {
  const seed = deriveInvestmentCommitteeDraftSeed(
    [
      buildSignal(),
      buildSignal({
        id: "signal-2",
        title: "General IC question thread",
        summary: "A general committee question thread is running.",
        owner: "Deal team",
        sourceUrl: "https://outlook.example/ic-thread"
      })
    ],
    new Date("2026-06-01T12:00:00.000Z")
  );

  assert.equal(seed?.weekOf, "2026-06-01");
  assert.equal(seed?.sourceTitle, "Susan Pi sent weekly IC package");
  assert.equal(seed?.sourceHref, "https://outlook.example/ic-package");
});

test("does not derive a draft seed when no IC signal is present", () => {
  const seed = deriveInvestmentCommitteeDraftSeed([
    buildSignal({
      id: "signal-2",
      category: null,
      title: "Ordinary operating update",
      summary: "No investment committee package is involved here."
    })
  ]);

  assert.equal(seed, null);
});

test("derives detected deals and groups related IC question traffic by deal", () => {
  const detectedDeals = deriveInvestmentCommitteeDetectedDeals([
    buildSignal({
      id: "package",
      sourceLabel: "IC Memos for Monday, June 1"
    }),
    buildSignal({
      id: "grumman-thread",
      title: "Project Island IICM thread active",
      sourceLabel: "RE: 600 Grumman - Project Island - IICM",
      summary: "Thread active with committee participants."
    }),
    buildSignal({
      id: "grumman-qa",
      title: "600 Grumman committee Q&A compiled",
      sourceLabel: "Q&A Summary - 600 Grumman",
      summary: "Committee questions and responses were compiled."
    }),
    buildSignal({
      id: "brownsburg-qa",
      title: "Brownsburg committee questions summarized",
      sourceLabel: "Q&A Summary - Brownsburg Land Acquisition + Horizontal Development",
      summary: "Peer committee questions were summarized."
    })
  ]);

  assert.equal(detectedDeals.length, 2);
  assert.equal(detectedDeals[0]?.title, "600 Grumman - Project Island");
  assert.equal(detectedDeals[0]?.trafficCount, 2);
  assert.equal(detectedDeals[0]?.peerQuestionCount, 1);
  assert.equal(detectedDeals[1]?.title, "Brownsburg Land Acquisition + Horizontal Development");
  assert.equal(detectedDeals[1]?.peerQuestionCount, 1);
});

test("ignores approved subject lines when deriving IC deal cards", () => {
  const detectedDeals = deriveInvestmentCommitteeDetectedDeals([
    buildSignal({
      id: "approved-hayward",
      title: "Approved: Hayward 39/43 - Funding Memo",
      sourceReference: "Approved: Hayward 39/43 - Funding Memo",
      sourceLabel: "Susan Pi"
    }),
    buildSignal({
      id: "active-aurora",
      title: "Aurora battery storage memo circulated for Energy IC",
      sourceLabel: "Aurora Battery Storage - Energy IC memo"
    })
  ]);

  assert.equal(detectedDeals.length, 1);
  assert.equal(detectedDeals[0]?.title, "Aurora Battery Storage");
});

test("builds the weekly board directly from the dedicated agent payload", () => {
  const board = buildInvestmentCommitteeBoard(buildAgentEnvelope(), [], "local");

  assert.equal(board.weekOf, "2026-06-01");
  assert.equal(board.boxFolderUrl, "https://box.example/folder");
  assert.equal(board.deals.length, 1);
  assert.equal(
    board.deals[0]?.title,
    "600 Grumman Project Island - Procurement of Early Works Construction Package"
  );
  assert.equal(board.deals[0]?.threads[0]?.kind, "answer");
  assert.equal(board.deals[0]?.threads[1]?.kind, "question");
  assert.equal(board.deals[0]?.threads[2]?.kind, "package");
});

test("merges persisted Will notes into the payload-backed weekly board", () => {
  const board = buildInvestmentCommitteeBoard(
    buildAgentEnvelope(),
    [
      buildDeal({
        id: "persisted-grumman",
        title: "600 Grumman Project Island",
        question_notes: "Need sharper final question on Walmart timeline."
      })
    ],
    "local"
  );

  assert.equal(board.deals[0]?.persistedDealId, "persisted-grumman");
  assert.equal(board.deals[0]?.willNotes, "Need sharper final question on Walmart timeline.");
});

test("builds a current-week board from routed IC and Energy IC traffic", () => {
  const board = buildInvestmentCommitteeBoardFromSignals(
    [
      buildSignal({
        id: "package",
        title: "Susan Pi sent this week's Investment Committee package",
        summary: "This week's Investment Committee memos are ready for review.",
        sourceLabel: "Susan Pi",
        sourceUrl: "https://outlook.example/package"
      }),
      buildSignal({
        id: "hayward-question",
        title: "Energy Investment Committee questions on Hayward 39/43",
        summary: "Committee questions need to be consolidated for Hayward 39/43.",
        sourceLabel: "Re: Hayward 39/43 - Energy Investment Committee",
        sourceUrl: "https://outlook.example/hayward-thread"
      }),
      buildSignal({
        id: "hayward-answer",
        title: "Hayward 39/43 committee answers compiled",
        summary: "Weekend answers were compiled for Hayward 39/43.",
        sourceLabel: "Q&A Summary - Hayward 39/43",
        sourceUrl: "https://outlook.example/hayward-answer"
      }),
      buildSignal({
        id: "aurora-package",
        title: "Aurora battery storage memo circulated for Energy IC",
        summary: "Aurora battery storage memo was circulated for this week's Energy IC review.",
        sourceLabel: "Aurora Battery Storage - Energy IC memo",
        sourceUrl: "https://outlook.example/aurora"
      })
    ],
    [
      buildDeal({
        id: "persisted-hayward",
        title: "Hayward 39/43",
        question_notes: "Press on revised return thresholds."
      })
    ],
    {
      source: "agent_run",
      producedAt: "2026-06-03T23:07:00Z"
    }
  );

  assert.ok(board);
  assert.equal(board?.source, "agent_run");
  assert.equal(board?.weekOf, "2026-06-01");
  assert.equal(board?.packageEmailSubject, "Susan Pi sent this week's Investment Committee package");
  assert.equal(board?.deals.length, 2);
  assert.equal(board?.deals[0]?.title, "Hayward 39/43");
  assert.equal(board?.deals[0]?.persistedDealId, "persisted-hayward");
  assert.equal(board?.deals[0]?.willNotes, "Press on revised return thresholds.");
  assert.equal(board?.deals[0]?.peerQuestionSummary, "Committee questions need to be consolidated for Hayward 39/43.");
  assert.equal(board?.deals[0]?.answerSummary, "Weekend answers were compiled for Hayward 39/43.");
  assert.equal(board?.deals[1]?.title, "Aurora Battery Storage");
});

test("investment committee loader falls back to the checked-in fixture when the local payload is missing", async () => {
  const snapshot = await snapshotLocalInvestmentCommitteePayload();

  try {
    await removeLocalInvestmentCommitteePayload();
    const result = await loadInvestmentCommitteeAgentEnvelopeWithSource();

    assert.equal(result.source, "fixture");
    assert.equal(result.envelope.workflow, "investment_committee_weekly_cycle");
    assert.ok(result.envelope.deals.length > 0);
  } finally {
    await restoreLocalInvestmentCommitteePayload(snapshot);
  }
});

test("investment committee loader prefers the local weekly payload when present", async () => {
  const snapshot = await snapshotLocalInvestmentCommitteePayload();

  try {
    const envelope = buildAgentEnvelope({
      tenantLabel: "Local IC payload"
    });

    await mkdir(dirname(LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH), { recursive: true });
    await writeFile(
      LOCAL_INVESTMENT_COMMITTEE_AGENT_PAYLOAD_PATH,
      JSON.stringify(envelope, null, 2),
      "utf8"
    );

    const result = await loadInvestmentCommitteeAgentEnvelopeWithSource();

    assert.equal(result.source, "local");
    assert.equal(result.envelope.tenantLabel, "Local IC payload");
  } finally {
    await restoreLocalInvestmentCommitteePayload(snapshot);
  }
});

test("hard-clears the weekly board after Tuesday reset", () => {
  assert.equal(
    shouldClearInvestmentCommitteeBoard(
      { resetAt: "2026-06-02T23:59:59-07:00" },
      new Date("2026-06-03T08:00:00-07:00")
    ),
    true
  );
  assert.equal(
    shouldClearInvestmentCommitteeBoard(
      { resetAt: "2026-06-02T23:59:59-07:00" },
      new Date("2026-06-02T10:00:00-07:00")
    ),
    false
  );
});

test("expired fixture board stays visible while expired local board clears", () => {
  const cycle = { resetAt: "2026-06-02T23:59:59-07:00" };
  const now = new Date("2026-06-03T08:00:00-07:00");

  assert.equal(shouldHideInvestmentCommitteeBoard("fixture", cycle, now), false);
  assert.equal(shouldHideInvestmentCommitteeBoard("local", cycle, now), true);
});
