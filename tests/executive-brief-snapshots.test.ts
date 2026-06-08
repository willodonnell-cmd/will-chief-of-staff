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
  assert.equal(parsed.humanBrief, "No structured bundle yet.");
});
