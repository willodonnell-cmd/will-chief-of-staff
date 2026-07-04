import assert from "node:assert/strict";
import test from "node:test";

import {
  isExecutiveBriefBundleSubject,
  listExecutiveBriefSnapshotsForUser,
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

test("reports missing or invalid CloudMailIn Executive Brief JSON bundles", () => {
  const missing = parseExecutiveBriefBundleEmail({
    destinationAddress: "priority+will@example.com",
    subject: "BLACKHAWK_BRIEF_BUNDLE 11 AM",
    rawText: "Human brief only. No structured bundle was included."
  });
  const invalid = parseExecutiveBriefBundleEmail({
    destinationAddress: "priority+will@example.com",
    subject: "BLACKHAWK_BRIEF_BUNDLE 11 AM",
    rawText: ["Human brief first.", "", "```json", "{\"slot\":", "```"].join("\n")
  });

  assert.equal(missing.jsonBundle, null);
  assert.equal(invalid.jsonBundle, null);
  assert.deepEqual(missing.validationWarnings, ["No JSON object bundle was found."]);
  assert.deepEqual(invalid.validationWarnings, ["No JSON object bundle was found."]);
  assert.match(missing.humanBrief ?? "", /Human brief only/);
  assert.match(invalid.humanBrief ?? "", /Human brief first/);
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
            source_lane: "email",
            source_refs: [{ sourceType: "outlook", id: "message-1", url: "https://outlook.example/message-1" }],
            sender: "Maya Finance",
            sender_email: "maya@example.com",
            source_url: "https://outlook.example/message-1",
            source_label: "Finance approval thread",
            received_at: "2026-06-07T18:45:00-07:00",
            priority: "high",
            recommended_action: "Send revised memo before the morning review."
          }
        ],
        decisions_needed: ["Approve whether to move the portfolio review."],
        meeting_prep: [
          {
            title: "9 AM partner sync",
            action: "Bring the IC follow-up list.",
            source_lane: "calendar_meetings",
            source_refs: [{ sourceType: "calendar", id: "event-1" }],
            calendar_event_id: "event-1",
            calendar_source_system_id: "outlook",
            start_at: "2026-06-08T09:00:00-07:00",
            end_at: "2026-06-08T09:30:00-07:00",
            timezone: "America/Los_Angeles",
            organizer: "Amelia Hart",
            organizer_email: "amelia@example.com",
            attendees: ["Will O'Donnell", { name: "Amelia Hart", email: "amelia@example.com", responseStatus: "accepted" }],
            location_or_link: "https://outlook.example/calendar-1",
            description_summary: "Partner sync agenda.",
            related_company_names: ["Prologis"],
            related_people_names: ["Amelia Hart"],
            internal_external_classification: "internal",
            priority_reasons: ["IC follow-up is due."]
          }
        ],
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
  assert.equal(parsed.structuredBrief?.topMoves[0]?.sourceLane, "email");
  assert.deepEqual(parsed.structuredBrief?.topMoves[0]?.sourceRefs, [
    { sourceType: "outlook", id: "message-1", url: "https://outlook.example/message-1" }
  ]);
  assert.equal(parsed.structuredBrief?.topMoves[0]?.sourceLabel, "Finance approval thread");
  assert.equal(parsed.structuredBrief?.topMoves[0]?.senderName, "Maya Finance");
  assert.equal(parsed.structuredBrief?.topMoves[0]?.senderEmail, "maya@example.com");
  assert.equal(parsed.structuredBrief?.topMoves[0]?.sourceUrl, "https://outlook.example/message-1");
  assert.equal(parsed.structuredBrief?.topMoves[0]?.receivedAt, "2026-06-08T01:45:00.000Z");
  assert.equal(parsed.structuredBrief?.topMoves[0]?.recommendedAction, "Send revised memo before the morning review.");
  assert.equal(parsed.structuredBrief?.decisionsNeeded[0]?.title, "Approve whether to move the portfolio review.");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.recommendedAction, "Bring the IC follow-up list.");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.sourceLane, "calendar_meetings");
  assert.deepEqual(parsed.structuredBrief?.meetingPrep[0]?.sourceRefs, [{ sourceType: "calendar", id: "event-1" }]);
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.calendarEventId, "event-1");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.calendarSourceSystemId, "outlook");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.startAt, "2026-06-08T16:00:00.000Z");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.endAt, "2026-06-08T16:30:00.000Z");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.timezone, "America/Los_Angeles");
  assert.deepEqual(parsed.structuredBrief?.meetingPrep[0]?.attendees, [
    "Will O'Donnell",
    { name: "Amelia Hart", email: "amelia@example.com", responseStatus: "accepted" }
  ]);
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.organizerName, "Amelia Hart");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.organizerEmail, "amelia@example.com");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.locationOrLink, "https://outlook.example/calendar-1");
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.descriptionSummary, "Partner sync agenda.");
  assert.deepEqual(parsed.structuredBrief?.meetingPrep[0]?.relatedCompanyNames, ["Prologis"]);
  assert.deepEqual(parsed.structuredBrief?.meetingPrep[0]?.relatedPeopleNames, ["Amelia Hart"]);
  assert.equal(parsed.structuredBrief?.meetingPrep[0]?.internalExternalClassification, "internal");
  assert.deepEqual(parsed.structuredBrief?.meetingPrep[0]?.priorityReasons, ["IC follow-up is due."]);
  assert.equal(parsed.structuredBrief?.carryForward[0]?.title, "Data-room owner still unresolved");
  assert.equal(parsed.structuredBrief?.taskCandidates[0]?.priority, "medium");
  assert.match(parsed.humanBrief ?? "", /Focus on the board memo/);
  assert.doesNotMatch(parsed.humanBrief ?? "", /BLACKHAWK_JSON_START/);
});

