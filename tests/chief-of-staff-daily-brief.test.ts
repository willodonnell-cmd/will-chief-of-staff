import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyBriefData } from "../lib/chief-of-staff-daily-brief";
import type { LibraryItemSummary } from "../lib/capture-library";
import type { PriorityInboxItem } from "../lib/priority-inbox";

const baseInboxItems: PriorityInboxItem[] = [
  {
    id: "inbox-decision",
    source: "outlook",
    sourceLabel: "Outlook",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://outlook.office.com/mail/inbox-decision",
    externalMessageId: "msg-decision",
    conversationId: "thread-decision",
    receivedAt: "2026-05-27T15:00:00.000Z",
    sender: "Jordan Lee",
    senderRole: "jordan@acme.com",
    threadTitle: "Please decide on the hiring scorecard",
    primaryLine: "Review the scorecard decision from Jordan.",
    summary: "Please decide whether the scorecard stays narrow before the board prep note goes out.",
    timeLabel: "Today",
    visibleState: "high_priority",
    whySurfaced: "Decision request from Outlook.",
    supportingSignals: ["Decision request", "High importance"],
    recommendedAction: "create_task",
    dispositionReason: "decision_needed",
    sourceMetadata: {
      importance: "high",
      inferenceClassification: "focused",
      isRead: false,
      hasAttachments: true,
      lastModifiedDateTime: "2026-05-27T15:10:00.000Z"
    }
  },
  {
    id: "inbox-reply",
    source: "outlook",
    sourceLabel: "Outlook",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://outlook.office.com/mail/inbox-reply",
    externalMessageId: "msg-reply",
    conversationId: "thread-reply",
    receivedAt: "2026-05-27T16:00:00.000Z",
    sender: "Avery Chen",
    senderRole: "avery@acme.com",
    threadTitle: "Can you confirm the investor memo timing?",
    primaryLine: "Confirm the investor memo timing.",
    summary: "Can you confirm whether the investor memo will be ready before tomorrow morning?",
    timeLabel: "Today",
    visibleState: "needs_review",
    whySurfaced: "Follow-up ask from Outlook.",
    supportingSignals: ["Unread", "Follow-up needed"],
    recommendedAction: "mark_handled",
    dispositionReason: "reply_needed",
    sourceMetadata: {
      importance: "normal",
      inferenceClassification: "focused",
      isRead: false,
      hasAttachments: false
    }
  },
  {
    id: "inbox-noise",
    source: "outlook",
    sourceLabel: "Outlook",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://outlook.office.com/mail/inbox-noise",
    externalMessageId: "msg-noise",
    conversationId: "thread-noise",
    receivedAt: "2026-05-27T12:00:00.000Z",
    sender: "Vendor Bot",
    senderRole: "vendor@example.com",
    threadTitle: "Quarterly vendor update",
    primaryLine: "Ignore the vendor update.",
    summary: "Generic vendor update with no action.",
    timeLabel: "Today",
    visibleState: "dismissed",
    whySurfaced: "Low-value vendor pitch.",
    supportingSignals: ["Low-value vendor pitch"],
    recommendedAction: "mark_handled",
    dispositionReason: "low_value"
  }
];

