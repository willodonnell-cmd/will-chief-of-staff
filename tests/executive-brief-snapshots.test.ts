import assert from "node:assert/strict";
import test from "node:test";

import {
  isExecutiveBriefBundleSubject,
  parseExecutiveBriefBundleEmail
} from "../lib/brief/executive-brief-snapshots";

test("detects Blackhawk Executive Brief bundle subjects", () => {
  assert.equal(isExecutiveBriefBundleSubject("BLACKHAWK_BRIEF_BUNDLE 7 AM"), true);
  assert.equal(isExecutiveBriefBundleSubject("blackhawk_brief_bundle manual"), true);
  assert.equal(isExecutiveBriefBundleSubject("Re: BLACKHAWK_BRIEF_BUNDLE 7 AM"), false);
});

test("parses human brief and fenced JSON bundle from CloudMailIn body", () => {
  const parsed = parseExecutiveBriefBundleEmail({
    destinationAddress: "priority+will@example.com",
    subject: "BLACKHAWK_BRIEF_BUNDLE 11 AM",
    forwardedAt: "Sun, 07 Jun 2026 18:00:00 -0700",
    headers: {
      "message-id": "<brief-123@example.com>"
    },
    rawText: [
      "Human brief:",
      "",
      "Board prep changed. Confirm the finance pack before the 3 PM block.",
      "",
      "```json",
      JSON.stringify(
        {
          slot: "11 AM",
          generated_at: "2026-06-07T18:02:00-07:00",
          display_date: "Sunday, Jun 7",
          items: [{ title: "Board prep changed" }]
        },
        null,
        2
      ),
      "```"
    ].join("\n")
  });

  assert.equal(parsed.subject, "BLACKHAWK_BRIEF_BUNDLE 11 AM");
  assert.equal(parsed.slot, "11 AM");
  assert.equal(parsed.generatedAt, "2026-06-08T01:02:00.000Z");
  assert.equal(parsed.displayDate, "Sunday, Jun 7");
  assert.equal(parsed.sourceMessageId, "brief-123@example.com");
  assert.match(parsed.humanBrief ?? "", /Board prep changed/);
  assert.deepEqual(parsed.jsonBundle, {
    slot: "11 AM",
    generated_at: "2026-06-07T18:02:00-07:00",
    display_date: "Sunday, Jun 7",
    items: [{ title: "Board prep changed" }]
  });
  assert.equal(parsed.structuredBrief, null);
  assert.deepEqual(parsed.validationWarnings, ["JSON bundle did not contain recognized Executive Brief sections."]);
});

test("falls back to manual slot and forwarded date when bundle lacks metadata", () => {
  const parsed = parseExecutiveBriefBundleEmail({
    destinationAddress: "priority+will@example.com",
    subject: "BLACKHAWK_BRIEF_BUNDLE",
    forwardedAt: "2026-06-08T02:00:00.000Z",
    rawText: "No structured bundle yet."
  });

  assert.equal(parsed.slot, "Manual");
  assert.equal(parsed.generatedAt, "2026-06-08T02:00:00.000Z");
  assert.equal(parsed.displayDate, null);
  assert.equal(parsed.jsonBundle, null);
  assert.equal(parsed.structuredBrief, null);
  assert.equal(parsed.humanBrief, "No structured bundle yet.");
});

test("strips Will email signature from the human brief", () => {
  const parsed = parseExecutiveBriefBundleEmail({
    destinationAddress: "priority+will@example.com",
    subject: "BLACKHAWK_BRIEF_BUNDLE Manual",
    forwardedAt: "2026-06-08T02:00:00.000Z",
    rawText: [
      "Human brief:",
      "Read this summary before the task candidates.",
      "",
      "Will O'Donnell",
      "|",
      "MD, Global Corporate  Development & Growth",
      "Pier 1, Bay 1 | San Francisco | California | 94111 | United States of America",
      "Direct +1 (415) 733-9489 | Mobile +1 (415) 517-6244 | WODonnell@prologis.com",
      "www.prologis.com | Follow us on LinkedIn and Facebook",
      "The information transmitted, including any attachments, is intended only for the person or entity to which it is addressed and may contain confidential and/or privileged material.",
      "signature for O'Donnell, Will"
    ].join("\n")
  });

  assert.equal(parsed.humanBrief, "Read this summary before the task candidates.");
  assert.doesNotMatch(parsed.humanBrief ?? "", /WODonnell@prologis\.com/);
  assert.doesNotMatch(parsed.humanBrief ?? "", /signature for O'Donnell, Will/);
});

test("normalizes marked Executive Brief JSON into structured sections", () => {
  const parsed = parseExecutiveBriefBundleEmail({
    destinationAddress: "priority+will@example.com",
    subject: "BLACKHAWK_BRIEF_BUNDLE Manual",
    forwardedAt: "2026-06-08T02:00:00.000Z",
    rawText: [
      "Human brief:",
      "Focus on the board memo and delegate the data-room follow-up.",
      "",
      "BLACKHAWK_JSON_START",
      JSON.stringify({
        contract_version: "executive_brief.v1",
        slot: "Manual",
        generated_at: "2026-06-07T19:04:00-07:00",
        command_summary: ["Board memo is the highest leverage item."],
        top_3_executive_moves: [
          {
            id: "move-board-memo",
            title: "Finish board memo",
            summary: "Finance comments arrived after the last draft.",
            source: "Outlook",
            priority: "high",
            recommended_action: "Send revised memo before the morning review."
          }
        ],
        decisions_needed: ["Approve whether to move the portfolio review."],
        meeting_prep: [{ title: "9 AM partner sync", action: "Bring the IC follow-up list." }],
        carry_forward: [{ title: "Data-room owner still unresolved" }],
        task_candidates: [{ title: "Ask Maya for data-room owner", priority: "medium" }]
      }),
      "BLACKHAWK_JSON_END"
    ].join("\n")
  });

  assert.equal(parsed.contractVersion, "executive_brief.v1");
  assert.deepEqual(parsed.validationWarnings, []);
  assert.equal(parsed.structuredBrief?.commandSummary[0], "Board memo is the highest leverage item.");
  assert.equal(parsed.structuredBrief?.topMoves[0]?.title, "Finish board memo");
  assert.equal(parsed.structuredBrief?.topMoves[0]?.recommendedAction, "Send revised memo before the morning review.");
  assert.equal(parsed.structuredBrief?.decisionsNeeded[0]?.title, "Approve whether to move the portfolio review.");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.recommendedAction, "Bring the IC follow-up list.");
  assert.equal(parsed.structuredBrief?.carryForward[0]?.title, "Data-room owner still unresolved");
  assert.equal(parsed.structuredBrief?.taskCandidates[0]?.priority, "medium");
  assert.match(parsed.humanBrief ?? "", /Focus on the board memo/);
  assert.doesNotMatch(parsed.humanBrief ?? "", /BLACKHAWK_JSON_START/);
});
