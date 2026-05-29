import test from "node:test";
import assert from "node:assert/strict";

import { normalizeOutlookMessageToWorkSignal } from "../lib/work-signals/normalize-outlook";
import { scoreExecutiveRelevance } from "../lib/work-signals/ranking";

test("normalizes an Outlook message into a canonical WorkSignal", () => {
  const signal = normalizeOutlookMessageToWorkSignal({
    id: "msg-1",
    conversationId: "thread-1",
    subject: "[Board] Please send updated numbers by 2026-05-30",
    receivedDateTime: "2026-05-27T15:00:00.000Z",
    bodyPreview: "Please send the updated board numbers and follow up with finance.",
    webLink: "https://outlook.office.com/mail/msg-1",
    importance: "high",
    inferenceClassification: "focused",
    isRead: false,
    hasAttachments: true,
    flag: {
      flagStatus: "flagged"
    },
    from: {
      emailAddress: {
        name: "Jordan Lee",
        address: "jordan@acme.com"
      }
    },
    toRecipients: [
      {
        emailAddress: {
          name: "Will O'Donnell",
          address: "will@example.com"
        }
      }
    ],
    ccRecipients: []
  });

  assert.equal(signal.source, "outlook");
  assert.equal(signal.sourceId, "msg-1");
  assert.equal(signal.senderOrOwner, "Jordan Lee");
  assert.equal(signal.projects[0], "Board");
  assert.equal(signal.dueDate, "2026-05-30");
  assert.equal(signal.followUpRequired, true);
  assert.equal(signal.companies[0], "Acme");
  assert.ok(signal.extractedActions.some((entry) => entry.includes("send updated numbers")));
});

test("scores executive relevance conservatively from WorkSignal fields", () => {
  const signal = normalizeOutlookMessageToWorkSignal({
    id: "msg-2",
    subject: "Can you review the candidate packet?",
    receivedDateTime: new Date().toISOString(),
    bodyPreview: "Can you review the candidate packet and let me know today?",
    importance: "high",
    isRead: false,
    hasAttachments: true,
    inferenceClassification: "focused",
    flag: {
      flagStatus: "flagged"
    },
    from: {
      emailAddress: {
        name: "Alex Chen",
        address: "alex@portfolio.com"
      }
    }
  });

  const relevance = scoreExecutiveRelevance(signal);

  assert.equal(relevance.level, "high");
  assert.ok(relevance.score >= 9);
  assert.ok(relevance.reasons.some((reason) => reason.code === "direct_ask"));
});