test("normalizes old thin Executive Brief bundles without requiring metadata", () => {
  const parsed = parseExecutiveBriefBundleEmail({
    destinationAddress: "priority+will@example.com",
    subject: "BLACKHAWK_BRIEF_BUNDLE Manual",
    forwardedAt: "2026-06-08T02:00:00.000Z",
    rawText: JSON.stringify({
      top_moves: [
        {
          id: "thin-1",
          title: "Reply to investor",
          summary: "Investor asked for the latest package.",
          source: "Outlook",
          priority: "high",
          recommendedAction: "Reply today",
          dueAt: "2026-06-08T22:00:00.000Z"
        }
      ]
    })
  });

  const item = parsed.structuredBrief?.topMoves[0];
  assert.equal(item?.title, "Reply to investor");
  assert.equal(item?.senderName, null);
  assert.equal(item?.senderEmail, null);
  assert.equal(item?.sourceUrl, null);
  assert.deepEqual(item?.sourceRefs, []);
  assert.deepEqual(item?.attendees, []);
});

test("loads rich json bundle metadata when stored structured brief was produced by an older thin parser", async () => {
  const row = {
    id: "snapshot-rich-json",
    subject: "BLACKHAWK_BRIEF_BUNDLE Metadata Test",
    slot: "Manual",
    generated_at: "2026-06-09T05:04:05.000Z",
    display_date: "June 8, 2026",
    raw_email_body: "Human brief\nBLACKHAWK_JSON_START\n{}\nBLACKHAWK_JSON_END",
    human_brief: "Human brief",
    json_bundle: {
      contract_version: "executive_brief.v1",
      top_3_executive_moves: [
        {
          id: "email-camel",
          title: "Confirm calendar deliverables",
          summary: "Camille sent the source email.",
          sourceLane: "email",
          sourceRefs: [{ sourceType: "outlook", url: "https://outlook.example/message" }],
          senderName: "Camille Garcia-Wong",
          senderEmail: "camille@example.com",
          sourceUrl: "https://outlook.example/message",
          sourceLabel: "BP Planning Calendar",
          receivedAt: "2026-06-09T05:00:00.000Z"
        }
      ],
      meeting_prep: [
        {
          id: "meeting-camel",
          title: "Rabine & Prologis catch-up",
          sourceLane: "calendar_meetings",
          sourceUrl: "https://outlook.example/calendar",
          startAt: "2026-06-09T18:00:00.000Z",
          endAt: "2026-06-09T18:30:00.000Z",
          attendees: [{ name: "Will O'Donnell", email: "will@example.com", responseStatus: "accepted" }],
          organizerName: "Kristina Nicolaou",
          organizerEmail: "kristina@example.com",
          locationOrLink: "Conference Room"
        }
      ]
    },
    structured_brief: {
      commandSummary: [],
      topMoves: [
        {
          id: "email-camel",
          title: "Confirm calendar deliverables",
          summary: "Camille sent the source email.",
          source: null,
          priority: null,
          recommendedAction: null,
          dueAt: null
        }
      ],
      decisionsNeeded: [],
      meetingPrep: [],
      carryForward: [],
      taskCandidates: []
    },
    contract_version: "executive_brief.v1",
    validation_warnings: [],
    source_message_id: "message-rich-json",
    created_at: "2026-06-09T05:05:00.000Z"
  };
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    returns: () => Promise.resolve({ data: [row], error: null })
  };
  const fakeClient = {
    from: () => query
  };

  const snapshots = await listExecutiveBriefSnapshotsForUser({
    client: fakeClient as never,
    userId: "user-1"
  });

  const emailItem = snapshots[0]?.structuredBrief?.topMoves[0];
  const meetingItem = snapshots[0]?.structuredBrief?.meetingPrep[0];
  assert.equal(emailItem?.sourceLane, "email");
  assert.equal(emailItem?.senderName, "Camille Garcia-Wong");
  assert.equal(emailItem?.senderEmail, "camille@example.com");
  assert.equal(emailItem?.sourceUrl, "https://outlook.example/message");
  assert.deepEqual(emailItem?.sourceRefs, [{ sourceType: "outlook", url: "https://outlook.example/message" }]);
  assert.equal(meetingItem?.sourceLane, "calendar_meetings");
  assert.equal(meetingItem?.startAt, "2026-06-09T18:00:00.000Z");
  assert.deepEqual(meetingItem?.attendees, [
    { name: "Will O'Donnell", email: "will@example.com", responseStatus: "accepted" }
  ]);
});