const baseLibraryItems: LibraryItemSummary[] = [
  {
    id: "task-meeting",
    type: "task",
    title: "Board prep checklist",
    preview: "Finalize talking points and confirm the memo is ready.",
    sourcePath: "/capture",
    privacy: "open",
    status: "active",
    capturedAt: "2026-05-27T09:00:00.000Z",
    lastActiveAt: "2026-05-27T10:00:00.000Z",
    archivedAt: null,
    completedAt: null,
    dueAt: "2026-05-28T16:00:00.000Z",
    saveState: "saved",
    saveStateDetail: "",
    localOnly: false,
    note: null,
    task: {
      title: "Board prep checklist",
      description: "Finalize the board prep checklist.",
      nextStep: "Confirm the memo and the narrowed hiring brief.",
      desiredOutcome: "Walk into board prep with one clean path.",
      status: "active",
      dueAt: "2026-05-28T16:00:00.000Z",
      priority: "high",
      categoryId: "calendar-1",
      categoryName: "Calendar",
      categoryIsFallback: false,
      linkedInitiativeId: "initiative-1",
      linkedInitiativeTitle: "Board prep"
    },
    originCapture: null,
    sourceLinkage: null
  },
  {
    id: "task-follow-up",
    type: "task",
    title: "Follow up with Jordan",
    preview: "Send the final scorecard framing after the decision lands.",
    sourcePath: "/capture",
    privacy: "open",
    status: "active",
    capturedAt: "2026-05-27T08:00:00.000Z",
    lastActiveAt: "2026-05-27T11:00:00.000Z",
    archivedAt: null,
    completedAt: null,
    dueAt: null,
    saveState: "saved",
    saveStateDetail: "",
    localOnly: false,
    note: null,
    task: {
      title: "Follow up with Jordan",
      description: "Follow up with Jordan on the hiring scorecard.",
      nextStep: "Send the narrowed framing once the decision is final.",
      desiredOutcome: "Jordan has the final scorecard framing.",
      status: "active",
      dueAt: null,
      priority: "medium",
      categoryId: "person-1",
      categoryName: "Person",
      categoryIsFallback: false,
      linkedInitiativeId: null,
      linkedInitiativeTitle: null
    },
    originCapture: null,
    sourceLinkage: null
  },
  {
    id: "note-fyi",
    type: "note",
    title: "Investor memo status",
    preview: "Saved reference from the board prep thread so the context stays nearby without becoming a task.",
    sourcePath: "/capture",
    privacy: "open",
    status: "active",
    capturedAt: "2026-05-27T07:30:00.000Z",
    lastActiveAt: "2026-05-27T09:30:00.000Z",
    archivedAt: null,
    completedAt: null,
    dueAt: null,
    saveState: "saved",
    saveStateDetail: "",
    localOnly: false,
    note: {
      title: "Investor memo status",
      body: "Saved reference from the board prep thread.",
      linkedInitiativeId: "initiative-1",
      linkedInitiativeTitle: "Board prep"
    },
    task: null,
    originCapture: null,
    sourceLinkage: {
      priorityInboxItemId: "handled-reference",
      source: "outlook",
      sourceLabel: "Outlook",
      sourceFamily: "email",
      ingestionMode: "live_adapter",
      nativeSourceLink: "https://outlook.office.com/mail/reference",
      fallbackDetailHref: null,
      externalMessageId: "msg-reference",
      conversationId: "thread-reference",
      receivedAt: "2026-05-27T07:00:00.000Z",
      sender: "Avery Chen",
      senderRole: "avery@acme.com",
      threadTitle: "Investor memo status",
      primaryLine: "Keep the memo reference nearby.",
      summary: "Saved reference from the board prep thread.",
      metadata: null,
      forwardedEmailSource: null
    }
  },
  {
    id: "note-recent",
    type: "note",
    title: "Hallway note",
    preview: "Founder mentioned a financing angle worth preserving.",
    sourcePath: "/capture",
    privacy: "open",
    status: "active",
    capturedAt: "2026-05-27T12:30:00.000Z",
    lastActiveAt: "2026-05-27T12:30:00.000Z",
    archivedAt: null,
    completedAt: null,
    dueAt: null,
    saveState: "saved",
    saveStateDetail: "",
    localOnly: false,
    note: {
      title: "Hallway note",
      body: "Founder mentioned a financing angle worth preserving.",
      linkedInitiativeId: null,
      linkedInitiativeTitle: null
    },
    task: null,
    originCapture: null,
    sourceLinkage: null
  }
];

test("buildDailyBriefData classifies inbox and capture records into the source-grounded sections", () => {
  const brief = buildDailyBriefData({
    priorityInboxItems: baseInboxItems,
    libraryItems: baseLibraryItems,
    now: new Date("2026-05-27T17:00:00.000Z")
  });

  assert.equal(brief.decisionsNeeded.length, 1);
  assert.equal(brief.decisionsNeeded[0]?.title, "Please decide on the hiring scorecard");

  assert.equal(brief.peopleWaitingOnWill.length, 1);
  assert.equal(brief.peopleWaitingOnWill[0]?.counterparty, "Avery Chen");

  assert.equal(brief.priorityInboxItems.length, 0);

  assert.equal(brief.meetingPrep.length, 1);
  assert.equal(brief.meetingPrep[0]?.meetingTitle, "Board prep checklist");

  assert.equal(brief.followUpsOpenLoops.length, 1);
  assert.equal(brief.followUpsOpenLoops[0]?.title, "Follow up with Jordan");

  assert.equal(brief.strategicFyis.length, 1);
  assert.equal(brief.strategicFyis[0]?.title, "Investor memo status");

  assert.equal(brief.recentlyCaptured.length, 1);
  assert.equal(brief.recentlyCaptured[0]?.title, "Hallway note");

  assert.equal(brief.lowValueNoiseFiltered.count, 1);
});
