import assert from "node:assert/strict";
import test from "node:test";

import { collectCalendarSource } from "../lib/microsoft-graph/calendar";
import { MicrosoftGraphClient } from "../lib/microsoft-graph/client";
import { collectOutlookSource } from "../lib/microsoft-graph/outlook";
import { collectTeamsSource } from "../lib/microsoft-graph/teams";

test("Outlook adapter normalizes mocked Graph mail messages with stable source records", async () => {
  const client = new MicrosoftGraphClient("access", async () =>
    new Response(
      JSON.stringify({
        value: [
          {
            id: "message-1",
            conversationId: "conversation-1",
            subject: "Please review customer decision",
            sender: { emailAddress: { name: "Alex", address: "alex@example.com" } },
            from: { emailAddress: { name: "Alex", address: "alex@example.com" } },
            toRecipients: [{ emailAddress: { name: "Will O'Donnell" } }],
            ccRecipients: [],
            receivedDateTime: "2026-06-05T12:00:00Z",
            webLink: "https://outlook/message-1",
            bodyPreview: "Can you review this before the customer meeting?",
            importance: "high",
            hasAttachments: true,
            categories: ["Customer"]
          }
        ]
      })
    )
  );

  const result = await collectOutlookSource(client, { now: "2026-06-05T13:00:00Z" });

  assert.equal(result.coverage.status, "included");
  assert.equal(result.records[0]?.id, "message-1");
  assert.equal(result.records[0]?.conversationId, "conversation-1");
  assert.equal(result.records[0]?.senderName, "Alex");
});

test("Outlook adapter returns empty coverage for an empty inbox", async () => {
  const client = new MicrosoftGraphClient("access", async () => new Response(JSON.stringify({ value: [] })));
  const result = await collectOutlookSource(client, { now: "2026-06-05T13:00:00Z" });

  assert.equal(result.coverage.status, "empty");
  assert.deepEqual(result.records, []);
});

test("Outlook adapter maps Graph permission errors to source coverage instead of throwing", async () => {
  const client = new MicrosoftGraphClient("access", async () =>
    new Response(JSON.stringify({ error: { code: "Forbidden", message: "Mail denied" } }), { status: 403 })
  );
  const result = await collectOutlookSource(client, { now: "2026-06-05T13:00:00Z" });

  assert.equal(result.coverage.status, "permission_denied");
  assert.equal(result.errors[0]?.source, "outlook");
});

test("Calendar adapter normalizes mocked events and detects empty calendars", async () => {
  const populated = new MicrosoftGraphClient("access", async () =>
    new Response(
      JSON.stringify({
        value: [
          {
            id: "event-1",
            subject: "Board prep",
            organizer: { emailAddress: { name: "Noemy", address: "noemy@example.com" } },
            attendees: [{ emailAddress: { name: "Will O'Donnell" } }],
            start: { dateTime: "2026-06-06T15:00:00", timeZone: "UTC" },
            end: { dateTime: "2026-06-06T16:00:00", timeZone: "UTC" },
            webLink: "https://outlook/event-1",
            location: { displayName: "HQ" },
            isOnlineMeeting: true,
            onlineMeetingProvider: "teamsForBusiness",
            bodyPreview: "Prepare board update.",
            importance: "high"
          }
        ]
      })
    )
  );
  const populatedResult = await collectCalendarSource(populated, { now: "2026-06-05T13:00:00Z" });
  assert.equal(populatedResult.coverage.status, "included");
  assert.equal(populatedResult.records[0]?.id, "event-1");
  assert.equal(populatedResult.records[0]?.subject, "Board prep");

  const empty = new MicrosoftGraphClient("access", async () => new Response(JSON.stringify({ value: [] })));
  const emptyResult = await collectCalendarSource(empty, { now: "2026-06-05T13:00:00Z" });
  assert.equal(emptyResult.coverage.status, "empty");
});

test("Teams adapter normalizes messages and safely reports unavailable permissions", async () => {
  const client = new MicrosoftGraphClient("access", async (input) => {
    if (String(input).includes("/me/chats?")) {
      return new Response(JSON.stringify({ value: [{ id: "chat-1", topic: "Strategy", chatType: "group" }] }));
    }

    return new Response(
      JSON.stringify({
        value: [
          {
            id: "message-1",
            createdDateTime: "2026-06-05T12:30:00Z",
            webUrl: "https://teams/message-1",
            from: { user: { displayName: "JT Steenkamp" } },
            body: { content: "<p>Please follow up on the budget blocker.</p>" }
          }
        ]
      })
    );
  });

  const result = await collectTeamsSource(client, { now: "2026-06-05T13:00:00Z" });
  assert.equal(result.coverage.status, "included");
  assert.equal(result.records[0]?.messageId, "message-1");
  assert.equal(result.records[0]?.preview, "Please follow up on the budget blocker.");

  const denied = new MicrosoftGraphClient("access", async () =>
    new Response(JSON.stringify({ error: { code: "Forbidden", message: "Teams denied" } }), { status: 403 })
  );
  const deniedResult = await collectTeamsSource(denied, { now: "2026-06-05T13:00:00Z" });
  assert.equal(deniedResult.coverage.status, "permission_denied");
  assert.match(deniedResult.coverage.reason ?? "", /Chat\.Read/);
});
