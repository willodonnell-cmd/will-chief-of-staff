import assert from "node:assert/strict";
import test from "node:test";

import { parseInvestmentCommitteeAgentEnvelope } from "../lib/investment-committee-agent";

test("parses a valid investment committee weekly-cycle payload", () => {
  const envelope = parseInvestmentCommitteeAgentEnvelope({
    producer: "chatgpt_agent",
    workflow: "investment_committee_weekly_cycle",
    producedAt: "2026-06-01T15:15:00.000Z",
    tenantLabel: "O'Donnell, Will",
    cycle: {
      weekOf: "2026-06-01",
      meetingDate: "2026-06-01T08:30:00-07:00",
      packageEmailSubject: "IC Memos for Monday, June 1",
      packageEmailUrl: "https://outlook.example/package",
      boxFolderUrl: "https://box.example/folder",
      questionsDueAt: "2026-06-05T17:00:00-07:00",
      resetAt: "2026-06-02T17:00:00-07:00"
    },
    deals: [
      {
        id: "600-grumman",
        title: "600 Grumman Project Island",
        memoUrl: null,
        peerQuestionSummary: "Peer questions were compiled.",
        answerSummary: "Weekend Q&A answers were circulated.",
        threads: [
          {
            id: "thread-1",
            subject: "Q&A Summary - 600 Grumman",
            sender: "Presenting team",
            kind: "answer",
            occurredAt: "2026-06-01T01:21:48Z",
            sourceUrl: "https://outlook.example/thread-1",
            summary: "Compiled Q&A answers for committee review.",
            mentionsWill: false
          }
        ]
      }
    ]
  });

  assert.equal(envelope.workflow, "investment_committee_weekly_cycle");
  assert.equal(envelope.cycle.boxFolderUrl, "https://box.example/folder");
  assert.equal(envelope.deals[0]?.threads[0]?.kind, "answer");
});

test("rejects invalid thread kinds in the weekly-cycle payload", () => {
  assert.throws(
    () =>
      parseInvestmentCommitteeAgentEnvelope({
        producer: "chatgpt_agent",
        workflow: "investment_committee_weekly_cycle",
        producedAt: "2026-06-01T15:15:00.000Z",
        tenantLabel: "O'Donnell, Will",
        cycle: {
          weekOf: "2026-06-01",
          meetingDate: null,
          packageEmailSubject: "IC Memos for Monday, June 1",
          packageEmailUrl: null,
          boxFolderUrl: null,
          questionsDueAt: null,
          resetAt: null
        },
        deals: [
          {
            id: "deal-1",
            title: "Deal 1",
            memoUrl: null,
            peerQuestionSummary: null,
            answerSummary: null,
            threads: [
              {
                id: "thread-1",
                subject: "Deal 1 thread",
                sender: "Someone",
                kind: "note",
                occurredAt: "2026-06-01T01:21:48Z",
                sourceUrl: null,
                summary: "Bad kind.",
                mentionsWill: false
              }
            ]
          }
        ]
      }),
    /must be one of/
  );
});
